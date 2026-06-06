# 🎯 PROMPT FINAL PARA CLAUDE CODE - Sportsbook Affiliate Portal

## INSTRUÇÃO PRINCIPAL

Crie um **Sportsbook Affiliate Portal** (similar a apwin.com.br) usando Next.js 14+, React Native, e Supabase.

Este é um **monorepo com 3 packages**: `web` (Next.js), `mobile` (React Native), e `shared` (tipos/schemas).

---

## 1. STACK TÉCNICO (USE EXATAMENTE ISTO)

### Monorepo
- **Yarn Workspaces** (root package.json com workspaces)

### Web (Next.js App)
- Next.js 14+ com App Router
- TypeScript
- Tailwind CSS
- ShadCN/UI
- Supabase Client (@supabase/auth-helpers-nextjs)

### Mobile (React Native)
- React Native CLI (não Expo)
- iOS + Android (100% feature parity)
- NativeWind (para Tailwind no mobile)
- React Navigation

### Shared
- TypeScript tipos/interfaces
- Zod para validações
- Custom hooks (useAuth, useFetch)
- API client utilities

### Backend
- Next.js API Routes (em web/app/api)
- Supabase (banco + auth + RLS)

### Data & APIs
- Supabase (PostgreSQL)
- API-Football (para dados de jogos)
- ESPN API (fallback)

### Notificações
- Web: Web Push API (browser)
- Mobile: React Native Firebase (FCM + APNs)

### Styling
- Dark mode: auto (sistema) + override manual
- Tailwind CSS (web) + NativeWind (mobile)

---

## 2. ESTRUTURA DE PASTAS

```
sportsbook-affiliate-portal/
├── package.json (root - yarn workspaces)
├── .gitignore
├── .env.local (será preenchido depois)
│
├── packages/
│   ├── web/                          # Next.js app
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx (homepage)
│   │   │   ├── (public)/
│   │   │   │   ├── noticias/
│   │   │   │   ├── palpites/
│   │   │   │   ├── tipsters/
│   │   │   │   ├── estatisticas/
│   │   │   │   ├── academia/
│   │   │   │   └── casas-de-apostas/
│   │   │   ├── (auth)/
│   │   │   │   ├── login/
│   │   │   │   ├── register/
│   │   │   │   └── reset-password/
│   │   │   ├── dashboard/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── meus-palpites/
│   │   │   │   ├── tipsters-seguidos/
│   │   │   │   ├── creditos/
│   │   │   │   ├── notificacoes/
│   │   │   │   ├── perfil/
│   │   │   │   └── configuracoes/
│   │   │   ├── admin/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── noticias/
│   │   │   │   ├── palpites/
│   │   │   │   ├── users/
│   │   │   │   ├── sportsbooks/
│   │   │   │   ├── creditos/
│   │   │   │   └── analytics/
│   │   │   ├── freelancer/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── noticias/
│   │   │   │   ├── palpites/
│   │   │   │   └── academy/
│   │   │   ├── api/
│   │   │   │   ├── auth/
│   │   │   │   ├── news/
│   │   │   │   ├── predictions/
│   │   │   │   ├── tipsters/
│   │   │   │   ├── user/
│   │   │   │   ├── admin/
│   │   │   │   ├── sportsbooks/
│   │   │   │   ├── cron/
│   │   │   │   └── health.ts
│   │   │   └── error.tsx, not-found.tsx
│   │   ├── components/
│   │   ├── lib/
│   │   ├── public/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── next.config.js
│   │   ├── tailwind.config.ts
│   │   └── .env.local (será preenchido)
│   │
│   ├── mobile/                       # React Native app
│   │   ├── src/
│   │   │   ├── navigation/
│   │   │   ├── screens/
│   │   │   ├── components/
│   │   │   ├── lib/
│   │   │   ├── App.tsx
│   │   │   └── index.js
│   │   ├── ios/
│   │   ├── android/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── app.json
│   │
│   └── shared/                       # Shared code
│       ├── src/
│       │   ├── types/
│       │   │   ├── user.ts
│       │   │   ├── article.ts
│       │   │   ├── prediction.ts
│       │   │   ├── sportsbook.ts
│       │   │   └── index.ts
│       │   ├── schemas/
│       │   │   ├── auth.ts
│       │   │   ├── article.ts
│       │   │   ├── prediction.ts
│       │   │   └── index.ts
│       │   ├── hooks/
│       │   │   ├── useAuth.ts
│       │   │   ├── useFetch.ts
│       │   │   └── useNotifications.ts
│       │   ├── api/
│       │   │   ├── client.ts (Supabase client)
│       │   │   ├── auth.ts
│       │   │   ├── articles.ts
│       │   │   ├── predictions.ts
│       │   │   └── index.ts
│       │   └── constants/
│       │       └── urls.ts
│       ├── package.json
│       └── tsconfig.json
│
└── docs/
    └── DATABASE_SCHEMA.md (incluir schema SQL)
```

