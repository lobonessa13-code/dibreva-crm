// ===================================================================
// ENVIAR FOLLOW-UP COMERCIAL — WhatsApp (Z-API)
// Endpoint: POST /functions/v1/enviar-followup
// Body: { lead_id, fase, mensagem?, automatico? }
// Fases: confirmacao | duvidas | reforco | fechamento | manual
// ===================================================================
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createAdminClient, corsHeaders, ok, err } from '../_shared/supabase.ts'

interface RequestBody {
  lead_id: string
  fase: 'confirmacao' | 'duvidas' | 'reforco' | 'fechamento' | 'reativacao' | 'manual'
  mensagem?: string         // Texto customizado (opcional, sobrescreve o template)
  automatico?: boolean      // true se vem do cron, false se manual
}

function dataBR(iso: string | null): string {
  if (!iso) return ''
  const [a, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${a}`
}

const ASSINATURA = `DIBREVA, Manutenção e Restauração Predial
(48) 99635-0627`

export function gerarMensagem(fase: string, lead: any): string {
  const saudacao = lead.nome_contato ? `Olá, ${lead.nome_contato}! Tudo bem?` : 'Olá! Tudo bem?'
  const condominio = lead.condominio || ''
  const servico = (lead.tipo_servico || 'serviço').toLowerCase()
  const dataEnvio = dataBR(lead.data_envio_orcamento)

  if (fase === 'confirmacao') {
    return `${saudacao}

Aqui é da DIBREVA. ${dataEnvio ? `No dia ${dataEnvio} enviamos` : 'Enviamos recentemente'} o orçamento de ${servico} para o ${condominio}.

Gostaria de confirmar se vocês receberam tudo certinho e se ficou alguma dúvida sobre a proposta.

Qualquer coisa, estamos à disposição!

${ASSINATURA}`
  }

  if (fase === 'duvidas') {
    return `${saudacao}

Passando para saber se vocês já conseguiram analisar o orçamento de ${servico} do ${condominio}.

Se ajudar, podemos agendar uma conversa para explicar os detalhes da proposta, tirar dúvidas técnicas ou ajustar o escopo conforme a necessidade do condomínio.

Ficamos no aguardo!

${ASSINATURA}`
  }

  if (fase === 'reforco') {
    return `${saudacao}

O orçamento de ${servico} do ${condominio} segue válido, e podemos revisar etapas, valores ou condições de pagamento se isso ajudar na decisão.

Vale lembrar que nossa agenda de obras é organizada por ordem de fechamento, então garantir a data com antecedência evita espera para iniciar o serviço.

Qualquer dúvida, é só chamar!

${ASSINATURA}`
  }

  if (fase === 'reativacao') {
    return `${saudacao}

Aqui é a Vanessa, da DIBREVA (manutenção e restauração predial).

Há um tempo enviamos um orçamento de ${servico} para o ${condominio} e queria retomar o contato: essa demanda ainda está nos planos do condomínio?

Se sim, atualizo o orçamento sem compromisso, com os valores e condições de hoje. E se surgiu outra necessidade, como pintura, fachada, lavação ou calçadas, também podemos ajudar.

Fico à disposição!

Vanessa Lobo
${ASSINATURA}`
  }

  // fechamento (última tentativa) e fallback para manual
  return `${saudacao}

Para não ficarmos insistindo, este é nosso último contato sobre o orçamento de ${servico} do ${condominio}.

Se a proposta não seguiu adiante, tudo bem, agradecemos muito a oportunidade. Se puder nos contar o motivo, nos ajuda a melhorar.

E se ainda estiver em análise, seguimos à disposição para conversar e negociar.

Um abraço,
${ASSINATURA}`
}

async function enviarWhatsApp(numero: string, texto: string): Promise<{ ok: boolean; response?: any; erro?: string }> {
  const instanceId = Deno.env.get('ZAPI_INSTANCE_ID') || Deno.env.get('ZAPI_INSTANCE')
  const token = Deno.env.get('ZAPI_TOKEN')
  const clientToken = Deno.env.get('ZAPI_CLIENT_TOKEN')

  if (!instanceId || !token) return { ok: false, erro: 'ZAPI_INSTANCE_ID ou ZAPI_TOKEN não configurados' }

  let phone = numero.replace(/\D/g, '').replace(/^0+/, '')
  if (phone.startsWith('55') && phone.length >= 12) phone = phone.slice(2)
  // Celulares antigos sem o nono dígito (DDD + 8 dígitos): insere o 9
  if (phone.length === 10) phone = phone.slice(0, 2) + '9' + phone.slice(2)
  const fullPhone = `55${phone}`

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

  if (!body.lead_id || !body.fase) return err('Faltam campos obrigatórios: lead_id, fase')

  const supabase = createAdminClient()

  const { data: lead, error: errLead } = await supabase
    .from('leads')
    .select('*')
    .eq('id', body.lead_id)
    .is('deleted_at', null)
    .single()

  if (errLead || !lead) return err('Lead não encontrado', 404)

  const destinatario = lead.telefone
  if (!destinatario) return err('Lead sem telefone cadastrado')

  const textoFinal = body.mensagem || gerarMensagem(body.fase, lead)

  const r = await enviarWhatsApp(destinatario, textoFinal)

  await supabase.from('followup_log').insert({
    lead_id: body.lead_id,
    fase: body.fase,
    canal: 'whatsapp',
    destinatario,
    mensagem: textoFinal,
    automatico: body.automatico === true,
    status: r.ok ? 'enviado' : 'falha',
    erro: r.erro || null,
    provider_response: r.response || null
  })

  if (r.ok) {
    const updates: Record<string, unknown> = {
      qtd_followups_enviados: (lead.qtd_followups_enviados || 0) + 1,
      ultimo_followup_em: new Date().toISOString()
    }
    // Primeiro follow-up move o lead para a etapa de acompanhamento no pipeline
    if (lead.status === 'orcamento_enviado') updates.status = 'followup_orcamento'

    await supabase.from('leads').update(updates).eq('id', body.lead_id)
  }

  if (!r.ok) return err('Falha no envio: ' + (r.erro || 'erro desconhecido'), 502)

  return ok({
    lead_id: body.lead_id,
    fase: body.fase,
    whatsapp: { status: 'enviado', destinatario }
  })
})
