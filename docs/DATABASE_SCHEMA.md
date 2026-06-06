# DATABASE SCHEMA — Sportsbook Affiliate Portal

Schema completo para Supabase (PostgreSQL). **26 tabelas.**

## Notas de adaptação (lido antes de executar)

O schema original do prompt usava sintaxe de enum estilo MySQL (`enum('a','b')` inline),
que **não é válida no PostgreSQL**. Aqui todos os enums foram convertidos para
`varchar(N) + CHECK (coluna IN (...))`, conforme decisão de projeto (mais fácil de evoluir).

Outras observações:

- **`users` × Supabase Auth (resolvido na Fase 3):** o Supabase Auth gerencia senhas na tabela
  interna `auth.users`. Por isso a tabela `public.users` **não** guarda senha: `password_hash`
  foi removido e `users.id` agora referencia `auth.users(id)`. Uma linha em `public.users` é
  criada automaticamente por um trigger quando alguém se cadastra (ver seção 11).
- `gen_random_uuid()`, `jsonb`, colunas `GENERATED ALWAYS AS ... STORED` e regex `~*` em
  CHECK são todos nativos do Postgres/Supabase — mantidos como no original.
- `timestamp` foi mantido como no prompt (sem timezone). Para produção, considerar `timestamptz`.

**Como executar:** copie cada bloco (ou o arquivo todo) no Supabase → SQL Editor e rode.
A ordem dos blocos respeita as dependências de foreign keys.

---

## 1. Users & Authentication

```sql
CREATE TABLE users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email varchar(255) NOT NULL UNIQUE,
  username varchar(50) NOT NULL UNIQUE,
  full_name varchar(100),
  avatar_url varchar(500),
  bio text,
  role varchar(30) NOT NULL DEFAULT 'freelancer'
    CHECK (role IN ('admin', 'content_manager', 'affiliate_manager', 'freelancer')),
  is_active boolean NOT NULL DEFAULT true,
  is_blocked boolean NOT NULL DEFAULT false,
  is_tipster boolean NOT NULL DEFAULT false,
  tipster_tier varchar(10) DEFAULT 'none'
    CHECK (tipster_tier IN ('none', 'bronze', 'silver', 'gold')),
  tipster_promoted_at timestamp DEFAULT NULL,
  total_predictions int DEFAULT 0,
  hit_rate numeric(5,2) DEFAULT 0,
  total_roi numeric(8,2) DEFAULT 0,
  total_points int DEFAULT 0,
  total_credits int DEFAULT 0,
  email_verified_at timestamp DEFAULT NULL,
  last_login_at timestamp DEFAULT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  deleted_at timestamp DEFAULT NULL,

  CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$'),
  CONSTRAINT username_length CHECK (length(username) >= 3 AND length(username) <= 50),
  CONSTRAINT valid_hit_rate CHECK (hit_rate >= 0 AND hit_rate <= 100),
  CONSTRAINT valid_points CHECK (total_points >= 0),
  CONSTRAINT valid_credits CHECK (total_credits >= 0)
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_tipster ON users(is_tipster);
CREATE INDEX idx_users_created_at ON users(created_at DESC);
```

---

## 2. Content (Articles, Academy, Tags)

```sql
CREATE TABLE articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title varchar(255) NOT NULL,
  slug varchar(255) NOT NULL UNIQUE,
  excerpt text NOT NULL,
  content text NOT NULL,
  cover_image_url varchar(500),
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  published_by_admin_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status varchar(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_review', 'published', 'rejected', 'archived')),
  rejection_reason text,
  meta_description varchar(160),
  keywords varchar(255),
  views_count int DEFAULT 0,
  published_at timestamp DEFAULT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  deleted_at timestamp DEFAULT NULL,

  CONSTRAINT title_length CHECK (length(title) >= 10 AND length(title) <= 255),
  CONSTRAINT slug_format CHECK (slug ~* '^[a-z0-9-]+$'),
  CONSTRAINT content_length CHECK (length(content) >= 100)
);

CREATE INDEX idx_articles_slug ON articles(slug);
CREATE INDEX idx_articles_author_id ON articles(author_id);
CREATE INDEX idx_articles_status ON articles(status);
CREATE INDEX idx_articles_published_at ON articles(published_at DESC);

CREATE TABLE article_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  tag_name varchar(50) NOT NULL,
  tag_type varchar(20) NOT NULL DEFAULT 'other'
    CHECK (tag_type IN ('sport', 'location', 'team', 'league', 'context', 'other')),
  created_at timestamp NOT NULL DEFAULT now(),

  UNIQUE(article_id, tag_name)
);

CREATE INDEX idx_article_tags_article_id ON article_tags(article_id);
CREATE INDEX idx_article_tags_tag_name ON article_tags(tag_name);

CREATE TABLE academy_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title varchar(255) NOT NULL,
  slug varchar(255) NOT NULL UNIQUE,
  content text NOT NULL,
  cover_image_url varchar(500),
  order_position int NOT NULL DEFAULT 0,
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  published_by_admin_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status varchar(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  published_at timestamp DEFAULT NULL,
  difficulty varchar(15) DEFAULT 'beginner'
    CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  estimated_read_minutes int DEFAULT 5,
  views_count int DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX idx_academy_articles_slug ON academy_articles(slug);
CREATE INDEX idx_academy_articles_status ON academy_articles(status);
CREATE INDEX idx_academy_articles_order_position ON academy_articles(order_position);
```

