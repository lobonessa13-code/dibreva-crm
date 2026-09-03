-- ===================================================================
-- MIGRATION: Módulo Documentos (Agente de Documentos com IA)
-- Orçamentos, Contratos, Aditivos e Recibos gerados pelo agente no CRM
-- Aplicar no SQL Editor do Supabase (projeto xokskfdzsdxzieboqozq)
-- ===================================================================

-- 1. TABELA: documentos
CREATE TABLE IF NOT EXISTS documentos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID DEFAULT auth.uid(),

  tipo TEXT NOT NULL CHECK (tipo IN ('orcamento','contrato','aditivo','recibo')),
  numero TEXT NOT NULL,                       -- ORC-2026-054, CTR-2026-003, ADT-2026-001, RCB-2026-012
  titulo TEXT NOT NULL,                       -- "Orçamento — Residencial Helena"

  -- Vínculos (todos opcionais)
  cliente_id UUID REFERENCES clientes(id),
  lead_id UUID REFERENCES leads(id),
  obra_id UUID REFERENCES obras(id),
  documento_pai_id UUID REFERENCES documentos(id),   -- contrato → orçamento, aditivo/recibo → contrato

  -- Conteúdo
  dados JSONB NOT NULL DEFAULT '{}'::jsonb,   -- dados estruturados que alimentam o template
  conversa JSONB NOT NULL DEFAULT '[]'::jsonb,-- histórico do chat com o agente

  status TEXT NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','enviado','assinado','cancelado')),
  valor NUMERIC(12,2) DEFAULT 0,
  data_documento DATE NOT NULL DEFAULT CURRENT_DATE,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

DROP TRIGGER IF EXISTS documentos_updated_at ON documentos;
CREATE TRIGGER documentos_updated_at BEFORE UPDATE ON documentos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_documentos_tipo ON documentos(tipo) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documentos_cliente ON documentos(cliente_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documentos_obra ON documentos(obra_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documentos_lead ON documentos(lead_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_documentos_numero ON documentos(numero) WHERE deleted_at IS NULL;

ALTER TABLE documentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "documentos_autenticados" ON documentos;
CREATE POLICY "documentos_autenticados" ON documentos FOR ALL
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- 2. TABELA: documentos_contadores (numeração sequencial por prefixo e ano)
CREATE TABLE IF NOT EXISTS documentos_contadores (
  prefixo TEXT NOT NULL,        -- ORC, CTR, ADT, RCB
  ano INTEGER NOT NULL,
  ultimo INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (prefixo, ano)
);

ALTER TABLE documentos_contadores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contadores_autenticados" ON documentos_contadores;
CREATE POLICY "contadores_autenticados" ON documentos_contadores FOR ALL
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Seed: último orçamento emitido pelo terminal foi ORC-2026-053 (Residencial Helena, 03/09/2026)
INSERT INTO documentos_contadores (prefixo, ano, ultimo) VALUES
  ('ORC', 2026, 53),
  ('CTR', 2026, 0),
  ('ADT', 2026, 0),
  ('RCB', 2026, 0)
ON CONFLICT (prefixo, ano) DO NOTHING;

-- 3. FUNÇÃO: proximo_numero_documento('ORC') → 'ORC-2026-054' (atômica)
CREATE OR REPLACE FUNCTION proximo_numero_documento(p_prefixo TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ano INTEGER := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  v_ultimo INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  INSERT INTO documentos_contadores (prefixo, ano, ultimo)
  VALUES (p_prefixo, v_ano, 1)
  ON CONFLICT (prefixo, ano)
  DO UPDATE SET ultimo = documentos_contadores.ultimo + 1
  RETURNING ultimo INTO v_ultimo;

  RETURN p_prefixo || '-' || v_ano::TEXT || '-' || LPAD(v_ultimo::TEXT, 3, '0');
END;
$$;

-- 4. VIEW: documentos com nomes dos vínculos (para a listagem)
CREATE OR REPLACE VIEW vw_documentos AS
SELECT
  d.*,
  c.nome AS cliente_nome,
  l.condominio AS lead_condominio,
  o.condominio AS obra_condominio,
  p.numero AS documento_pai_numero
FROM documentos d
LEFT JOIN clientes c ON c.id = d.cliente_id
LEFT JOIN leads l ON l.id = d.lead_id
LEFT JOIN obras o ON o.id = d.obra_id
LEFT JOIN documentos p ON p.id = d.documento_pai_id
WHERE d.deleted_at IS NULL;
