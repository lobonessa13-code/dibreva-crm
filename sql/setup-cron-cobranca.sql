-- ===================================================================
-- DIBREVA — Agendamento do job de verificação de atrasos
-- Roda DIARIAMENTE às 09:00 (horário do servidor Supabase = UTC)
-- 09:00 UTC = 06:00 Brasília · ajuste se preferir outro horário
--
-- PRÉ-REQUISITOS:
-- 1) Aplicar migration-financeiro-cobranca.sql
-- 2) Deploy das Edge Functions: verificar-atrasos e enviar-lembrete
-- 3) Configurar secrets no projeto Supabase:
--    supabase secrets set RESEND_API_KEY=re_...
--    supabase secrets set RESEND_FROM_EMAIL="DIBREVA <financeiro@dibreva.com.br>"
--    supabase secrets set ZAPI_INSTANCE=xxxxxxxxxx
--    supabase secrets set ZAPI_TOKEN=xxxxxxxxxx
--    supabase secrets set ZAPI_CLIENT_TOKEN=xxxxxxxxxx  (se Account Security ativo)
-- 4) Habilitar as extensões pg_cron e pg_net no Supabase
--    (Database → Extensions → ativar 'pg_cron' e 'pg_net')
--
-- SUBSTITUA antes de executar:
--   {{PROJECT_REF}}     → ref do projeto (ex: xokskfdzsdxzieboqozq)
--   {{SERVICE_ROLE}}    → service_role key (Settings → API → service_role secret)
-- ===================================================================

-- 1. Habilita extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. (Re)agenda o job — remove versão anterior se existir
SELECT cron.unschedule('dibreva-verificar-atrasos') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'dibreva-verificar-atrasos'
);

-- 3. Agenda execução diária às 09:00 UTC
SELECT cron.schedule(
  'dibreva-verificar-atrasos',
  '0 9 * * *',  -- todo dia às 09:00 UTC
  $$
  SELECT net.http_post(
    url := 'https://{{PROJECT_REF}}.supabase.co/functions/v1/verificar-atrasos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer {{SERVICE_ROLE}}'
    ),
    body := jsonb_build_object('source', 'cron')
  );
  $$
);

-- ===================================================================
-- Verificar agendamento
-- ===================================================================
-- SELECT * FROM cron.job WHERE jobname = 'dibreva-verificar-atrasos';

-- ===================================================================
-- Histórico de execuções (últimas 20)
-- ===================================================================
-- SELECT jobid, status, return_message, start_time, end_time
-- FROM cron.job_run_details
-- WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'dibreva-verificar-atrasos')
-- ORDER BY start_time DESC LIMIT 20;

-- ===================================================================
-- Para PAUSAR o job:
-- ===================================================================
-- SELECT cron.unschedule('dibreva-verificar-atrasos');
