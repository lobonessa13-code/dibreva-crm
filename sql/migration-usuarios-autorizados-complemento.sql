-- ===================================================================
-- DIBREVA Mini ERP — Complemento da migration de usuários autorizados
-- Aplicar no SQL Editor DEPOIS de migration-usuarios-autorizados.sql
-- (a migration principal já foi atualizada para incluir estes itens;
--  este arquivo existe só para quem já rodou a versão anterior)
-- ===================================================================
-- Fecha o que ficou de fora na primeira execução (2026-09-04):
--   - views de KPI sem security_invoker (liam leads/obras/receitas
--     como dono do banco, ignorando o RLS)
--   - tabelas antigas do módulo Tarefas ainda com "qualquer autenticado"
-- ===================================================================

BEGIN;

ALTER VIEW public.vw_crm_kpis           SET (security_invoker = on);
ALTER VIEW public.vw_obras_kpis         SET (security_invoker = on);
ALTER VIEW public.vw_inadimplentes_kpis SET (security_invoker = on);

DO $$
DECLARE
  t   TEXT;
  pol RECORD;
BEGIN
  FOREACH t IN ARRAY ARRAY['tarefas', 'tarefa_comentarios'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY "Somente autorizados" ON public.%I FOR ALL
         USING (public.usuario_autorizado())
         WITH CHECK (public.usuario_autorizado())', t);
  END LOOP;
END $$;

COMMIT;

-- Verificação (esperado: nenhuma linha):
-- SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
-- WHERE n.nspname = 'public' AND c.relkind = 'v' AND c.relname LIKE 'vw\_%'
--   AND coalesce(c.reloptions::text, '') NOT LIKE '%security_invoker=on%';
