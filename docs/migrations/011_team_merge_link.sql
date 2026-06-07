-- 011_team_merge_link.sql
-- Vínculo reversível entre times de fontes diferentes que são o MESMO clube
-- (ex.: "Botafogo-RJ" do API-Football e "Botafogo FC" da ESPN). A linha alias
-- (normalmente a ESPN) aponta para a linha canônica (normalmente a API-Football,
-- que é a rica e onde os jogos se amarram).
--   * Listagem mostra só linhas com merged_into IS NULL.
--   * Desfazer o vínculo = voltar merged_into para NULL. Nada é apagado.

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS merged_into uuid REFERENCES public.teams(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_teams_merged_into ON public.teams(merged_into);
