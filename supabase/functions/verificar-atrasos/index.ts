// ===================================================================
// JOB DIÁRIO — Verificar atrasos e disparar lembretes
// Endpoint: POST /functions/v1/verificar-atrasos
// Executado via pg_cron (uma vez por dia, ~9h)
// ===================================================================
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createAdminClient, corsHeaders, ok, err } from '../_shared/supabase.ts'

interface Inadimplente {
  receita_id: string
  descricao: string
  valor: number
  data_prevista: string
  status: string
  dias_atraso: number
  nivel_alerta: string
  obra_id: string | null
  condominio: string | null
  cliente_obra_nome: string | null
  cliente_id: string | null
  cliente_nome: string | null
  email: string | null
  email_cobranca: string | null
  whatsapp: string | null
  telefone: string | null
  nome_responsavel: string | null
  notificar_email: boolean
  notificar_whatsapp: boolean
  qtd_lembretes_enviados: number | null
  ultimo_lembrete_em: string | null
}

// Define qual fase aplicar baseada em dias de atraso
function calcularFase(diasAtraso: number): 'lembrete' | 'suave' | 'formal' | null {
  if (diasAtraso === -3 || diasAtraso === -1) return 'lembrete'    // 3 dias antes / dia anterior
  if (diasAtraso === 1 || diasAtraso === 7) return 'suave'         // dia 1 e dia 7 após
  if (diasAtraso === 15 || (diasAtraso > 15 && diasAtraso % 15 === 0)) return 'formal'
  return null
}

// Verifica se já enviou lembrete nas últimas 24h para evitar spam
function podeEnviar(ultimoLembreteEm: string | null): boolean {
  if (!ultimoLembreteEm) return true
  const ultimo = new Date(ultimoLembreteEm).getTime()
  const agora = Date.now()
  const horas24 = 24 * 60 * 60 * 1000
  return (agora - ultimo) >= horas24
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createAdminClient()

  try {
    // 1. Marca receitas vencidas como 'atrasado'
    const { data: marcadas, error: errMark } = await supabase.rpc('fn_marcar_atrasos')
    if (errMark) console.error('Erro fn_marcar_atrasos:', errMark)

    // 2. Busca todos os inadimplentes da view
    const { data: inadimplentes, error: errView } = await supabase
      .from('vw_inadimplentes')
      .select('*')

    if (errView) {
      console.error('Erro ao carregar vw_inadimplentes:', errView)
      return err('Erro ao carregar inadimplentes: ' + errView.message, 500)
    }

    const resultados: Array<{ receita_id: string; fase: string; canais: string[]; erro?: string }> = []
    const lembreteFnUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/enviar-lembrete`
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    for (const i of (inadimplentes || []) as Inadimplente[]) {
      const fase = calcularFase(i.dias_atraso)
      if (!fase) continue

      // Evita reenviar muito frequentemente
      if (!podeEnviar(i.ultimo_lembrete_em)) {
        resultados.push({ receita_id: i.receita_id, fase, canais: [], erro: 'Aguardando intervalo (>24h)' })
        continue
      }

      const canais: string[] = []
      if (i.notificar_email && (i.email_cobranca || i.email)) canais.push('email')
      if (i.notificar_whatsapp && (i.whatsapp || i.telefone)) canais.push('whatsapp')

      if (canais.length === 0) {
        resultados.push({ receita_id: i.receita_id, fase, canais: [], erro: 'Sem canais de contato' })
        continue
      }

      try {
        const resp = await fetch(lembreteFnUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            receita_id: i.receita_id,
            fase,
            canais: { email: canais.includes('email'), whatsapp: canais.includes('whatsapp') },
            automatico: true
          })
        })

        const body = await resp.json()
        if (!resp.ok) throw new Error(body.error || 'Erro no envio')

        resultados.push({ receita_id: i.receita_id, fase, canais })
      } catch (e) {
        resultados.push({ receita_id: i.receita_id, fase, canais, erro: String(e) })
      }
    }

    return ok({
      executed_at: new Date().toISOString(),
      receitas_marcadas_atrasadas: marcadas || 0,
      total_inadimplentes: (inadimplentes || []).length,
      lembretes_disparados: resultados.filter(r => !r.erro).length,
      lembretes_falhos: resultados.filter(r => r.erro).length,
      detalhes: resultados
    })
  } catch (e) {
    console.error('Erro geral:', e)
    return err(`Erro: ${String(e)}`, 500)
  }
})
