// Modelo de Copa do Mundo: rating Elo internacional + probabilidades por confronto.
// A Copa não tem jogos próprios antes do torneio, então a força das seleções vem do
// histórico de jogos internacionais (amistosos, eliminatórias, Nations, continentais),
// resumido num Elo. O Elo é convertido em λ (gols esperados) e cai na MESMA matriz
// Poisson + Dixon-Coles do modelo de liga (outcomesFromLambdas). Sede neutra (sem mando).

import { outcomesFromLambdas, type MatchProbabilities } from './probability';

export type IntlGame = {
  date: string; // ISO; usado só para ordenar cronologicamente
  home: string; // espn id
  away: string; // espn id
  hg: number;
  ag: number;
  neutral: boolean;
  importance: number; // K do Elo conforme a competição
};

export type EloRatings = Map<string, { rating: number; played: number }>;

const BASE = 1500;
const HOME_ADV = 65; // vantagem de mando (em pontos de Elo) p/ jogos NÃO neutros

export const BASE_RATING = BASE;

/** Multiplicador por saldo de gols (World Football Elo). */
function goalMultiplier(gd: number): number {
  if (gd <= 1) return 1;
  if (gd === 2) return 1.5;
  return (11 + gd) / 8;
}

/** Variação de Elo do mandante após um jogo (o visitante recebe o simétrico). */
export function eloDelta(ratingHome: number, ratingAway: number, hg: number, ag: number, neutral: boolean, importance: number): number {
  const dr = ratingHome - ratingAway + (neutral ? 0 : HOME_ADV);
  const we = 1 / (1 + 10 ** (-dr / 400)); // expectativa do mandante
  const w = hg > ag ? 1 : hg < ag ? 0 : 0.5;
  return importance * goalMultiplier(Math.abs(hg - ag)) * (w - we);
}

/**
 * Calcula o Elo de cada seleção processando os jogos em ordem cronológica. Times não
 * vistos começam em 1500. O K vem da importância da competição (amistoso < eliminatória
 * < continental < Copa). Retorna rating + nº de jogos por espn id.
 */
export function computeElo(games: IntlGame[]): EloRatings {
  const rating = new Map<string, number>();
  const played = new Map<string, number>();
  const get = (id: string) => rating.get(id) ?? BASE;

  const sorted = [...games].sort((a, b) => a.date.localeCompare(b.date));
  for (const g of sorted) {
    if (!g.home || !g.away) continue;
    const rh = get(g.home);
    const ra = get(g.away);
    const delta = eloDelta(rh, ra, g.hg, g.ag, g.neutral, g.importance);
    rating.set(g.home, rh + delta);
    rating.set(g.away, ra - delta);
    played.set(g.home, (played.get(g.home) ?? 0) + 1);
    played.set(g.away, (played.get(g.away) ?? 0) + 1);
  }

  const out: EloRatings = new Map();
  for (const [id, r] of rating) out.set(id, { rating: r, played: played.get(id) ?? 0 });
  return out;
}

// Conversão Elo -> gols esperados (sede neutra). Calibráveis no backtest da Copa:
//  - TOTAL_GOALS: média de gols por jogo internacional.
//  - SUP_DIV: a cada SUP_DIV pontos de Elo, ~1 gol de vantagem esperada.
const TOTAL_GOALS = 2.6;
const SUP_DIV = 200;
const MIN_LAMBDA = 0.15;

export function eloToLambdas(ratingHome: number, ratingAway: number): { lambdaHome: number; lambdaAway: number } {
  const supremacy = (ratingHome - ratingAway) / SUP_DIV;
  return {
    lambdaHome: Math.max(MIN_LAMBDA, TOTAL_GOALS / 2 + supremacy / 2),
    lambdaAway: Math.max(MIN_LAMBDA, TOTAL_GOALS / 2 - supremacy / 2),
  };
}

/** Probabilidades de um confronto da Copa a partir dos Elos das duas seleções (sede neutra). */
export function eloMatchProbabilities(ratingHome: number, ratingAway: number): MatchProbabilities {
  const { lambdaHome, lambdaAway } = eloToLambdas(ratingHome, ratingAway);
  return outcomesFromLambdas(lambdaHome, lambdaAway);
}
