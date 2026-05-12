// ===== Obras Module =====

const OBRAS = {
  obras: [],
  clientes: [],
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
    try {
      this.clientes = await DB.list('clientes', { orderBy: 'nome', ascending: true });
    } catch (e) {
      console.warn('Tabela clientes ainda não existe — aplique a migration-financeiro-cobranca.sql');
      this.clientes = [];
    }
  },

  popularSelectClientes() {
    const sel = document.getElementById('obra-cliente-id');
    if (!sel) return;
    sel.innerHTML = '<option value="">— Selecionar cliente cadastrado —</option>' +
      this.clientes.map(c => `<option value="${c.id}">${c.nome}${c.nome_condominio && c.nome_condominio !== c.nome ? ' — ' + c.nome_condominio : ''}</option>`).join('');
  },

  preencherDoCliente() {
    const id = document.getElementById('obra-cliente-id').value;
    if (!id) return;
    const c = this.clientes.find(x => x.id === id);
    if (!c) return;

    const setIfEmpty = (elId, val) => {
      const el = document.getElementById(elId);
      if (el && !el.value && val) el.value = val;
    };

    document.getElementById('obra-condominio').value = c.nome_condominio || c.nome || '';
    document.getElementById('obra-cliente').value = c.nome || '';
    setIfEmpty('obra-cnpj', c.cpf_cnpj || '');
    setIfEmpty('obra-cidade', c.endereco_cidade || '');
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
              <button class="btn btn-sm btn-secondary btn-icon" title="Aditivos" onclick="OBRAS.openAditivos('${o.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
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
    this.popularSelectClientes();
    document.getElementById('modal-obra-title').textContent = 'Nova Obra';
    document.getElementById('obra-id').value = '';
    const cs = document.getElementById('obra-cliente-id');
    if (cs) cs.value = '';
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
      this.popularSelectClientes();
      const obra = await DB.get('obras', id);
      document.getElementById('modal-obra-title').textContent = 'Editar Obra';
      document.getElementById('obra-id').value = obra.id;
      const cs = document.getElementById('obra-cliente-id');
      if (cs) cs.value = obra.cliente_id || '';
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

    const clienteIdEl = document.getElementById('obra-cliente-id');
    const record = {
      cliente_id: clienteIdEl?.value || null,
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
  },

  // --- Aditivos ---
  async openAditivos(obraId) {
    UI.openModal('modal-aditivos');
    document.getElementById('aditivo-obra-id').value = obraId;
    const body = document.getElementById('modal-aditivos-body');
    body.innerHTML = '<div style="text-align:center; padding: 20px;"><div class="spinner"></div></div>';

    try {
      const obra = await DB.get('obras', obraId);
      const aditivos = await DB.list('aditivos', { filters: { obra_id: obraId }, orderBy: 'numero', ascending: true });

      document.getElementById('modal-aditivos-title').textContent = `Aditivos — ${obra.condominio}`;

      const totalAdicional = aditivos.reduce((s, a) => s + (a.valor_adicional || 0), 0);
      const totalPrazo = aditivos.reduce((s, a) => s + (a.prazo_adicional_dias || 0), 0);
      const valorOriginal = obra.valor_fechado || 0;

      body.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 16px;">
          <div class="kpi-card"><div class="kpi-label">Valor Original</div><div class="kpi-value" style="font-size: 18px;">${UI.moeda(valorOriginal)}</div></div>
          <div class="kpi-card"><div class="kpi-label">+ Aditivos</div><div class="kpi-value success" style="font-size: 18px;">${UI.moeda(totalAdicional)}</div><div class="kpi-sub">${aditivos.length} aditivo(s)</div></div>
          <div class="kpi-card"><div class="kpi-label">Valor Total</div><div class="kpi-value" style="font-size: 18px;">${UI.moeda(valorOriginal + totalAdicional)}</div><div class="kpi-sub">+ ${totalPrazo} dias</div></div>
        </div>

        ${aditivos.length === 0 ? '<div class="empty-state"><p>Nenhum aditivo registrado para esta obra</p></div>' :
          aditivos.map(a => `
            <div class="panel-item">
              <div class="panel-item-info">
                <div class="item-title">Aditivo Nº ${a.numero} — ${UI.data(a.data_aditivo)}</div>
                <div class="item-sub">${a.descricao}</div>
                ${a.prazo_adicional_dias > 0 ? `<div class="item-sub">+ ${a.prazo_adicional_dias} dias de prazo</div>` : ''}
                ${a.arquivo_url ? `<div class="item-sub"><a href="${a.arquivo_url}" target="_blank" style="color: var(--azul);">📎 Ver documento assinado</a></div>` : ''}
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <div class="panel-item-value" style="color: var(--success);">+${UI.moeda(a.valor_adicional)}</div>
                <div class="table-actions">
                  <button class="btn btn-sm btn-secondary btn-icon" title="Editar" onclick="OBRAS.openEditAditivo('${a.id}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button class="btn btn-sm btn-secondary btn-icon" title="Excluir" onclick="OBRAS.removeAditivo('${a.id}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </div>
              </div>
            </div>
          `).join('')}
      `;
    } catch (err) {
      body.innerHTML = `<p style="color: var(--danger);">Erro: ${err.message}. Verifique se aplicou a migration-financeiro-cobranca.sql</p>`;
    }
  },

  async openNovoAditivo() {
    const obraId = document.getElementById('aditivo-obra-id').value;
    if (!obraId) return;

    const aditivos = await DB.list('aditivos', { filters: { obra_id: obraId }, orderBy: 'numero', ascending: false });
    const proximoNumero = aditivos.length > 0 ? (aditivos[0].numero + 1) : 1;

    document.getElementById('modal-ad-title').textContent = 'Novo Aditivo';
    document.getElementById('aditivo-id').value = '';
    document.getElementById('aditivo-numero').value = proximoNumero;
    document.getElementById('aditivo-data').value = new Date().toISOString().split('T')[0];
    document.getElementById('aditivo-descricao').value = '';
    document.getElementById('aditivo-valor').value = '0';
    document.getElementById('aditivo-prazo').value = '0';
    document.getElementById('aditivo-url').value = '';
    document.getElementById('aditivo-observacoes').value = '';
    UI.openModal('modal-aditivo-form');
  },

  async openEditAditivo(id) {
    try {
      const a = await DB.get('aditivos', id);
      document.getElementById('modal-ad-title').textContent = `Editar Aditivo Nº ${a.numero}`;
      document.getElementById('aditivo-id').value = a.id;
      document.getElementById('aditivo-obra-id').value = a.obra_id;
      document.getElementById('aditivo-numero').value = a.numero;
      document.getElementById('aditivo-data').value = UI.dataISO(a.data_aditivo);
      document.getElementById('aditivo-descricao').value = a.descricao || '';
      document.getElementById('aditivo-valor').value = a.valor_adicional || 0;
      document.getElementById('aditivo-prazo').value = a.prazo_adicional_dias || 0;
      document.getElementById('aditivo-url').value = a.arquivo_url || '';
      document.getElementById('aditivo-observacoes').value = a.observacoes || '';
      UI.openModal('modal-aditivo-form');
    } catch (err) {
      UI.error('Erro ao carregar aditivo: ' + err.message);
    }
  },

  async saveAditivo() {
    const id = document.getElementById('aditivo-id').value;
    const obraId = document.getElementById('aditivo-obra-id').value;
    const descricao = document.getElementById('aditivo-descricao').value.trim();
    const data = document.getElementById('aditivo-data').value;

    if (!descricao || !data) return UI.warning('Preencha descrição e data');

    const record = {
      obra_id: obraId,
      numero: parseInt(document.getElementById('aditivo-numero').value) || 1,
      descricao,
      valor_adicional: parseFloat(document.getElementById('aditivo-valor').value) || 0,
      prazo_adicional_dias: parseInt(document.getElementById('aditivo-prazo').value) || 0,
      data_aditivo: data,
      arquivo_url: document.getElementById('aditivo-url').value.trim() || null,
      observacoes: document.getElementById('aditivo-observacoes').value.trim() || null
    };

    try {
      if (id) {
        await DB.update('aditivos', id, record);
        UI.success('Aditivo atualizado!');
      } else {
        await DB.create('aditivos', record);
        UI.success('Aditivo registrado!');
      }
      UI.closeModal('modal-aditivo-form');
      await this.openAditivos(obraId);
    } catch (err) {
      UI.error('Erro ao salvar: ' + err.message);
    }
  },

  async removeAditivo(id) {
    if (!await UI.confirm('Excluir este aditivo?')) return;
    try {
      const obraId = document.getElementById('aditivo-obra-id').value;
      await DB.remove('aditivos', id);
      UI.success('Aditivo excluído');
      await this.openAditivos(obraId);
    } catch (err) {
      UI.error('Erro: ' + err.message);
    }
  }
};
