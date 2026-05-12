-- ===================================================================
-- DIBREVA Mini ERP — Migration: Clientes + Cobrança Automática
-- Adiciona: tabela clientes, aditivos, notificacoes_log,
--          status 'atrasado' em receitas, view inadimplentes
-- Aplicar no Supabase SQL Editor APÓS o schema.sql
-- ===================================================================

-- ===================================================================
-- 1. TABELA: clientes (cadastro completo)
-- ===================================================================
CREATE TABLE IF NOT EXISTS clientes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID DEFAULT auth.uid(),

  -- Identificação
  tipo TEXT NOT NULL DEFAULT 'condominio'
    CHECK (tipo IN ('condominio','empresa','pessoa_fisica')),
  nome TEXT NOT NULL,
  cpf_cnpj TEXT,
  inscricao_estadual TEXT,

  -- Condomínio
  nome_condominio TEXT,
  administradora TEXT,

  -- Endereço
  endereco_logradouro TEXT,
  endereco_numero TEXT,
  endereco_complemento TEXT,
  endereco_bairro TEXT,
  endereco_cidade TEXT,
  endereco_uf TEXT,
  endereco_cep TEXT,

  -- Contato
  email TEXT,
  email_cobranca TEXT,
  telefone TEXT,
  telefone_cobranca TEXT,
  whatsapp TEXT,

  -- Responsáveis (síndico, gestor, financeiro)
  nome_responsavel TEXT,
  cargo_responsavel TEXT,
  nome_financeiro TEXT,

  -- Preferências de comunicação
  notificar_email BOOLEAN DEFAULT true,
  notificar_whatsapp BOOLEAN DEFAULT true,

  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TRIGGER clientes_updated_at BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso total clientes" ON clientes FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_clientes_nome ON clientes(nome) WHERE deleted_at IS NULL;
CREATE INDEX idx_clientes_cpf_cnpj ON clientes(cpf_cnpj) WHERE deleted_at IS NULL;

-- ===================================================================
-- 2. ALTERAR: obras → adicionar FK cliente_id
-- ===================================================================
ALTER TABLE obras
  ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES clientes(id);

CREATE INDEX IF NOT EXISTS idx_obras_cliente_id ON obras(cliente_id);

-- ===================================================================
-- 3. ALTERAR: receitas → status 'atrasado' + parcelas + auditoria
-- ===================================================================

-- Remover constraint antiga e recriar com 'atrasado'
ALTER TABLE receitas DROP CONSTRAINT IF EXISTS receitas_status_check;
ALTER TABLE receitas ADD CONSTRAINT receitas_status_check
  CHECK (status IN ('previsto','recebido','atrasado'));

ALTER TABLE receitas
  ADD COLUMN IF NOT EXISTS data_recebimento DATE,
  ADD COLUMN IF NOT EXISTS numero_parcela INTEGER,
  ADD COLUMN IF NOT EXISTS total_parcelas INTEGER,
  ADD COLUMN IF NOT EXISTS forma_pagamento TEXT
    CHECK (forma_pagamento IN ('pix','boleto','transferencia','dinheiro','cheque','cartao') OR forma_pagamento IS NULL),
  ADD COLUMN IF NOT EXISTS comprovante_url TEXT,
  ADD COLUMN IF NOT EXISTS ultimo_lembrete_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS qtd_lembretes_enviados INTEGER DEFAULT 0;

-- ===================================================================
-- 4. TABELA: aditivos (renegociações vinculadas a obras)
-- ===================================================================
CREATE TABLE IF NOT EXISTS aditivos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID DEFAULT auth.uid(),
  obra_id UUID NOT NULL REFERENCES obras(id) ON DELETE CASCADE,

  numero INTEGER NOT NULL DEFAULT 1,
  descricao TEXT NOT NULL,
  valor_adicional NUMERIC(12,2) NOT NULL DEFAULT 0,
  prazo_adicional_dias INTEGER NOT NULL DEFAULT 0,
  data_aditivo DATE NOT NULL DEFAULT CURRENT_DATE,

  arquivo_url TEXT,
  observacoes TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TRIGGER aditivos_updated_at BEFORE UPDATE ON aditivos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE aditivos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso total aditivos" ON aditivos FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_aditivos_obra_id ON aditivos(obra_id) WHERE deleted_at IS NULL;

