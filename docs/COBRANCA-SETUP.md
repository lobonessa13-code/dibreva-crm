# DIBREVA CRM — Módulo de Cobrança Automática

Sistema completo de controle de fluxo de caixa por obra, cadastro de clientes, aditivos e **lembretes automáticos de inadimplência** por e-mail e WhatsApp.

## Visão geral

- **Cadastro de Clientes** (`clientes.html`): tipo (condomínio/empresa/PF), CPF/CNPJ, endereço completo, contatos principal e financeiro, preferências de notificação.
- **Obras** (`obras.html`): vinculadas a cliente cadastrado + gestão de **aditivos** (renegociações).
- **Financeiro** (`financeiro.html`): fluxo de caixa, painel de inadimplentes com cores por nível, envio manual de lembrete, registro de pagamento com forma + comprovante.
- **Job diário**: marca parcelas vencidas como `atrasado` e dispara lembretes nas fases corretas.

## Instalação (passo a passo)

### 1. Aplicar migration SQL

No **Supabase Dashboard → SQL Editor**, execute na ordem:

```bash
sql/schema.sql                          # caso ainda não tenha aplicado
sql/migration-financeiro-cobranca.sql   # esta migration
```

A migration cria:
- Tabela `clientes` (cadastro completo)
- FK `cliente_id` em `obras`
- Status `atrasado` em `receitas` + colunas de auditoria
- Tabela `aditivos`
- Tabela `notificacoes_log`
- View `vw_inadimplentes` e `vw_inadimplentes_kpis`
- Funções `fn_marcar_atrasos()`, `fn_registrar_pagamento()`, `fn_fluxo_caixa_obra()`

### 2. Configurar secrets das Edge Functions

```bash
# E-mail (Resend) — https://resend.com
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxxxxxx
supabase secrets set RESEND_FROM_EMAIL="DIBREVA <financeiro@dibreva.com.br>"

# WhatsApp (Z-API) — https://app.z-api.io
supabase secrets set ZAPI_INSTANCE=xxxxxxxxxxx
supabase secrets set ZAPI_TOKEN=xxxxxxxxxxx
supabase secrets set ZAPI_CLIENT_TOKEN=xxxxxxxxxxx   # opcional, se Account Security ativo
```

> O domínio do remetente em `RESEND_FROM_EMAIL` precisa estar verificado no Resend (DNS).

### 3. Deploy das Edge Functions

```bash
cd /Users/vanessalobo/Documents/DIBREVA/CRM
supabase functions deploy enviar-lembrete
supabase functions deploy verificar-atrasos
```

### 4. Agendar o job diário (pg_cron)

No **Dashboard → Database → Extensions**, ative `pg_cron` e `pg_net`.

No SQL Editor, abra `sql/setup-cron-cobranca.sql`, substitua:
- `{{PROJECT_REF}}` → `xokskfdzsdxzieboqozq`
- `{{SERVICE_ROLE}}` → chave em **Settings → API → service_role secret**

Execute. O job roda diariamente às 09:00 UTC (06:00 Brasília).

### 5. Testar manualmente

Antes de esperar o cron, dispare a função para conferir:

```bash
curl -X POST \
  -H "Authorization: Bearer SUA_SERVICE_ROLE_KEY" \
  https://xokskfdzsdxzieboqozq.supabase.co/functions/v1/verificar-atrasos
```

Deve retornar JSON com `receitas_marcadas_atrasadas`, `lembretes_disparados`, `detalhes`.

## Fluxo de cobrança

```
┌─────────────────┐
│ Receita prevista│
│ (cadastrada)    │
└────────┬────────┘
         │
         ├─── 3 dias antes do vencimento → fase "lembrete" (cordial)
         ├─── 1 dia antes               → fase "lembrete" (cordial)
         │
         ▼ data_prevista < hoje
┌─────────────────┐
│   atrasado      │   fn_marcar_atrasos() roda diariamente
└────────┬────────┘
         │
         ├─── dia 1 após         → fase "suave"  (1ª cobrança)
         ├─── dia 7 após         → fase "suave"  (reforço)
         ├─── dia 15 após        → fase "formal" (notificação)
         ├─── dia 30, 45, 60...  → fase "formal" (recorrente a cada 15 dias)
         │
         ▼ pagamento registrado
┌─────────────────┐
│   recebido      │
└─────────────────┘
```

**Anti-spam:** o job nunca envia 2 lembretes na mesma receita em menos de 24 horas.

## Níveis de alerta no painel

| Cor | Dias de atraso |
|-----|----------------|
| Cinza | Ainda não venceu (até 3 dias antes) |
| 🟡 Amarelo | 1 a 7 dias |
| 🟠 Laranja | 8 a 15 dias |
| 🔴 Vermelho | 16 dias ou mais |

## Tabelas principais

### `clientes`
Cadastro do contratante (condomínio, empresa ou PF) com endereço completo, responsável, contato financeiro separado, e preferências de notificação (`notificar_email`, `notificar_whatsapp`).

### `obras` (modificada)
Adicionada coluna `cliente_id` (FK opcional). Obras antigas continuam funcionando com `cliente` em texto livre; novas obras devem vincular a um cliente cadastrado para habilitar lembretes.

### `receitas` (modificada)
- Novo status: `atrasado`
- Campos: `data_recebimento`, `numero_parcela`, `total_parcelas`, `forma_pagamento`, `comprovante_url`, `ultimo_lembrete_em`, `qtd_lembretes_enviados`

### `aditivos`
Renegociações vinculadas a uma obra: número, descrição, valor adicional, prazo adicional, data, URL do PDF assinado.

### `notificacoes_log`
Auditoria completa: cada lembrete enviado (canal, fase, destinatário, mensagem, status, resposta do provider).

## Troubleshooting

**"Tabela clientes não existe"** → aplique `migration-financeiro-cobranca.sql`.

**Lembrete não dispara via cron** → confira:
```sql
SELECT * FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'dibreva-verificar-atrasos')
ORDER BY start_time DESC LIMIT 5;
```

**Lembrete falha "RESEND_API_KEY não configurada"** → rode novamente `supabase secrets set` e faça redeploy das functions.

**WhatsApp não chega** → verifique no painel Z-API:
- Instância está conectada (QR code escaneado)?
- Account Security: se ativo, `ZAPI_CLIENT_TOKEN` é obrigatório

**Cliente não recebe lembrete** → verifique:
- `notificar_email` / `notificar_whatsapp` do cliente está marcado?
- `email_cobranca` ou `whatsapp` preenchidos?
- Obra está vinculada via `cliente_id`?

## Arquivos criados/modificados

```
sql/
├── migration-financeiro-cobranca.sql    [NOVO]
└── setup-cron-cobranca.sql              [NOVO]

supabase/functions/
├── verificar-atrasos/index.ts           [NOVO]
└── enviar-lembrete/index.ts             [NOVO]

clientes.html                            [NOVO]
js/clientes.js                           [NOVO]

financeiro.html                          [MODIFICADO — painel inadimplentes + modais]
js/financeiro.js                         [MODIFICADO — lógica de inadimplência]
obras.html                               [MODIFICADO — vínculo cliente + aditivos]
js/obras.js                              [MODIFICADO — preencher do cliente + CRUD aditivos]
js/nav.js                                [MODIFICADO — menu Clientes]

docs/COBRANCA-SETUP.md                   [NOVO — este arquivo]
```
