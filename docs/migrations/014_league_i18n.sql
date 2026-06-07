-- 014_league_i18n.sql
-- Campos multilíngues/extras das ligas, conforme o CSV de referência
-- (#dados/brazil-serie-d-league-data.csv): nomes/slugs EN/ES, apelidos por idioma,
-- gênero. (name/slug/logo_url já existem; dados de país ficam na tabela countries.)

ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS name_en varchar(150),
  ADD COLUMN IF NOT EXISTS name_es varchar(150),
  ADD COLUMN IF NOT EXISTS slug_en varchar(150),
  ADD COLUMN IF NOT EXISTS slug_es varchar(150),
  ADD COLUMN IF NOT EXISTS nicknames_pt jsonb,
  ADD COLUMN IF NOT EXISTS nicknames_en jsonb,
  ADD COLUMN IF NOT EXISTS nicknames_es jsonb,
  ADD COLUMN IF NOT EXISTS gender_en varchar(10),
  ADD COLUMN IF NOT EXISTS gender_br varchar(10),
  ADD COLUMN IF NOT EXISTS gender_es varchar(10);
