-- ===================================================================
-- DIBREVA — Módulo de Vistoria Predial
-- Execute no Supabase SQL Editor APÓS o schema.sql principal
-- ===================================================================

-- 1. TABELA: vistorias
CREATE TABLE vistorias (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID DEFAULT auth.uid(),
  lead_id UUID REFERENCES leads(id),
  imovel_nome TEXT NOT NULL,
  imovel_tipo TEXT NOT NULL DEFAULT 'residencial'
    CHECK (imovel_tipo IN ('residencial','comercial','misto','industrial')),
  imovel_endereco TEXT,
  imovel_cidade TEXT DEFAULT 'Criciúma',
  imovel_idade INTEGER,
  imovel_pavimentos INTEGER,
  imovel_area NUMERIC(10,2),
  sistemas_construtivos TEXT,
  estado_geral TEXT CHECK (estado_geral IN ('bom','regular','degradado','critico')),
  status TEXT NOT NULL DEFAULT 'em_andamento'
    CHECK (status IN ('em_andamento','processando','concluida')),
  data_vistoria DATE DEFAULT CURRENT_DATE,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- 2. TABELA: vistoria_patologias
CREATE TABLE vistoria_patologias (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vistoria_id UUID REFERENCES vistorias(id) ON DELETE CASCADE,
  sistema TEXT NOT NULL,
  localizacao TEXT NOT NULL,
  tipo_manifestacao TEXT NOT NULL,
  dimensao TEXT,
  causa_provavel TEXT,
  severidade TEXT NOT NULL DEFAULT 'leve'
    CHECK (severidade IN ('leve','moderado','grave','critico')),
  foto_base64 TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. TABELA: vistoria_resultados
CREATE TABLE vistoria_resultados (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vistoria_id UUID REFERENCES vistorias(id) ON DELETE CASCADE UNIQUE,
  resultado_json JSONB NOT NULL,
  total_p1 NUMERIC(12,2) DEFAULT 0,
  total_p2 NUMERIC(12,2) DEFAULT 0,
  total_preventivo_anual NUMERIC(12,2) DEFAULT 0,
  total_reforma NUMERIC(12,2) DEFAULT 0,
  total_geral NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Triggers updated_at (reutiliza função já existente do schema.sql)
CREATE TRIGGER vistorias_updated_at BEFORE UPDATE ON vistorias
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER vistoria_resultados_updated_at BEFORE UPDATE ON vistoria_resultados
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE vistorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE vistoria_patologias ENABLE ROW LEVEL SECURITY;
ALTER TABLE vistoria_resultados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso total vistorias" ON vistorias FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total vistoria_patologias" ON vistoria_patologias FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total vistoria_resultados" ON vistoria_resultados FOR ALL USING (true) WITH CHECK (true);

-- Índices
CREATE INDEX idx_vistorias_status ON vistorias(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_vistorias_lead_id ON vistorias(lead_id);
CREATE INDEX idx_vistoria_patologias_vistoria ON vistoria_patologias(vistoria_id);
CREATE INDEX idx_vistoria_resultados_vistoria ON vistoria_resultados(vistoria_id);