---

## 3. Geography & Competitions

```sql
CREATE TABLE countries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(2) NOT NULL UNIQUE,
  name varchar(100) NOT NULL UNIQUE,
  flag_emoji varchar(10),
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX idx_countries_code ON countries(code);

CREATE TABLE leagues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id uuid NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  name varchar(150) NOT NULL,
  slug varchar(150) NOT NULL UNIQUE,
  logo_url varchar(500),
  is_active boolean NOT NULL DEFAULT true,
  external_api_id varchar(100),
  external_api_source varchar(15) DEFAULT 'api_football'
    CHECK (external_api_source IN ('api_football', 'espn')),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX idx_leagues_country_id ON leagues(country_id);
CREATE INDEX idx_leagues_slug ON leagues(slug);
CREATE INDEX idx_leagues_external_api_id ON leagues(external_api_id);

CREATE TABLE teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id uuid NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
  name varchar(150) NOT NULL,
  slug varchar(150) NOT NULL UNIQUE,
  logo_url varchar(500),
  external_api_id varchar(100),
  external_api_source varchar(15) DEFAULT 'api_football'
    CHECK (external_api_source IN ('api_football', 'espn')),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX idx_teams_country_id ON teams(country_id);
CREATE INDEX idx_teams_slug ON teams(slug);
```

---

## 4. Matches & Predictions

```sql
CREATE TABLE matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  home_team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  away_team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  scheduled_at timestamp NOT NULL,
  status varchar(15) NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'live', 'finished', 'postponed', 'cancelled')),
  home_score int DEFAULT NULL,
  away_score int DEFAULT NULL,
  youtube_embed_url varchar(500),
  twitch_stream_url varchar(500),
  external_api_id varchar(100),
  external_api_source varchar(15) DEFAULT 'api_football'
    CHECK (external_api_source IN ('api_football', 'espn')),
  last_synced_at timestamp DEFAULT NULL,
  home_team_slug varchar(150),
  away_team_slug varchar(150),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),

  CONSTRAINT valid_score CHECK (
    (status != 'finished' AND home_score IS NULL AND away_score IS NULL) OR
    (status = 'finished' AND home_score IS NOT NULL AND away_score IS NOT NULL)
  ),
  CONSTRAINT teams_different CHECK (home_team_id != away_team_id)
);

CREATE INDEX idx_matches_league_id ON matches(league_id);
CREATE INDEX idx_matches_home_team_id ON matches(home_team_id);
CREATE INDEX idx_matches_away_team_id ON matches(away_team_id);
CREATE INDEX idx_matches_scheduled_at ON matches(scheduled_at DESC);
CREATE INDEX idx_matches_status ON matches(status);

CREATE TABLE predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  tipster_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prediction_type varchar(20) NOT NULL
    CHECK (prediction_type IN ('winner', 'over_under', 'both_score', 'exact_score',
                               'first_goal', 'handicap', 'draw_no_bet', 'double_chance')),
  prediction_value varchar(100) NOT NULL,
  confidence int NOT NULL DEFAULT 50,
  odds numeric(8,2) NOT NULL,
  suggested_stake numeric(10,2) DEFAULT 100,
  status varchar(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'pending_result', 'won', 'lost', 'voided', 'rejected')),
  result_marked_at timestamp DEFAULT NULL,
  result_marked_by_admin_id uuid REFERENCES users(id) ON DELETE SET NULL,
  description text,
  tag_name varchar(50),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  published_at timestamp DEFAULT NULL,

  CONSTRAINT confidence_valid CHECK (confidence >= 1 AND confidence <= 100),
  CONSTRAINT odds_valid CHECK (odds > 1 AND odds < 1000),
  CONSTRAINT stake_valid CHECK (suggested_stake > 0)
);

CREATE INDEX idx_predictions_match_id ON predictions(match_id);
CREATE INDEX idx_predictions_tipster_id ON predictions(tipster_id);
CREATE INDEX idx_predictions_status ON predictions(status);
CREATE INDEX idx_predictions_published_at ON predictions(published_at DESC);
```

