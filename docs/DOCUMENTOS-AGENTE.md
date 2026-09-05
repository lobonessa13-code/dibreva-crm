# Módulo Documentos: Agente de Documentos DIBREVA

Gera **orçamentos, contratos, aditivos e recibos** dentro do CRM, por conversa com a IA, no mesmo padrão dos documentos feitos no terminal.

## Como funciona

```
Vanessa descreve o pedido no chat
        │
        ▼
Agente (Claude, claude-sonnet-5) ── pergunta o que falta
        │                          busca cliente / obra / lead / documento base no Supabase
        ▼
Ferramenta gerar_* recebe DADOS ESTRUTURADOS (JSON)
        │
        ▼
js/doc-templates.js renderiza o A4 (layout fixo, portado dos modelos de referência)
        │
        ▼
Preview no iframe ── Salvar (número automático) ── Imprimir/PDF ── Baixar HTML
```

A IA **nunca escreve HTML**. Ela preenche um formulário invisível (o `input_schema` da ferramenta) e o template garante o padrão visual. É exatamente o que acontece no terminal: eu preencho o modelo, não reinvento o documento.

## Arquivos

| Arquivo | Papel |
|---|---|
| `documentos.html` | Página: listagem + workspace (chat à esquerda, preview A4 à direita) |
| `js/documentos.js` | Estado, chat, prompt do agente, ferramentas, salvar/imprimir/baixar |
| `js/doc-templates.js` | Templates dos 4 documentos, dados da empresa, valor por extenso, paginação com medição real |
| `js/ia.js` | Cliente da Messages API (chave no localStorage, igual ao antigo módulo Vistoria) |
| `css/documentos.css` | Estilos do workspace |
| `sql/migration-documentos.sql` | Tabelas `documentos`, `documentos_contadores`, função `proximo_numero_documento`, view `vw_documentos` |

## Instalação

1. **Banco:** rodar `sql/migration-documentos.sql` no SQL Editor do Supabase (projeto `xokskfdzsdxzieboqozq`).
2. **Chave da IA:** Configurações → Integração com IA → salvar a chave `sk-ant-...` (fica no localStorage do navegador; precisa repetir em cada computador).
3. **Deploy:** push na `main` publica na Vercel.

## Numeração

`ORC-2026-054`, `CTR-2026-001`, `ADT-2026-001`, `RCB-2026-001`. O contador por prefixo e ano fica em `documentos_contadores`; a função `proximo_numero_documento('ORC')` é atômica. O número só é consumido ao **salvar** (rascunhos não gastam número). O seed começa em `ORC 2026 = 53` porque o último orçamento feito no terminal foi o ORC-2026-053 (Residencial Helena). Para ajustar o ponto de partida de outro prefixo:

```sql
update documentos_contadores set ultimo = 7 where prefixo = 'CTR' and ano = 2026;
```

## Vínculos e atalhos no CRM

- **CRM (leads):** ícone de documento na linha do lead abre `documentos.html?novo=orcamento&lead_id=...` com os dados do lead no contexto do agente.
- **Obras:** ícone de documento abre a lista filtrada da obra com botões "+ Contrato / + Aditivo / + Recibo".
- **Financeiro (receitas recebidas):** ícone abre `?novo=recibo&receita_id=...` com valor e obra no contexto.
- No workspace, os quatro seletores (cliente, lead, obra, documento base) alimentam o contexto. "Documento base" permite contrato a partir de orçamento e aditivo/recibo a partir de contrato.

Efeitos ao salvar:
- Orçamento com lead vinculado e status **Enviado** → lead vai para "Orçamento Enviado" (com data e valor). O follow-up comercial automático passa a valer.
- Aditivo com obra vinculada e status **Assinado** → registra o aditivo no módulo Obras (valor e prazo adicionais).

## Padrões embutidos no prompt

Regras que o agente segue (mesmas das memórias do terminal): itens de serviço em linguagem direta, lavação como Etapa 1 (exceto quando há remoção de cerâmicas), observações padrão, marcas de tinta premium sempre que há pintura, frase final de negociação, entrada no percentual exato, prazo em dias úteis, sem seção de autopromoção, sem travessões, validade de 30 dias. Cláusulas jurídicas do contrato e do aditivo são fixas no template (carga horária, redes de proteção, multa 2%, garantia 24 meses, assinatura digital, foro Criciúma).

