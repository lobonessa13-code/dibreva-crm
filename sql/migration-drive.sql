-- ===================================================================
-- MIGRATION: Integração Google Drive (publicação de documentos)
-- ===================================================================

-- 1. Tabela de integrações (tokens). RLS ligada SEM policies:
--    só a service role (funções na Vercel) lê e escreve.
CREATE TABLE IF NOT EXISTS integracoes (
  chave TEXT PRIMARY KEY,
  valor JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE integracoes ENABLE ROW LEVEL SECURITY;

-- 2. Colunas de publicação no documento
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS drive_url TEXT;
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS drive_pasta_url TEXT;
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS drive_pdf_id TEXT;
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS drive_html_id TEXT;
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS publicado_em TIMESTAMPTZ;

-- 3. Recria a view para expor as colunas novas (d.* é expandido na criação;
--    precisa de DROP porque a ordem das colunas muda)
DROP VIEW IF EXISTS vw_documentos;
CREATE VIEW vw_documentos AS
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

SELECT column_name FROM information_schema.columns WHERE table_name = 'documentos' AND column_name LIKE 'drive%';