---

## 5. Tipster Stats & Rankings

```sql
CREATE TABLE tipster_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipster_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  total_predictions int DEFAULT 0,
  total_won int DEFAULT 0,
  total_lost int DEFAULT 0,
  total_voided int DEFAULT 0,
  hit_rate numeric(5,2) DEFAULT 0,
  roi numeric(8,2) DEFAULT 0,
  followers_count int DEFAULT 0,
  average_odds numeric(8,2) DEFAULT 0,
  week_predictions int DEFAULT 0,
  week_won int DEFAULT 0,
  month_predictions int DEFAULT 0,
  month_won int DEFAULT 0,
  last_updated_at timestamp NOT NULL DEFAULT now(),

  CONSTRAINT hit_rate_valid CHECK (hit_rate >= 0 AND hit_rate <= 100)
);

CREATE INDEX idx_tipster_stats_tipster_id ON tipster_stats(tipster_id);
CREATE INDEX idx_tipster_stats_hit_rate ON tipster_stats(hit_rate DESC);

CREATE TABLE tipster_rankings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipster_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period varchar(10) NOT NULL
    CHECK (period IN ('week', 'month', 'year', 'all_time')),
  period_start_date date NOT NULL,
  period_end_date date NOT NULL,
  speciality varchar(15) NOT NULL DEFAULT 'none'
    CHECK (speciality IN ('none', 'over_under', 'both_score', 'exact_score', 'winner')),
  rank_position int NOT NULL,
  predictions_count int NOT NULL DEFAULT 0,
  won_count int NOT NULL DEFAULT 0,
  hit_rate_period numeric(5,2) DEFAULT 0,
  roi_period numeric(8,2) DEFAULT 0,
  profit numeric(10,2) DEFAULT 0,
  updated_at timestamp NOT NULL DEFAULT now(),

  UNIQUE(tipster_id, period, speciality, period_start_date)
);

CREATE INDEX idx_tipster_rankings_period ON tipster_rankings(period);
CREATE INDEX idx_tipster_rankings_rank_position ON tipster_rankings(rank_position);

CREATE TABLE user_follows_tipster (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tipster_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followed_at timestamp NOT NULL DEFAULT now(),

  UNIQUE(user_id, tipster_id),
  CONSTRAINT user_not_tipster CHECK (user_id != tipster_id)
);

CREATE INDEX idx_user_follows_tipster_user_id ON user_follows_tipster(user_id);
CREATE INDEX idx_user_follows_tipster_tipster_id ON user_follows_tipster(tipster_id);
```

---

## 6. Gamification (Points, Credits, Badges)

```sql
CREATE TABLE user_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  total_points int NOT NULL DEFAULT 0,
  points_from_correct_predictions int DEFAULT 0,
  points_from_followers int DEFAULT 0,
  points_from_bonuses int DEFAULT 0,
  points_from_achievements int DEFAULT 0,
  points_from_promotion int DEFAULT 0,
  updated_at timestamp NOT NULL DEFAULT now(),

  CONSTRAINT total_valid CHECK (total_points >= 0)
);

CREATE INDEX idx_user_points_user_id ON user_points(user_id);

CREATE TABLE point_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_type varchar(30) NOT NULL
    CHECK (transaction_type IN ('correct_prediction', 'wrong_prediction', 'new_follower',
                                'weekly_bonus', 'monthly_bonus', 'achievement_earned',
                                'promotion_to_tipster', 'admin_adjustment', 'other')),
  amount int NOT NULL,
  reference_id uuid DEFAULT NULL,
  reference_type varchar(50),
  description text,
  created_at timestamp NOT NULL DEFAULT now(),

  CONSTRAINT amount_not_zero CHECK (amount != 0)
);

CREATE INDEX idx_point_transactions_user_id ON point_transactions(user_id);
CREATE INDEX idx_point_transactions_type ON point_transactions(transaction_type);

CREATE TABLE user_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  total_credits int NOT NULL DEFAULT 0,
  credits_available int DEFAULT 0,
  credits_pending int DEFAULT 0,
  updated_at timestamp NOT NULL DEFAULT now(),

  CONSTRAINT total_valid CHECK (total_credits >= 0)
);

CREATE INDEX idx_user_credits_user_id ON user_credits(user_id);

CREATE TABLE credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_type varchar(30) NOT NULL
    CHECK (transaction_type IN ('earned_from_prediction', 'earned_bonus', 'redeemed', 'admin_adjustment')),
  amount int NOT NULL,
  description text,
  created_at timestamp NOT NULL DEFAULT now(),

  CONSTRAINT amount_not_zero CHECK (amount != 0)
);

CREATE INDEX idx_credit_transactions_user_id ON credit_transactions(user_id);

CREATE TABLE badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(50) NOT NULL UNIQUE,
  name varchar(100) NOT NULL,
  description text,
  icon_url varchar(500),
  criteria_json jsonb NOT NULL,
  tier varchar(10) DEFAULT 'bronze'
    CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id uuid NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  earned_at timestamp NOT NULL DEFAULT now(),

  UNIQUE(user_id, badge_id)
);

CREATE INDEX idx_user_badges_user_id ON user_badges(user_id);
```