## Histórico importado e biblioteca de exemplos

Em 2026-09-04 foram importados para a tabela `documentos` os documentos feitos no terminal: 57 orçamentos, 8 contratos, 6 aditivos e 40 recibos (extraídos dos HTML em `DIBREVA/Orcamentos`, `Contratos`, `Aditivos`, `Recibos`). Números originais preservados quando únicos; os demais receberam `PREFIXO-ANO-Hnn` (H de histórico), com o número impresso guardado em `dados.numero_original`. Contadores ajustados para continuar a sequência (ORC 53, CTR 23, ADT 2, RCB 13 em 2026).

`js/biblioteca-exemplos.js` (gerado por `scratchpad/importacao/gerar-biblioteca.js`) resume esses documentos por categoria de serviço (etapas e itens reais) e é injetado no prompt do agente (bloco em cache, ~7 mil tokens). O agente usa `buscar_documentos` para abrir qualquer documento completo.

## Paginação

`DocTemplates.renderAsync` mede cada bloco num iframe oculto (mesmo CSS, fontes carregadas), distribui os blocos pelas páginas com as alturas reais e depois ajusta: página apertada recebe `.compacto` / `.compacto2`; página de etapas com sobra grande recebe `.folgada`. O HTML baixado já vem paginado e pode ser conferido com `DIBREVA/scripts/validar-documento.js`.

## Edição manual (sem IA)

Botão **Editar dados** na barra do preview abre um formulário gerado a partir do `input_schema` da ferramenta do tipo (campos, listas de itens, parcelas etc.). Ao aplicar, o documento é regerado pelo template sem chamar a API. Se depois disso a Vanessa voltar a conversar com o agente, os dados editados são enviados junto da próxima mensagem.

## Publicação no Google Drive

Funções serverless na Vercel (`api/drive/*`, Node 22, `@sparticuz/chromium` + `puppeteer-core`):

| Rota | Papel |
|---|---|
| `GET /api/drive/auth` | Gera a URL de autorização do Google (exige login do CRM) |
| `GET /api/drive/callback` | Recebe o código, guarda o refresh token em `integracoes` (só service role) |
| `GET/DELETE /api/drive/status` | Situação da conexão / desconectar |
| `POST /api/drive/publicar` | Recebe `{documento_id, html}`, gera o PDF com Chrome headless, cria/reaproveita a pasta do cliente e sobe PDF + HTML |

- **Gatilhos:** orçamento ao virar **Enviado**; contrato e aditivo ao virar **Assinado**; botão "Enviar ao Drive" a qualquer momento. Republicar atualiza os mesmos arquivos (ids guardados em `drive_pdf_id` / `drive_html_id`).
- **Árvore:** `DIBREVA/01 - ADMINISTRATIVO/{01 - ORCAMENTOS | 02 - CONTRATOS | 03 - ADITIVO | 04 - RECIBOS}/{N - ANO}/{Cliente}/`. Pasta do ano é achada por regex (`1 - 2026`, `2 - 2025`...). Pasta do cliente: busca exata, depois sem acentos/maiúsculas, depois por nome-chave (ignora Residencial, Edifício, EDF, Condomínio) quando só uma pasta combina; contratos e aditivos usam nome em MAIÚSCULAS. Se nada combinar, cria.
- **Nome dos arquivos:** `{Cliente}-{Tipo}-{numero}-DIBREVA.pdf` e `.html`.
- **Credenciais:** projeto Google Cloud `dibreva-crm` (conta pessoal da Vanessa), cliente OAuth "DIBREVA CRM Web", app em modo teste com usuárias `dibrevaltda@gmail.com` e `lobo.nessa13@gmail.com`. Drive autorizado com **dibrevaltda@gmail.com**. Variáveis na Vercel: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (JWT legacy, começa com `eyJ`), `APP_URL`.
- **Banco:** `sql/migration-drive.sql` (tabela `integracoes` + colunas `drive_*`/`publicado_em` em `documentos`).

## Custo

Modelo padrão `claude-sonnet-5` (definido em `js/ia.js`). Cada geração ou alteração via chat usa por volta de 8 a 12 mil tokens de entrada e 2 a 4 mil de saída (aprox. US$ 0,03 a 0,06 por chamada). Edições manuais custam zero. O prompt base tem cache ativado.
