// ===== Obras Module =====

const OBRAS = {
  obras: [],
  page: 1,
  perPage: 10,

  stages: [
    { id: 'planejamento', label: 'Planejamento' },
    { id: 'em_execucao', label: 'Em Execução' },
    { id: 'finalizada', label: 'Finalizada' }
  ],

  async init() {
    try {
      await this.loadData();
      this.renderKPIs();
      this.renderBoard();
      this.renderTable();
    } catch (err) {
      console.error('Erro ao inicializar Obras:', err);
      UI.error('Erro ao carregar dados de obras.');
    }
  },

  async loadData() {
    this.obras = await DB.list('obras', { orderBy: 'created_at', ascending: false });
  },

  async renderKPIs() {
    try {
      const kpis = await DB.kpis('vw_obras_kpis');
      document.getElementById('kpi-andamento').textContent = kpis.em_andamento || 0;
      document.getElementById('kpi-finalizadas').textContent = kpis.finalizadas || 0;
      document.getElementById('kpi-valor-exec').textContent = UI.moeda(kpis.valor_em_execucao || 0);
    } catch {
      const execucao = this.obras.filter(o => o.status === 'em_execucao');
      document.getElementById('kpi-andamento').textContent = execucao.length;
      document.getElementById('kpi-finalizadas').textContent = this.obras.filter(o => o.status === 'finalizada').length;
      document.getElementById('kpi-valor-exec').textContent = UI.moeda(execucao.reduce((s, o) => s + (o.valor_fechado || 0), 0));
    }
  },

  // --- Board ---
  renderBoard() {
    const container = document.getElementById('board-container');
    container.innerHTML = this.stages.map(stage => {
      const stageObras = this.obras.filter(o => o.status === stage.id);
      return `
        <div class="pipeline-stage stage-${stage.id}">
          <div class="pipeline-header">
            <h3>${stage.label}</h3>
            <span class="count">${stageObras.length}</span>
          </div>
          <div class="pipeline-body">
            ${stageObras.length === 0
              ? '<div class="empty-state"><p>Nenhuma obra</p></div>'
              : stageObras.map(o => {
                const progress = this.calcProgress(o);
                const progressClass = progress >= 90 ? 'red' : progress >= 60 ? 'orange' : 'green';
                return `
                  <div class="pipeline-card" onclick="OBRAS.openEdit('${o.id}')">
                    <div class="card-title">${o.condominio}</div>
                    <div class="card-subtitle">${o.cliente || '—'}</div>
                    <div class="card-value">${UI.moeda(o.valor_fechado)}</div>
                    ${o.data_inicio ? `
                      <div class="progress-bar">
                        <div class="progress-fill ${progressClass}" style="width: ${Math.min(progress, 100)}%"></div>
                      </div>
                      <div class="card-action">${progress.toFixed(0)}% do prazo (${o.prazo_dias || 90} dias)</div>
                    ` : ''}
                  </div>
                `;
              }).join('')
            }
          </div>
        </div>
      `;
    }).join('');
  },

  calcProgress(obra) {
    if (!obra.data_inicio || !obra.prazo_dias) return 0;
    const inicio = new Date(obra.data_inicio);
    const hoje = new Date();
    const diasPassados = Math.floor((hoje - inicio) / (1000 * 60 * 60 * 24));
    return (diasPassados / obra.prazo_dias) * 100;
  },

  // --- Tabela ---
  renderTable() {
    const search = (document.getElementById('search-obras')?.value || '').toLowerCase();
    const filtered = this.obras.filter(o =>
      !search ||
      (o.condominio || '').toLowerCase().includes(search) ||
      (o.cliente || '').toLowerCase().includes(search)
    );

    const { items, totalPages } = UI.paginate(filtered, this.page, this.perPage);

    document.getElementById('obras-table-body').innerHTML = items.length === 0
      ? '<tr><td colspan="8" class="empty-state"><p>Nenhuma obra encontrada</p></td></tr>'
      : items.map(o => `
        <tr>
          <td><strong>${o.condominio}</strong></td>
          <td>${o.cnpj || '—'}</td>
          <td>${o.cliente || '—'}</td>
          <td>${UI.moeda(o.valor_fechado)}</td>
          <td>${UI.data(o.data_inicio)}</td>
          <td>${o.prazo_dias || '—'} dias</td>
          <td>${UI.statusBadge(o.status)}</td>
          <td>
            <div class="table-actions">
              <button class="btn btn-sm btn-secondary btn-icon" title="Editar" onclick="OBRAS.openEdit('${o.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="btn btn-sm btn-secondary btn-icon" title="Financeiro" onclick="OBRAS.openFinanceiro('${o.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              </button>
              <button class="btn btn-sm btn-secondary btn-icon" title="Excluir" onclick="OBRAS.remove('${o.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `).join('');

    UI.renderPagination('obras-pagination', this.page, totalPages, 'OBRAS.goToPage');
  },

  goToPage(page) {
    OBRAS.page = page;
    OBRAS.renderTable();
  },

  // --- Tabs ---
  switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach((btn, i) => {
      btn.classList.toggle('active', ['board','tabela'][i] === tab);
    });
    document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');
  },

  // --- CRUD ---
  openNew() {
    document.getElementById('modal-obra-title').textContent = 'Nova Obra';
    document.getElementById('obra-id').value = '';
    document.getElementById('obra-condominio').value = '';
    document.getElementById('obra-cliente').value = '';
    document.getElementById('obra-cnpj').value = '';
    document.getElementById('obra-cidade').value = '';
    document.getElementById('obra-valor').value = '';
    document.getElementById('obra-data-inicio').value = new Date().toISOString().split('T')[0];
    document.getElementById('obra-prazo').value = '90';
    document.getElementById('obra-status').value = 'planejamento';
    document.getElementById('obra-observacoes').value = '';
    UI.openModal('modal-obra');
  },

  async openEdit(id) {
    try {
      const obra = await DB.get('obras', id);
      document.getElementById('modal-obra-title').textContent = 'Editar Obra';
      document.getElementById('obra-id').value = obra.id;
      document.getElementById('obra-condominio').value = obra.condominio || '';
      document.getElementById('obra-cliente').value = obra.cliente || '';
      document.getElementById('obra-cnpj').value = obra.cnpj || '';
      document.getElementById('obra-cidade').value = obra.cidade || '';
      document.getElementById('obra-valor').value = obra.valor_fechado || '';
      document.getElementById('obra-data-inicio').value = UI.dataISO(obra.data_inicio);
      document.getElementById('obra-prazo').value = obra.prazo_dias || 90;
      document.getElementById('obra-status').value = obra.status || 'planejamento';
      document.getElementById('obra-observacoes').value = obra.observacoes || '';
      UI.openModal('modal-obra');
    } catch (err) {
      UI.error('Erro ao carregar obra');
    }
  },

  async save() {
    const id = document.getElementById('obra-id').value;
    const condominio = document.getElementById('obra-condominio').value.trim();
    const cliente = document.getElementById('obra-cliente').value.trim();

    if (!condominio || !cliente) return UI.warning('Informe condomínio e cliente');

    const record = {
      condominio,
      cliente,
      cnpj: document.getElementById('obra-cnpj').value.trim() || null,
      cidade: document.getElementById('obra-cidade').value.trim() || null,
      valor_fechado: parseFloat(document.getElementById('obra-valor').value) || 0,
      data_inicio: document.getElementById('obra-data-inicio').value || null,
      prazo_dias: parseInt(document.getElementById('obra-prazo').value) || 90,
      status: document.getElementById('obra-status').value,
      observacoes: document.getElementById('obra-observacoes').value.trim() || null
    };

    try {
      if (id) {
        await DB.update('obras', id, record);
        UI.success('Obra atualizada!');
      } else {
        await DB.create('obras', record);
        UI.success('Obra criada!');
      }
      UI.closeModal('modal-obra');
      await this.loadData();
      this.renderKPIs();
      this.renderBoard();
      this.renderTable();
    } catch (err) {
      UI.error('Erro ao salvar: ' + err.message);
    }
  },

  async remove(id) {
    if (!await UI.confirm('Excluir esta obra?')) return;
    try {
      await DB.remove('obras', id);
      UI.success('Obra excluída');
      await this.loadData();
      this.renderKPIs();
      this.renderBoard();
      this.renderTable();
    } catch (err) {
      UI.error('Erro ao excluir: ' + err.message);
    }
  },

  // --- Financeiro da Obra ---
  async openFinanceiro(obraId) {
    UI.openModal('modal-obra-financeiro');
    const body = document.getElementById('modal-fin-body');
    body.innerHTML = '<div style="text-align:center; padding: 20px;"><div class="spinner"></div></div>';

    try {
      const obra = await DB.get('obras', obraId);
      const receitas = await DB.list('receitas', { filters: { obra_id: obraId } });
      const despesas = await DB.list('despesas', { filters: { obra_id: obraId } });

      document.getElementById('modal-fin-title').textContent = `Financeiro — ${obra.condominio}`;

      const totalReceitas = receitas.reduce((s, r) => s + (r.valor || 0), 0);
      const totalRecebido = receitas.filter(r => r.status === 'recebido').reduce((s, r) => s + (r.valor || 0), 0);
      const totalDespesas = despesas.reduce((s, d) => s + (d.valor || 0), 0);
      const totalPago = despesas.filter(d => d.status === 'pago').reduce((s, d) => s + (d.valor || 0), 0);

      body.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
          <div class="kpi-card"><div class="kpi-label">Receitas Previstas</div><div class="kpi-value">${UI.moeda(totalReceitas)}</div><div class="kpi-sub">Recebido: ${UI.moeda(totalRecebido)}</div></div>
          <div class="kpi-card"><div class="kpi-label">Despesas</div><div class="kpi-value danger">${UI.moeda(totalDespesas)}</div><div class="kpi-sub">Pago: ${UI.moeda(totalPago)}</div></div>
        </div>

        <h3 style="font-family: var(--font-heading); font-size: 14px; margin-bottom: 12px;">Receitas</h3>
        ${receitas.length === 0 ? '<p style="color: var(--cinza); font-size: 13px;">Nenhuma receita vinculada</p>' :
          receitas.map(r => `
            <div class="panel-item">
              <div class="panel-item-info">
                <div class="item-title">${r.descricao}</div>
                <div class="item-sub">${UI.data(r.data_prevista)} · ${UI.statusBadge(r.status)}</div>
              </div>
              <div class="panel-item-value" style="color: var(--success);">+${UI.moeda(r.valor)}</div>
            </div>
          `).join('')}

        <h3 style="font-family: var(--font-heading); font-size: 14px; margin: 20px 0 12px;">Despesas</h3>
        ${despesas.length === 0 ? '<p style="color: var(--cinza); font-size: 13px;">Nenhuma despesa vinculada</p>' :
          despesas.map(d => `
            <div class="panel-item">
              <div class="panel-item-info">
                <div class="item-title">${d.descricao}</div>
                <div class="item-sub">${d.categoria} · ${UI.data(d.data_vencimento)} · ${UI.statusBadge(d.status)}</div>
              </div>
              <div class="panel-item-value" style="color: var(--danger);">-${UI.moeda(d.valor)}</div>
            </div>
          `).join('')}
      `;
    } catch (err) {
      body.innerHTML = `<p style="color: var(--danger);">Erro ao carregar dados financeiros: ${err.message}</p>`;
    }
  }
};
