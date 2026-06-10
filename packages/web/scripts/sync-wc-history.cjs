/*
 * Busca o histórico de jogos de SELEÇÕES na ESPN (amistosos, eliminatórias, Nations
 * League e competições continentais) e grava em international_matches. Esses jogos
 * semeiam o Elo internacional do modelo da Copa (lib/elo.ts calcula o Elo a partir
 * deles). Split recursivo por data (teto ~100/req da ESPN).
 *
 * Uso:
 *   node scripts/sync-wc-history.cjs            # dry-run
 *   node scripts/sync-wc-history.cjs --apply
 *
 * Requer migration 021 aplicada.
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const APPLY = process.argv.includes('--apply');
const SOCCER = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
const START = '20210101';
const END = (() => { const d = new Date(); return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`; })();

// slug ESPN -> importância (K base do Elo).
const COMPS = {
  'fifa.friendly': 20,
  'fifa.worldq.uefa': 30, 'fifa.worldq.conmebol': 30, 'fifa.worldq.concacaf': 30,
  'fifa.worldq.afc': 30, 'fifa.worldq.caf': 30, 'fifa.worldq.ofc': 30,
  'uefa.nations': 30, 'concacaf.nations': 30,
  'uefa.euro': 40, 'conmebol.america': 40, 'caf.nations': 40, 'afc.asian': 40,
  'concacaf.gold': 35, 'ofc.nations': 35,
  'fifa.world': 50,
};

function loadEnv() {
  const e = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
  const g = (k) => { const m = e.match(new RegExp('^' + k + '=(.*)$', 'm')); return m ? m[1].trim().replace(/^["']|["']$/g, '') : ''; };
  return { url: g('NEXT_PUBLIC_SUPABASE_URL'), key: g('SUPABASE_SERVICE_ROLE_KEY') };
}
const ymd = (d) => `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
const parse = (s) => new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T00:00:00Z`);

async function fetchRange(slug, start, end, out) {
  let j;
  try { j = await (await fetch(`${SOCCER}/${slug}/scoreboard?dates=${start}-${end}`)).json(); } catch { return; }
  const events = j?.events ?? [];
  if (events.length >= 100 && start !== end) {
    const a = parse(start), b = parse(end);
    const mid = new Date((a.getTime() + b.getTime()) / 2);
    const midEnd = ymd(mid);
    const nextStart = ymd(new Date(mid.getTime() + 86400000));
    await fetchRange(slug, start, midEnd, out);
    await fetchRange(slug, nextStart, end, out);
    return;
  }
  for (const e of events) {
    const comp = e.competitions?.[0];
    const st = comp?.status?.type;
    if (!comp || !st?.completed) continue;
    const home = comp.competitors?.find((c) => c.homeAway === 'home');
    const away = comp.competitors?.find((c) => c.homeAway === 'away');
    const hId = home?.team?.id, aId = away?.team?.id;
    const hg = Number(home?.score), ag = Number(away?.score);
    if (!hId || !aId || !Number.isFinite(hg) || !Number.isFinite(ag)) continue;
    out.set(String(e.id), {
      espn_event_id: String(e.id), played_at: e.date,
      home_espn_id: String(hId), away_espn_id: String(aId),
      home_goals: hg, away_goals: ag,
      neutral: !!comp.neutralSite, competition: slug, importance: COMPS[slug],
    });
  }
}

async function main() {
  const { url, key } = loadEnv();
  const s = createClient(url, key);

  // Fatia a janela em trimestres (a ESPN devolve vazio p/ faixas muito largas); o split
  // recursivo do fetchRange cuida do teto de 100 dentro de cada trimestre.
  const chunks = [];
  for (let d = parse(START); d < parse(END); d = new Date(d.getTime() + 91 * 86400000)) {
    const a = ymd(d);
    const bDate = new Date(Math.min(d.getTime() + 90 * 86400000, parse(END).getTime()));
    chunks.push([a, ymd(bDate)]);
  }

  const byEvent = new Map();
  for (const slug of Object.keys(COMPS)) {
    const before = byEvent.size;
    for (const [a, b] of chunks) await fetchRange(slug, a, b, byEvent);
    console.log(`[${slug}] +${byEvent.size - before}`);
  }
  const rows = [...byEvent.values()];
  console.log(`total: ${rows.length} jogos internacionais${APPLY ? '' : ' (dry-run)'} (${START}..${END}).`);

  if (APPLY) {
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await s.from('international_matches').upsert(rows.slice(i, i + 500), { onConflict: 'espn_event_id' });
      if (error) throw new Error(error.message);
    }
    console.log('Gravado.');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