---

## 3. SCHEMA SQL COMPLETO

Use exatamente este schema (26 tabelas):

### Users & Authentication
```sql
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(255) NOT NULL UNIQUE,
  password_hash varchar(255) NOT NULL,
  username varchar(50) NOT NULL UNIQUE,
  full_name varchar(100),
  avatar_url varchar(500),
  bio text,
  role enum('admin', 'content_manager', 'affiliate_manager', 'freelancer') NOT NULL DEFAULT 'freelancer',
  is_active boolean NOT NULL DEFAULT true,
  is_blocked boolean NOT NULL DEFAULT false,
  is_tipster boolean NOT NULL DEFAULT false,
  tipster_tier enum('none', 'bronze', 'silver', 'gold') DEFAULT 'none',
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

### Content (Articles, Academy, Tags)
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
  status enum('draft', 'pending_review', 'published', 'rejected', 'archived') NOT NULL DEFAULT 'draft',
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
  tag_type enum('sport', 'location', 'team', 'league', 'context', 'other') NOT NULL DEFAULT 'other',
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
  status enum('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
  published_at timestamp DEFAULT NULL,
  difficulty enum('beginner', 'intermediate', 'advanced') DEFAULT 'beginner',
  estimated_read_minutes int DEFAULT 5,
  views_count int DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX idx_academy_articles_slug ON academy_articles(slug);
CREATE INDEX idx_academy_articles_status ON academy_articles(status);
CREATE INDEX idx_academy_articles_order_position ON academy_articles(order_position);
```

### Geography & Competitions
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
  external_api_source enum('api_football', 'espn') DEFAULT 'api_football',
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
  external_api_source enum('api_football', 'espn') DEFAULT 'api_football',
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX idx_teams_country_id ON teams(country_id);
CREATE INDEX idx_teams_slug ON teams(slug);
```

### Matches & Predictions
```sql
CREATE TABLE matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  home_team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  away_team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  scheduled_at timestamp NOT NULL,
  status enum('scheduled', 'live', 'finished', 'postponed', 'cancelled') NOT NULL DEFAULT 'scheduled',
  home_score int DEFAULT NULL,
  away_score int DEFAULT NULL,
  youtube_embed_url varchar(500),
  twitch_stream_url varchar(500),
  external_api_id varchar(100),
  external_api_source enum('api_football', 'espn') DEFAULT 'api_football',
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
  prediction_type enum('winner', 'over_under', 'both_score', 'exact_score', 'first_goal', 'handicap', 'draw_no_bet', 'double_chance') NOT NULL,
  prediction_value varchar(100) NOT NULL,
  confidence int NOT NULL DEFAULT 50,
  odds numeric(8,2) NOT NULL,
  suggested_stake numeric(10,2) DEFAULT 100,
  status enum('draft', 'published', 'pending_result', 'won', 'lost', 'voided', 'rejected') NOT NULL DEFAULT 'draft',
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

### Tipster Stats & Rankings
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
  period enum('week', 'month', 'year', 'all_time') NOT NULL,
  period_start_date date NOT NULL,
  period_end_date date NOT NULL,
  speciality enum('none', 'over_under', 'both_score', 'exact_score', 'winner') NOT NULL DEFAULT 'none',
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

