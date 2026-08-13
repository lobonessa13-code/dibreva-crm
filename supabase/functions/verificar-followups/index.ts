// ===================================================================
// JOB DIÁRIO — Verificar orçamentos enviados e disparar follow-ups
// Endpoint: POST /functions/v1/verificar-followups
// Executado via pg_cron (uma vez por dia, ~13h UTC = 10h Brasília)
//
// Cadência (baseada em quantos follow-ups já foram enviados):
//   0 enviados e 2+ dias do envio  -> confirmacao (recebeu o orçamento?)
//   1 enviado  e 7+ dias do envio  -> duvidas (conseguiu analisar?)
//   2 enviados e 15+ dias do envio -> reforco (proposta válida + agenda)
//   3 enviados e 30+ dias do envio -> fechamento (último contato)
//   4 enviados -> encerra a automação para o lead
// ===================================================================
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createAdminClient, corsHeaders, ok, err } from '../_shared/supabase.ts'

interface LeadFollowup {
  lead_id: string
  condominio: string
  nome_contato: string | null
  telefone: string | null
  followup_ativo: boolean
  qtd_followups_enviados: number | null
  ultimo_followup_em: string | null
  dias_desde_envio: number
}

const CADENCIA: Array<{ qtd: number; diasMinimos: number; fase: string }> = [
  { qtd: 0, diasMinimos: 2,  fase: 'confirmacao' },
  { qtd: 1, diasMinimos: 7,  fase: 'duvidas' },
  { qtd: 2, diasMinimos: 15, fase: 'reforco' },
  { qtd: 3, diasMinimos: 30, fase: 'fechamento' },
]

function calcularFase(qtdEnviados: number, diasDesdeEnvio: number): string | null {
  const etapa = CADENCIA.find(c => c.qtd === qtdEnviados)
  if (!etapa) return null
  return diasDesdeEnvio >= etapa.diasMinimos ? etapa.fase : null
}

// Nunca envia 2 follow-ups no mesmo lead em menos de 48h
function podeEnviar(ultimoFollowupEm: string | null): boolean {
  if (!ultimoFollowupEm) return true
  const ultimo = new Date(ultimoFollowupEm).getTime()
  const horas48 = 48 * 60 * 60 * 1000
  return (Date.now() - ultimo) >= horas48
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createAdminClient()

  try {
    const { data: leads, error: errView } = await supabase
      .from('vw_followup_comercial')
      .select('*')
      .eq('followup_ativo', true)

    if (errView) {
      console.error('Erro ao carregar vw_followup_comercial:', errView)
      return err('Erro ao carregar leads em follow-up: ' + errView.message, 500)
    }

    const resultados: Array<{ lead_id: string; condominio: string; fase: string | null; enviado: boolean; motivo?: string }> = []
    const followupFnUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/enviar-followup`
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    for (const l of (leads || []) as LeadFollowup[]) {
      const fase = calcularFase(l.qtd_followups_enviados || 0, l.dias_desde_envio)
      if (!fase) continue

      if (!l.telefone) {
        resultados.push({ lead_id: l.lead_id, condominio: l.condominio, fase, enviado: false, motivo: 'Sem telefone cadastrado' })
        continue
      }

      if (!podeEnviar(l.ultimo_followup_em)) {
        resultados.push({ lead_id: l.lead_id, condominio: l.condominio, fase, enviado: false, motivo: 'Aguardando intervalo (>48h)' })
        continue
      }

      try {
        const resp = await fetch(followupFnUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ lead_id: l.lead_id, fase, automatico: true })
        })

        const body = await resp.json()
        if (!resp.ok) throw new Error(body.error || 'Erro no envio')

        resultados.push({ lead_id: l.lead_id, condominio: l.condominio, fase, enviado: true })
      } catch (e) {
        resultados.push({ lead_id: l.lead_id, condominio: l.condominio, fase, enviado: false, motivo: String(e) })
      }
    }

    return ok({
      executed_at: new Date().toISOString(),
      leads_em_followup: (leads || []).length,
      followups_enviados: resultados.filter(r => r.enviado).length,
      followups_falhos: resultados.filter(r => !r.enviado && r.motivo && !r.motivo.startsWith('Aguardando')).length,
      detalhes: resultados
    })
  } catch (e) {
    console.error('Erro geral:', e)
    return err(`Erro: ${String(e)}`, 500)
  }
})
