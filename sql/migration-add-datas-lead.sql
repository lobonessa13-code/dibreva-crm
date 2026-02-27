-- ===================================================================
-- MIGRAÇÃO: Adicionar campos de datas no pipeline de leads
-- Execute no Supabase SQL Editor
-- ===================================================================

-- Data de entrada do lead
ALTER TABLE leads ADD COLUMN IF NOT EXISTS data_entrada DATE DEFAULT CURRENT_DATE;

-- Data de envio do orçamento
ALTER TABLE leads ADD COLUMN IF NOT EXISTS data_envio_orcamento DATE;

-- Data de aprovação
ALTER TABLE leads ADD COLUMN IF NOT EXISTS data_aprovacao DATE;

-- Data de perda
ALTER TABLE leads ADD COLUMN IF NOT EXISTS data_perdido DATE;

-- Preencher data_entrada para leads existentes (usa created_at)
UPDATE leads SET data_entrada = created_at::date WHERE data_entrada IS NULL;