### Gamification (Points, Credits, Badges)
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
  transaction_type enum('correct_prediction', 'wrong_prediction', 'new_follower', 'weekly_bonus', 'monthly_bonus', 'achievement_earned', 'promotion_to_tipster', 'admin_adjustment', 'other') NOT NULL,
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
  transaction_type enum('earned_from_prediction', 'earned_bonus', 'redeemed', 'admin_adjustment') NOT NULL,
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
  tier enum('bronze', 'silver', 'gold', 'platinum') DEFAULT 'bronze',
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

### Credits Redemption
```sql
CREATE TABLE credit_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credits_amount int NOT NULL,
  converted_to_currency numeric(10,2) NOT NULL,
  redemption_method enum('pix', 'ted', 'digital_wallet') NOT NULL,
  pix_key varchar(255),
  bank_account_json jsonb,
  status enum('pending', 'approved', 'rejected', 'paid', 'refunded') NOT NULL DEFAULT 'pending',
  reviewed_by_admin_id uuid REFERENCES users(id) ON DELETE SET NULL,
  review_notes text,
  rejection_reason text,
  fee_percentage numeric(5,2) DEFAULT 5,
  fee_amount numeric(10,2) GENERATED ALWAYS AS (converted_to_currency * (fee_percentage / 100)) STORED,
  final_amount numeric(10,2) GENERATED ALWAYS AS (converted_to_currency - fee_amount) STORED,
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

### Sportsbooks & Affiliate Tracking
```sql
CREATE TABLE sportsbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) NOT NULL UNIQUE,
  slug varchar(100) NOT NULL UNIQUE,
  logo_url varchar(500),
  affiliate_url varchar(500) NOT NULL,
  commission_type enum('cpa', 'revshare', 'hybrid') NOT NULL,
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
  context_type enum('article', 'prediction', 'comparison', 'general') NOT NULL,
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
  event_type enum('click', 'signup', 'deposit', 'conversion') NOT NULL,
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

### Notifications
```sql
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type enum('tipster_new_prediction', 'prediction_result', 'promotion_to_tipster', 'credit_redemption_approved', 'credit_redemption_rejected', 'new_badge', 'achievement_unlocked', 'follower_gained', 'system_announcement') NOT NULL,
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
  push_type enum('web', 'ios', 'android') NOT NULL,
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

### System
```sql
CREATE TABLE api_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key varchar(255) NOT NULL UNIQUE,
  cache_type enum('matches', 'standings', 'teams', 'leagues', 'statistics') NOT NULL,
  cached_data jsonb NOT NULL,
  source enum('api_football', 'espn') NOT NULL,
  expires_at timestamp NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_cache_cache_key ON api_cache(cache_key);
CREATE INDEX idx_api_cache_expires_at ON api_cache(expires_at);

CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_role varchar(50),
  action enum('create', 'read', 'update', 'delete', 'approve', 'reject', 'publish', 'unpublish', 'block_user', 'promote_tipster', 'mark_result', 'approve_redemption', 'login', 'logout') NOT NULL,
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

**⚠️ Execute todo esse SQL no Supabase (SQL Editor) após criar o projeto.**

---

## 4. URLS PÚBLICAS (Em português, kebab-case)

### Seções Públicas
```
GET  /                              # Homepage
GET  /noticias                      # Listar notícias (infinite scroll)
GET  /noticias/[slug]               # Detalhe notícia
GET  /palpites                      # Listar palpites
GET  /palpites/[id]                 # Detalhe palpite
GET  /tipsters                      # Listar tipsters
GET  /tipsters/[username]           # Perfil tipster
GET  /tipsters/[username]/palpites  # Palpites do tipster
GET  /transmissoes                  # Transmissões ao vivo
GET  /estatisticas                  # Hub de estatísticas
GET  /estatisticas/[league]         # Tabela de liga
GET  /casas-de-apostas              # Listar sportsbooks
GET  /academia                      # Lista academia
GET  /academia/[slug]               # Artigo academia
```

### Autenticação
```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/refresh-token
POST /api/auth/forgot-password
POST /api/auth/reset-password
```

