-- ===================================================================
-- DIBREVA Mini ERP — Migração: Lista de usuários autorizados
-- Aplicar no Supabase SQL Editor (uma única execução)
-- ===================================================================
--
-- Contexto:
--   Até aqui qualquer conta criada no Supabase Auth entrava no CRM,
--   porque as policies só exigiam auth.uid() IS NOT NULL. Esta migração
--   cria a tabela usuarios_autorizados e troca TODAS as policies das
--   tabelas do sistema para exigir que o e-mail do usuário logado esteja
--   nessa lista (função usuario_autorizado()).
--
-- Impacto:
--   - Usuário logado com e-mail na lista → continua funcionando igual.
--   - Usuário logado com e-mail fora da lista → não lê nem escreve nada
--     (o front também desloga e mostra "acesso não autorizado").
--   - Edge Functions / funções na Vercel → continuam funcionando
--     (SERVICE_ROLE_KEY bypassa RLS).
--   - Views vw_* passam a rodar com os direitos de quem consulta
--     (security_invoker), fechando a leitura anônima via view.
--
-- Como adicionar alguém depois:
--   INSERT INTO usuarios_autorizados (email, nome) VALUES ('x@gmail.com', 'Nome');
-- Como bloquear alguém:
--   UPDATE usuarios_autorizados SET ativo = false WHERE email = 'x@gmail.com';
--
-- Além desta migração, desligar o cadastro público no painel:
--   Authentication → Sign In / Providers → Email → "Allow new users to sign up" = OFF
-- ===================================================================

BEGIN;

-- 1. Tabela de e-mails autorizados -----------------------------------
CREATE TABLE IF NOT EXISTS public.usuarios_autorizados (
  email      TEXT PRIMARY KEY,
  nome       TEXT,
  ativo      BOOLEAN NOT NULL DEFAULT true,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- e-mails sempre em minúsculo, sem espaços
ALTER TABLE public.usuarios_autorizados
  DROP CONSTRAINT IF EXISTS usuarios_autorizados_email_minusculo;
ALTER TABLE public.usuarios_autorizados
  ADD CONSTRAINT usuarios_autorizados_email_minusculo
  CHECK (email = lower(btrim(email)));

INSERT INTO public.usuarios_autorizados (email, nome) VALUES
  ('lobo.nessa13@gmail.com',  'Vanessa Lobo'),
  ('dibrevaltda@gmail.com',   'DIBREVA'),
  ('contato@dibreva.com.br',  'DIBREVA (contato)')
ON CONFLICT (email) DO UPDATE SET ativo = true;

-- 2. Função usada pelas policies ---------------------------------------
--    SECURITY DEFINER para ler a lista sem depender de policy própria.
CREATE OR REPLACE FUNCTION public.usuario_autorizado()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios_autorizados u
    WHERE u.ativo
      AND u.email = lower(btrim(coalesce(auth.jwt() ->> 'email', '')))
  );
$$;

REVOKE ALL ON FUNCTION public.usuario_autorizado() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.usuario_autorizado() TO authenticated, anon, service_role;

-- 3. RLS da própria lista: autorizado enxerga a lista; ninguém edita via API
ALTER TABLE public.usuarios_autorizados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lista visivel para autorizados" ON public.usuarios_autorizados;
CREATE POLICY "Lista visivel para autorizados" ON public.usuarios_autorizados
  FOR SELECT USING (public.usuario_autorizado());

-- 4. Troca as policies de todas as tabelas do sistema ------------------
--    Para cada tabela existente: remove as policies atuais e cria uma
--    única "Somente autorizados" (FOR ALL).
DO $$
DECLARE
  t   TEXT;
  pol RECORD;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'leads', 'obras', 'receitas', 'despesas',
    'vistorias', 'vistoria_patologias', 'vistoria_resultados',
    'clientes', 'aditivos', 'notificacoes_log',
    'leads_raw', 'lead_interacoes',
    'followup_log',
    'documentos', 'documentos_contadores',
    'tarefas', 'tarefa_comentarios'
  ] LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE 'Tabela % não existe, pulando', t;
      CONTINUE;
    END IF;

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

-- 5. Views: rodar com os direitos de quem consulta ---------------------
--    Sem isso a view roda como dono (postgres) e ignora o RLS das tabelas.
DO $$
DECLARE v TEXT;
BEGIN
  FOREACH v IN ARRAY ARRAY[
    'vw_inadimplentes', 'vw_inadimplentes_kpis', 'vw_crm_kpis', 'vw_obras_kpis',
    'vw_followup_comercial', 'vw_followup_kpis', 'vw_documentos'
  ] LOOP
    IF to_regclass('public.' || v) IS NOT NULL THEN
      EXECUTE format('ALTER VIEW public.%I SET (security_invoker = on)', v);
    ELSE
      RAISE NOTICE 'View % não existe, pulando', v;
    END IF;
  END LOOP;
END $$;

COMMIT;

-- ===================================================================
-- VERIFICAÇÃO (executar depois do COMMIT, em query separada):
-- ===================================================================
-- SELECT tablename, policyname, qual, with_check
-- FROM pg_policies WHERE schemaname = 'public'
-- ORDER BY tablename;
--
-- Esperado: todas as tabelas do sistema com policyname = 'Somente autorizados'
-- e qual = 'usuario_autorizado()'.
--
-- SELECT * FROM usuarios_autorizados;   -- deve listar os 3 e-mails
-- ===================================================================

-- ===================================================================
-- ROLLBACK (voltar para "qualquer autenticado"):
-- ===================================================================
-- DO $$
-- DECLARE t TEXT;
-- BEGIN
--   FOREACH t IN ARRAY ARRAY['leads','obras','receitas','despesas','vistorias',
--     'vistoria_patologias','vistoria_resultados','clientes','aditivos',
--     'notificacoes_log','leads_raw','lead_interacoes','followup_log',
--     'documentos','documentos_contadores'] LOOP
--     IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
--     EXECUTE format('DROP POLICY IF EXISTS "Somente autorizados" ON public.%I', t);
--     EXECUTE format('CREATE POLICY "Autenticados" ON public.%I FOR ALL
--       USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL)', t);
--   END LOOP;
-- END $$;
-- ===================================================================
