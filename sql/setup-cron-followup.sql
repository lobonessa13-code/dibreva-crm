-- ===================================================================
-- DIBREVA - Agendamento do job de follow-up comercial
-- Roda DIARIAMENTE as 13:00 UTC = 10:00 Brasilia
-- (horario comercial, melhor para mensagem de vendas no WhatsApp)
--
-- PRE-REQUISITOS:
-- 1) Aplicar migration-followup-comercial.sql
-- 2) Deploy das Edge Functions: verificar-followups e enviar-followup
-- 3) Secrets ZAPI_INSTANCE_ID e ZAPI_TOKEN ja configurados no projeto
--    (sao os mesmos usados pela cobranca automatica)
-- 4) Extensoes pg_cron e pg_net habilitadas (ja ativas para a cobranca)
--
-- SUBSTITUA antes de executar:
--   {{PROJECT_REF}}  -> ref do projeto (ex: xokskfdzsdxzieboqozq)
--   {{SERVICE_ROLE}} -> service_role key JWT legacy (Settings -> API)
-- ===================================================================

-- 1. Garante extensoes
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. (Re)agenda o job, removendo versao anterior se existir
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dibreva-verificar-followups') THEN
    PERFORM cron.unschedule('dibreva-verificar-followups');
  END IF;
END $$;

-- 3. Agenda execucao diaria as 13:00 UTC (10:00 Brasilia)
SELECT cron.schedule(
  'dibreva-verificar-followups',
  '0 13 * * *',
  $$
  SELECT net.http_post(
    url := 'https://{{PROJECT_REF}}.supabase.co/functions/v1/verificar-followups',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer {{SERVICE_ROLE}}'
    ),
    body := jsonb_build_object('source', 'cron')
  );
  $$
);

-- ===================================================================
-- Verificar agendamento:
-- SELECT * FROM cron.job WHERE jobname = 'dibreva-verificar-followups';
--
-- Historico de execucoes (ultimas 20):
-- SELECT jobid, status, return_message, start_time
-- FROM cron.job_run_details
-- WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'dibreva-verificar-followups')
-- ORDER BY start_time DESC LIMIT 20;
--
-- Para PAUSAR o job:
-- SELECT cron.unschedule('dibreva-verificar-followups');
-- ===================================================================