### User Dashboard (/dashboard - login obrigatório)
```
GET  /dashboard
GET  /dashboard/meus-palpites
GET  /dashboard/tipsters-seguidos
GET  /dashboard/notificacoes
GET  /dashboard/creditos
GET  /dashboard/creditos/resgate
GET  /dashboard/perfil
GET  /dashboard/configuracoes
```

### Tipster Dashboard (/tipster - se é tipster)
```
GET  /tipster/dashboard
GET  /tipster/performance
GET  /tipster/meus-palpites
```

### Admin (/admin - somente admin/managers)
```
GET  /admin/dashboard
GET  /admin/noticias
GET  /admin/noticias/novo
GET  /admin/noticias/[id]/editar
GET  /admin/palpites
GET  /admin/palpites/[id]/resultado
GET  /admin/users
GET  /admin/sportsbooks
GET  /admin/creditos/resgates
GET  /admin/analytics
GET  /admin/configuracoes
```

---

## 5. ENDPOINTS API (75+ endpoints)

Implemente TODOS estes endpoints em `web/app/api/`:

### Auth (6 endpoints)
```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/refresh-token
POST /api/auth/forgot-password
POST /api/auth/reset-password
```

### Public Content (15 endpoints)
```
GET  /api/news
GET  /api/news/[slug]
POST /api/news (admin/content_manager/freelancer)
PUT  /api/news/[id] (admin/content_manager/author)
DELETE /api/news/[id] (admin only)

GET  /api/predictions
GET  /api/predictions/[id]
POST /api/predictions (tipster)
PUT  /api/predictions/[id] (tipster)
POST /api/predictions/[id]/publish (tipster)
POST /api/predictions/[id]/result (admin/content_manager)

GET  /api/tipsters
GET  /api/tipsters/[username]
GET  /api/tipsters/[username]/predictions

GET  /api/rankings
GET  /api/statistics
```

### User Endpoints (15 endpoints)
```
GET  /api/user/profile
PUT  /api/user/profile
POST /api/user/password
GET  /api/user/notifications
POST /api/user/notifications/[id]/mark-read
POST /api/user/follow-tipster/[tipster-id]
DELETE /api/user/follow-tipster/[tipster-id]
GET  /api/user/followed-tipsters
GET  /api/user/bets
GET  /api/user/credits
POST /api/user/credits/redeem
GET  /api/user/settings
PUT  /api/user/settings
GET  /api/sportsbooks
GET  /api/transmissoes
```

### Admin Endpoints (20 endpoints)
```
GET  /api/admin/dashboard
GET  /api/admin/news
POST /api/admin/news/[id]/approve
POST /api/admin/news/[id]/reject
GET  /api/admin/predictions
POST /api/admin/predictions/[id]/mark-result
GET  /api/admin/users
POST /api/admin/users/[id]/block
POST /api/admin/users/[id]/unblock
POST /api/admin/users/[id]/promote-tipster
GET  /api/admin/sportsbooks
POST /api/admin/sportsbooks
GET  /api/admin/credits/redemptions
POST /api/admin/credits/redemptions/[id]/approve
POST /api/admin/credits/redemptions/[id]/reject
GET  /api/admin/analytics
POST /api/admin/rankings/recalculate
GET  /api/health
POST /api/cron/fetch-matches
POST /api/cron/update-match-results
POST /api/cron/calculate-rankings
```

---

## 6. ROLES E PERMISSÕES (4 roles)

### 1. ADMINISTRATOR
- Acesso total a tudo
- Gerencia conteúdo, usuários, sportsbooks, créditos

### 2. CONTENT MANAGER
- Gerencia notícias, palpites, academia
- Aprova/publica conteúdo
- Marca resultados de palpites
- Acesso limitado a /admin

### 3. AFFILIATE MANAGER
- Gerencia sportsbooks
- Rastreia conversões
- Vê analytics de afiliados
- Acesso limitado a /admin

### 4. FREELANCER (Author)
- Cria conteúdo (notícias, palpites, academia)
- Envia para aprovação
- Se promovido a Tipster: cria palpites publicados
- Acesso a /freelancer/dashboard e /dashboard

