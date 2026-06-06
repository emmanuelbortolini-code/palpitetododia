-- ============================================================
-- RLS (Row Level Security) + roles
-- Rode DEPOIS de 001_initial_schema.sql.
--
-- Modelo: RLS é a camada de segurança base em TODAS as tabelas.
-- - Logado (authenticated) acessa via RLS conforme as policies abaixo.
-- - Não-logado (anon) só enxerga conteúdo público (publicado / dados de referência).
-- - Operações de sistema (crons/webhooks) usam a service_role, que IGNORA RLS.
--
-- Tabelas SEM policy de cliente ficam acessíveis somente via service_role
-- (RLS habilitado + nenhuma policy = nega tudo para anon/authenticated).
--
-- Roles (coluna users.role): admin, content_manager, affiliate_manager, freelancer.
-- 'freelancer' é o usuário-base (todo cadastro começa assim).
-- ============================================================

-- ---------- Helpers de role ----------
-- SECURITY DEFINER: rodam como dono e ignoram RLS, evitando recursão ao ler users.

CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin');
$$;

CREATE OR REPLACE FUNCTION public.is_content_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'content_manager'));
$$;

CREATE OR REPLACE FUNCTION public.is_affiliate_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'affiliate_manager'));
$$;

-- ---------- Trigger anti-escalonamento de privilégio em users ----------
-- A policy de UPDATE permite o usuário editar a PRÓPRIA linha (perfil), mas RLS é
-- por linha, não por coluna. Este trigger impede que um não-admin altere colunas
-- sensíveis (role, créditos, pontos, status, email) na própria conta.

CREATE OR REPLACE FUNCTION public.protect_user_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Contexto privilegiado (service_role/painel/crons, sem usuário final) ou admin: libera.
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;
  NEW.role               := OLD.role;
  NEW.is_tipster         := OLD.is_tipster;
  NEW.tipster_tier       := OLD.tipster_tier;
  NEW.tipster_promoted_at := OLD.tipster_promoted_at;
  NEW.is_blocked         := OLD.is_blocked;
  NEW.is_active          := OLD.is_active;
  NEW.total_predictions  := OLD.total_predictions;
  NEW.hit_rate           := OLD.hit_rate;
  NEW.total_roi          := OLD.total_roi;
  NEW.total_points       := OLD.total_points;
  NEW.total_credits      := OLD.total_credits;
  NEW.email              := OLD.email; -- troca de email passa pelo fluxo do Supabase Auth
  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_user_columns_trg
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.protect_user_columns();

-- ============================================================
-- Habilitar RLS em TODAS as tabelas
-- ============================================================
ALTER TABLE public.users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_tags        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_articles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.countries           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leagues             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipster_stats       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipster_rankings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_follows_tipster ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_points         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_credits        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_redemptions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sportsbooks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_links     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_events     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_cache           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log           ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Policies
-- ============================================================

-- ---------- users ----------
-- Leitura: a própria conta ou admin. (Perfis públicos de tipster serão expostos
-- depois por uma view/função segura, sem vazar email.)
CREATE POLICY users_select ON public.users
  FOR SELECT USING (id = auth.uid() OR public.is_admin());
CREATE POLICY users_update ON public.users
  FOR UPDATE USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

-- ---------- articles ----------
CREATE POLICY articles_select ON public.articles
  FOR SELECT USING (status = 'published' OR author_id = auth.uid() OR public.is_content_staff());
CREATE POLICY articles_insert ON public.articles
  FOR INSERT WITH CHECK (author_id = auth.uid());
CREATE POLICY articles_update ON public.articles
  FOR UPDATE USING (author_id = auth.uid() OR public.is_content_staff())
  WITH CHECK (author_id = auth.uid() OR public.is_content_staff());
CREATE POLICY articles_delete ON public.articles
  FOR DELETE USING (public.is_admin());

-- ---------- article_tags ----------
CREATE POLICY article_tags_select ON public.article_tags
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.articles a
    WHERE a.id = article_id
      AND (a.status = 'published' OR a.author_id = auth.uid() OR public.is_content_staff())
  ));
