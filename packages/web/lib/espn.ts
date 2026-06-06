// Client da API pública (não-oficial) da ESPN para futebol. Sem chave e sem
// limite rígido. A ESPN organiza o futebol por SLUG de liga (ex.: bra.1).

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';

export type EspnTeam = { id: string; name: string; logo: string | null };

export type EspnLeagueData = {
  league: { id: string; name: string; slug: string; logo: string | null };
  teams: EspnTeam[];
};

// Ligas brasileiras disponíveis na ESPN (todas do Brasil → country BR).
// Continentais (Libertadores/Sudamericana) ficam de fora: misturam países.
export const ESPN_BRAZIL_LEAGUES = [
  'bra.1',
  'bra.2',
  'bra.3',
  'bra.copa_do_brazil',
  'bra.camp.paulista',
  'bra.camp.carioca',
  'bra.camp.mineiro',
  'bra.camp.gaucho',
] as const;

/** Busca a liga + seus times pelo slug da ESPN (uma chamada traz os dois). */
export async function fetchEspnLeagueTeams(slug: string): Promise<EspnLeagueData> {
  const res = await fetch(`${ESPN_BASE}/${slug}/teams`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`ESPN ${slug}: HTTP ${res.status}`);
  const json = await res.json();
  const lg = json?.sports?.[0]?.leagues?.[0];
  if (!lg) throw new Error(`ESPN ${slug}: liga não encontrada`);

  const teams: EspnTeam[] = (lg.teams ?? []).map((t: any) => ({
    id: String(t.team.id),
    name: t.team.displayName ?? t.team.name,
    logo: t.team.logos?.[0]?.href ?? null,
  }));

  return {
    league: {
      id: String(lg.id),
      name: lg.name,
      slug,
      logo: lg.logos?.[0]?.href ?? null,
    },
    teams,
  };
}
