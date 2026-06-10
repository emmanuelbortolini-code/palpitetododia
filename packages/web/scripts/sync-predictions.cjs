/*
 * Grava previsões pré-jogo dos jogos AGENDADOS das ligas com tabela e pontua os
 * encerrados (preenche placar real) -> match_predictions. Base p/ calibração honesta.
 * A matemática (Poisson + Dixon-Coles, modelo ponderado por recência) espelha
 * lib/probability.ts.
 *
 * Uso:
 *   node scripts/sync-predictions.cjs            # dry-run (não grava)
 *   node scripts/sync-predictions.cjs --apply
 *
 * Requer migration 020 aplicada e team_season_stats sincronizado.
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const APPLY = process.argv.includes('--apply');
const SEASON = new Date().getFullYear();
const RHO = -0.13;
const MAX_GOALS = 10;
const HALF_LIFE = 120;

function loadEnv() {
  const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
  const get = (k) => { const m = env.match(new RegExp('^' + k + '=(.*)$', 'm')); return m ? m[1].trim().replace(/^["']|["']$/g, '') : ''; };
  return { url: get('NEXT_PUBLIC_SUPABASE_URL'), key: get('SUPABASE_SERVICE_ROLE_KEY') };
}

// --- modelo (espelha lib/probability.ts) ---
function buildWeightedModel(teams, now) {
  const weight = (date) => {
    const age = (now - Date.parse(date)) / 86400000;
    return Number.isFinite(age) ? 0.5 ** (Math.max(0, age) / HALF_LIFE) : 1;
  };
  let hG = 0, hW = 0, aG = 0, aW = 0;
  for (const t of teams) for (const g of t.games) {
    const w = weight(g.date);
    if (g.homeAway === 'home') { hG += w * g.gf; hW += w; } else { aG += w * g.gf; aW += w; }
  }
  if (hW === 0 || aW === 0) return null;
  const muHome = hG / hW, muAway = aG / aW;
  if (muHome <= 0 || muAway <= 0) return null;
  const map = new Map();
  for (const t of teams) {
    let hgf = 0, hga = 0, hw = 0, agf = 0, aga = 0, aw = 0;
    for (const g of t.games) {
      const w = weight(g.date);
      if (g.homeAway === 'home') { hgf += w * g.gf; hga += w * g.ga; hw += w; }
      else { agf += w * g.gf; aga += w * g.ga; aw += w; }
    }
    if (hw === 0 || aw === 0) continue;
    map.set(t.teamId, {
      attackHome: hgf / hw / muHome, defenseHome: hga / hw / muAway,
      attackAway: agf / aw / muAway, defenseAway: aga / aw / muHome,
    });
  }
  if (!map.size) return null;
  return { muHome, muAway, teams: map };
}

const fact = (n) => { let f = 1; for (let i = 2; i <= n; i++) f *= i; return f; };
const poisson = (k, l) => (Math.exp(-l) * l ** k) / fact(k);
function tau(i, j, lh, la) {
  if (i === 0 && j === 0) return 1 - lh * la * RHO;
  if (i === 0 && j === 1) return 1 + lh * RHO;
  if (i === 1 && j === 0) return 1 + la * RHO;
  if (i === 1 && j === 1) return 1 - RHO;
  return 1;
}
function matchProbs(model, home, away) {
  const h = model.teams.get(home), a = model.teams.get(away);
  if (!h || !a) return null;
  const lh = model.muHome * h.attackHome * a.defenseAway;
  const la = model.muAway * a.attackAway * h.defenseHome;
  const ph = Array.from({ length: MAX_GOALS + 1 }, (_, k) => poisson(k, lh));
  const pa = Array.from({ length: MAX_GOALS + 1 }, (_, k) => poisson(k, la));
  let total = 0; const grid = [];
  for (let i = 0; i <= MAX_GOALS; i++) { grid[i] = []; for (let j = 0; j <= MAX_GOALS; j++) { const p = ph[i] * pa[j] * tau(i, j, lh, la); grid[i][j] = p; total += p; } }
  let homeWin = 0, draw = 0, awayWin = 0, over25 = 0, btts = 0, top = { home: 0, away: 0, p: 0 };
  for (let i = 0; i <= MAX_GOALS; i++) for (let j = 0; j <= MAX_GOALS; j++) {
    const p = grid[i][j] / total;
    if (i > j) homeWin += p; else if (i === j) draw += p; else awayWin += p;
    if (i + j >= 3) over25 += p;
    if (i >= 1 && j >= 1) btts += p;
    if (p > top.p) top = { home: i, away: j, p };
  }
  return { lambdaHome: lh, lambdaAway: la, homeWin, draw, awayWin, over25, btts, top };
}

async function main() {
  const { url, key } = loadEnv();
  const s = createClient(url, key);

  const { data: tss } = await s
    .from('team_season_stats')
    .select('league_id, team_id, points, raw')
    .eq('season', SEASON);
  const byLeague = new Map();
  for (const r of tss ?? []) { if (!byLeague.has(r.league_id)) byLeague.set(r.league_id, []); byLeague.get(r.league_id).push(r); }

  const models = new Map();
  for (const [lid, rows] of byLeague) {
    if (!rows.some((r) => r.points != null)) continue;
    const teams = rows.map((r) => ({
      teamId: r.team_id,
      games: ((r.raw && r.raw.schedule) || []).filter((g) => typeof g.gf === 'number' && typeof g.ga === 'number'),
    }));
    const m = buildWeightedModel(teams, Date.now());
    if (m) models.set(lid, m);
  }
  const leagueIds = [...models.keys()];

  // previsões dos agendados
  let predicted = 0;
  if (leagueIds.length) {
    const { data: upcoming } = await s
      .from('matches')
      .select('id, league_id, home_team_id, away_team_id')
      .in('league_id', leagueIds)
      .eq('status', 'scheduled');
    const now = new Date().toISOString();
    const rows = [];
    for (const m of upcoming ?? []) {
      const p = matchProbs(models.get(m.league_id), m.home_team_id, m.away_team_id);
      if (!p) continue;
      rows.push({
        match_id: m.id, league_id: m.league_id, season: SEASON, predicted_at: now,
        lambda_home: p.lambdaHome, lambda_away: p.lambdaAway,
        p_home: p.homeWin, p_draw: p.draw, p_away: p.awayWin, p_over25: p.over25, p_btts: p.btts,
        top_home: p.top.home, top_away: p.top.away,
      });
    }
    predicted = rows.length;
    console.log(`${predicted} previsões${APPLY ? '' : ' (dry-run)'} em ${leagueIds.length} liga(s).`);
    if (APPLY) for (let i = 0; i < rows.length; i += 200) {
      const { error } = await s.from('match_predictions').upsert(rows.slice(i, i + 200), { onConflict: 'match_id' });
      if (error) throw new Error(error.message);
    }
  }

  // pontuação dos encerrados
  const { data: pending } = await s
    .from('match_predictions')
    .select('match_id, match:match_id(status, home_score, away_score)')
    .is('scored_at', null);
  let scored = 0;
  const scoredAt = new Date().toISOString();
  for (const row of pending ?? []) {
    const mt = row.match;
    if (!mt || mt.status !== 'finished' || mt.home_score == null || mt.away_score == null) continue;
    scored++;
    if (APPLY) {
      const { error } = await s.from('match_predictions')
        .update({ actual_home_score: mt.home_score, actual_away_score: mt.away_score, scored_at: scoredAt })
        .eq('match_id', row.match_id);
      if (error) throw new Error(error.message);
    }
  }
  console.log(`${scored} jogos pontuados${APPLY ? '' : ' (dry-run)'}.`);
  if (APPLY) console.log('Gravado.');
}

main().catch((e) => { console.error(e); process.exit(1); });
