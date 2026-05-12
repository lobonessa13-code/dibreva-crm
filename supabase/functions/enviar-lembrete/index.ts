// ===================================================================
// ENVIAR LEMBRETE — Orquestra email (Resend) + WhatsApp (Z-API)
// Endpoint: POST /functions/v1/enviar-lembrete
// Body: { receita_id, fase, canais: { email, whatsapp }, mensagem?, automatico? }
// ===================================================================
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createAdminClient, corsHeaders, ok, err } from '../_shared/supabase.ts'

interface RequestBody {
  receita_id: string
  fase: 'lembrete' | 'suave' | 'formal' | 'manual'
  canais: { email?: boolean; whatsapp?: boolean }
  mensagem?: string         // Texto customizado (opcional — se vier, sobrescreve template)
  automatico?: boolean      // true se vem do cron, false se manual
}

function moeda(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
}

function dataBR(iso: string | null): string {
  if (!iso) return '—'
  const [a, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${a}`
}

function gerarMensagem(fase: string, dados: any): { assunto: string; texto: string } {
  const responsavel = dados.nome_responsavel || 'Prezado(a)'
  const condominio = dados.condominio || dados.cliente_nome || ''
  const valor = moeda(dados.valor)
  const venc = dataBR(dados.data_prevista)
  const desc = dados.descricao
  const dias = dados.dias_atraso || 0

  if (fase === 'lembrete' || (dias <= 0 && fase !== 'formal')) {
    return {
      assunto: `Lembrete: vencimento em ${venc} — ${condominio}`,
      texto: `Olá, ${responsavel}!

Passando para lembrar amigavelmente do vencimento da parcela:

📋 ${desc}
🏢 ${condominio}
💰 Valor: ${valor}
📅 Vencimento: ${venc}

Caso já tenha efetuado o pagamento, por favor desconsidere esta mensagem.

Qualquer dúvida estamos à disposição.

Atenciosamente,
DIBREVA — Manutenção e Restauração Predial
(48) 99635-0627`
    }
  }

  if (fase === 'suave' || (dias > 0 && dias <= 7)) {
    return {
      assunto: `Pagamento em aberto — ${condominio}`,
      texto: `Olá, ${responsavel}!

Identificamos que a parcela abaixo está com pagamento em aberto:

📋 ${desc}
🏢 ${condominio}
💰 Valor: ${valor}
📅 Venceu em: ${venc} (${dias} dia(s) atrás)

Poderia, por gentileza, verificar internamente o status do pagamento? Se já foi efetuado, agradecemos se puder nos encaminhar o comprovante.

Estamos à disposição para qualquer esclarecimento.

Atenciosamente,
DIBREVA — Manutenção e Restauração Predial
(48) 99635-0627 · dibrevaltda@gmail.com`
    }
  }

  return {
    assunto: `Notificação de débito em atraso — ${condominio}`,
    texto: `Prezado(a) ${responsavel},

Comunicamos que a parcela abaixo encontra-se em atraso há ${dias} dias:

📋 ${desc}
🏢 ${condominio}
💰 Valor original: ${valor}
📅 Vencimento original: ${venc}

Solicitamos a regularização do pagamento o quanto antes para evitar a aplicação das penalidades previstas em contrato (juros e multa).

Caso já tenha efetuado o pagamento, por favor nos encaminhe o comprovante para baixarmos o débito.

Para qualquer negociação ou esclarecimento, entre em contato:
📞 (48) 99635-0627
✉ dibrevaltda@gmail.com

DIBREVA — Manutenção e Restauração Predial
CNPJ 15.332.344/0001-75`
  }
}

async function enviarEmail(destinatario: string, assunto: string, texto: string): Promise<{ ok: boolean; response?: any; erro?: string }> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'DIBREVA <noreply@dibreva.com.br>'

  if (!apiKey) return { ok: false, erro: 'RESEND_API_KEY não configurada' }

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [destinatario],
        subject: assunto,
        text: texto,
        html: texto.replace(/\n/g, '<br>')
      })
    })

    const body = await resp.json()
    if (!resp.ok) return { ok: false, response: body, erro: body.message || 'Erro no Resend' }
    return { ok: true, response: body }
  } catch (e) {
    return { ok: false, erro: String(e) }
  }
}

async function enviarWhatsApp(numero: string, texto: string): Promise<{ ok: boolean; response?: any; erro?: string }> {
  const instanceId = Deno.env.get('ZAPI_INSTANCE_ID') || Deno.env.get('ZAPI_INSTANCE')
  const token = Deno.env.get('ZAPI_TOKEN')
  const clientToken = Deno.env.get('ZAPI_CLIENT_TOKEN') // opcional, Z-API account security

  if (!instanceId || !token) return { ok: false, erro: 'ZAPI_INSTANCE_ID ou ZAPI_TOKEN não configurados' }

  const phone = numero.replace(/\D/g, '').replace(/^0+/, '')
  const fullPhone = phone.startsWith('55') ? phone : `55${phone}`

  try {
    const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (clientToken) headers['Client-Token'] = clientToken

    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ phone: fullPhone, message: texto })
    })

    const body = await resp.json()
    if (!resp.ok) return { ok: false, response: body, erro: body.error || 'Erro no Z-API' }
    return { ok: true, response: body }
  } catch (e) {
    return { ok: false, erro: String(e) }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return err('Método não permitido', 405)

  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return err('JSON inválido')
  }

  if (!body.receita_id || !body.fase) return err('Faltam campos obrigatórios: receita_id, fase')
  if (!body.canais?.email && !body.canais?.whatsapp) return err('Selecione ao menos um canal')

  const supabase = createAdminClient()

  // Carrega dados completos da inadimplência
  const { data: rows, error: errView } = await supabase
    .from('vw_inadimplentes')
    .select('*')
    .eq('receita_id', body.receita_id)
    .limit(1)

  if (errView) return err('Erro ao buscar receita: ' + errView.message, 500)
  if (!rows || rows.length === 0) return err('Receita não encontrada ou sem cliente vinculado', 404)

  const dados = rows[0]

  // Mensagem: usa custom se vier, senão gera template
  const template = gerarMensagem(body.fase, dados)
  const textoFinal = body.mensagem || template.texto
  const assunto = template.assunto

  const resultado: any = { receita_id: body.receita_id, fase: body.fase }

  // === E-MAIL ===
  if (body.canais.email) {
    const destEmail = dados.email_cobranca || dados.email
    if (!destEmail) {
      resultado.email = { status: 'sem_destinatario' }
    } else {
      const r = await enviarEmail(destEmail, assunto, textoFinal)
      resultado.email = { status: r.ok ? 'enviado' : 'falha', erro: r.erro }

      await supabase.from('notificacoes_log').insert({
        receita_id: body.receita_id,
        cliente_id: dados.cliente_id,
        obra_id: dados.obra_id,
        canal: 'email',
        fase: body.fase,
        destinatario: destEmail,
        assunto,
        mensagem: textoFinal,
        status: r.ok ? 'enviado' : 'falha',
        erro: r.erro || null,
        provider_response: r.response || null
      })
    }
  }

  // === WHATSAPP ===
  if (body.canais.whatsapp) {
    const destWhats = dados.whatsapp || dados.telefone
    if (!destWhats) {
      resultado.whatsapp = { status: 'sem_destinatario' }
    } else {
      const r = await enviarWhatsApp(destWhats, textoFinal)
      resultado.whatsapp = { status: r.ok ? 'enviado' : 'falha', erro: r.erro }

      await supabase.from('notificacoes_log').insert({
        receita_id: body.receita_id,
        cliente_id: dados.cliente_id,
        obra_id: dados.obra_id,
        canal: 'whatsapp',
        fase: body.fase,
        destinatario: destWhats,
        assunto: null,
        mensagem: textoFinal,
        status: r.ok ? 'enviado' : 'falha',
        erro: r.erro || null,
        provider_response: r.response || null
      })
    }
  }

  // Atualiza contador de lembretes na receita (se ao menos um canal foi enviado)
  const enviouAlgo = resultado.email?.status === 'enviado' || resultado.whatsapp?.status === 'enviado'
  if (enviouAlgo) {
    await supabase
      .from('receitas')
      .update({
        ultimo_lembrete_em: new Date().toISOString(),
        qtd_lembretes_enviados: (dados.qtd_lembretes_enviados || 0) + 1
      })
      .eq('id', body.receita_id)
  }

  return ok(resultado)
})