-- ===================================================================
-- 5. TABELA: notificacoes_log (auditoria de lembretes enviados)
-- ===================================================================
CREATE TABLE IF NOT EXISTS notificacoes_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  receita_id UUID REFERENCES receitas(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES clientes(id),
  obra_id UUID REFERENCES obras(id),

  canal TEXT NOT NULL CHECK (canal IN ('email','whatsapp','painel')),
  fase TEXT NOT NULL CHECK (fase IN ('lembrete','suave','formal','manual')),
  destinatario TEXT NOT NULL,
  assunto TEXT,
  mensagem TEXT NOT NULL,

  status TEXT NOT NULL DEFAULT 'enviado'
    CHECK (status IN ('enviado','falha','agendado')),
  erro TEXT,
  provider_response JSONB,

  enviado_em TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_notif_receita ON notificacoes_log(receita_id);
CREATE INDEX idx_notif_cliente ON notificacoes_log(cliente_id);
CREATE INDEX idx_notif_enviado_em ON notificacoes_log(enviado_em DESC);

ALTER TABLE notificacoes_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso total notificacoes_log" ON notificacoes_log FOR ALL USING (true) WITH CHECK (true);

-- ===================================================================
-- 6. FUNÇÃO: marcar receitas vencidas como 'atrasado'
-- ===================================================================
CREATE OR REPLACE FUNCTION fn_marcar_atrasos()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE receitas
  SET status = 'atrasado'
  WHERE status = 'previsto'
    AND data_prevista < CURRENT_DATE
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ===================================================================
-- 7. VIEW: vw_inadimplentes (parcelas atrasadas com dados do cliente)
-- ===================================================================
CREATE OR REPLACE VIEW vw_inadimplentes AS
SELECT
  r.id AS receita_id,
  r.descricao,
  r.valor,
  r.data_prevista,
  r.status,
  r.numero_parcela,
  r.total_parcelas,
  r.ultimo_lembrete_em,
  r.qtd_lembretes_enviados,
  (CURRENT_DATE - r.data_prevista)::INTEGER AS dias_atraso,
  CASE
    WHEN (CURRENT_DATE - r.data_prevista) <= 0 THEN 'a_vencer'
    WHEN (CURRENT_DATE - r.data_prevista) BETWEEN 1 AND 7 THEN 'amarelo'
    WHEN (CURRENT_DATE - r.data_prevista) BETWEEN 8 AND 15 THEN 'laranja'
    ELSE 'vermelho'
  END AS nivel_alerta,
  o.id AS obra_id,
  o.condominio,
  o.cliente AS cliente_obra_nome,
  c.id AS cliente_id,
  c.nome AS cliente_nome,
  c.cpf_cnpj,
  c.email,
  c.email_cobranca,
  c.telefone,
  c.whatsapp,
  c.nome_responsavel,
  c.notificar_email,
  c.notificar_whatsapp
FROM receitas r
LEFT JOIN obras o ON o.id = r.obra_id
LEFT JOIN clientes c ON c.id = o.cliente_id
WHERE r.deleted_at IS NULL
  AND (
    r.status = 'atrasado'
    OR (r.status = 'previsto' AND r.data_prevista < CURRENT_DATE)
    OR (r.status = 'previsto' AND r.data_prevista BETWEEN CURRENT_DATE AND CURRENT_DATE + 3)
  )
ORDER BY r.data_prevista ASC;

-- ===================================================================
-- 8. VIEW: vw_inadimplentes_kpis (resumo para card)
-- ===================================================================
CREATE OR REPLACE VIEW vw_inadimplentes_kpis AS
SELECT
  COUNT(*) FILTER (WHERE dias_atraso > 0) AS qtd_atrasadas,
  COALESCE(SUM(valor) FILTER (WHERE dias_atraso > 0), 0) AS valor_atrasado,
  COUNT(*) FILTER (WHERE dias_atraso BETWEEN 1 AND 7) AS qtd_amarelo,
  COUNT(*) FILTER (WHERE dias_atraso BETWEEN 8 AND 15) AS qtd_laranja,
  COUNT(*) FILTER (WHERE dias_atraso > 15) AS qtd_vermelho,
  COUNT(*) FILTER (WHERE dias_atraso BETWEEN -3 AND 0) AS qtd_a_vencer_3d
FROM vw_inadimplentes;

-- ===================================================================
-- 9. FUNÇÃO: fluxo de caixa POR OBRA
-- ===================================================================
CREATE OR REPLACE FUNCTION fn_fluxo_caixa_obra(p_obra_id UUID)
RETURNS TABLE(
  total_previsto NUMERIC,
  total_recebido NUMERIC,
  total_atrasado NUMERIC,
  total_despesas NUMERIC,
  total_pago NUMERIC,
  saldo_obra NUMERIC,
  qtd_parcelas_total INTEGER,
  qtd_parcelas_recebidas INTEGER,
  qtd_parcelas_atrasadas INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE((SELECT SUM(valor) FROM receitas WHERE obra_id = p_obra_id AND deleted_at IS NULL), 0),
    COALESCE((SELECT SUM(valor) FROM receitas WHERE obra_id = p_obra_id AND status = 'recebido' AND deleted_at IS NULL), 0),
    COALESCE((SELECT SUM(valor) FROM receitas WHERE obra_id = p_obra_id AND status = 'atrasado' AND deleted_at IS NULL), 0),
    COALESCE((SELECT SUM(valor) FROM despesas WHERE obra_id = p_obra_id AND deleted_at IS NULL), 0),
    COALESCE((SELECT SUM(valor) FROM despesas WHERE obra_id = p_obra_id AND status = 'pago' AND deleted_at IS NULL), 0),
    COALESCE((SELECT SUM(valor) FROM receitas WHERE obra_id = p_obra_id AND status = 'recebido' AND deleted_at IS NULL), 0) -
    COALESCE((SELECT SUM(valor) FROM despesas WHERE obra_id = p_obra_id AND status = 'pago' AND deleted_at IS NULL), 0),
    (SELECT COUNT(*)::INTEGER FROM receitas WHERE obra_id = p_obra_id AND deleted_at IS NULL),
    (SELECT COUNT(*)::INTEGER FROM receitas WHERE obra_id = p_obra_id AND status = 'recebido' AND deleted_at IS NULL),
    (SELECT COUNT(*)::INTEGER FROM receitas WHERE obra_id = p_obra_id AND status = 'atrasado' AND deleted_at IS NULL);
END;
$$ LANGUAGE plpgsql;

-- ===================================================================
-- 10. FUNÇÃO: registrar pagamento (marca recebido + data + forma)
-- ===================================================================
CREATE OR REPLACE FUNCTION fn_registrar_pagamento(
  p_receita_id UUID,
  p_data_recebimento DATE DEFAULT CURRENT_DATE,
  p_forma_pagamento TEXT DEFAULT NULL,
  p_comprovante_url TEXT DEFAULT NULL
)
RETURNS UUID AS $$
BEGIN
  UPDATE receitas
  SET status = 'recebido',
      data_recebimento = p_data_recebimento,
      forma_pagamento = p_forma_pagamento,
      comprovante_url = p_comprovante_url
  WHERE id = p_receita_id;

  RETURN p_receita_id;
END;
$$ LANGUAGE plpgsql;

-- ===================================================================
-- 11. ÍNDICES adicionais para performance
-- ===================================================================
CREATE INDEX IF NOT EXISTS idx_receitas_data_prevista ON receitas(data_prevista) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_receitas_status_atraso ON receitas(status, data_prevista) WHERE deleted_at IS NULL;

-- ===================================================================
-- FIM da migration
-- ===================================================================
