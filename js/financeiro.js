// ===== Financeiro Module =====

const FIN = {
  receitas: [],
  despesas: [],
  obras: [],
  inadimplentes: [],
  ano: new Date().getFullYear(),
  mes: new Date().getMonth() + 1,
  chartFluxo: null,

  async init() {
    try {
      // Marca atrasados automaticamente na carga
      try { await DB.rpc('fn_marcar_atrasos'); } catch (e) { console.warn('fn_marcar_atrasos indisponível:', e); }
      await this.loadData();
      this.updateMonthLabel();
      this.renderKPIs();
      this.renderInadimplentes();
      this.renderReceitas();
      this.renderDespesas();
      this.renderFluxoCaixa();
      await this.loadObrasSelect();
    } catch (err) {
      console.error('Erro ao inicializar Financeiro:', err);
      UI.error('Erro ao carregar dados financeiros.');
    }
  },

  async loadData() {
    this.receitas = await DB.list('receitas', { orderBy: 'data_prevista', ascending: false });
    this.despesas = await DB.list('despesas', { orderBy: 'data_vencimento', ascending: false });
    try {
      const { data, error } = await sb.from('vw_inadimplentes').select('*');
      if (error) throw error;
      this.inadimplentes = data || [];
    } catch (e) {
      console.warn('vw_inadimplentes indisponível:', e?.message);
      this.inadimplentes = [];
    }
  },

  async loadObrasSelect() {
    this.obras = await DB.list('obras', { orderBy: 'condominio', ascending: true });
    const options = '<option value="">— Sem vínculo —</option>' +
      this.obras.map(o => `<option value="${o.id}">${o.condominio} (${UI.moeda(o.valor_fechado)})</option>`).join('');
    const selReceita = document.getElementById('receita-obra-id');
    const selDespesa = document.getElementById('despesa-obra-id');
    if (selReceita) selReceita.innerHTML = options;
    if (selDespesa) selDespesa.innerHTML = options;
  },

  // --- Mês ---
  updateMonthLabel() {
    document.getElementById('month-label').textContent = `${UI.mesNome(this.mes)} ${this.ano}`;
  },

  prevMonth() {
    this.mes--;
    if (this.mes < 1) { this.mes = 12; this.ano--; }
    this.updateMonthLabel();
    this.renderKPIs();
    this.renderReceitas();
    this.renderDespesas();
  },

  nextMonth() {
    this.mes++;
    if (this.mes > 12) { this.mes = 1; this.ano++; }
    this.updateMonthLabel();
    this.renderKPIs();
    this.renderReceitas();
    this.renderDespesas();
  },

  // --- Filtrar por mês ---
  receitasDoMes() {
    return this.receitas.filter(r => {
      const d = new Date(r.data_prevista);
      return d.getFullYear() === this.ano && (d.getMonth() + 1) === this.mes;
    });
  },

  despesasDoMes() {
    return this.despesas.filter(d => {
      const dt = new Date(d.data_vencimento);
      return dt.getFullYear() === this.ano && (dt.getMonth() + 1) === this.mes;
    });
  },

  // --- KPIs ---
  async renderKPIs() {
    // Inadimplência (sempre dos inadimplentes carregados)
    const atrasados = this.inadimplentes.filter(i => (i.dias_atraso || 0) > 0);
    const valorAtrasado = atrasados.reduce((s, i) => s + (i.valor || 0), 0);
    const elInad = document.getElementById('kpi-inadimplencia');
    const elInadQtd = document.getElementById('kpi-inadimplencia-qtd');
    if (elInad) elInad.textContent = UI.moeda(valorAtrasado);
    if (elInadQtd) elInadQtd.textContent = atrasados.length > 0
      ? `${atrasados.length} parcela(s) atrasada(s)`
      : 'Tudo em dia ✓';

    try {
      const kpis = await DB.rpc('fn_financeiro_kpis', { p_ano: this.ano, p_mes: this.mes });
      const fat = kpis?.faturamento_mes || 0;
      const desp = kpis?.despesas_mes || 0;
      const lucro = kpis?.lucro_bruto || 0;
      document.getElementById('kpi-faturamento').textContent = UI.moeda(fat);
      document.getElementById('kpi-despesas').textContent = UI.moeda(desp);
      const kpiLucro = document.getElementById('kpi-lucro');
      kpiLucro.textContent = UI.moeda(lucro);
      kpiLucro.className = `kpi-value ${lucro >= 0 ? 'success' : 'danger'}`;
    } catch {
      // Fallback no frontend
      const recMes = this.receitasDoMes();
      const despMes = this.despesasDoMes();
      const fat = recMes.filter(r => r.status === 'recebido').reduce((s, r) => s + (r.valor || 0), 0);
      const desp = despMes.filter(d => d.status === 'pago').reduce((s, d) => s + (d.valor || 0), 0);
      const lucro = fat - desp;
      document.getElementById('kpi-faturamento').textContent = UI.moeda(fat);
      document.getElementById('kpi-despesas').textContent = UI.moeda(desp);
      const kpiLucro = document.getElementById('kpi-lucro');
      kpiLucro.textContent = UI.moeda(lucro);
      kpiLucro.className = `kpi-value ${lucro >= 0 ? 'success' : 'danger'}`;
    }
  },

  // --- Listas ---
  renderReceitas() {
    const list = document.getElementById('receitas-list');
    const recMes = this.receitasDoMes();

    if (recMes.length === 0) {
      list.innerHTML = '<div class="empty-state"><p>Nenhuma receita neste mês</p></div>';
      return;
    }

    list.innerHTML = recMes.map(r => {
      const isAtrasada = r.status === 'atrasado';
      const podeMarcarReceb = r.status === 'previsto' || r.status === 'atrasado';
      return `
      <div class="panel-item" style="${isAtrasada ? 'border-left: 3px solid var(--danger); padding-left: 9px;' : ''}">
        <div class="panel-item-info">
          <div class="item-title">${r.descricao}</div>
          <div class="item-sub">${UI.data(r.data_prevista)} · ${UI.statusBadge(r.status)}${isAtrasada ? ' · <strong style="color:var(--danger);">Atrasada</strong>' : ''}</div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <div class="panel-item-value" style="color: ${isAtrasada ? 'var(--danger)' : 'var(--success)'};">${isAtrasada ? '!' : '+'}${UI.moeda(r.valor)}</div>
          <div class="table-actions">
            ${isAtrasada ? `
              <button class="btn btn-sm btn-icon" style="background: var(--laranja); color: white;" title="Enviar lembrete" onclick="FIN.openLembrete('${r.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              </button>` : ''}
            ${podeMarcarReceb ? `
              <button class="btn btn-sm btn-success btn-icon" title="Registrar Pagamento" onclick="FIN.openPagamento('${r.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              </button>` : ''}
            <button class="btn btn-sm btn-secondary btn-icon" title="Editar" onclick="FIN.editReceita('${r.id}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn btn-sm btn-secondary btn-icon" title="Excluir" onclick="FIN.removeReceita('${r.id}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      </div>
    `;}).join('');
  },

  // --- Inadimplentes ---
  renderInadimplentes() {
    const list = document.getElementById('inadimplentes-list');
    if (!list) return;

    if (this.inadimplentes.length === 0) {
      list.innerHTML = '<div class="empty-state"><p>✓ Nenhuma parcela atrasada ou próxima do vencimento</p></div>';
      return;
    }

    list.innerHTML = this.inadimplentes.map(i => {
      const cor = {
        a_vencer: 'var(--cinza)',
        amarelo: '#f59e0b',
        laranja: '#f97316',
        vermelho: 'var(--danger)'
      }[i.nivel_alerta] || 'var(--cinza)';

      const statusTxt = i.dias_atraso > 0
        ? `<strong style="color: ${cor};">${i.dias_atraso} dia(s) em atraso</strong>`
        : i.dias_atraso === 0
          ? '<strong style="color: var(--laranja);">Vence hoje</strong>'
          : `<span style="color: var(--cinza);">Vence em ${Math.abs(i.dias_atraso)} dia(s)</span>`;

      const nomeCliente = i.cliente_nome || i.cliente_obra_nome || '—';
      const contato = [i.email_cobranca || i.email, i.whatsapp || i.telefone].filter(Boolean).join(' · ');

      return `
        <div class="panel-item" style="border-left: 3px solid ${cor}; padding-left: 9px;">
          <div class="panel-item-info" style="flex: 1;">
            <div class="item-title">${i.descricao}</div>
            <div class="item-sub">
              ${i.condominio ? `<strong>${i.condominio}</strong> · ` : ''}${nomeCliente}<br>
              Vencimento: ${UI.data(i.data_prevista)} · ${statusTxt}
              ${i.qtd_lembretes_enviados > 0 ? `<br><small style="color: var(--cinza);">📨 ${i.qtd_lembretes_enviados} lembrete(s) enviado(s)${i.ultimo_lembrete_em ? ' · último em ' + UI.data(i.ultimo_lembrete_em) : ''}</small>` : ''}
              ${contato ? `<br><small style="color: var(--cinza);">${contato}</small>` : ''}
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <div class="panel-item-value" style="color: ${cor};">${UI.moeda(i.valor)}</div>
            <div class="table-actions">
              ${i.dias_atraso > 0 ? `
                <button class="btn btn-sm" style="background: var(--laranja); color: white;" title="Enviar lembrete" onclick="FIN.openLembrete('${i.receita_id}')">
                  Lembrar
                </button>` : ''}
              <button class="btn btn-sm btn-success" title="Registrar pagamento" onclick="FIN.openPagamento('${i.receita_id}')">
                Pago
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  async marcarAtrasos() {
    try {
      const count = await DB.rpc('fn_marcar_atrasos');
      UI.success(`${count || 0} receita(s) marcadas como atrasadas`);
      await this.loadData();
      this.renderKPIs();
      this.renderInadimplentes();
      this.renderReceitas();
    } catch (err) {
      UI.error('Erro ao atualizar atrasos: ' + err.message);
    }
  },

  // --- Modal Pagamento ---
  async openPagamento(receitaId) {
    try {
      const r = await DB.get('receitas', receitaId);
      document.getElementById('pag-receita-id').value = r.id;
      document.getElementById('pag-data').value = new Date().toISOString().split('T')[0];
      document.getElementById('pag-forma').value = '';
      document.getElementById('pag-comprovante').value = '';
      document.getElementById('pag-info').innerHTML = `
        <strong>${r.descricao}</strong><br>
        Valor: ${UI.moeda(r.valor)} · Vencimento: ${UI.data(r.data_prevista)}
      `;
      UI.openModal('modal-pagamento');
    } catch (err) {
      UI.error('Erro: ' + err.message);
    }
  },

  async confirmarPagamento() {
    const id = document.getElementById('pag-receita-id').value;
    const data = document.getElementById('pag-data').value;
    const forma = document.getElementById('pag-forma').value || null;
    const comprovante = document.getElementById('pag-comprovante').value.trim() || null;

    if (!data) return UI.warning('Informe a data do recebimento');

    try {
      await DB.rpc('fn_registrar_pagamento', {
        p_receita_id: id,
        p_data_recebimento: data,
        p_forma_pagamento: forma,
        p_comprovante_url: comprovante
      });
      UI.success('Pagamento registrado!');
      UI.closeModal('modal-pagamento');
      await this.loadData();
      this.renderKPIs();
      this.renderInadimplentes();
      this.renderReceitas();
      this.renderFluxoCaixa();
    } catch (err) {
      // Fallback se a função não existir
      try {
        await DB.update('receitas', id, {
          status: 'recebido',
          data_recebimento: data,
          forma_pagamento: forma,
          comprovante_url: comprovante
        });
        UI.success('Pagamento registrado!');
        UI.closeModal('modal-pagamento');
        await this.loadData();
        this.renderKPIs();
        this.renderInadimplentes();
        this.renderReceitas();
        this.renderFluxoCaixa();
      } catch (e2) {
        UI.error('Erro ao registrar pagamento: ' + e2.message);
      }
    }
  },

  // --- Modal Lembrete ---
  async openLembrete(receitaId) {
    try {
      const inad = this.inadimplentes.find(i => i.receita_id === receitaId);
      if (!inad) {
        UI.warning('Dados de cobrança não encontrados. Verifique se a obra tem cliente vinculado.');
        return;
      }

      document.getElementById('lembrete-receita-id').value = receitaId;
      document.getElementById('lembrete-info').innerHTML = `
        <strong>${inad.descricao}</strong><br>
        ${inad.condominio || ''} · ${inad.cliente_nome || inad.cliente_obra_nome || '—'}<br>
        Valor: <strong>${UI.moeda(inad.valor)}</strong> · Vencimento: ${UI.data(inad.data_prevista)}<br>
        ${inad.dias_atraso > 0 ? `<strong style="color: var(--danger);">${inad.dias_atraso} dia(s) em atraso</strong>` : 'A vencer'}
      `;

      // Definir fase sugerida automaticamente
      const fase = inad.dias_atraso <= 0 ? 'lembrete' : inad.dias_atraso <= 7 ? 'suave' : 'formal';
      document.getElementById('lembrete-fase').value = fase;
      document.getElementById('lembrete-email').checked = inad.email_cobranca || inad.email ? true : false;
      document.getElementById('lembrete-whatsapp').checked = inad.whatsapp || inad.telefone ? true : false;

      this.atualizarMensagemLembrete();
      document.getElementById('lembrete-fase').onchange = () => this.atualizarMensagemLembrete();

      UI.openModal('modal-lembrete');
    } catch (err) {
      UI.error('Erro: ' + err.message);
    }
  },

  atualizarMensagemLembrete() {
    const receitaId = document.getElementById('lembrete-receita-id').value;
    const inad = this.inadimplentes.find(i => i.receita_id === receitaId);
    if (!inad) return;

    const fase = document.getElementById('lembrete-fase').value;
    const responsavel = inad.nome_responsavel || 'Prezado(a)';
    const condominio = inad.condominio || inad.cliente_nome || '';
    const valor = UI.moeda(inad.valor);
    const venc = UI.data(inad.data_prevista);
    const desc = inad.descricao;

    const templates = {
      lembrete: `Olá, ${responsavel}!

Passando para lembrar amigavelmente do vencimento da parcela:

📋 ${desc}
🏢 ${condominio}
💰 Valor: ${valor}
📅 Vencimento: ${venc}

Caso já tenha efetuado o pagamento, por favor desconsidere esta mensagem.

Qualquer dúvida estamos à disposição.

Atenciosamente,
DIBREVA — Manutenção e Restauração Predial
(48) 99635-0627`,

      suave: `Olá, ${responsavel}!

Identificamos que a parcela abaixo está com pagamento em aberto:

📋 ${desc}
🏢 ${condominio}
💰 Valor: ${valor}
📅 Venceu em: ${venc} (${inad.dias_atraso} dia(s) atrás)

Poderia, por gentileza, verificar internamente o status do pagamento? Se já foi efetuado, agradecemos se puder nos encaminhar o comprovante.

Estamos à disposição para qualquer esclarecimento.

Atenciosamente,
DIBREVA — Manutenção e Restauração Predial
(48) 99635-0627 · dibrevaltda@gmail.com`,

      formal: `Prezado(a) ${responsavel},

Comunicamos que a parcela abaixo encontra-se em atraso há ${inad.dias_atraso} dias:

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
    };

    document.getElementById('lembrete-mensagem').value = templates[fase] || templates.lembrete;
  },

  async enviarLembrete() {
    const receitaId = document.getElementById('lembrete-receita-id').value;
    const fase = document.getElementById('lembrete-fase').value;
    const mensagem = document.getElementById('lembrete-mensagem').value.trim();
    const enviarEmail = document.getElementById('lembrete-email').checked;
    const enviarWhats = document.getElementById('lembrete-whatsapp').checked;

    if (!mensagem) return UI.warning('Mensagem não pode ficar vazia');
    if (!enviarEmail && !enviarWhats) return UI.warning('Selecione ao menos um canal');

    try {
      const { data: { session } } = await sb.auth.getSession();
      const token = session?.access_token || SUPABASE_KEY;
      const supabaseUrl = SUPABASE_URL;

      const resp = await fetch(`${supabaseUrl}/functions/v1/enviar-lembrete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': SUPABASE_KEY
        },
        body: JSON.stringify({
          receita_id: receitaId,
          fase,
          mensagem,
          canais: {
            email: enviarEmail,
            whatsapp: enviarWhats
          }
        })
      });

      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || 'Erro no envio');

      const enviados = [];
      if (result.email?.status === 'enviado') enviados.push('e-mail');
      if (result.whatsapp?.status === 'enviado') enviados.push('WhatsApp');

      UI.success(`Lembrete enviado: ${enviados.join(' + ') || 'verifique o log'}`);
      UI.closeModal('modal-lembrete');
      await this.loadData();
      this.renderInadimplentes();
    } catch (err) {
      UI.error('Erro ao enviar: ' + err.message);
    }
  },

  renderDespesas() {
    const list = document.getElementById('despesas-list');
    const despMes = this.despesasDoMes();

    if (despMes.length === 0) {
      list.innerHTML = '<div class="empty-state"><p>Nenhuma despesa neste mês</p></div>';
      return;
    }

    list.innerHTML = despMes.map(d => `
      <div class="panel-item">
        <div class="panel-item-info">
          <div class="item-title">${d.descricao}</div>
          <div class="item-sub">${d.categoria} · ${UI.data(d.data_vencimento)} · ${UI.statusBadge(d.status)}</div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <div class="panel-item-value" style="color: var(--danger);">-${UI.moeda(d.valor)}</div>
          <div class="table-actions">
            ${d.status === 'pendente' ? `
              <button class="btn btn-sm btn-success btn-icon" title="Marcar Pago" onclick="FIN.marcarPago('${d.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              </button>` : ''}
            <button class="btn btn-sm btn-secondary btn-icon" title="Editar" onclick="FIN.editDespesa('${d.id}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn btn-sm btn-secondary btn-icon" title="Excluir" onclick="FIN.removeDespesa('${d.id}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      </div>
    `).join('');
  },

  // --- Gráfico Fluxo de Caixa ---
  async renderFluxoCaixa() {
    const ctx = document.getElementById('chart-fluxo');
    if (!ctx) return;

    let labels = [], recData = [], despData = [], saldoData = [];

    try {
      const fluxo = await DB.rpc('fn_fluxo_caixa', { p_meses: 6 });
      if (Array.isArray(fluxo)) {
        labels = fluxo.map(f => f.mes_nome);
        recData = fluxo.map(f => f.receitas_total || 0);
        despData = fluxo.map(f => f.despesas_total || 0);
        saldoData = fluxo.map(f => f.saldo || 0);
      }
    } catch {
      // Fallback: calcular no frontend
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const m = d.getMonth() + 1;
        const a = d.getFullYear();
        labels.push(`${UI.mesNome(m).slice(0,3)}/${String(a).slice(2)}`);

        const rec = this.receitas.filter(r => {
          const rd = new Date(r.data_prevista);
          return rd.getFullYear() === a && (rd.getMonth() + 1) === m && r.status === 'recebido';
        }).reduce((s, r) => s + (r.valor || 0), 0);

        const desp = this.despesas.filter(d => {
          const dd = new Date(d.data_vencimento);
          return dd.getFullYear() === a && (dd.getMonth() + 1) === m && d.status === 'pago';
        }).reduce((s, d) => s + (d.valor || 0), 0);

        recData.push(rec);
        despData.push(desp);
        saldoData.push(rec - desp);
      }
    }

    if (this.chartFluxo) this.chartFluxo.destroy();
    this.chartFluxo = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Receitas',
            data: recData,
            backgroundColor: 'rgba(45,142,94,0.7)',
            borderRadius: 4
          },
          {
            label: 'Despesas',
            data: despData,
            backgroundColor: 'rgba(196,59,59,0.7)',
            borderRadius: 4
          },
          {
            label: 'Saldo',
            data: saldoData,
            type: 'line',
            borderColor: '#1D2A3A',
            backgroundColor: 'rgba(29,42,58,0.1)',
            fill: true,
            tension: 0.3,
            pointRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: { label: (ctx) => `${ctx.dataset.label}: ${UI.moeda(ctx.raw)}` }
          }
        },
        scales: {
          y: { ticks: { callback: v => UI.moeda(v) } }
        }
      }
    });
  },

  // --- CRUD Receitas ---
  openNovaReceita() {
    document.getElementById('modal-receita-title').textContent = 'Nova Receita';
    document.getElementById('receita-id').value = '';
    document.getElementById('receita-obra-id').value = '';
    document.getElementById('receita-descricao').value = '';
    document.getElementById('receita-valor').value = '';
    document.getElementById('receita-data').value = new Date().toISOString().split('T')[0];
    document.getElementById('receita-parcelas').value = '1';
    document.getElementById('receita-status').value = 'previsto';
    UI.openModal('modal-receita');
  },

  async editReceita(id) {
    try {
      const r = await DB.get('receitas', id);
      document.getElementById('modal-receita-title').textContent = 'Editar Receita';
      document.getElementById('receita-id').value = r.id;
      document.getElementById('receita-obra-id').value = r.obra_id || '';
      document.getElementById('receita-descricao').value = r.descricao || '';
      document.getElementById('receita-valor').value = r.valor || '';
      document.getElementById('receita-data').value = UI.dataISO(r.data_prevista);
      document.getElementById('receita-parcelas').value = '1';
      document.getElementById('receita-status').value = r.status || 'previsto';
      UI.openModal('modal-receita');
    } catch (err) {
      UI.error('Erro ao carregar receita');
    }
  },

  async saveReceita() {
    const id = document.getElementById('receita-id').value;
    const descricao = document.getElementById('receita-descricao').value.trim();
    const valorTotal = parseFloat(document.getElementById('receita-valor').value);
    const data = document.getElementById('receita-data').value;
    const parcelas = parseInt(document.getElementById('receita-parcelas').value) || 1;
    const status = document.getElementById('receita-status').value;
    const obraId = document.getElementById('receita-obra-id').value || null;

    if (!descricao || !valorTotal || !data) return UI.warning('Preencha descrição, valor e data');

    try {
      if (id) {
        // Editando receita existente (sem parcelar)
        await DB.update('receitas', id, {
          obra_id: obraId, descricao, valor: valorTotal, data_prevista: data, status
        });
        UI.success('Receita atualizada!');
      } else if (parcelas > 1) {
        // Criar múltiplas parcelas
        const valorParcela = Math.round(valorTotal / parcelas * 100) / 100;
        const inicio = new Date(data);

        for (let i = 0; i < parcelas; i++) {
          const dataParcela = new Date(inicio);
          dataParcela.setMonth(dataParcela.getMonth() + i);

          await DB.create('receitas', {
            obra_id: obraId,
            descricao: `${descricao} - Parcela ${i + 1}/${parcelas}`,
            valor: i === parcelas - 1
              ? Math.round((valorTotal - valorParcela * (parcelas - 1)) * 100) / 100
              : valorParcela,
            data_prevista: dataParcela.toISOString().split('T')[0],
            status
          });
        }
        UI.success(`${parcelas} parcelas criadas!`);
      } else {
        await DB.create('receitas', {
          obra_id: obraId, descricao, valor: valorTotal, data_prevista: data, status
        });
        UI.success('Receita criada!');
      }
      UI.closeModal('modal-receita');
      await this.loadData();
      this.renderKPIs();
      this.renderReceitas();
      this.renderFluxoCaixa();
    } catch (err) {
      UI.error('Erro ao salvar: ' + err.message);
    }
  },

  async marcarRecebido(id) {
    try {
      await DB.update('receitas', id, { status: 'recebido' });
      UI.success('Receita marcada como recebida!');
      await this.loadData();
      this.renderKPIs();
      this.renderReceitas();
      this.renderFluxoCaixa();
    } catch (err) {
      UI.error('Erro: ' + err.message);
    }
  },

  async removeReceita(id) {
    if (!await UI.confirm('Excluir esta receita?')) return;
    try {
      await DB.remove('receitas', id);
      UI.success('Receita excluída');
      await this.loadData();
      this.renderKPIs();
      this.renderReceitas();
      this.renderFluxoCaixa();
    } catch (err) {
      UI.error('Erro: ' + err.message);
    }
  },

  // --- CRUD Despesas ---
  openNovaDespesa() {
    document.getElementById('modal-despesa-title').textContent = 'Nova Despesa';
    document.getElementById('despesa-id').value = '';
    document.getElementById('despesa-obra-id').value = '';
    document.getElementById('despesa-descricao').value = '';
    document.getElementById('despesa-categoria').value = 'Material';
    document.getElementById('despesa-valor').value = '';
    document.getElementById('despesa-data').value = new Date().toISOString().split('T')[0];
    document.getElementById('despesa-status').value = 'pendente';
    UI.openModal('modal-despesa');
  },

  async editDespesa(id) {
    try {
      const d = await DB.get('despesas', id);
      document.getElementById('modal-despesa-title').textContent = 'Editar Despesa';
      document.getElementById('despesa-id').value = d.id;
      document.getElementById('despesa-obra-id').value = d.obra_id || '';
      document.getElementById('despesa-descricao').value = d.descricao || '';
      document.getElementById('despesa-categoria').value = d.categoria || 'Geral';
      document.getElementById('despesa-valor').value = d.valor || '';
      document.getElementById('despesa-data').value = UI.dataISO(d.data_vencimento);
      document.getElementById('despesa-status').value = d.status || 'pendente';
      UI.openModal('modal-despesa');
    } catch (err) {
      UI.error('Erro ao carregar despesa');
    }
  },

  async saveDespesa() {
    const id = document.getElementById('despesa-id').value;
    const descricao = document.getElementById('despesa-descricao').value.trim();
    const valor = parseFloat(document.getElementById('despesa-valor').value);
    const data = document.getElementById('despesa-data').value;

    if (!descricao || !valor || !data) return UI.warning('Preencha descrição, valor e data');

    const record = {
      obra_id: document.getElementById('despesa-obra-id').value || null,
      descricao,
      categoria: document.getElementById('despesa-categoria').value,
      valor,
      data_vencimento: data,
      status: document.getElementById('despesa-status').value
    };

    try {
      if (id) {
        await DB.update('despesas', id, record);
        UI.success('Despesa atualizada!');
      } else {
        await DB.create('despesas', record);
        UI.success('Despesa criada!');
      }
      UI.closeModal('modal-despesa');
      await this.loadData();
      this.renderKPIs();
      this.renderDespesas();
      this.renderFluxoCaixa();
    } catch (err) {
      UI.error('Erro ao salvar: ' + err.message);
    }
  },

  async marcarPago(id) {
    try {
      await DB.update('despesas', id, { status: 'pago' });
      UI.success('Despesa marcada como paga!');
      await this.loadData();
      this.renderKPIs();
      this.renderDespesas();
      this.renderFluxoCaixa();
    } catch (err) {
      UI.error('Erro: ' + err.message);
    }
  },

  async removeDespesa(id) {
    if (!await UI.confirm('Excluir esta despesa?')) return;
    try {
      await DB.remove('despesas', id);
      UI.success('Despesa excluída');
      await this.loadData();
      this.renderKPIs();
      this.renderDespesas();
      this.renderFluxoCaixa();
    } catch (err) {
      UI.error('Erro: ' + err.message);
    }
  },

  // --- Export CSV ---
  exportCSV() {
    const allData = [
      ...this.receitasDoMes().map(r => ({ ...r, tipo: 'Receita' })),
      ...this.despesasDoMes().map(d => ({ ...d, tipo: 'Despesa' }))
    ];
    UI.exportCSV(allData, `financeiro-${this.ano}-${String(this.mes).padStart(2,'0')}`, [
      { label: 'Tipo', accessor: r => r.tipo },
      { label: 'Descrição', accessor: r => r.descricao },
      { label: 'Categoria', accessor: r => r.categoria || '—' },
      { label: 'Valor', accessor: r => r.valor },
      { label: 'Data', accessor: r => r.data_prevista || r.data_vencimento },
      { label: 'Status', accessor: r => UI.statusLabel(r.status) }
    ]);
  }
};
