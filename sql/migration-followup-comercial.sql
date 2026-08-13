-- ===================================================================
-- DIBREVA Mini ERP - Migration: Follow-up Comercial Automatico
-- Automatiza o acompanhamento via WhatsApp de orcamentos ja enviados.
-- Adiciona: colunas de follow-up em leads, tabela followup_log,
--           view vw_followup_comercial e KPIs.
-- Aplicar no Supabase SQL Editor APOS o schema.sql
-- ===================================================================

-- ===================================================================
-- 1. ALTERAR: leads -> controle de follow-up
-- ===================================================================
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS followup_ativo BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS qtd_followups_enviados INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ultimo_followup_em TIMESTAMPTZ;

-- ===================================================================
-- 2. TABELA: followup_log (auditoria de follow-ups enviados)
-- ===================================================================
CREATE TABLE IF NOT EXISTS followup_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,

  fase TEXT NOT NULL CHECK (fase IN ('confirmacao','duvidas','reforco','fechamento','manual')),
  canal TEXT NOT NULL DEFAULT 'whatsapp' CHECK (canal IN ('whatsapp')),
  destinatario TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  automatico BOOLEAN DEFAULT false,

  status TEXT NOT NULL DEFAULT 'enviado' CHECK (status IN ('enviado','falha')),
  erro TEXT,
  provider_response JSONB,

  enviado_em TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_followup_log_lead ON followup_log(lead_id);
CREATE INDEX IF NOT EXISTS idx_followup_log_enviado_em ON followup_log(enviado_em DESC);

ALTER TABLE followup_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Followup log autenticados" ON followup_log;
CREATE POLICY "Followup log autenticados" ON followup_log
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ===================================================================
-- 3. VIEW: vw_followup_comercial
-- Leads com orcamento enviado aguardando decisao (inclui pausados,
-- o filtro de ativo fica na Edge Function / painel)
-- ===================================================================
CREATE OR REPLACE VIEW vw_followup_comercial AS
SELECT
  l.id AS lead_id,
  l.condominio,
  l.cidade,
  l.tipo_servico,
  l.valor_estimado,
  l.status,
  l.nome_contato,
  l.telefone,
  l.email,
  l.probabilidade,
  l.proxima_acao,
  l.data_envio_orcamento,
  l.followup_ativo,
  l.qtd_followups_enviados,
  l.ultimo_followup_em,
  (CURRENT_DATE - l.data_envio_orcamento)::INTEGER AS dias_desde_envio
FROM leads l
WHERE l.deleted_at IS NULL
  AND l.status IN ('orcamento_enviado','followup_orcamento')
  AND l.data_envio_orcamento IS NOT NULL
ORDER BY l.data_envio_orcamento ASC;

-- ===================================================================
-- 4. VIEW: vw_followup_kpis (resumo para cards do painel)
-- ===================================================================
CREATE OR REPLACE VIEW vw_followup_kpis AS
SELECT
  COUNT(*) AS aguardando_retorno,
  COALESCE(SUM(valor_estimado), 0) AS valor_em_aberto,
  COUNT(*) FILTER (WHERE followup_ativo) AS com_automacao_ativa,
  COUNT(*) FILTER (
    WHERE ultimo_followup_em IS NULL AND dias_desde_envio >= 7
       OR ultimo_followup_em < now() - INTERVAL '7 days'
  ) AS sem_contato_7d
FROM vw_followup_comercial;

-- ===================================================================
-- FIM da migration
-- ===================================================================
