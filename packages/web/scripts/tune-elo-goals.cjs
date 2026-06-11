/*
 * Sweep de TOTAL_GOALS e SUP_DIV do mapeamento Elo->gols (lib/elo.ts eloToLambdas).
 * Roda o walk-forward do Elo UMA vez (o Elo independe desses parâmetros), guarda os
 * pares pré-jogo (dr = ratingHome - ratingAway, resultado) e varre a grade barato,
 * avaliando Brier/log-loss de 1X2/Over/BTTS contra o baseline (taxa-base constante).
 * A matemática (Elo + Poisson/Dixon-Coles) espelha lib/elo.ts e lib/probability.ts.
 *
 * Uso: node scripts/tune-elo-goals.cjs
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const BASE = 1500;
const HOME_ADV = 65;
const MIN_LAMBDA = 0.15;
const RHO = -0.13;
const MAX_GOALS = 10;
const MIN_PLAYED = 5;

function loadEnv() {
  const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
  const get = (k) => { const m = env.match(new RegExp('^' + k + '=(.*)$', 'm')); return m ? m[1].trim().replace(/^["']|["']$/g, '') : ''; };
  return { url: get('NEXT_PUBLIC_SUPABASE_URL'), key: get('SUPABASE_SERVICE_ROLE_KEY') };
}

// --- Elo (espelha lib/elo.ts) ---
const goalMult = (gd) => (gd <= 1 ? 1 : gd === 2 ? 1.5 : (11 + gd) / 8);
function eloDelta(rh, ra, hg, ag, neutral, importance) {
  const dr = rh - ra + (neutral ? 0 : HOME_ADV);
  const we = 1 / (1 + 10 ** (-dr / 400));
  const w = hg > ag ? 1 : hg < ag ? 0 : 0.5;
  return importance * goalMult(Math.abs(hg - ag)) * (w - we);
}

// --- Poisson + Dixon-Coles (espelha lib/probability.ts outcomesFromLambdas) ---
const fact = (n) => { let f = 1; for (let i = 2; i <= n; i++) f *= i; return f; };
const poisson = (k, l) => (Math.exp(-l) * l ** k) / fact(k);
function tau(i, j, lh, la) {
  if (i === 0 && j === 0) return 1 - lh * la * RHO;
  if (i === 0 && j === 1) return 1 + lh * RHO;
  if (i === 1 && j === 0) return 1 + la * RHO;
  if (i === 1 && j === 1) return 1 - RHO;
  return 1;
}
function outcomes(lh, la) {
  const ph = Array.from({ length: MAX_GOALS + 1 }, (_, k) => poisson(k, lh));
  const pa = Array.from({ length: MAX_GOALS + 1 }, (_, k) => poisson(k, la));
  let total = 0; const grid = [];
  for (let i = 0; i <= MAX_GOALS; i++) { grid[i] = []; for (let j = 0; j <= MAX_GOALS; j++) { const p = ph[i] * pa[j] * tau(i, j, lh, la); grid[i][j] = p; total += p; } }
  let hw = 0, dr = 0, aw = 0, over = 0, btts = 0;
  for (let i = 0; i <= MAX_GOALS; i++) for (let j = 0; j <= MAX_GOALS; j++) {
    const p = grid[i][j] / total;
    if (i > j) hw += p; else if (i === j) dr += p; else aw += p;
    if (i + j >= 3) over += p;
    if (i >= 1 && j >= 1) btts += p;
  }
  return { hw, dr, aw, over, btts };
}

const clip = (p) => Math.min(1 - 1e-15, Math.max(1e-15, p));
const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

// Avalia uma combinação (TG, SD) sobre os pares pré-jogo.
function evaluate(pairs, TG, SD) {
  const brierX2 = [], brierOver = [], brierBtts = [], llX2 = [], llOver = [], llBtts = [];
  for (const e of pairs) {
    const sup = e.dr / SD;
    const lh = Math.max(MIN_LAMBDA, TG / 2 + sup / 2);
    const la = Math.max(MIN_LAMBDA, TG / 2 - sup / 2);
    const o = outcomes(lh, la);
    const yH = e.outcome === 'H' ? 1 : 0, yD = e.outcome === 'D' ? 1 : 0, yA = e.outcome === 'A' ? 1 : 0;
    brierX2.push((o.hw - yH) ** 2 + (o.dr - yD) ** 2 + (o.aw - yA) ** 2);
    brierOver.push((o.over - e.over) ** 2);
    brierBtts.push((o.btts - e.btts) ** 2);
    const pOut = e.outcome === 'H' ? o.hw : e.outcome === 'D' ? o.dr : o.aw;
    llX2.push(-Math.log(clip(pOut)));
    llOver.push(-(e.over * Math.log(clip(o.over)) + (1 - e.over) * Math.log(clip(1 - o.over))));
    llBtts.push(-(e.btts * Math.log(clip(o.btts)) + (1 - e.btts) * Math.log(clip(1 - o.btts))));
  }
  return {
    brier: { x2: mean(brierX2), over: mean(brierOver), btts: mean(brierBtts) },
    ll: { x2: mean(llX2), over: mean(llOver), btts: mean(llBtts) },
  };
}

async function main() {
  const { url, key } = loadEnv();
  const s = createClient(url, key);

  // carrega histórico (paginado)
  const games = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await s
      .from('international_matches')
      .select('played_at, home_espn_id, away_espn_id, home_goals, away_goals, neutral, importance')
      .order('played_at', { ascending: true })
      .range(from, from + 999);
    if (error) throw error;
    if (!data?.length) break;
    for (const g of data) games.push({
      date: g.played_at, home: String(g.home_espn_id), away: String(g.away_espn_id),
      hg: g.home_goals, ag: g.away_goals, neutral: !!g.neutral, importance: g.importance,
    });
    if (data.length < 1000) break;
  }
  games.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  console.log(`international_matches: ${games.length} jogos`);

  // walk-forward: captura dr pré-jogo + resultado (independe de TG/SD)
  const rating = new Map(), played = new Map();
  const get = (id) => rating.get(id) ?? BASE;
  const pairs = [];
  let skipped = 0;
  for (const g of games) {
    if (!g.home || !g.away) { skipped++; continue; }
    const rh = get(g.home), ra = get(g.away);
    if ((played.get(g.home) ?? 0) >= MIN_PLAYED && (played.get(g.away) ?? 0) >= MIN_PLAYED) {
      pairs.push({
        dr: rh - ra, // sede neutra (sem HOME_ADV no mapeamento Elo->gols)
        outcome: g.hg > g.ag ? 'H' : g.hg < g.ag ? 'A' : 'D',
        over: g.hg + g.ag >= 3 ? 1 : 0,
        btts: g.hg >= 1 && g.ag >= 1 ? 1 : 0,
      });
    } else skipped++;
    const d = eloDelta(rh, ra, g.hg, g.ag, g.neutral, g.importance);
    rating.set(g.home, rh + d); rating.set(g.away, ra - d);
    played.set(g.home, (played.get(g.home) ?? 0) + 1);
    played.set(g.away, (played.get(g.away) ?? 0) + 1);
  }
  console.log(`avaliados: ${pairs.length} | pulados: ${skipped}`);

  // baseline (taxa-base constante)
  const rH = mean(pairs.map((p) => (p.outcome === 'H' ? 1 : 0)));
  const rD = mean(pairs.map((p) => (p.outcome === 'D' ? 1 : 0)));
  const rA = mean(pairs.map((p) => (p.outcome === 'A' ? 1 : 0)));
  const rO = mean(pairs.map((p) => p.over));
  const rB = mean(pairs.map((p) => p.btts));
  const baseX2 = mean(pairs.map((p) => ((rH - (p.outcome === 'H' ? 1 : 0)) ** 2 + (rD - (p.outcome === 'D' ? 1 : 0)) ** 2 + (rA - (p.outcome === 'A' ? 1 : 0)) ** 2)));
  const baseOver = mean(pairs.map((p) => (rO - p.over) ** 2));
  const baseBtts = mean(pairs.map((p) => (rB - p.btts) ** 2));
  const obsGoals = mean(games.map((g) => g.hg + g.ag));
  console.log(`\nbaseline Brier  -> 1X2 ${baseX2.toFixed(3)} | Over ${baseOver.toFixed(3)} | BTTS ${baseBtts.toFixed(3)}`);
  console.log(`taxa-base       -> Over ${(rO * 100).toFixed(1)}% | BTTS ${(rB * 100).toFixed(1)}% | media de gols/jogo ${obsGoals.toFixed(3)}`);

  // valores atuais p/ referência
  const cur = evaluate(pairs, 2.6, 200);
  console.log(`\nATUAL (TG=2.6, SD=200): Brier 1X2 ${cur.brier.x2.toFixed(3)} | Over ${cur.brier.over.toFixed(3)} | BTTS ${cur.brier.btts.toFixed(3)} || logloss 1X2 ${cur.ll.x2.toFixed(3)} Over ${cur.ll.over.toFixed(3)} BTTS ${cur.ll.btts.toFixed(3)}`);

  // sweep
  const TGs = [];
  for (let t = 2.2; t <= 3.21; t += 0.1) TGs.push(Math.round(t * 100) / 100);
  const SDs = [120, 140, 160, 180, 200, 220, 250, 300];

  let best = null;
  const rows = [];
  for (const TG of TGs) for (const SD of SDs) {
    const r = evaluate(pairs, TG, SD);
    // score combinado: soma dos Brier dos 3 mercados (quanto menor melhor)
    const score = r.brier.x2 + r.brier.over + r.brier.btts;
    rows.push({ TG, SD, ...r.brier, score });
    if (!best || score < best.score) best = { TG, SD, ...r, score };
  }

  // melhores por mercado
  const bestOver = rows.reduce((a, b) => (b.over < a.over ? b : a));
  const bestBtts = rows.reduce((a, b) => (b.btts < a.btts ? b : a));
  const bestX2 = rows.reduce((a, b) => (b.x2 < a.x2 ? b : a));

  console.log(`\nmelhor 1X2 : TG=${bestX2.TG} SD=${bestX2.SD} -> Brier 1X2 ${bestX2.x2.toFixed(3)}`);
  console.log(`melhor Over: TG=${bestOver.TG} SD=${bestOver.SD} -> Brier Over ${bestOver.over.toFixed(3)} (baseline ${baseOver.toFixed(3)})`);
  console.log(`melhor BTTS: TG=${bestBtts.TG} SD=${bestBtts.SD} -> Brier BTTS ${bestBtts.btts.toFixed(3)} (baseline ${baseBtts.toFixed(3)})`);
  console.log(`\nmelhor COMBINADO (soma dos 3 Brier): TG=${best.TG} SD=${best.SD}`);
  console.log(`  Brier 1X2 ${best.brier.x2.toFixed(3)} | Over ${best.brier.over.toFixed(3)} | BTTS ${best.brier.btts.toFixed(3)}`);
  console.log(`  logloss   1X2 ${best.ll.x2.toFixed(3)} | Over ${best.ll.over.toFixed(3)} | BTTS ${best.ll.btts.toFixed(3)}`);

  // perfil por SUP_DIV fixando TG (confirma platô vs pico)
  console.log(`\nperfil por SUP_DIV (TG=${best.TG}):`);
  console.log('  SD    Brier1X2  logloss1X2');
  for (const SD of [110, 120, 130, 140, 150, 160, 180, 200, 250]) {
    const r = evaluate(pairs, best.TG, SD);
    console.log(`  ${String(SD).padStart(3)}   ${r.brier.x2.toFixed(3)}     ${r.ll.x2.toFixed(3)}`);
  }

  // perfil de TG fixando SD no melhor combinado (mostra o trade-off de gols)
  console.log(`\nperfil por TOTAL_GOALS (SD=${best.SD}):`);
  console.log('  TG    Brier1X2  BrierOver  BrierBTTS');
  for (const TG of TGs) {
    const r = evaluate(pairs, TG, best.SD);
    console.log(`  ${TG.toFixed(1)}   ${r.brier.x2.toFixed(3)}     ${r.brier.over.toFixed(3)}      ${r.brier.btts.toFixed(3)}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
