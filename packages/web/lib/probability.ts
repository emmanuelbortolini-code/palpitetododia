// Modelo de Poisson por mando para probabilidades de jogo (1X2 / Over-Under / BTTS).
// Insumo: team_season_stats (GF/GA e jogos, separados casa/fora) de uma liga.
// Tudo derivado da temporada corrente; sem libs externas.

export type TeamRates = {
  teamId: string;
  attackHome: number;
  defenseHome: number;
  attackAway: number;
  defenseAway: number;
};

export type LeagueModel = {
  muHome: number; // média de gols do mandante por jogo na liga
  muAway: number; // média de gols do visitante por jogo na liga
  teams: Map<string, TeamRates>;
};

type StatsRow = {
  team_id: string;
  home_played: number | null;
  home_gf: number | null;
  home_ga: number | null;
  away_played: number | null;
  away_gf: number | null;
  away_ga: number | null;
};

/** Constrói o modelo da liga (médias + força de ataque/defesa por mando de cada time). */
export function buildLeagueModel(rows: StatsRow[]): LeagueModel | null {
  let totHomeG = 0;
  let totHomeP = 0;
  let totAwayG = 0;
  let totAwayP = 0;
  for (const r of rows) {
    totHomeG += r.home_gf ?? 0;
    totHomeP += r.home_played ?? 0;
    totAwayG += r.away_gf ?? 0;
    totAwayP += r.away_played ?? 0;
  }
  if (totHomeP === 0 || totAwayP === 0) return null;
  const muHome = totHomeG / totHomeP;
  const muAway = totAwayG / totAwayP;
  if (muHome <= 0 || muAway <= 0) return null;

  const teams = new Map<string, TeamRates>();
  for (const r of rows) {
    const hp = r.home_played ?? 0;
    const ap = r.away_played ?? 0;
    if (hp === 0 || ap === 0) continue; // sem amostra dos dois mandos
    teams.set(r.team_id, {
      teamId: r.team_id,
      attackHome: (r.home_gf ?? 0) / hp / muHome,
      defenseHome: (r.home_ga ?? 0) / hp / muAway,
      attackAway: (r.away_gf ?? 0) / ap / muAway,
      defenseAway: (r.away_ga ?? 0) / ap / muHome,
    });
  }
  return { muHome, muAway, teams };
}

const factorial = (n: number) => {
  let f = 1;
  for (let i = 2; i <= n; i++) f *= i;
  return f;
};
const poisson = (k: number, lambda: number) => (Math.exp(-lambda) * lambda ** k) / factorial(k);

export type MatchProbabilities = {
  lambdaHome: number;
  lambdaAway: number;
  homeWin: number;
  draw: number;
  awayWin: number;
  over25: number;
  under25: number;
  btts: number;
  topScore: { home: number; away: number; p: number };
};

const MAX_GOALS = 10;

// Correção Dixon-Coles: ajusta a dependência nos placares baixos (mais 0-0/1-1,
// menos 1-0/0-1) que o Poisson independente erra. rho típico ~ -0.1; rho=0 = Poisson puro.
const RHO = -0.13;

function tau(i: number, j: number, lh: number, la: number, rho: number): number {
  if (i === 0 && j === 0) return 1 - lh * la * rho;
  if (i === 0 && j === 1) return 1 + lh * rho;
  if (i === 1 && j === 0) return 1 + la * rho;
  if (i === 1 && j === 1) return 1 - rho;
  return 1;
}

/** Probabilidades de um confronto (Poisson com correção Dixon-Coles) a partir do modelo da liga. */
export function matchProbabilities(
  model: LeagueModel,
  homeTeamId: string,
  awayTeamId: string,
  rho = RHO,
): MatchProbabilities | null {
  const h = model.teams.get(homeTeamId);
  const a = model.teams.get(awayTeamId);
  if (!h || !a) return null;

  const lambdaHome = model.muHome * h.attackHome * a.defenseAway;
  const lambdaAway = model.muAway * a.attackAway * h.defenseHome;

  const ph = Array.from({ length: MAX_GOALS + 1 }, (_, k) => poisson(k, lambdaHome));
  const pa = Array.from({ length: MAX_GOALS + 1 }, (_, k) => poisson(k, lambdaAway));

  // Matriz de placares com o ajuste tau; normaliza pois tau (e o truncamento) tira a soma de 1.
  const grid: number[][] = [];
  let total = 0;
  for (let i = 0; i <= MAX_GOALS; i++) {
    grid[i] = [];
    for (let j = 0; j <= MAX_GOALS; j++) {
      const p = ph[i] * pa[j] * tau(i, j, lambdaHome, lambdaAway, rho);
      grid[i][j] = p;
      total += p;
    }
  }

  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;
  let over25 = 0;
  let btts = 0;
  let topScore = { home: 0, away: 0, p: 0 };
  for (let i = 0; i <= MAX_GOALS; i++) {
    for (let j = 0; j <= MAX_GOALS; j++) {
      const p = grid[i][j] / total;
      if (i > j) homeWin += p;
      else if (i === j) draw += p;
      else awayWin += p;
      if (i + j >= 3) over25 += p;
      if (i >= 1 && j >= 1) btts += p;
      if (p > topScore.p) topScore = { home: i, away: j, p };
    }
  }
  return {
    lambdaHome,
    lambdaAway,
    homeWin,
    draw,
    awayWin,
    over25,
    under25: 1 - over25,
    btts,
    topScore,
  };
}