---

## 7. Credits Redemption

```sql
CREATE TABLE credit_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credits_amount int NOT NULL,
  converted_to_currency numeric(10,2) NOT NULL,
  redemption_method varchar(15) NOT NULL
    CHECK (redemption_method IN ('pix', 'ted', 'digital_wallet')),
  pix_key varchar(255),
  bank_account_json jsonb,
  status varchar(15) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'paid', 'refunded')),
  reviewed_by_admin_id uuid REFERENCES users(id) ON DELETE SET NULL,
  review_notes text,
  rejection_reason text,
  fee_percentage numeric(5,2) DEFAULT 5,
  fee_amount numeric(10,2) GENERATED ALWAYS AS (converted_to_currency * (fee_percentage / 100)) STORED,
  final_amount numeric(10,2) GENERATED ALWAYS AS (converted_to_currency - (converted_to_currency * (fee_percentage / 100))) STORED,
  payment_reference varchar(100),
  paid_at timestamp DEFAULT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),

  CONSTRAINT credits_valid CHECK (credits_amount > 0),
  CONSTRAINT amount_valid CHECK (converted_to_currency > 0)
);

CREATE INDEX idx_credit_redemptions_user_id ON credit_redemptions(user_id);
CREATE INDEX idx_credit_redemptions_status ON credit_redemptions(status);
```

> **Nota:** no original, `final_amount` referenciava a coluna gerada `fee_amount`. O Postgres
> não permite uma coluna `GENERATED` referenciar outra coluna gerada, então a expressão de
> `fee_amount` foi reescrita inline em `final_amount`.

---

## 8. Sportsbooks & Affiliate Tracking

```sql
CREATE TABLE sportsbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) NOT NULL UNIQUE,
  slug varchar(100) NOT NULL UNIQUE,
  logo_url varchar(500),
  affiliate_url varchar(500) NOT NULL,
  commission_type varchar(10) NOT NULL
    CHECK (commission_type IN ('cpa', 'revshare', 'hybrid')),
  commission_rate numeric(5,2) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  description text,
  website_url varchar(500),
  total_clicks int DEFAULT 0,
  total_signups int DEFAULT 0,
  total_revenue numeric(12,2) DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),

  CONSTRAINT commission_valid CHECK (commission_rate > 0 AND commission_rate < 100)
);

CREATE INDEX idx_sportsbooks_slug ON sportsbooks(slug);
CREATE INDEX idx_sportsbooks_is_active ON sportsbooks(is_active);

CREATE TABLE affiliate_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sportsbook_id uuid NOT NULL REFERENCES sportsbooks(id) ON DELETE CASCADE,
  context_type varchar(15) NOT NULL
    CHECK (context_type IN ('article', 'prediction', 'comparison', 'general')),
  context_id uuid DEFAULT NULL,
  tracking_code varchar(100) UNIQUE,
  custom_url varchar(500),
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX idx_affiliate_links_sportsbook_id ON affiliate_links(sportsbook_id);
CREATE INDEX idx_affiliate_links_tracking_code ON affiliate_links(tracking_code);

CREATE TABLE tracking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_link_id uuid REFERENCES affiliate_links(id) ON DELETE SET NULL,
  sportsbook_id uuid NOT NULL REFERENCES sportsbooks(id) ON DELETE CASCADE,
  event_type varchar(15) NOT NULL
    CHECK (event_type IN ('click', 'signup', 'deposit', 'conversion')),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  session_id varchar(100),
  ip_address_hash varchar(100),
  user_agent_hash varchar(100),
  referrer_url varchar(500),
  referrer_page varchar(255),
  is_conversion boolean DEFAULT false,
  conversion_amount numeric(10,2) DEFAULT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  conversion_at timestamp DEFAULT NULL
);

CREATE INDEX idx_tracking_events_sportsbook_id ON tracking_events(sportsbook_id);
CREATE INDEX idx_tracking_events_event_type ON tracking_events(event_type);
```

