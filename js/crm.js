// ===== CRM Module =====

const CRM = {
  leads: [],
  filtered: [],
  page: 1,
  perPage: 10,
  sortField: 'created_at',
  sortAsc: false,
  chartStatus: null,
  chartCidades: null,
  chartRelQtd: null,
  chartRelValor: null,

  // Pipeline stages
  stages: [
    { id: 'lead', label: 'Lead' },
    { id: 'visita_tecnica', label: 'Visita Técnica' },
    { id: 'orcamento_enviado', label: 'Orçamento Enviado' },
    { id: 'negociacao', label: 'Negociação' },
    { id: 'aprovado', label: 'Aprovado' },
    { id: 'perdido', label: 'Perdido' }
  ],

  async init() {
    try {
      await this.loadData();
      this.renderKPIs();
      this.renderPipeline();
      this.renderTable();
      this.renderCharts();
      this.setupStatusAutoDate();
    } catch (err) {
      console.error('Erro ao inicializar CRM:', err);
      UI.error('Erro ao carregar dados. Verifique a conexão com Supabase.');
    }
  },

  async loadData() {
    this.leads = await DB.list('leads', {
      orderBy: this.sortField,
      ascending: this.sortAsc
    });
    this.filtered = [...this.leads];
  },

  // --- Auto-preencher datas ao mudar status ---
  setupStatusAutoDate() {
    const statusEl = document.getElementById('lead-status');
    if (!statusEl) return;
    statusEl.addEventListener('change', () => {
      const hoje = new Date().toISOString().split('T')[0];
      const status = statusEl.value;
      if (status === 'orcamento_enviado') {
        const el = document.getElementById('lead-data-envio-orcamento');
        if (el && !el.value) el.value = hoje;
      } else if (status === 'aprovado') {
        const el = document.getElementById('lead-data-aprovacao');
        if (el && !el.value) el.value = hoje;
      } else if (status === 'perdido') {
        const el = document.getElementById('lead-data-perdido');
        if (el && !el.value) el.value = hoje;
      }
    });
  },

  // --- KPIs ---
  async renderKPIs() {
    try {
      const kpis = await DB.kpis('vw_crm_kpis');
      document.getElementById('kpi-leads').textContent = kpis.leads_ativos || 0;
      document.getElementById('kpi-previsao').textContent = UI.moeda(kpis.previsao_faturamento || 0);
      document.getElementById('kpi-negociacao').textContent = kpis.em_negociacao || 0;
      document.getElementById('kpi-aprovados').textContent = kpis.aprovados_mes || 0;
    } catch {
      // Fallback: calcular no frontend
      const ativos = this.leads.filter(l => !['aprovado','perdido'].includes(l.status));
      document.getElementById('kpi-leads').textContent = ativos.length;
      document.getElementById('kpi-previsao').textContent = UI.moeda(
        ativos.reduce((s, l) => s + (l.valor_estimado * (l.probabilidade || 30) / 100), 0)
      );
      document.getElementById('kpi-negociacao').textContent = this.leads.filter(l => l.status === 'negociacao').length;
      const mesAtual = new Date().getMonth();
      document.getElementById('kpi-aprovados').textContent = this.leads.filter(l =>
        l.status === 'aprovado' && new Date(l.updated_at).getMonth() === mesAtual
      ).length;
    }
  },

  // --- Pipeline Kanban ---
  renderPipeline() {
    const container = document.getElementById('pipeline-container');
    container.innerHTML = this.stages.map(stage => {
      const stageLeads = this.leads.filter(l => l.status === stage.id);
      return `
        <div class="pipeline-stage stage-${stage.id}">
          <div class="pipeline-header">
            <h3>${stage.label}</h3>
            <span class="count">${stageLeads.length}</span>
          </div>
          <div class="pipeline-body">
            ${stageLeads.length === 0
              ? '<div class="empty-state"><p>Nenhum lead</p></div>'
              : stageLeads.map(l => `
                <div class="pipeline-card" onclick="CRM.openEdit('${l.id}')">
                  <div class="card-title">${l.condominio}</div>
                  <div class="card-subtitle">${l.cidade || '—'}</div>
                  ${l.valor_estimado > 0 ? `<div class="card-value">${UI.moeda(l.valor_estimado)}</div>` : ''}
                  <div class="card-action">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    ${l.proxima_acao || '—'}
                  </div>
                </div>
              `).join('')
            }
          </div>
        </div>
      `;
    }).join('');
  },

  // --- Tabela ---
  renderTable() {
    const search = (document.getElementById('search-input')?.value || '').toLowerCase();
    const statusFilter = document.getElementById('filter-status')?.value || 'todos';

    this.filtered = this.leads.filter(l => {
      const matchSearch = !search ||
        (l.condominio || '').toLowerCase().includes(search) ||
        (l.nome_contato || '').toLowerCase().includes(search) ||
        (l.cidade || '').toLowerCase().includes(search) ||
        (l.administradora || '').toLowerCase().includes(search);
      const matchStatus = statusFilter === 'todos' || l.status === statusFilter;
      return matchSearch && matchStatus;
    });

    // Sort
    this.filtered.sort((a, b) => {
      let valA = a[this.sortField] ?? '';
      let valB = b[this.sortField] ?? '';
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return this.sortAsc ? -1 : 1;
      if (valA > valB) return this.sortAsc ? 1 : -1;
      return 0;
    });

    const { items, totalPages } = UI.paginate(this.filtered, this.page, this.perPage);

    document.getElementById('table-body').innerHTML = items.length === 0
      ? '<tr><td colspan="7" class="empty-state"><p>Nenhum lead encontrado</p></td></tr>'
      : items.map(l => `
        <tr>
          <td><strong>${l.condominio}</strong></td>
          <td>${l.cidade || '—'}</td>
          <td>${l.nome_contato || '—'}</td>
          <td>${l.valor_estimado > 0 ? UI.moeda(l.valor_estimado) : '—'}</td>
          <td>${UI.statusBadge(l.status)}</td>
          <td>${l.proxima_acao || '—'}</td>
          <td>
            <div class="table-actions">
              <button class="btn btn-sm btn-secondary btn-icon" title="Editar" onclick="CRM.openEdit('${l.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              ${['negociacao','aprovado'].includes(l.status) ? `
              <button class="btn btn-sm btn-success btn-icon" title="Converter em Obra" onclick="CRM.openConverter('${l.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              </button>` : ''}
              <button class="btn btn-sm btn-secondary btn-icon" title="Excluir" onclick="CRM.remove('${l.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `).join('');

    UI.renderPagination('pagination', this.page, totalPages, 'CRM.goToPage');
  },

  filterTable() {
    this.page = 1;
    this.renderTable();
  },

  sort(field) {
    if (this.sortField === field) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortField = field;
      this.sortAsc = true;
    }
    this.renderTable();
  },

  goToPage(page) {
    CRM.page = page;
    CRM.renderTable();
  },

  // --- Gráficos ---
  renderCharts() {
    this.renderStatusChart();
    this.renderCidadesChart();
  },

  renderStatusChart() {
    const ctx = document.getElementById('chart-status');
    if (!ctx) return;

    const statusCount = {};
    this.stages.forEach(s => statusCount[s.id] = 0);
    this.leads.forEach(l => { if (statusCount[l.status] !== undefined) statusCount[l.status]++; });

    const colors = {
      lead: '#3A7BBF',
      visita_tecnica: '#2A3D52',
      orcamento_enviado: '#D37E53',
      negociacao: '#E5A100',
      aprovado: '#2D8E5E',
      perdido: '#C43B3B'
    };

    if (this.chartStatus) this.chartStatus.destroy();
    this.chartStatus = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: this.stages.map(s => s.label),
        datasets: [{
          data: this.stages.map(s => statusCount[s.id]),
          backgroundColor: this.stages.map(s => colors[s.id]),
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { padding: 16, font: { size: 12 } } }
        }
      }
    });
  },

  renderCidadesChart() {
    const ctx = document.getElementById('chart-cidades');
    if (!ctx) return;

    const cidadeValor = {};
    this.leads.filter(l => l.status !== 'perdido').forEach(l => {
      const cidade = l.cidade || 'Sem cidade';
      cidadeValor[cidade] = (cidadeValor[cidade] || 0) + (l.valor_estimado || 0);
    });

    const sorted = Object.entries(cidadeValor).sort((a, b) => b[1] - a[1]).slice(0, 10);

    if (this.chartCidades) this.chartCidades.destroy();
    this.chartCidades = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: sorted.map(([c]) => c),
        datasets: [{
          label: 'Valor Estimado (R$)',
          data: sorted.map(([, v]) => v),
          backgroundColor: '#D46250',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: (ctx) => UI.moeda(ctx.raw) }
          }
        },
        scales: {
          x: {
            ticks: { callback: (v) => UI.moeda(v) }
          }
        }
      }
    });
  },

  // --- Tabs ---
  switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach((btn, i) => {
      btn.classList.toggle('active', ['pipeline','tabela','graficos','relatorios'][i] === tab);
    });
    document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');

    if (tab === 'graficos') this.renderCharts();
    if (tab === 'tabela') this.renderTable();
    if (tab === 'relatorios') this.renderRelatorios();
  },

  // --- CRUD ---
  openNew() {
    const hoje = new Date().toISOString().split('T')[0];
    document.getElementById('modal-lead-title').textContent = 'Novo Lead';
    document.getElementById('lead-id').value = '';
    document.getElementById('lead-condominio').value = '';
    document.getElementById('lead-cidade').value = '';
    document.getElementById('lead-tipo-servico').value = 'Restauração predial';
    document.getElementById('lead-valor').value = '';
    document.getElementById('lead-status').value = 'lead';
    document.getElementById('lead-proxima-acao').value = 'Contato inicial';
    document.getElementById('lead-nome-contato').value = '';
    document.getElementById('lead-telefone').value = '';
    document.getElementById('lead-email').value = '';
    document.getElementById('lead-administradora').value = '';
    document.getElementById('lead-probabilidade').value = '30';
    document.getElementById('lead-observacoes').value = '';
    document.getElementById('lead-data-entrada').value = hoje;
    document.getElementById('lead-data-envio-orcamento').value = '';
    document.getElementById('lead-data-aprovacao').value = '';
    document.getElementById('lead-data-perdido').value = '';
    UI.openModal('modal-lead');
  },

  async openEdit(id) {
    try {
      const lead = await DB.get('leads', id);
      document.getElementById('modal-lead-title').textContent = 'Editar Lead';
      document.getElementById('lead-id').value = lead.id;
      document.getElementById('lead-condominio').value = lead.condominio || '';
      document.getElementById('lead-cidade').value = lead.cidade || '';
      document.getElementById('lead-tipo-servico').value = lead.tipo_servico || 'Restauração predial';
      document.getElementById('lead-valor').value = lead.valor_estimado || '';
      document.getElementById('lead-status').value = lead.status || 'lead';
      document.getElementById('lead-proxima-acao').value = lead.proxima_acao || '';
      document.getElementById('lead-nome-contato').value = lead.nome_contato || '';
      document.getElementById('lead-telefone').value = lead.telefone || '';
      document.getElementById('lead-email').value = lead.email || '';
      document.getElementById('lead-administradora').value = lead.administradora || '';
      document.getElementById('lead-probabilidade').value = lead.probabilidade ?? 30;
      document.getElementById('lead-observacoes').value = lead.observacoes || '';
      document.getElementById('lead-data-entrada').value = lead.data_entrada || '';
      document.getElementById('lead-data-envio-orcamento').value = lead.data_envio_orcamento || '';
      document.getElementById('lead-data-aprovacao').value = lead.data_aprovacao || '';
      document.getElementById('lead-data-perdido').value = lead.data_perdido || '';
      UI.openModal('modal-lead');
    } catch (err) {
      UI.error('Erro ao carregar lead');
    }
  },

  async save() {
    const id = document.getElementById('lead-id').value;
    const condominio = document.getElementById('lead-condominio').value.trim();
    const cidade = document.getElementById('lead-cidade').value.trim();
    const tipo_servico = document.getElementById('lead-tipo-servico').value;
    const valor_estimado = parseFloat(document.getElementById('lead-valor').value) || 0;
    const status = document.getElementById('lead-status').value;
    const proxima_acao = document.getElementById('lead-proxima-acao').value.trim();

    if (!condominio) return UI.warning('Informe o condomínio');
    if (!proxima_acao) return UI.warning('Informe a próxima ação');

    const record = {
      condominio,
      cidade: cidade || 'Não informada',
      tipo_servico,
      valor_estimado,
      status,
      proxima_acao,
      nome_contato: document.getElementById('lead-nome-contato').value.trim() || null,
      telefone: document.getElementById('lead-telefone').value.trim() || null,
      email: document.getElementById('lead-email').value.trim() || null,
      administradora: document.getElementById('lead-administradora').value.trim() || null,
      probabilidade: parseInt(document.getElementById('lead-probabilidade').value) || 30,
      observacoes: document.getElementById('lead-observacoes').value.trim() || null,
      data_entrada: document.getElementById('lead-data-entrada').value || null,
      data_envio_orcamento: document.getElementById('lead-data-envio-orcamento').value || null,
      data_aprovacao: document.getElementById('lead-data-aprovacao').value || null,
      data_perdido: document.getElementById('lead-data-perdido').value || null
    };

    try {
      if (id) {
        await DB.update('leads', id, record);
        UI.success('Lead atualizado!');
      } else {
        await DB.create('leads', record);
        UI.success('Lead criado!');
      }
      UI.closeModal('modal-lead');
      await this.loadData();
      this.renderKPIs();
      this.renderPipeline();
      this.renderTable();
    } catch (err) {
      UI.error('Erro ao salvar: ' + err.message);
    }
  },

  async remove(id) {
    if (!await UI.confirm('Excluir este lead?')) return;
    try {
      await DB.remove('leads', id);
      UI.success('Lead excluído');
      await this.loadData();
      this.renderKPIs();
      this.renderPipeline();
      this.renderTable();
    } catch (err) {
      UI.error('Erro ao excluir: ' + err.message);
    }
  },

  // --- Converter Lead → Obra ---
  async openConverter(id) {
    const lead = await DB.get('leads', id);
    document.getElementById('converter-lead-id').value = id;
    document.getElementById('converter-cnpj').value = '';
    document.getElementById('converter-valor').value = lead.valor_estimado || '';
    document.getElementById('converter-data-inicio').value = new Date().toISOString().split('T')[0];
    document.getElementById('converter-prazo').value = '90';
    document.getElementById('converter-parcelas').value = '1';
    UI.openModal('modal-converter');
  },

  async converter() {
    const leadId = document.getElementById('converter-lead-id').value;
    const valor = parseFloat(document.getElementById('converter-valor').value) || null;
    const dataInicio = document.getElementById('converter-data-inicio').value || null;
    const prazo = parseInt(document.getElementById('converter-prazo').value) || 90;
    const parcelas = parseInt(document.getElementById('converter-parcelas').value) || 1;
    const cnpj = document.getElementById('converter-cnpj').value.trim() || null;

    try {
      // Criar obra via RPC (cria 1 receita automática)
      const obraId = await DB.rpc('converter_lead_em_obra', {
        p_lead_id: leadId,
        p_valor_fechado: valor,
        p_data_inicio: dataInicio,
        p_prazo_dias: prazo
      });

      // Salvar CNPJ na obra
      if (cnpj && obraId) {
        await DB.update('obras', obraId, { cnpj });
      }

      // Salvar data_aprovacao no lead
      const hoje = new Date().toISOString().split('T')[0];
      await DB.update('leads', leadId, { data_aprovacao: hoje });

      // Se tem parcelas > 1, substituir a receita única por parcelas
      if (parcelas > 1 && obraId) {
        // Buscar e remover a receita única criada pelo RPC
        const receitas = await DB.list('receitas', { filters: { obra_id: obraId } });
        for (const r of receitas) {
          await DB.remove('receitas', r.id);
        }

        // Criar parcelas mensais
        const valorParcela = Math.round((valor || 0) / parcelas * 100) / 100;
        const inicio = new Date(dataInicio);

        for (let i = 0; i < parcelas; i++) {
          const dataParcela = new Date(inicio);
          dataParcela.setMonth(dataParcela.getMonth() + i);

          await DB.create('receitas', {
            obra_id: obraId,
            descricao: `Parcela ${i + 1}/${parcelas}`,
            valor: i === parcelas - 1
              ? Math.round(((valor || 0) - valorParcela * (parcelas - 1)) * 100) / 100
              : valorParcela,
            data_prevista: dataParcela.toISOString().split('T')[0],
            status: 'previsto'
          });
        }
      }

      UI.success(`Lead convertido em Obra! ${parcelas > 1 ? parcelas + ' parcelas criadas.' : ''}`);
      UI.closeModal('modal-converter');
      await this.loadData();
      this.renderKPIs();
      this.renderPipeline();
      this.renderTable();
    } catch (err) {
      UI.error('Erro na conversão: ' + err.message);
    }
  },

  // ===== RELATÓRIOS ANUAIS =====

  getYearsFromLeads() {
    const years = new Set();
    this.leads.forEach(l => {
      if (l.data_entrada) years.add(new Date(l.data_entrada).getFullYear());
      if (l.data_envio_orcamento) years.add(new Date(l.data_envio_orcamento).getFullYear());
      if (l.data_aprovacao) years.add(new Date(l.data_aprovacao).getFullYear());
      if (l.data_perdido) years.add(new Date(l.data_perdido).getFullYear());
      if (l.created_at) years.add(new Date(l.created_at).getFullYear());
    });
    if (years.size === 0) years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  },

  renderRelatorios() {
    const selectAno = document.getElementById('relatorio-ano');
    if (!selectAno) return;

    const years = this.getYearsFromLeads();

    // Preencher select de anos (só se vazio ou mudou)
    if (selectAno.options.length === 0 || selectAno.dataset.loaded !== 'true') {
      selectAno.innerHTML = '<option value="todos">Todos os anos</option>' +
        years.map(y => `<option value="${y}">${y}</option>`).join('');
      selectAno.dataset.loaded = 'true';
    }

    const anoSelecionado = selectAno.value;

    // Filtrar leads por ano
    const filterByYear = (leads, dateField) => {
      if (anoSelecionado === 'todos') return leads.filter(l => l[dateField]);
      return leads.filter(l => {
        if (!l[dateField]) return false;
        return new Date(l[dateField]).getFullYear() === parseInt(anoSelecionado);
      });
    };

    // Orçamentos enviados: leads que passaram pelo status orcamento_enviado (tem data_envio_orcamento)
    const enviados = filterByYear(this.leads, 'data_envio_orcamento');
    const contratados = filterByYear(this.leads, 'data_aprovacao');
    const perdidos = filterByYear(this.leads, 'data_perdido');

    const totalEnviados = enviados.length;
    const totalContratados = contratados.length;
    const totalPerdidos = perdidos.length;
    const valorEnviados = enviados.reduce((s, l) => s + (l.valor_estimado || 0), 0);
    const valorContratados = contratados.reduce((s, l) => s + (l.valor_estimado || 0), 0);
    const valorPerdidos = perdidos.reduce((s, l) => s + (l.valor_estimado || 0), 0);
    const taxa = totalEnviados > 0 ? Math.round((totalContratados / totalEnviados) * 100) : 0;

    // KPIs
    document.getElementById('rel-enviados').textContent = totalEnviados;
    document.getElementById('rel-enviados-valor').textContent = UI.moeda(valorEnviados);
    document.getElementById('rel-contratados').textContent = totalContratados;
    document.getElementById('rel-contratados-valor').textContent = UI.moeda(valorContratados);
    document.getElementById('rel-perdidos').textContent = totalPerdidos;
    document.getElementById('rel-perdidos-valor').textContent = UI.moeda(valorPerdidos);
    document.getElementById('rel-taxa').textContent = taxa + '%';
    document.getElementById('rel-taxa-sub').textContent = `${totalContratados} de ${totalEnviados} orçamentos`;

    // Gráficos comparativos por ano
    this.renderRelatorioCharts(years);

    // Tabela detalhada por tipo de serviço
    this.renderRelatorioTable(enviados, contratados, perdidos);
  },

  renderRelatorioCharts(years) {
    const displayYears = years.slice().reverse();

    const dataByYear = displayYears.map(year => {
      const enviadosAno = this.leads.filter(l => l.data_envio_orcamento && new Date(l.data_envio_orcamento).getFullYear() === year);
      const contratadosAno = this.leads.filter(l => l.data_aprovacao && new Date(l.data_aprovacao).getFullYear() === year);
      const perdidosAno = this.leads.filter(l => l.data_perdido && new Date(l.data_perdido).getFullYear() === year);
      return {
        year,
        enviadosQtd: enviadosAno.length,
        contratadosQtd: contratadosAno.length,
        perdidosQtd: perdidosAno.length,
        enviadosVal: enviadosAno.reduce((s, l) => s + (l.valor_estimado || 0), 0),
        contratadosVal: contratadosAno.reduce((s, l) => s + (l.valor_estimado || 0), 0),
        perdidosVal: perdidosAno.reduce((s, l) => s + (l.valor_estimado || 0), 0)
      };
    });

    // Chart Quantidade
    const ctxQtd = document.getElementById('chart-relatorio-qtd');
    if (ctxQtd) {
      if (this.chartRelQtd) this.chartRelQtd.destroy();
      this.chartRelQtd = new Chart(ctxQtd, {
        type: 'bar',
        data: {
          labels: displayYears.map(String),
          datasets: [
            { label: 'Orçamentos Enviados', data: dataByYear.map(d => d.enviadosQtd), backgroundColor: '#D37E53', borderRadius: 4 },
            { label: 'Contratados', data: dataByYear.map(d => d.contratadosQtd), backgroundColor: '#2D8E5E', borderRadius: 4 },
            { label: 'Perdidos', data: dataByYear.map(d => d.perdidosQtd), backgroundColor: '#C43B3B', borderRadius: 4 }
          ]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'bottom', labels: { padding: 16, font: { size: 12 } } }
          },
          scales: {
            y: { beginAtZero: true, ticks: { stepSize: 1 } }
          }
        }
      });
    }

    // Chart Valor
    const ctxVal = document.getElementById('chart-relatorio-valor');
    if (ctxVal) {
      if (this.chartRelValor) this.chartRelValor.destroy();
      this.chartRelValor = new Chart(ctxVal, {
        type: 'bar',
        data: {
          labels: displayYears.map(String),
          datasets: [
            { label: 'Valor Orçado', data: dataByYear.map(d => d.enviadosVal), backgroundColor: '#D37E53', borderRadius: 4 },
            { label: 'Valor Contratado', data: dataByYear.map(d => d.contratadosVal), backgroundColor: '#2D8E5E', borderRadius: 4 },
            { label: 'Valor Perdido', data: dataByYear.map(d => d.perdidosVal), backgroundColor: '#C43B3B', borderRadius: 4 }
          ]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'bottom', labels: { padding: 16, font: { size: 12 } } },
            tooltip: { callbacks: { label: (ctx) => ctx.dataset.label + ': ' + UI.moeda(ctx.raw) } }
          },
          scales: {
            y: { beginAtZero: true, ticks: { callback: (v) => UI.moeda(v) } }
          }
        }
      });
    }
  },

  renderRelatorioTable(enviados, contratados, perdidos) {
    const tbody = document.getElementById('relatorio-table-body');
    if (!tbody) return;

    // Agrupar por tipo_servico
    const servicos = new Set();
    [...enviados, ...contratados, ...perdidos].forEach(l => servicos.add(l.tipo_servico || 'Outro'));

    const rows = Array.from(servicos).sort().map(servico => {
      const sEnv = enviados.filter(l => (l.tipo_servico || 'Outro') === servico);
      const sCon = contratados.filter(l => (l.tipo_servico || 'Outro') === servico);
      const sPer = perdidos.filter(l => (l.tipo_servico || 'Outro') === servico);
      const valEnv = sEnv.reduce((s, l) => s + (l.valor_estimado || 0), 0);
      const valCon = sCon.reduce((s, l) => s + (l.valor_estimado || 0), 0);
      const taxa = sEnv.length > 0 ? Math.round((sCon.length / sEnv.length) * 100) : 0;

      return `
        <tr>
          <td><strong>${servico}</strong></td>
          <td>${sEnv.length}</td>
          <td>${sCon.length}</td>
          <td>${sPer.length}</td>
          <td>${UI.moeda(valEnv)}</td>
          <td>${UI.moeda(valCon)}</td>
          <td>
            <div style="display:flex;align-items:center;gap:8px;">
              <div class="progress-bar" style="width:80px;">
                <div class="progress-fill ${taxa >= 50 ? 'green' : taxa >= 25 ? 'orange' : 'red'}" style="width:${taxa}%"></div>
              </div>
              <span>${taxa}%</span>
            </div>
          </td>
        </tr>
      `;
    });

    // Totais
    const totalEnv = enviados.length;
    const totalCon = contratados.length;
    const totalPer = perdidos.length;
    const totalValEnv = enviados.reduce((s, l) => s + (l.valor_estimado || 0), 0);
    const totalValCon = contratados.reduce((s, l) => s + (l.valor_estimado || 0), 0);
    const totalTaxa = totalEnv > 0 ? Math.round((totalCon / totalEnv) * 100) : 0;

    rows.push(`
      <tr style="font-weight:700;background:var(--cinza-bg);">
        <td>TOTAL</td>
        <td>${totalEnv}</td>
        <td>${totalCon}</td>
        <td>${totalPer}</td>
        <td>${UI.moeda(totalValEnv)}</td>
        <td>${UI.moeda(totalValCon)}</td>
        <td>
          <div style="display:flex;align-items:center;gap:8px;">
            <div class="progress-bar" style="width:80px;">
              <div class="progress-fill ${totalTaxa >= 50 ? 'green' : totalTaxa >= 25 ? 'orange' : 'red'}" style="width:${totalTaxa}%"></div>
            </div>
            <span>${totalTaxa}%</span>
          </div>
        </td>
      </tr>
    `);

    tbody.innerHTML = rows.length <= 1
      ? '<tr><td colspan="7" class="empty-state"><p>Nenhum dado de orçamento encontrado. Preencha as datas nos leads.</p></td></tr>'
      : rows.join('');
  },

  // --- Export CSV ---
  exportCSV() {
    UI.exportCSV(this.filtered.length ? this.filtered : this.leads, 'crm-leads', [
      { label: 'Condomínio', accessor: r => r.condominio },
      { label: 'Cidade', accessor: r => r.cidade },
      { label: 'Contato', accessor: r => r.nome_contato },
      { label: 'Telefone', accessor: r => r.telefone },
      { label: 'Tipo Serviço', accessor: r => r.tipo_servico },
      { label: 'Valor Estimado', accessor: r => r.valor_estimado },
      { label: 'Status', accessor: r => UI.statusLabel(r.status) },
      { label: 'Probabilidade', accessor: r => r.probabilidade },
      { label: 'Próxima Ação', accessor: r => r.proxima_acao },
      { label: 'Administradora', accessor: r => r.administradora },
      { label: 'Data Entrada', accessor: r => r.data_entrada || '' },
      { label: 'Data Envio Orçamento', accessor: r => r.data_envio_orcamento || '' },
      { label: 'Data Aprovação', accessor: r => r.data_aprovacao || '' },
      { label: 'Data Perdido', accessor: r => r.data_perdido || '' },
      { label: 'Observações', accessor: r => r.observacoes }
    ]);
  }
};
