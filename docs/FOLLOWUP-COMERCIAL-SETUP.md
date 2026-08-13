# Follow-up Comercial Automático (WhatsApp)

Automatiza o acompanhamento de orçamentos já enviados: o sistema envia mensagens de follow-up via WhatsApp (Z-API) em uma cadência definida, até o cliente responder, aprovar ou o ciclo terminar.

## Como funciona

1. Quando um lead entra no status **Orçamento Enviado** com a **Data de Envio do Orçamento** preenchida, ele passa a aparecer na aba **Comercial** do CRM.
2. Todo dia às **10:00 (Brasília)** o job `dibreva-verificar-followups` roda e envia a mensagem da vez para cada lead com automação ativa.
3. No primeiro follow-up enviado, o lead muda automaticamente para o status **Follow-up Pós-Orçamento** no pipeline.
4. Cada envio fica registrado na tabela `followup_log` (visível no botão de histórico da aba Comercial).

## Cadência

| Follow-up | Quando | Fase | Conteúdo |
|-----------|--------|------|----------|
| 1º | 2 dias após o envio | confirmacao | Confirma recebimento do orçamento |
| 2º | 7 dias após o envio | duvidas | Pergunta se analisaram, oferece conversa |
| 3º | 15 dias após o envio | reforco | Proposta válida, agenda por ordem de fechamento |
| 4º | 30 dias após o envio | fechamento | Último contato, pede feedback |

Regras:
- A fase é definida pela **quantidade de follow-ups já enviados** + dias desde o envio (se o cron falhar um dia, recupera no dia seguinte).
- Anti-spam: nunca envia 2 mensagens para o mesmo lead em menos de **48h**.
- Após o 4º follow-up a automação encerra sozinha para aquele lead.
- A automação para de considerar o lead quando ele sai dos status `orcamento_enviado` / `followup_orcamento` (aprovado, perdido) ou quando a automação é pausada no painel.

## Aba Comercial (crm.html)

- KPIs: orçamentos aguardando retorno (com valor em aberto), automações ativas, sem contato há 7+ dias, follow-ups enviados no mês.
- Tabela com cada orçamento em acompanhamento: dias desde o envio, follow-ups já feitos, próximo passo previsto.
- Ações por lead:
  - **Enviar agora**: abre modal com o template da fase sugerida (editável) e envia na hora.
  - **Pausar/reativar** a automação (toggle).
  - **Histórico**: todas as mensagens já enviadas para o lead.

## Instalação

1. **Migration**: rodar `sql/migration-followup-comercial.sql` no Supabase SQL Editor.
2. **Edge Functions**: deploy de `enviar-followup` e `verificar-followups`:
   ```bash
   export SUPABASE_ACCESS_TOKEN=sbp_...
   supabase functions deploy enviar-followup --project-ref xokskfdzsdxzieboqozq
   supabase functions deploy verificar-followups --project-ref xokskfdzsdxzieboqozq
   ```
3. **Cron**: rodar `sql/setup-cron-followup.sql` no SQL Editor, substituindo `{{PROJECT_REF}}` e `{{SERVICE_ROLE}}` (JWT legacy).
4. **Secrets**: usa os mesmos `ZAPI_INSTANCE_ID` e `ZAPI_TOKEN` já configurados para a cobrança automática. Nada novo a configurar.

## Teste manual

```bash
# Dispara o job completo (só envia o que estiver na janela da cadência)
curl -X POST \
  -H "Authorization: Bearer <legacy_service_role_jwt>" \
  https://xokskfdzsdxzieboqozq.supabase.co/functions/v1/verificar-followups

# Envia um follow-up específico
curl -X POST \
  -H "Authorization: Bearer <legacy_service_role_jwt>" \
  -H "Content-Type: application/json" \
  -d '{"lead_id":"<uuid>","fase":"confirmacao"}' \
  https://xokskfdzsdxzieboqozq.supabase.co/functions/v1/enviar-followup
```

## Estrutura no banco

- `leads.followup_ativo` (boolean, default true)
- `leads.qtd_followups_enviados` (int)
- `leads.ultimo_followup_em` (timestamptz)
- `followup_log` (auditoria de cada envio)
- `vw_followup_comercial` (leads em acompanhamento + dias desde envio)
- `vw_followup_kpis` (cards do painel)
