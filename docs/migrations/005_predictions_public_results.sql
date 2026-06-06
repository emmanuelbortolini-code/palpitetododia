-- Migration 005 — expor resultados de palpites ao público.
--
-- A policy original (002) só liberava status = 'published' para anon/authenticated.
-- Ao marcar resultado o status vira won/lost/voided e o palpite sumia da página
-- pública /palpites — quebrando o histórico (green/red) dos tipsters.
-- Aqui liberamos também os estados resolvidos. 'draft' e 'rejected' continuam
-- visíveis só para o autor e para o staff de conteúdo.

DROP POLICY IF EXISTS predictions_select ON public.predictions;

CREATE POLICY predictions_select ON public.predictions
  FOR SELECT USING (
    status IN ('published', 'pending_result', 'won', 'lost', 'voided')
    OR tipster_id = auth.uid()
    OR public.is_content_staff()
  );
