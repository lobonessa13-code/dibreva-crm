// ===== Financeiro Module =====

const FIN = {
  receitas: [],
  despesas: [],
  obras: [],
  ano: new Date().getFullYear(),
  mes: new Date().getMonth() + 1,
  chartFluxo: null,

  async init() {
    try {
      await this.loadData();
      this.updateMonthLabel();
      this.renderKPIs();
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

    list.innerHTML = recMes.map(r => `
      <div class="panel-item">
        <div class="panel-item-info">
          <div class="item-title">${r.descricao}</div>
          <div class="item-sub">${UI.data(r.data_prevista)} · ${UI.statusBadge(r.status)}</div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <div class="panel-item-value" style="color: var(--success);">+${UI.moeda(r.valor)}</div>
          <div class="table-actions">
            ${r.status === 'previsto' ? `
              <button class="btn btn-sm btn-success btn-icon" title="Marcar Recebido" onclick="FIN.marcarRecebido('${r.id}')">
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
    `).join('');
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
