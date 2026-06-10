// Rótulos PT-BR para as estatísticas de temporada da ESPN (team_season_stats.raw.statistics).
// Chaveado pelo `name` estável (camelCase) de cada métrica.

export const CATEGORY_LABEL: Record<string, string> = {
  general: 'Geral',
  offensive: 'Ataque',
  defensive: 'Defesa',
  goalKeeping: 'Goleiro',
};

// Ordem em que as categorias aparecem.
export const CATEGORY_ORDER = ['general', 'offensive', 'defensive', 'goalKeeping'];

// Métricas não suportadas no feed gratuito (sempre 0) ou irrelevantes em liga
// de pontos corridos (disputa de pênaltis, xG, notas de jogador, minutos do time).
export const HIDDEN_STATS = new Set([
  'avgRatingFromCorrespondent',
  'avgRatingFromDataFeed',
  'avgRatingFromEditor',
  'avgRatingFromUser',
  'minutes',
  'avgExpectedGoalDifferential',
  'avgExpectedGoals',
  'avgExpectedGoalsConceded',
  'shootOutKicksFaced',
  'shootOutKicksSaved',
  'shootOutSavePct',
  'shootOutGoals',
  'shootOutMisses',
  'shootOutPct',
  'wonCorners', // escanteios não populados neste feed (sempre 0; ver match_stats por jogo)
  'lostCorners',
  'savePct', // ESPN devolve fora de escala (~0,2%); enganoso
]);

// Métricas mostradas como porcentagem.
export const PCT_STATS = new Set(['goalConversion']);

export const STAT_LABEL: Record<string, string> = {
  // Defesa
  blockedShots: 'Chutes bloqueados',
  effectiveClearance: 'Cortes eficazes',
  effectiveTackles: 'Desarmes ganhos',
  inneffectiveTackles: 'Desarmes perdidos',
  interceptions: 'Interceptações',
  tacklePct: '% de desarmes certos',
  totalClearance: 'Cortes (total)',
  totalTackles: 'Desarmes (total)',
  timesTackled: 'Vezes desarmado',
  defensiveActions: 'Ações defensivas',
  recoveries: 'Recuperações de bola',

  // Geral
  appearances: 'Jogos',
  dnp: 'Não atuou',
  draws: 'Empates',
  foulsCommitted: 'Faltas cometidas',
  foulsSuffered: 'Faltas sofridas',
  goalDifference: 'Saldo de gols',
  avgGoalDifferential: 'Saldo de gols (média)',
  handBalls: 'Mãos na bola',
  losses: 'Derrotas',
  lostCorners: 'Escanteios cedidos',
  ownGoals: 'Gols contra',
  passPct: '% de passes certos',
  redCards: 'Cartões vermelhos',
  starts: 'Titularidades',
  subIns: 'Entradas (substituição)',
  subOuts: 'Saídas (substituição)',
  suspensions: 'Suspensões',
  winPct: '% de vitórias',
  wins: 'Vitórias',
  wonCorners: 'Escanteios a favor',
  yellowCards: 'Cartões amarelos',
  duelsLost: 'Duelos perdidos',
  duelsWon: 'Duelos ganhos',
  duels: 'Duelos (total)',
  duelWinPct: '% de duelos ganhos',
  secondYellow: 'Segundo amarelo',
  ownGoalsAccrued: 'Gols contra a favor',

  // Goleiro
  cleanSheet: 'Jogos sem sofrer gol',
  crossesCaught: 'Cruzamentos defendidos',
  goalsConceded: 'Gols sofridos',
  partialCleenSheet: 'Clean sheet parcial',
  penaltyKickConceded: 'Pênaltis sofridos (gol)',
  penaltyKickSavePct: '% de pênaltis defendidos',
  penaltyKicksFaced: 'Pênaltis enfrentados',
  penaltyKicksSaved: 'Pênaltis defendidos',
  punches: 'Socos (saída de gol)',
  savePct: '% de defesas',
  saves: 'Defesas',
  shotsFaced: 'Finalizações no alvo enfrentadas',
  smothers: 'Bloqueios de saída',
  unclaimedCrosses: 'Cruzamentos não defendidos',
  bigChanceSaves: 'Defesas em grandes chances',
  penaltyGoalsConceded: 'Gols de pênalti sofridos',
  avgGoalsConceded: 'Gols sofridos (média)',

  // Ataque
  accurateCrosses: 'Cruzamentos certos',
  accurateLongBalls: 'Bolas longas certas',
  accuratePasses: 'Passes certos',
  accurateThroughBalls: 'Lançamentos certos',
  crossPct: '% de cruzamentos certos',
  freeKickGoals: 'Gols de falta',
  freeKickShots: 'Finalizações de falta',
  gameWinningAssists: 'Assistências decisivas',
  gameWinningGoals: 'Gols decisivos',
  goalAssists: 'Assistências',
  headedGoals: 'Gols de cabeça',
  inaccurateCrosses: 'Cruzamentos errados',
  inaccurateLongBalls: 'Bolas longas erradas',
  inaccuratePasses: 'Passes errados',
  inaccurateThroughBalls: 'Lançamentos errados',
  leftFootedShots: 'Finalizações de pé esquerdo',
  longballPct: '% de bolas longas certas',
  offsides: 'Impedimentos',
  penaltyKickGoals: 'Gols de pênalti',
  penaltyKickPct: '% de pênaltis convertidos',
  penaltyKickShots: 'Pênaltis cobrados',
  penaltyKicksMissed: 'Pênaltis perdidos',
  possessionPct: 'Posse de bola',
  rightFootedShots: 'Finalizações de pé direito',
  shotAssists: 'Passes para finalização',
  shotPct: '% de finalizações no alvo',
  shotsHeaded: 'Finalizações de cabeça',
  shotsOffTarget: 'Finalizações para fora',
  shotsOnPost: 'Bolas na trave',
  shotsOnTarget: 'Finalizações no alvo',
  throughBallPct: '% de lançamentos certos',
  totalCrosses: 'Cruzamentos (total)',
  totalGoals: 'Gols',
  totalLongBalls: 'Bolas longas (total)',
  totalPasses: 'Passes (total)',
  totalShots: 'Finalizações (total)',
  totalThroughBalls: 'Lançamentos (total)',
  bigChanceCreated: 'Grandes chances criadas',
  avgBigChanceCreated: 'Grandes chances criadas (média)',
  awayGoals: 'Gols fora',
  homeGoals: 'Gols em casa',
  goalConversion: 'Aproveitamento de finalização',
  avgGoals: 'Gols por jogo (média)',
};

/** Formata o valor de uma métrica: % para taxas, 2 casas para médias, valor da ESPN no resto. */
export function formatStatValue(name: string, value: number, displayValue: string): string {
  if (name.endsWith('Pct') || PCT_STATS.has(name)) {
    const p = value <= 1 ? value * 100 : value;
    return `${p.toFixed(1)}%`;
  }
  if (name.startsWith('avg')) return Number(value).toFixed(2);
  return displayValue && displayValue !== '' ? displayValue : String(value);
}
