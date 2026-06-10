// Calibração das probabilidades (Brier, log-loss, confiabilidade e baseline).
// Duas fontes alimentam as MESMAS métricas:
//  - backtest walk-forward: para cada jogo encerrado, reconstrói o modelo da liga
//    usando SÓ os jogos anteriores àquela data (sem vazamento) e prevê.
//  - previsões persistidas (match_predictions): previsão pré-jogo travada vs placar real.
// Tudo derivado da própria amostra; sem libs externas.

import { buildWeightedLeagueModel, matchProbabilities, type Game } from './probability';
import { eloDelta, eloMatchProbabilities, BASE_RATING, type IntlGame } from './elo';

/** Previsão já confrontada com o resultado real — unidade de avaliação das métricas. */
export type ScoredPred = {
  pHome: number;
  pDraw: number;
  pAway: number;
  pOver: number; // P(total de gols >= 3)
  pBtts: number; // P(ambos marcam)
  outcome: 'H' | 'D' | 'A';
  over: 0 | 1;
  btts: 0 | 1;
};

export type TeamSchedule = { teamId: string; games: Game[] };
export type FinishedMatch = {
  leagueId: string;
  homeTeamId: string;
  awayTeamId: string;
  date: string;
  homeScore: number;
  awayScore: number;
};

const outcomeOf = (h: number, a: number): 'H' | 'D' | 'A' => (h > a ? 'H' : h < a ? 'A' : 'D');

/**
 * Backtest walk-forward: para cada jogo encerrado, monta o modelo ponderado da liga
 * usando apenas jogos ANTERIORES à data do confronto (recência relativa àquela data) e
 * prevê. Exige `minGames` jogos prévios de cada time, senão pula (início de temporada).
 */
export function walkForwardBacktest(
  schedulesByLeague: Map<string, TeamSchedule[]>,
  matches: FinishedMatch[],
  minGames = 4,
): { scored: ScoredPred[]; skipped: number } {
  const scored: ScoredPred[] = [];
  let skipped = 0;

  for (const m of matches) {
    const cutoff = Date.parse(m.date);
    const league = schedulesByLeague.get(m.leagueId);
    if (!league || !Number.isFinite(cutoff)) {
      skipped++;
      continue;
    }

    const priorGames = (teamId: string) =>
      (league.find((t) => t.teamId === teamId)?.games ?? []).filter((g) => Date.parse(g.date) < cutoff);
    if (priorGames(m.homeTeamId).length < minGames || priorGames(m.awayTeamId).length < minGames) {
      skipped++;
      continue;
    }

    const teams = league.map((t) => ({
      teamId: t.teamId,
      games: t.games.filter((g) => Date.parse(g.date) < cutoff),
    }));
    const model = buildWeightedLeagueModel(teams, 120, cutoff);
    const probs = model && matchProbabilities(model, m.homeTeamId, m.awayTeamId);
    if (!probs) {
      skipped++;
      continue;
    }

    scored.push({
      pHome: probs.homeWin,
      pDraw: probs.draw,
      pAway: probs.awayWin,
      pOver: probs.over25,
      pBtts: probs.btts,
      outcome: outcomeOf(m.homeScore, m.awayScore),
      over: m.homeScore + m.awayScore >= 3 ? 1 : 0,
      btts: m.homeScore >= 1 && m.awayScore >= 1 ? 1 : 0,
    });
  }

  return { scored, skipped };
}

/**
 * Backtest walk-forward do modelo de seleções (Elo): processa os jogos internacionais em
 * ordem; prevê cada um com o Elo PRÉ-jogo (sem vazamento) e só então atualiza os ratings.
 * Exige `minPlayed` jogos prévios de cada seleção. Honesto e O(n) — o Elo já é sequencial.
 */
export function eloWalkForward(games: IntlGame[], minPlayed = 5): { scored: ScoredPred[]; skipped: number } {
  const rating = new Map<string, number>();
  const played = new Map<string, number>();
  const get = (id: string) => rating.get(id) ?? BASE_RATING;
  const scored: ScoredPred[] = [];
  let skipped = 0;

  for (const g of [...games].sort((a, b) => a.date.localeCompare(b.date))) {
    if (!g.home || !g.away) {
      skipped++;
      continue;
    }
    const rh = get(g.home);
    const ra = get(g.away);
    if ((played.get(g.home) ?? 0) >= minPlayed && (played.get(g.away) ?? 0) >= minPlayed) {
      const p = eloMatchProbabilities(rh, ra);
      scored.push({
        pHome: p.homeWin,
        pDraw: p.draw,
        pAway: p.awayWin,
        pOver: p.over25,
        pBtts: p.btts,
        outcome: g.hg > g.ag ? 'H' : g.hg < g.ag ? 'A' : 'D',
        over: g.hg + g.ag >= 3 ? 1 : 0,
        btts: g.hg >= 1 && g.ag >= 1 ? 1 : 0,
      });
    } else {
      skipped++;
    }
    const delta = eloDelta(rh, ra, g.hg, g.ag, g.neutral, g.importance);
    rating.set(g.home, rh + delta);
    rating.set(g.away, ra - delta);
    played.set(g.home, (played.get(g.home) ?? 0) + 1);
    played.set(g.away, (played.get(g.away) ?? 0) + 1);
  }
  return { scored, skipped };
}