---

## 9. Notifications

```sql
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type varchar(35) NOT NULL
    CHECK (type IN ('tipster_new_prediction', 'prediction_result', 'promotion_to_tipster',
                    'credit_redemption_approved', 'credit_redemption_rejected', 'new_badge',
                    'achievement_unlocked', 'follower_gained', 'system_announcement')),
  title varchar(255) NOT NULL,
  message text NOT NULL,
  reference_id uuid DEFAULT NULL,
  reference_type varchar(50),
  is_read boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT now(),
  read_at timestamp DEFAULT NULL
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);

CREATE TABLE push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  push_type varchar(10) NOT NULL
    CHECK (push_type IN ('web', 'ios', 'android')),
  subscription_json jsonb NOT NULL,
  device_name varchar(255),
  device_os varchar(50),
  is_active boolean NOT NULL DEFAULT true,
  is_blocked boolean NOT NULL DEFAULT false,
  receive_prediction_notifications boolean DEFAULT true,
  receive_result_notifications boolean DEFAULT true,
  receive_achievement_notifications boolean DEFAULT true,
  last_tested_at timestamp DEFAULT NULL,
  last_used_at timestamp DEFAULT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id);
```

---

## 10. System

```sql
CREATE TABLE api_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key varchar(255) NOT NULL UNIQUE,
  cache_type varchar(15) NOT NULL
    CHECK (cache_type IN ('matches', 'standings', 'teams', 'leagues', 'statistics')),
  cached_data jsonb NOT NULL,
  source varchar(15) NOT NULL
    CHECK (source IN ('api_football', 'espn')),
  expires_at timestamp NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_cache_cache_key ON api_cache(cache_key);
CREATE INDEX idx_api_cache_expires_at ON api_cache(expires_at);

CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_role varchar(50),
  action varchar(20) NOT NULL
    CHECK (action IN ('create', 'read', 'update', 'delete', 'approve', 'reject', 'publish',
                      'unpublish', 'block_user', 'promote_tipster', 'mark_result',
                      'approve_redemption', 'login', 'logout')),
  resource_type varchar(50) NOT NULL,
  resource_id uuid,
  resource_name varchar(255),
  changes_json jsonb,
  ip_address_hash varchar(100),
  user_agent varchar(500),
  success boolean NOT NULL DEFAULT true,
  error_message text DEFAULT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_actor_user_id ON audit_log(actor_user_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);
```

---

## Lista das 26 tabelas

1. users
2. articles
3. article_tags
4. academy_articles
5. countries
6. leagues
7. teams
8. matches
9. predictions
10. tipster_stats
11. tipster_rankings
12. user_follows_tipster
13. user_points
14. point_transactions
15. user_credits
16. credit_transactions
17. badges
18. user_badges
19. credit_redemptions
20. sportsbooks
21. affiliate_links
22. tracking_events
23. notifications
24. push_subscriptions
25. api_cache
26. audit_log

> **RLS (Row Level Security):** habilitado em todas as tabelas via
> `docs/migrations/002_rls_policies.sql` (rodar depois do schema). Ver as policies das 4 roles lá.

---

## 11. Integração com Supabase Auth

Quando alguém se cadastra, o Supabase cria uma linha em `auth.users`. Este trigger cria
automaticamente o perfil correspondente em `public.users`, lendo `username` e `full_name`
dos metadados enviados no signup (`options.data`).

**Rode este bloco depois de criar a tabela `users`.**

```sql
-- Função: cria o perfil em public.users a partir do novo auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, username, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$$;

-- Trigger: dispara após inserir em auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

> **Nota:** o `username` precisa ser único (constraint em `users`). O app valida/garante a
> unicidade antes do signup; o `COALESCE` com a parte local do e-mail é só um fallback.
