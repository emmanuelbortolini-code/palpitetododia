-- ============================================================
-- Correção do trigger protect_user_columns (da migration 002)
--
-- Problema: o trigger revertia colunas sensíveis (role, créditos, etc.) sempre
-- que quem editava não fosse admin. Mas operações via service_role / Supabase
-- Table Editor / SQL Editor / crons NÃO têm usuário logado (auth.uid() = NULL),
-- então eram bloqueadas indevidamente (ex.: não dava pra promover alguém a admin
-- pelo painel — voltava para 'freelancer').
--
-- Correção: só proteger quando há um usuário final logado (auth.uid() != NULL).
-- Sem auth.uid() = contexto privilegiado (service_role/painel) → permitido.
-- anon não consegue dar UPDATE em users de qualquer forma (policy users_update
-- exige id = auth.uid(), que é NULL para anon).
-- ============================================================

CREATE OR REPLACE FUNCTION public.protect_user_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Contexto privilegiado (service_role, painel, crons) ou admin: libera.
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Usuário comum logado editando o próprio perfil: trava colunas sensíveis.
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
  NEW.email              := OLD.email;
  RETURN NEW;
END;
$$;
