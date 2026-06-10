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

// Shrinkage (regularização) das forças de ataque/defesa rumo a 1.0 (média da liga),
// proporcional à amostra efetiva n: força_ajustada = 1 + (bruta - 1) * n/(n+K). Com
// poucos jogos a força colapsa p/ a média (evita superconfiança); com muitos, confia no
// dado. K=8 escolhido por backtest walk-forward (log-loss 1.40 -> 1.04, Brier 0.70 -> 0.62).
const SHRINKAGE_K = 8;
const shrink = (ratio: number, n: number, k: number) => 1 + (ratio - 1) * (n / (n + k));

/** Constrói o modelo da liga (médias + força de ataque/defesa por mando de cada time). */
export function buildLeagueModel(rows: StatsRow[], shrinkageK = SHRINKAGE_K): LeagueModel | null {
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
      attackHome: shrink((r.home_gf ?? 0) / hp / muHome, hp, shrinkageK),
      defenseHome: shrink((r.home_ga ?? 0) / hp / muAway, hp, shrinkageK),
      attackAway: shrink((r.away_gf ?? 0) / ap / muAway, ap, shrinkageK),
      defenseAway: shrink((r.away_ga ?? 0) / ap / muHome, ap, shrinkageK),
    });
  }
  return { muHome, muAway, teams };
}

export type Game = { date: string; homeAway: 'home' | 'away'; gf: number; ga: number };

/**
 * Modelo da liga com ponderação por recência (decaimento exponencial por meia-vida
 * em dias): jogos recentes pesam mais. Usa o schedule de cada time. Cai p/ null se
 * não houver amostra suficiente (a página então usa o modelo agregado).
 */
export function buildWeightedLeagueModel(
  teams: { teamId: string; games: Game[] }[],
  halfLifeDays = 120,
  now = Date.now(),
  shrinkageK = SHRINKAGE_K,
): LeagueModel | null {
  const weight = (date: string) => {
    const ageDays = (now - Date.parse(date)) / 86_400_000;
    return Number.isFinite(ageDays) ? 0.5 ** (Math.max(0, ageDays) / halfLifeDays) : 1;
  };

  // Médias da liga (ponderadas): gols do mandante e do visitante por jogo.
  let hGoals = 0, hW = 0, aGoals = 0, aW = 0;
  for (const t of teams) {
    for (const g of t.games) {
      const w = weight(g.date);
      if (g.homeAway === 'home') { hGoals += w * g.gf; hW += w; }
      else { aGoals += w * g.gf; aW += w; }
    }
  }
  if (hW === 0 || aW === 0) return null;
  const muHome = hGoals / hW;
  const muAway = aGoals / aW;
  if (muHome <= 0 || muAway <= 0) return null;

  const teamMap = new Map<string, TeamRates>();
  for (const t of teams) {
    let hgf = 0, hga = 0, hw = 0, agf = 0, aga = 0, aw = 0;
    for (const g of t.games) {
      const w = weight(g.date);
      if (g.homeAway === 'home') { hgf += w * g.gf; hga += w * g.ga; hw += w; }
      else { agf += w * g.gf; aga += w * g.ga; aw += w; }
    }
    if (hw === 0 || aw === 0) continue;
    teamMap.set(t.teamId, {
      teamId: t.teamId,
      attackHome: shrink(hgf / hw / muHome, hw, shrinkageK),
      defenseHome: shrink(hga / hw / muAway, hw, shrinkageK),
      attackAway: shrink(agf / aw / muAway, aw, shrinkageK),
      defenseAway: shrink(aga / aw / muHome, aw, shrinkageK),
    });
  }
  if (!teamMap.size) return null;
  return { muHome, muAway, teams: teamMap };
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
