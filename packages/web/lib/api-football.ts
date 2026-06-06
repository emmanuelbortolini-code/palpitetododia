// Client da API-Football (API-Sports).
//
// IMPORTANTE: usamos o endpoint DIRETO `https://v3.football.api-sports.io` com o
// header `x-apisports-key` — NÃO o gateway RapidAPI (`api-football-v3.p.rapidapi.com`)
// documentado no prompt original, ao qual esta key não está inscrita.
//
// Plano Free atual: 100 req/dia, temporadas 2022–2024 apenas, sem o parâmetro `next`.
// Trocar API_FOOTBALL_SEASON para a temporada atual quando houver plano pago.

const BASE_URL = process.env.API_FOOTBALL_BASE_URL ?? 'https://v3.football.api-sports.io';
const KEY = process.env.API_FOOTBALL_KEY!;
const TIMEOUT = Number(process.env.API_FOOTBALL_TIMEOUT ?? 30000);

type ApiTeam = { id: number; name: string; logo: string | null };

export type ApiFixture = {
  fixture: { id: number; date: string; status: { short: string } };
  league: { id: number; name: string; season: number; logo: string | null };
  teams: { home: ApiTeam; away: ApiTeam };
  goals: { home: number | null; away: number | null };
};

/** GET genérico contra a API-Football, com timeout e tratamento de `errors`. */
async function apiGet<T>(path: string): Promise<T[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { 'x-apisports-key': KEY },
      signal: controller.signal,
      cache: 'no-store',
    });
    const json = await res.json();
    // A API devolve `errors` como [] (ok) ou objeto { campo: msg } (erro).
    const errors = json.errors;
    const hasError = Array.isArray(errors)
      ? errors.length > 0
      : errors && Object.keys(errors).length > 0;
    if (hasError) {
      throw new Error(`API-Football: ${JSON.stringify(errors)}`);
    }
    return (json.response ?? []) as T[];
  } finally {
    clearTimeout(timer);
  }
}

/** Busca todas as partidas de uma liga numa temporada. */
export function fetchFixtures(leagueId: number, season: number): Promise<ApiFixture[]> {
  return apiGet<ApiFixture>(`/fixtures?league=${leagueId}&season=${season}`);
}
