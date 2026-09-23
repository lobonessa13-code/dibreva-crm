-- ===================================================================
-- DIBREVA - Alerta diário de follow-ups (Telegram / WhatsApp da Vanessa)
-- Roda DIARIAMENTE às 11:00 UTC = 08:00 Brasília
--
-- PRÉ-REQUISITOS:
-- 1) Edge Function alerta-followups deployada
-- 2) Secrets TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID configurados
--    (opcional: ALERTA_WHATSAPP_NUMERO para receber também no WhatsApp)
--
-- SUBSTITUA antes de executar:
--   {{SERVICE_ROLE}} -> service_role key JWT legacy (Settings -> API),
--                       a mesma usada no setup-cron-followup.sql
-- ===================================================================

-- 1. (Re)agenda o job, removendo versão anterior se existir
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dibreva-alerta-followups') THEN
    PERFORM cron.unschedule('dibreva-alerta-followups');
  END IF;
END $$;

-- 2. Agenda execução diária às 11:00 UTC (08:00 Brasília)
SELECT cron.schedule(
  'dibreva-alerta-followups',
  '0 11 * * *',
  $$
  SELECT net.http_post(
    url := 'https://xokskfdzsdxzieboqozq.supabase.co/functions/v1/alerta-followups',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer {{SERVICE_ROLE}}'
    ),
    body := jsonb_build_object('source', 'cron')
  );
  $$
);

-- 3. Teste imediato: manda o alerta agora, mesmo sem pendências
SELECT net.http_post(
  url := 'https://xokskfdzsdxzieboqozq.supabase.co/functions/v1/alerta-followups',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer {{SERVICE_ROLE}}'
  ),
  body := jsonb_build_object('forcar', true)
);

-- ===================================================================
-- Conferir o agendamento:
-- SELECT jobname, schedule FROM cron.job WHERE jobname = 'dibreva-alerta-followups';
--
-- Resposta do teste (alguns segundos depois):
-- SELECT status_code, content FROM net._http_response ORDER BY created DESC LIMIT 1;
--
-- Para PAUSAR:
-- SELECT cron.unschedule('dibreva-alerta-followups');
-- ===================================================================
