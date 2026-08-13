-- ===================================================================
-- DIBREVA Mini ERP - Migration: REMOVER modulo Tarefas
-- Remove as tabelas tarefas e tarefa_comentarios do banco.
-- ATENCAO: apaga permanentemente todas as tarefas e comentarios.
-- Aplicar no Supabase SQL Editor apenas se tiver certeza.
-- ===================================================================

-- Remove da publicacao realtime (se estiver incluida)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'tarefas'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE tarefas;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'tarefa_comentarios'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE tarefa_comentarios;
  END IF;
END $$;

-- Remove as tabelas (comentarios primeiro por causa da FK)
DROP TABLE IF EXISTS tarefa_comentarios;
DROP TABLE IF EXISTS tarefas;
