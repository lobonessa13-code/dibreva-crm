-- ===================================================================
-- Follow-up: "retomar contato em outra data" (6 meses a 1 ano)
-- Quando o cliente pede para chamar mais tarde, a régua D1/D7/D15/D30
-- fica suspensa e a mensagem de reativação sai na data escolhida.
-- ===================================================================
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS data_retomar_contato DATE;

CREATE OR REPLACE VIEW vw_followup_comercial
WITH (security_invoker = on) AS
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
  (CURRENT_DATE - l.data_envio_orcamento)::INTEGER AS dias_desde_envio,
  l.data_retomar_contato
FROM leads l
WHERE l.deleted_at IS NULL
  AND l.status IN ('orcamento_enviado','followup_orcamento')
  AND l.data_envio_orcamento IS NOT NULL
ORDER BY l.data_envio_orcamento ASC;
