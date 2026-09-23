// ===================================================================
// ALERTA DIÁRIO — Resumo dos follow-ups de orçamento para a Vanessa
// Endpoint: POST /functions/v1/alerta-followups
// Executado via pg_cron (~11h UTC = 8h Brasília)
//
// Usa a mesma régua do CRM (js/crm.js → alertaFollowup) e da
// verificar-followups: dia 2, 7, 15 e 30 após o envio, 48h entre msgs.
//
// Canais (cada um só é usado se os secrets existirem):
//   Telegram → TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID
//   WhatsApp → ALERTA_WHATSAPP_NUMERO (+ ZAPI_INSTANCE_ID/ZAPI_TOKEN)
//
// Body opcional: { "enviar": false } só devolve o texto (teste)
//                { "forcar": true }  envia mesmo sem pendências
// ===================================================================
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createAdminClient, corsHeaders, ok, err } from '../_shared/supabase.ts'

interface LeadFollowup {
  lead_id: string
  condominio: string
  tipo_servico: string | null
  nome_contato: string | null
  telefone: string | null
  valor_estimado: number | null
  data_envio_orcamento: string
  followup_ativo: boolean
  qtd_followups_enviados: number | null
  ultimo_followup_em: string | null
}

const CADENCIA = [
  { qtd: 0, diasMinimos: 2,  label: 'confirmação' },
  { qtd: 1, diasMinimos: 7,  label: 'dúvidas' },
  { qtd: 2, diasMinimos: 15, label: 'reforço' },
  { qtd: 3, diasMinimos: 30, label: 'fechamento' },
]

const CRM_URL = 'https://dibreva-crm.vercel.app/crm.html'
const DIA_MS = 86400000

// Data de hoje no fuso de Brasília, como dia UTC 00:00 (só para contar dias)
function hojeBrasilia(): number {
  const s = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  return Date.parse(s)
}

function diaDe(iso: string): number {
  const s = new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  return Date.parse(s)
}

function fmt(ms: number): string {
  const [a, m, d] = new Date(ms).toISOString().slice(0, 10).split('-')
  return `${d}/${m}`
}

function proximaMensagem(l: LeadFollowup, hoje: number) {
  const etapa = CADENCIA.find(c => c.qtd === (l.qtd_followups_enviados || 0))
  if (!etapa) return null
  let prox = Date.parse(l.data_envio_orcamento) + etapa.diasMinimos * DIA_MS
  if (l.ultimo_followup_em) prox = Math.max(prox, diaDe(l.ultimo_followup_em) + 2 * DIA_MS)
  return { etapa, prox, diasPara: Math.round((prox - hoje) / DIA_MS) }
}

function moeda(v: number | null): string {
  if (!v) return ''
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function montarTexto(leads: LeadFollowup[], hoje: number) {
  const atrasados: string[] = []
  const hojeLista: string[] = []
  const amanha: string[] = []

  for (const l of leads) {
    const p = proximaMensagem(l, hoje)
    if (!p) continue
    const contato = [l.nome_contato, l.telefone].filter(Boolean).join(' · ') || 'sem contato'
    const valor = moeda(l.valor_estimado)
    const linha = `${l.condominio}: ${p.etapa.label}${valor ? ` (${valor})` : ''}\n   ${contato}`
    if (p.diasPara < 0) atrasados.push(`🔴 ${linha.replace(':', `: atrasado ${-p.diasPara}d,`)}`)
    else if (p.diasPara === 0) hojeLista.push(`🟠 ${linha}`)
    else if (p.diasPara === 1) amanha.push(`🔵 ${l.condominio}: ${p.etapa.label}`)
  }

  const pendentes = atrasados.length + hojeLista.length
  const partes = [`📋 Follow-ups de orçamento · ${fmt(hoje)}`, `Mandar mensagem hoje: ${pendentes}`]
  if (atrasados.length) partes.push(`Atrasados\n${atrasados.join('\n')}`)
  if (hojeLista.length) partes.push(`Para hoje\n${hojeLista.join('\n')}`)
  if (amanha.length) partes.push(`Amanhã\n${amanha.join('\n')}`)
  partes.push(`👉 ${CRM_URL}`)

  return { texto: partes.join('\n\n'), pendentes, amanha: amanha.length }
}

async function enviarTelegram(texto: string) {
  const token = Deno.env.get('TELEGRAM_BOT_TOKEN')
  const chatId = Deno.env.get('TELEGRAM_CHAT_ID')
  if (!token || !chatId) return { canal: 'telegram', ok: false, erro: 'não configurado' }
  try {
    const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: texto, disable_web_page_preview: true }),
    })
    const body = await resp.json()
    return { canal: 'telegram', ok: !!body.ok, erro: body.ok ? undefined : body.description }
  } catch (e) {
    return { canal: 'telegram', ok: false, erro: String(e) }
  }
}

async function enviarWhatsApp(texto: string) {
  const numero = Deno.env.get('ALERTA_WHATSAPP_NUMERO')
  const instanceId = Deno.env.get('ZAPI_INSTANCE_ID') || Deno.env.get('ZAPI_INSTANCE')
  const token = Deno.env.get('ZAPI_TOKEN')
  const clientToken = Deno.env.get('ZAPI_CLIENT_TOKEN')
  if (!numero || !instanceId || !token) return { canal: 'whatsapp', ok: false, erro: 'não configurado' }

  let phone = numero.replace(/\D/g, '')
  if (!phone.startsWith('55')) phone = `55${phone}`
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (clientToken) headers['Client-Token'] = clientToken
    const resp = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ phone, message: texto }),
    })
    const body = await resp.json()
    return { canal: 'whatsapp', ok: resp.ok && !body.error, erro: resp.ok && !body.error ? undefined : (body.error || 'Erro no Z-API') }
  } catch (e) {
    return { canal: 'whatsapp', ok: false, erro: String(e) }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  let opcoes: { enviar?: boolean; forcar?: boolean } = {}
  try { opcoes = await req.json() } catch { /* body vazio */ }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('vw_followup_comercial')
    .select('*')
    .eq('followup_ativo', true)

  if (error) {
    console.error('Erro ao carregar vw_followup_comercial:', error)
    return err('Erro ao carregar orçamentos: ' + error.message, 500)
  }

  const resumo = montarTexto((data || []) as LeadFollowup[], hojeBrasilia())

  if (opcoes.enviar === false) return ok({ ...resumo, enviado: false })
  if (resumo.pendentes === 0 && resumo.amanha === 0 && !opcoes.forcar) {
    return ok({ ...resumo, enviado: false, motivo: 'Nenhum follow-up pendente' })
  }

  const canais = await Promise.all([enviarTelegram(resumo.texto), enviarWhatsApp(resumo.texto)])
  console.log('alerta-followups:', JSON.stringify(canais))
  return ok({ ...resumo, enviado: canais.some(c => c.ok), canais })
})