CREATE POLICY article_tags_write ON public.article_tags
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.articles a
    WHERE a.id = article_id AND (a.author_id = auth.uid() OR public.is_content_staff())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.articles a
    WHERE a.id = article_id AND (a.author_id = auth.uid() OR public.is_content_staff())
  ));

-- ---------- academy_articles ----------
CREATE POLICY academy_select ON public.academy_articles
  FOR SELECT USING (status = 'published' OR public.is_content_staff());
CREATE POLICY academy_write ON public.academy_articles
  FOR ALL USING (public.is_content_staff()) WITH CHECK (public.is_content_staff());

-- ---------- Dados de referência: leitura pública, escrita via service_role ----------
CREATE POLICY countries_select ON public.countries FOR SELECT USING (true);
CREATE POLICY leagues_select   ON public.leagues   FOR SELECT USING (true);
CREATE POLICY teams_select     ON public.teams     FOR SELECT USING (true);
CREATE POLICY matches_select   ON public.matches   FOR SELECT USING (true);

-- ---------- predictions ----------
CREATE POLICY predictions_select ON public.predictions
  FOR SELECT USING (status = 'published' OR tipster_id = auth.uid() OR public.is_content_staff());
CREATE POLICY predictions_insert ON public.predictions
  FOR INSERT WITH CHECK (tipster_id = auth.uid());
CREATE POLICY predictions_update ON public.predictions
  FOR UPDATE USING (tipster_id = auth.uid() OR public.is_content_staff())
  WITH CHECK (tipster_id = auth.uid() OR public.is_content_staff());
CREATE POLICY predictions_delete ON public.predictions
  FOR DELETE USING (public.is_admin());

-- ---------- tipster_stats / tipster_rankings: leitura pública ----------
CREATE POLICY tipster_stats_select    ON public.tipster_stats    FOR SELECT USING (true);
CREATE POLICY tipster_rankings_select ON public.tipster_rankings FOR SELECT USING (true);

-- ---------- user_follows_tipster: cada um gerencia os próprios follows ----------
CREATE POLICY follows_select ON public.user_follows_tipster
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY follows_insert ON public.user_follows_tipster
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY follows_delete ON public.user_follows_tipster
  FOR DELETE USING (user_id = auth.uid());

-- ---------- Pontos/créditos: leitura do próprio dono (ou admin) ----------
CREATE POLICY user_points_select ON public.user_points
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY point_tx_select ON public.point_transactions
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY user_credits_select ON public.user_credits
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY credit_tx_select ON public.credit_transactions
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

-- ---------- Badges ----------
CREATE POLICY badges_select ON public.badges FOR SELECT USING (true);
CREATE POLICY user_badges_select ON public.user_badges FOR SELECT USING (true);

-- ---------- credit_redemptions: dono cria/lê; admin gerencia ----------
CREATE POLICY redemptions_select ON public.credit_redemptions
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY redemptions_insert ON public.credit_redemptions
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY redemptions_update ON public.credit_redemptions
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------- sportsbooks: leitura pública dos ativos; affiliate staff gerencia ----------
CREATE POLICY sportsbooks_select ON public.sportsbooks
  FOR SELECT USING (is_active = true OR public.is_affiliate_staff());
CREATE POLICY sportsbooks_write ON public.sportsbooks
  FOR ALL USING (public.is_affiliate_staff()) WITH CHECK (public.is_affiliate_staff());

-- ---------- affiliate_links / tracking_events: só affiliate staff lê (escrita via service_role) ----------
CREATE POLICY affiliate_links_select ON public.affiliate_links
  FOR SELECT USING (public.is_affiliate_staff());
CREATE POLICY tracking_events_select ON public.tracking_events
  FOR SELECT USING (public.is_affiliate_staff());

-- ---------- notifications: dono lê e marca como lida ----------
CREATE POLICY notifications_select ON public.notifications
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY notifications_update ON public.notifications
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ---------- push_subscriptions: dono gerencia ----------
CREATE POLICY push_subs_all ON public.push_subscriptions
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ---------- audit_log: só admin lê (escrita via service_role) ----------
CREATE POLICY audit_log_select ON public.audit_log
  FOR SELECT USING (public.is_admin());

-- api_cache: nenhuma policy de cliente — acesso só via service_role.
