-- Migration 004 — chaves únicas para upsert do sync da API-Football.
-- O sync (lib/sync/matches.ts) faz upsert por (external_api_source, external_api_id);
-- o ON CONFLICT precisa de uma constraint única correspondente.
-- Tabelas estão vazias (nenhum sync rodou ainda), então é seguro adicionar.
-- NULLs são permitidos e não colidem (linhas criadas manualmente, sem id externo).

ALTER TABLE public.leagues
  ADD CONSTRAINT leagues_external_api_uq UNIQUE (external_api_source, external_api_id);

ALTER TABLE public.teams
  ADD CONSTRAINT teams_external_api_uq UNIQUE (external_api_source, external_api_id);

ALTER TABLE public.matches
  ADD CONSTRAINT matches_external_api_uq UNIQUE (external_api_source, external_api_id);