**Implementar RLS (Row Level Security) no Supabase para proteger dados.**

---

## 7. GAMIFICATION (Números Finais)

### Pontos por Acerto
```
1.01-1.50: 2 pontos
1.51-2.50: 5 pontos
2.51-5.00: 10 pontos
5.01-10.00: 15 pontos
10.01+: 20 pontos

Bônus semanal (segunda 00:00):
- 70% hit rate: +10
- 80% hit rate: +20
- 90% hit rate: +30
- Top 3: +25
- Top 4-10: +15

Bônus mensal (1º do mês 00:00):
- 75% hit rate: +50
- 85% hit rate: +100
- Top 3: +50
- ROI >= 50%: +75

Promoção a Tipster: +100
```

### Créditos por Acerto
```
Base: 1 crédito
Odds >= 5.0: +1 extra (total 2)
Odds >= 10.0: +2 extra (total 3)

Top tipster/mês: +100 créditos
Welcome bonus: +5 créditos
```

### Resgate de Créditos
```
Mínimo: 50 créditos
Máximo/vez: 1000 créditos
Frequência: 1x por mês
Taxa: 5%
Métodos: PIX, TED
Conversão: 1 crédito = 1 BRL
```

### Promoção a Tipster
```
Critério automático:
- Hit rate >= 60%
- Palpites >= 10
- Período: últimos 30 dias

Automático: sim (sem review)
Pontos ao promover: +100
```

### Badges (30+ achievements)
- Primeiro Palpite (bronze)
- Primeira Vitória (bronze)
- Expert (60% hit - silver)
- Mestre (70% hit - gold)
- Lenda (80% hit - gold)
- 100 Vitórias (silver)
- 500 Vitórias (gold)
- Popular (100 followers - silver)
- Influencer (500 followers - gold)
- (+ 20 outras badges)

---

## 8. CRON JOBS

Implemente estes cron jobs em `web/app/api/cron/`:

```
POST /api/cron/fetch-matches (a cada 5 min)
  - Busca próximos matches via API-Football
  - Armazena em cache
  - Notifica users

POST /api/cron/update-match-results (a cada 1 min durante matches)
  - Atualiza placares ao vivo
  - Processa resultados quando match termina

POST /api/cron/calculate-rankings (daily 23:50 UTC)
  - Calcula rankings semanais/mensais/all-time
  - Atualiza tipster_rankings

POST /api/cron/process-predictions (real-time após resultado)
  - Marca resultado de palpites
  - Calcula hit_rate, ROI
  - Dá pontos/créditos
  - Atualiza stats

POST /api/cron/award-points (real-time ou daily)
  - Calcula pontos por acerto
  - Aplica bônus semanais/mensais
  - Atualiza user_points

POST /api/cron/promote-tipsters (daily 00:30)
  - Verifica critérios (10 palpites, 60% hit rate)
  - Promove automaticamente
  - Envia notificações

POST /api/cron/sync-api-cache (a cada 6h)
  - Sincroniza dados com API-Football
  - Limpa cache antigo
```

**Proteger com `CRON_SECRET` header!**

---

## 9. AUTENTICAÇÃO

Use **Supabase Auth**:
- JWT tokens (access_token + refresh_token)
- Email/password
- Password reset via email
- Session management

Implement no Next.js:
```typescript
// lib/auth.ts
import { createClient } from '@supabase/auth-helpers-nextjs'

export const getAuth = () => createClient()
```

---

## 10. DARK MODE

- **Web**: Sistema automático (prefers-color-scheme) + toggle manual
  - Usar Tailwind dark: prefix
  - Armazenar preferência em localStorage
  
- **Mobile**: Sistema automático + toggle manual
  - Usar NativeWind dark: prefix
  - Armazenar em AsyncStorage

---

## 11. PUSH NOTIFICATIONS

### Web Push
```javascript
// lib/push.ts
import { Notification } from 'web-push'

export const registerPushNotification = async () => {
  const registration = await navigator.serviceWorker.register('/sw.js')
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  })
  // Salvar subscription no banco
}
```

