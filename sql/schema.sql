-- ===================================================================
-- DIBREVA Mini ERP — Schema Completo
-- Execute este SQL no Supabase SQL Editor (https://supabase.com/dashboard)
-- ===================================================================

-- 1. TABELA: leads (CRM)
CREATE TABLE leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID DEFAULT auth.uid(),
  condominio TEXT NOT NULL,
  cidade TEXT NOT NULL,
  tipo_servico TEXT NOT NULL DEFAULT 'Restauração predial',
  valor_estimado NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'lead'
    CHECK (status IN ('lead','visita_tecnica','orcamento_enviado','negociacao','aprovado','perdido')),
  proxima_acao TEXT NOT NULL DEFAULT 'Contato inicial',
  nome_contato TEXT,
  telefone TEXT,
  email TEXT,
  administradora TEXT,
  observacoes TEXT,
  probabilidade INTEGER DEFAULT 30 CHECK (probabilidade BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- 2. TABELA: obras
CREATE TABLE obras (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID DEFAULT auth.uid(),
  lead_id UUID REFERENCES leads(id),
  cliente TEXT NOT NULL,
  condominio TEXT NOT NULL,
  cidade TEXT,
  cnpj TEXT,
  valor_fechado NUMERIC(12,2) NOT NULL DEFAULT 0,
  data_inicio DATE,
  prazo_dias INTEGER DEFAULT 90,
  data_previsao_fim DATE,
  status TEXT NOT NULL DEFAULT 'planejamento'
    CHECK (status IN ('planejamento','em_execucao','finalizada')),
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- 3. TABELA: receitas (Financeiro - entradas)
CREATE TABLE receitas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID DEFAULT auth.uid(),
  obra_id UUID REFERENCES obras(id),
  descricao TEXT NOT NULL,
  valor NUMERIC(12,2) NOT NULL,
  data_prevista DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'previsto'
    CHECK (status IN ('previsto','recebido')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- 4. TABELA: despesas (Financeiro - saídas)
CREATE TABLE despesas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID DEFAULT auth.uid(),
  obra_id UUID REFERENCES obras(id),
  descricao TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'Geral'
    CHECK (categoria IN ('Material','Mao de obra','Equipamento','Transporte','Administrativo','Imposto','Geral')),
  valor NUMERIC(12,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','pago')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- ===================================================================
-- TRIGGERS: updated_at automático
-- ===================================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER leads_updated_at BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER obras_updated_at BEFORE UPDATE ON obras
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER receitas_updated_at BEFORE UPDATE ON receitas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER despesas_updated_at BEFORE UPDATE ON despesas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ===================================================================
-- TRIGGER: calcular data_previsao_fim automaticamente
-- ===================================================================
CREATE OR REPLACE FUNCTION calc_previsao_fim()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.data_inicio IS NOT NULL AND NEW.prazo_dias IS NOT NULL THEN
    NEW.data_previsao_fim = NEW.data_inicio + (NEW.prazo_dias || ' days')::INTERVAL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER obras_calc_fim BEFORE INSERT OR UPDATE ON obras
  FOR EACH ROW EXECUTE FUNCTION calc_previsao_fim();

-- ===================================================================
-- FUNÇÃO: Converter Lead → Obra (atômica)
-- ===================================================================
CREATE OR REPLACE FUNCTION converter_lead_em_obra(
  p_lead_id UUID,
  p_valor_fechado NUMERIC DEFAULT NULL,
  p_data_inicio DATE DEFAULT CURRENT_DATE,
  p_prazo_dias INTEGER DEFAULT 90
)
RETURNS UUID AS $$
DECLARE
  v_lead RECORD;
  v_obra_id UUID;
BEGIN
  -- Buscar lead
  SELECT * INTO v_lead FROM leads WHERE id = p_lead_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead não encontrado: %', p_lead_id;
  END IF;

  -- Atualizar status do lead
  UPDATE leads SET status = 'aprovado' WHERE id = p_lead_id;

  -- Criar obra
  INSERT INTO obras (lead_id, cliente, condominio, cidade, valor_fechado, data_inicio, prazo_dias, status)
  VALUES (
    p_lead_id,
    COALESCE(v_lead.nome_contato, v_lead.condominio),
    v_lead.condominio,
    v_lead.cidade,
    COALESCE(p_valor_fechado, v_lead.valor_estimado),
    p_data_inicio,
    p_prazo_dias,
    'planejamento'
  )
  RETURNING id INTO v_obra_id;

  -- Criar receita prevista automaticamente
  INSERT INTO receitas (obra_id, descricao, valor, data_prevista, status)
  VALUES (
    v_obra_id,
    'Valor total - ' || v_lead.condominio,
    COALESCE(p_valor_fechado, v_lead.valor_estimado),
    p_data_inicio + (p_prazo_dias || ' days')::INTERVAL,
    'previsto'
  );

  RETURN v_obra_id;
END;
$$ LANGUAGE plpgsql;

-- ===================================================================
-- VIEWS: KPIs calculados no banco (rápido)
-- ===================================================================

-- KPIs CRM
CREATE OR REPLACE VIEW vw_crm_kpis AS
SELECT
  COUNT(*) FILTER (WHERE status NOT IN ('aprovado','perdido') AND deleted_at IS NULL) AS leads_ativos,
  COALESCE(SUM(valor_estimado * probabilidade / 100) FILTER (WHERE status NOT IN ('aprovado','perdido') AND deleted_at IS NULL), 0) AS previsao_faturamento,
  COUNT(*) FILTER (WHERE status = 'negociacao' AND deleted_at IS NULL) AS em_negociacao,
  COUNT(*) FILTER (WHERE status = 'aprovado' AND deleted_at IS NULL AND updated_at >= date_trunc('month', CURRENT_DATE)) AS aprovados_mes
FROM leads;

-- KPIs Obras
CREATE OR REPLACE VIEW vw_obras_kpis AS
SELECT
  COUNT(*) FILTER (WHERE status = 'em_execucao' AND deleted_at IS NULL) AS em_andamento,
  COUNT(*) FILTER (WHERE status = 'finalizada' AND deleted_at IS NULL) AS finalizadas,
  COALESCE(SUM(valor_fechado) FILTER (WHERE status = 'em_execucao' AND deleted_at IS NULL), 0) AS valor_em_execucao
FROM obras;

-- KPIs Financeiro (por mês)
CREATE OR REPLACE FUNCTION fn_financeiro_kpis(p_ano INTEGER, p_mes INTEGER)
RETURNS TABLE(faturamento_mes NUMERIC, despesas_mes NUMERIC, lucro_bruto NUMERIC) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE((
      SELECT SUM(valor) FROM receitas
      WHERE status = 'recebido'
        AND deleted_at IS NULL
        AND EXTRACT(YEAR FROM data_prevista) = p_ano
        AND EXTRACT(MONTH FROM data_prevista) = p_mes
    ), 0) AS faturamento_mes,
    COALESCE((
      SELECT SUM(valor) FROM despesas
      WHERE status = 'pago'
        AND deleted_at IS NULL
        AND EXTRACT(YEAR FROM data_vencimento) = p_ano
        AND EXTRACT(MONTH FROM data_vencimento) = p_mes
    ), 0) AS despesas_mes,
    COALESCE((
      SELECT SUM(valor) FROM receitas
      WHERE status = 'recebido'
        AND deleted_at IS NULL
        AND EXTRACT(YEAR FROM data_prevista) = p_ano
        AND EXTRACT(MONTH FROM data_prevista) = p_mes
    ), 0) -
    COALESCE((
      SELECT SUM(valor) FROM despesas
      WHERE status = 'pago'
        AND deleted_at IS NULL
        AND EXTRACT(YEAR FROM data_vencimento) = p_ano
        AND EXTRACT(MONTH FROM data_vencimento) = p_mes
    ), 0) AS lucro_bruto;
END;
$$ LANGUAGE plpgsql;

-- View fluxo de caixa (6 meses)
CREATE OR REPLACE FUNCTION fn_fluxo_caixa(p_meses INTEGER DEFAULT 6)
RETURNS TABLE(ano INTEGER, mes INTEGER, mes_nome TEXT, receitas_total NUMERIC, despesas_total NUMERIC, saldo NUMERIC) AS $$
BEGIN
  RETURN QUERY
  WITH meses AS (
    SELECT
      EXTRACT(YEAR FROM d)::INTEGER AS ano,
      EXTRACT(MONTH FROM d)::INTEGER AS mes,
      TO_CHAR(d, 'Mon/YY') AS mes_nome
    FROM generate_series(
      date_trunc('month', CURRENT_DATE) - ((p_meses - 1) || ' months')::INTERVAL,
      date_trunc('month', CURRENT_DATE),
      '1 month'
    ) d
  )
  SELECT
    m.ano, m.mes, m.mes_nome,
    COALESCE((
      SELECT SUM(r.valor) FROM receitas r
      WHERE r.status = 'recebido' AND r.deleted_at IS NULL
        AND EXTRACT(YEAR FROM r.data_prevista) = m.ano
        AND EXTRACT(MONTH FROM r.data_prevista) = m.mes
    ), 0) AS receitas_total,
    COALESCE((
      SELECT SUM(d.valor) FROM despesas d
      WHERE d.status = 'pago' AND d.deleted_at IS NULL
        AND EXTRACT(YEAR FROM d.data_vencimento) = m.ano
        AND EXTRACT(MONTH FROM d.data_vencimento) = m.mes
    ), 0) AS despesas_total,
    COALESCE((
      SELECT SUM(r.valor) FROM receitas r
      WHERE r.status = 'recebido' AND r.deleted_at IS NULL
        AND EXTRACT(YEAR FROM r.data_prevista) = m.ano
        AND EXTRACT(MONTH FROM r.data_prevista) = m.mes
    ), 0) -
    COALESCE((
      SELECT SUM(d.valor) FROM despesas d
      WHERE d.status = 'pago' AND d.deleted_at IS NULL
        AND EXTRACT(YEAR FROM d.data_vencimento) = m.ano
        AND EXTRACT(MONTH FROM d.data_vencimento) = m.mes
    ), 0) AS saldo
  FROM meses m
  ORDER BY m.ano, m.mes;
END;
$$ LANGUAGE plpgsql;

-- ===================================================================
-- RLS: Row Level Security (preparado para multi-usuario)
-- ===================================================================
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE obras ENABLE ROW LEVEL SECURITY;
ALTER TABLE receitas ENABLE ROW LEVEL SECURITY;
ALTER TABLE despesas ENABLE ROW LEVEL SECURITY;

-- Política aberta (acesso total via anon key - uso individual)
CREATE POLICY "Acesso total leads" ON leads FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total obras" ON obras FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total receitas" ON receitas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total despesas" ON despesas FOR ALL USING (true) WITH CHECK (true);

-- ===================================================================
-- ÍNDICES para performance
-- ===================================================================
CREATE INDEX idx_leads_status ON leads(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_leads_cidade ON leads(cidade) WHERE deleted_at IS NULL;
CREATE INDEX idx_obras_status ON obras(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_obras_lead_id ON obras(lead_id);
CREATE INDEX idx_receitas_obra_id ON receitas(obra_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_receitas_status ON receitas(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_despesas_obra_id ON despesas(obra_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_despesas_status ON despesas(status) WHERE deleted_at IS NULL;
