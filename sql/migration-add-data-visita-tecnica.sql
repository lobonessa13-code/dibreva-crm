-- ===================================================================
-- Migration: adicionar data_visita_tecnica em leads
-- Aplicar via: Supabase Dashboard → SQL Editor → New query → Run
-- ===================================================================

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS data_visita_tecnica DATE;

COMMENT ON COLUMN leads.data_visita_tecnica IS 'Data em que a visita técnica foi/será realizada (preenchida quando status muda para visita_tecnica)';