### Mobile Push (Firebase)
```typescript
// mobile/lib/push.ts
import messaging from '@react-native-firebase/messaging'

export const setupPushNotifications = async () => {
  const token = await messaging().getToken()
  // Salvar token no banco
  
  messaging().onMessage(handleRemoteMessage)
  messaging().setBackgroundMessageHandler(handleRemoteMessage)
}
```

---

## 12. INSTRUÇÕES DE SETUP

### Após gerar o projeto:

1. **Instalar dependências**
```bash
yarn install
```

2. **Copiar .env.local para web/**
```bash
cp .env.local packages/web/.env.local
```

3. **Executar migrations SQL** (copiar schema SQL acima para Supabase SQL Editor)

4. **Popular dados iniciais** (seed data - criar script)

5. **Rodar em desenvolvimento**
```bash
# Web
yarn web dev

# Mobile (com Xcode/Android Studio)
yarn mobile start
```

6. **Testar em localhost:3000**

---

## 13. ESTRUTURA DE RESPOSTA API

Todas as respostas devem seguir este padrão:

```json
{
  "data": {},
  "error": null,
  "message": "Success"
}
```

Ou em caso de erro:
```json
{
  "error": "ERROR_CODE",
  "message": "Descrição do erro",
  "details": {}
}
```

---

## 14. TECNOLOGIAS ESPECÍFICAS A USAR

- **Web**:
  - next/auth (Supabase)
  - next/image
  - zustand (state management)
  - react-query (data fetching)
  - zod (validation)

- **Mobile**:
  - @react-navigation
  - zustand
  - react-query
  - zod

- **Shared**:
  - TypeScript
  - Zod
  - date-fns

---

## 15. FEATURES CRÍTICAS A IMPLEMENTAR

✅ Autenticação completa
✅ Homepage com hero + top palpites + notícias
✅ CRUD de notícias/palpites
✅ Sistema de tipsters
✅ Rankings (semanal/mensal/all-time)
✅ Dashboard de usuário
✅ Admin dashboard
✅ Gamification (pontos, créditos, badges)
✅ Notificações (web + mobile)
✅ Dark mode
✅ Cron jobs funcionando
✅ RLS no banco

---

## 16. NÃO PRECISA IMPLEMENTAR (Por enquanto)

❌ Testes unitários/E2E
❌ Documentação Swagger
❌ CI/CD
❌ Monitoramento (Sentry)
❌ Analytics
❌ Webhooks de afiliados (estrutura sim, mas não testar)

---

## 17. .env.local (Já fornecido)

```
NEXT_PUBLIC_SUPABASE_URL=https://lbzhxkpgxcopxdafhyxk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key]
SUPABASE_SERVICE_ROLE_KEY=[service-key]
FIREBASE_PROJECT_ID=palpitetododia-e3312
FIREBASE_PRIVATE_KEY=[private-key]
FIREBASE_CLIENT_EMAIL=[client-email]
API_FOOTBALL_KEY=1c7a31050d457e54c661ce5a7495a347
API_FOOTBALL_HOST=api-football-v3.p.rapidapi.com
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BOmZVukudDfh2NQDO13DQjXJ_D4_rXlzoXUA9VimozmD6sso6GdJjGj2kjXzyYTdIxwuj92_sOr3WSgSQGFkXqM
VAPID_PRIVATE_KEY=MZnusVbxLa6UaWFy7nDHoYhC4KsA1fs-9yP0Iw2Y1MU
CRON_SECRET=palpitetododia-super-secret-cron-2024
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NODE_ENV=development
LOG_LEVEL=debug
```

---

## RESUMO

Você precisa gerar um monorepo Next.js + React Native com:
- ✅ 26 tabelas SQL (schema completo acima)
- ✅ 75+ endpoints API
- ✅ 4 roles com permissões (RLS)
- ✅ Sistema de gamification (pontos, créditos, badges)
- ✅ Cron jobs automatizados
- ✅ Push notifications (web + mobile)
- ✅ Dark mode
- ✅ Estrutura profissional e pronta para produção

**Use EXATAMENTE os números, nomes de routes, e estrutura acima.**

Boa sorte! 🚀