// ----- Métricas -----

export type ReliabilityBin = { lo: number; hi: number; n: number; predMean: number; obsRate: number };
export type CalibrationReport = {
  n: number;
  brier: { x2: number; over: number; btts: number };
  logLoss: { x2: number; over: number; btts: number };
  baseline: { x2: number; over: number; btts: number }; // Brier de um palpite constante = taxa-base
  reliability: { x2: ReliabilityBin[]; over: ReliabilityBin[]; btts: ReliabilityBin[] };
};

const clip = (p: number) => Math.min(1 - 1e-15, Math.max(1e-15, p));
const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

// Brier 1X2 (multiclasse, faixa 0..2): soma dos quadrados de (prob - indicador) das 3 classes.
const brierX2 = (p: ScoredPred) =>
  (p.pHome - (p.outcome === 'H' ? 1 : 0)) ** 2 +
  (p.pDraw - (p.outcome === 'D' ? 1 : 0)) ** 2 +
  (p.pAway - (p.outcome === 'A' ? 1 : 0)) ** 2;

const probOfOutcome = (p: ScoredPred) => (p.outcome === 'H' ? p.pHome : p.outcome === 'D' ? p.pDraw : p.pAway);

/** Pares (prob, indicador) para a confiabilidade binária de cada mercado. */
function pairs(preds: ScoredPred[], market: 'x2' | 'over' | 'btts'): [number, number][] {
  if (market === 'over') return preds.map((p) => [p.pOver, p.over]);
  if (market === 'btts') return preds.map((p) => [p.pBtts, p.btts]);
  // 1X2: um-contra-resto agrupado (as 3 classes juntas).
  return preds.flatMap((p) => [
    [p.pHome, p.outcome === 'H' ? 1 : 0],
    [p.pDraw, p.outcome === 'D' ? 1 : 0],
    [p.pAway, p.outcome === 'A' ? 1 : 0],
  ]);
}

function reliability(ps: [number, number][], bins = 10): ReliabilityBin[] {
  const out: ReliabilityBin[] = [];
  for (let b = 0; b < bins; b++) {
    const lo = b / bins;
    const hi = (b + 1) / bins;
    const inBin = ps.filter(([p]) => (b === bins - 1 ? p >= lo && p <= hi : p >= lo && p < hi));
    out.push({
      lo,
      hi,
      n: inBin.length,
      predMean: mean(inBin.map(([p]) => p)),
      obsRate: mean(inBin.map(([, y]) => y)),
    });
  }
  return out;
}

export function evaluate(preds: ScoredPred[]): CalibrationReport {
  const n = preds.length;

  // Taxas-base (palpite constante = referência sem habilidade).
  const rHome = mean(preds.map((p) => (p.outcome === 'H' ? 1 : 0)));
  const rDraw = mean(preds.map((p) => (p.outcome === 'D' ? 1 : 0)));
  const rAway = mean(preds.map((p) => (p.outcome === 'A' ? 1 : 0)));
  const rOver = mean(preds.map((p) => p.over));
  const rBtts = mean(preds.map((p) => p.btts));
  const base: ScoredPred[] = preds.map((p) => ({
    ...p,
    pHome: rHome,
    pDraw: rDraw,
    pAway: rAway,
    pOver: rOver,
    pBtts: rBtts,
  }));

  return {
    n,
    brier: {
      x2: mean(preds.map(brierX2)),
      over: mean(preds.map((p) => (p.pOver - p.over) ** 2)),
      btts: mean(preds.map((p) => (p.pBtts - p.btts) ** 2)),
    },
    logLoss: {
      x2: mean(preds.map((p) => -Math.log(clip(probOfOutcome(p))))),
      over: mean(preds.map((p) => -(p.over * Math.log(clip(p.pOver)) + (1 - p.over) * Math.log(clip(1 - p.pOver))))),
      btts: mean(preds.map((p) => -(p.btts * Math.log(clip(p.pBtts)) + (1 - p.btts) * Math.log(clip(1 - p.pBtts))))),
    },
    baseline: {
      x2: mean(base.map(brierX2)),
      over: mean(base.map((p) => (p.pOver - p.over) ** 2)),
      btts: mean(base.map((p) => (p.pBtts - p.btts) ** 2)),
    },
    reliability: {
      x2: reliability(pairs(preds, 'x2')),
      over: reliability(pairs(preds, 'over')),
      btts: reliability(pairs(preds, 'btts')),
    },
  };
}
