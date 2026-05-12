// ===== Clientes Module =====

const CLI = {
  clientes: [],
  obras: [],
  page: 1,
  perPage: 10,

  async init() {
    try {
      await this.loadData();
      this.renderKPIs();
      this.renderTable();
    } catch (err) {
      console.error('Erro ao inicializar Clientes:', err);
      UI.error('Erro ao carregar clientes.');
    }
  },

  async loadData() {
    [this.clientes, this.obras] = await Promise.all([
      DB.list('clientes', { orderBy: 'nome', ascending: true }),
      DB.list('obras', { orderBy: 'created_at', ascending: false })
    ]);
  },

  // --- KPIs ---
  renderKPIs() {
    const total = this.clientes.length;
    const cond = this.clientes.filter(c => c.tipo === 'condominio').length;
    const emp = this.clientes.filter(c => c.tipo === 'empresa').length;
    const clientesComObras = new Set(this.obras.filter(o => o.cliente_id && o.status !== 'finalizada').map(o => o.cliente_id));

    document.getElementById('kpi-total').textContent = total;
    document.getElementById('kpi-condominios').textContent = cond;
    document.getElementById('kpi-empresas').textContent = emp;
    document.getElementById('kpi-com-obras').textContent = clientesComObras.size;
  },

  // --- Tabela ---
  renderTable() {
    const search = (document.getElementById('search-clientes')?.value || '').toLowerCase();
    const tipoFilter = document.getElementById('filter-tipo')?.value || 'todos';

    const filtered = this.clientes.filter(c => {
      if (tipoFilter !== 'todos' && c.tipo !== tipoFilter) return false;
      if (!search) return true;
      return (c.nome || '').toLowerCase().includes(search) ||
             (c.cpf_cnpj || '').toLowerCase().includes(search) ||
             (c.nome_condominio || '').toLowerCase().includes(search);
    });

    const { items, totalPages } = UI.paginate(filtered, this.page, this.perPage);

    document.getElementById('clientes-table-body').innerHTML = items.length === 0
      ? '<tr><td colspan="7" class="empty-state"><p>Nenhum cliente cadastrado</p></td></tr>'
      : items.map(c => {
        const tipoBadge = {
          condominio: '<span class="badge badge-em_execucao">Condomínio</span>',
          empresa: '<span class="badge badge-aprovado">Empresa</span>',
          pessoa_fisica: '<span class="badge badge-lead">PF</span>'
        }[c.tipo] || '';

        const notifIcons = [];
        if (c.notificar_email) notifIcons.push('<span title="E-mail ativo" style="color: var(--success);">✉</span>');
        if (c.notificar_whatsapp) notifIcons.push('<span title="WhatsApp ativo" style="color: #25D366;">●</span>');

        return `
          <tr>
            <td>
              <strong>${c.nome}</strong>
              ${c.nome_condominio && c.nome_condominio !== c.nome ? `<br><small style="color: var(--cinza);">${c.nome_condominio}</small>` : ''}
              <br>${tipoBadge}
            </td>
            <td>${c.cpf_cnpj || '—'}</td>
            <td>${c.endereco_cidade ? `${c.endereco_cidade}/${c.endereco_uf || ''}` : '—'}</td>
            <td>${c.nome_responsavel || '—'}${c.cargo_responsavel ? `<br><small style="color: var(--cinza);">${c.cargo_responsavel}</small>` : ''}</td>
            <td>
              ${c.email ? `<small>${c.email}</small><br>` : ''}
              ${c.telefone ? `<small>${UI.telefone(c.telefone)}</small>` : ''}
              ${!c.email && !c.telefone ? '—' : ''}
            </td>
            <td style="font-size: 16px;">${notifIcons.join(' ') || '—'}</td>
            <td>
              <div class="table-actions">
                <button class="btn btn-sm btn-secondary btn-icon" title="Editar" onclick="CLI.openEdit('${c.id}')">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="btn btn-sm btn-secondary btn-icon" title="Obras vinculadas" onclick="CLI.openObras('${c.id}')">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                </button>
                <button class="btn btn-sm btn-secondary btn-icon" title="Excluir" onclick="CLI.remove('${c.id}')">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');

    UI.renderPagination('clientes-pagination', this.page, totalPages, 'CLI.goToPage');
  },

  goToPage(page) {
    CLI.page = page;
    CLI.renderTable();
  },

  // --- Toggle tipo (mostra/esconde campos relevantes) ---
  toggleTipo() {
    const tipo = document.getElementById('cliente-tipo').value;
    const labelDoc = document.getElementById('label-cpf-cnpj');
    const grpCondo = document.getElementById('grp-condominio');
    const grpIE = document.getElementById('grp-ie');

    if (tipo === 'pessoa_fisica') {
      labelDoc.textContent = 'CPF';
      grpCondo.style.display = 'none';
      grpIE.style.display = 'none';
    } else if (tipo === 'condominio') {
      labelDoc.textContent = 'CNPJ';
      grpCondo.style.display = '';
      grpIE.style.display = '';
    } else {
      labelDoc.textContent = 'CNPJ';
      grpCondo.style.display = 'none';
      grpIE.style.display = '';
    }
  },

  // --- CRUD ---
  openNew() {
    document.getElementById('modal-cliente-title').textContent = 'Novo Cliente';
    document.getElementById('cliente-id').value = '';
    document.getElementById('cliente-tipo').value = 'condominio';
    [
      'cliente-nome','cliente-cpf-cnpj','cliente-ie','cliente-condominio','cliente-administradora',
      'cliente-logradouro','cliente-numero','cliente-complemento','cliente-bairro',
      'cliente-cidade','cliente-uf','cliente-cep',
      'cliente-responsavel','cliente-cargo','cliente-email','cliente-telefone',
      'cliente-fin-nome','cliente-email-cobranca','cliente-tel-cobranca','cliente-whatsapp',
      'cliente-observacoes'
    ].forEach(id => document.getElementById(id).value = '');
    document.getElementById('cliente-notif-email').checked = true;
    document.getElementById('cliente-notif-whatsapp').checked = true;
    this.toggleTipo();
    UI.openModal('modal-cliente');
  },

  async openEdit(id) {
    try {
      const c = await DB.get('clientes', id);
      document.getElementById('modal-cliente-title').textContent = 'Editar Cliente';
      document.getElementById('cliente-id').value = c.id;
      document.getElementById('cliente-tipo').value = c.tipo || 'condominio';
      document.getElementById('cliente-nome').value = c.nome || '';
      document.getElementById('cliente-cpf-cnpj').value = c.cpf_cnpj || '';
      document.getElementById('cliente-ie').value = c.inscricao_estadual || '';
      document.getElementById('cliente-condominio').value = c.nome_condominio || '';
      document.getElementById('cliente-administradora').value = c.administradora || '';
      document.getElementById('cliente-logradouro').value = c.endereco_logradouro || '';
      document.getElementById('cliente-numero').value = c.endereco_numero || '';
      document.getElementById('cliente-complemento').value = c.endereco_complemento || '';
      document.getElementById('cliente-bairro').value = c.endereco_bairro || '';
      document.getElementById('cliente-cidade').value = c.endereco_cidade || '';
      document.getElementById('cliente-uf').value = c.endereco_uf || '';
      document.getElementById('cliente-cep').value = c.endereco_cep || '';
      document.getElementById('cliente-responsavel').value = c.nome_responsavel || '';
      document.getElementById('cliente-cargo').value = c.cargo_responsavel || '';
      document.getElementById('cliente-email').value = c.email || '';
      document.getElementById('cliente-telefone').value = c.telefone || '';
      document.getElementById('cliente-fin-nome').value = c.nome_financeiro || '';
      document.getElementById('cliente-email-cobranca').value = c.email_cobranca || '';
      document.getElementById('cliente-tel-cobranca').value = c.telefone_cobranca || '';
      document.getElementById('cliente-whatsapp').value = c.whatsapp || '';
      document.getElementById('cliente-observacoes').value = c.observacoes || '';
      document.getElementById('cliente-notif-email').checked = c.notificar_email !== false;
      document.getElementById('cliente-notif-whatsapp').checked = c.notificar_whatsapp !== false;
      this.toggleTipo();
      UI.openModal('modal-cliente');
    } catch (err) {
      UI.error('Erro ao carregar cliente: ' + err.message);
    }
  },

  async save() {
    const id = document.getElementById('cliente-id').value;
    const nome = document.getElementById('cliente-nome').value.trim();

    if (!nome) return UI.warning('Informe o nome / razão social');

    const record = {
      tipo: document.getElementById('cliente-tipo').value,
      nome,
      cpf_cnpj: document.getElementById('cliente-cpf-cnpj').value.trim() || null,
      inscricao_estadual: document.getElementById('cliente-ie').value.trim() || null,
      nome_condominio: document.getElementById('cliente-condominio').value.trim() || null,
      administradora: document.getElementById('cliente-administradora').value.trim() || null,
      endereco_logradouro: document.getElementById('cliente-logradouro').value.trim() || null,
      endereco_numero: document.getElementById('cliente-numero').value.trim() || null,
      endereco_complemento: document.getElementById('cliente-complemento').value.trim() || null,
      endereco_bairro: document.getElementById('cliente-bairro').value.trim() || null,
      endereco_cidade: document.getElementById('cliente-cidade').value.trim() || null,
      endereco_uf: document.getElementById('cliente-uf').value.trim().toUpperCase() || null,
      endereco_cep: document.getElementById('cliente-cep').value.trim() || null,
      nome_responsavel: document.getElementById('cliente-responsavel').value.trim() || null,
      cargo_responsavel: document.getElementById('cliente-cargo').value.trim() || null,
      email: document.getElementById('cliente-email').value.trim() || null,
      telefone: document.getElementById('cliente-telefone').value.trim() || null,
      nome_financeiro: document.getElementById('cliente-fin-nome').value.trim() || null,
      email_cobranca: document.getElementById('cliente-email-cobranca').value.trim() || null,
      telefone_cobranca: document.getElementById('cliente-tel-cobranca').value.trim() || null,
      whatsapp: document.getElementById('cliente-whatsapp').value.trim() || null,
      observacoes: document.getElementById('cliente-observacoes').value.trim() || null,
      notificar_email: document.getElementById('cliente-notif-email').checked,
      notificar_whatsapp: document.getElementById('cliente-notif-whatsapp').checked
    };

    try {
      if (id) {
        await DB.update('clientes', id, record);
        UI.success('Cliente atualizado!');
      } else {
        await DB.create('clientes', record);
        UI.success('Cliente cadastrado!');
      }
      UI.closeModal('modal-cliente');
      await this.loadData();
      this.renderKPIs();
      this.renderTable();
    } catch (err) {
      UI.error('Erro ao salvar: ' + err.message);
    }
  },

  async remove(id) {
    if (!await UI.confirm('Excluir este cliente? Obras vinculadas continuarão existindo, mas sem cliente.')) return;
    try {
      await DB.remove('clientes', id);
      UI.success('Cliente excluído');
      await this.loadData();
      this.renderKPIs();
      this.renderTable();
    } catch (err) {
      UI.error('Erro ao excluir: ' + err.message);
    }
  },

  // --- Obras vinculadas ---
  async openObras(clienteId) {
    UI.openModal('modal-cliente-obras');
    const body = document.getElementById('modal-co-body');
    body.innerHTML = '<div style="text-align:center; padding: 20px;"><div class="spinner"></div></div>';

    try {
      const cliente = this.clientes.find(c => c.id === clienteId);
      const obrasVinc = this.obras.filter(o => o.cliente_id === clienteId);
      document.getElementById('modal-co-title').textContent = `Obras — ${cliente?.nome || ''}`;

      if (obrasVinc.length === 0) {
        body.innerHTML = '<div class="empty-state"><p>Este cliente ainda não tem obras cadastradas.</p></div>';
        return;
      }

      const totalFechado = obrasVinc.reduce((s, o) => s + (o.valor_fechado || 0), 0);

      body.innerHTML = `
        <div class="kpi-card" style="margin-bottom: 16px;">
          <div class="kpi-label">Valor Total em Obras</div>
          <div class="kpi-value">${UI.moeda(totalFechado)}</div>
          <div class="kpi-sub">${obrasVinc.length} obra(s)</div>
        </div>
        ${obrasVinc.map(o => `
          <div class="panel-item">
            <div class="panel-item-info">
              <div class="item-title">${o.condominio}</div>
              <div class="item-sub">${UI.statusBadge(o.status)} · ${o.cidade || '—'} · Início: ${UI.data(o.data_inicio)}</div>
            </div>
            <div class="panel-item-value">${UI.moeda(o.valor_fechado)}</div>
          </div>
        `).join('')}
      `;
    } catch (err) {
      body.innerHTML = `<p style="color: var(--danger);">Erro: ${err.message}</p>`;
    }
  },

  // --- Máscaras ---
  mascaraDoc(input) {
    let v = input.value.replace(/\D/g, '');
    const tipo = document.getElementById('cliente-tipo').value;
    if (tipo === 'pessoa_fisica') {
      v = v.slice(0, 11);
      if (v.length > 9) v = v.replace(/^(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
      else if (v.length > 6) v = v.replace(/^(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
      else if (v.length > 3) v = v.replace(/^(\d{3})(\d{1,3})/, '$1.$2');
    } else {
      v = v.slice(0, 14);
      if (v.length > 12) v = v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{1,2})/, '$1.$2.$3/$4-$5');
      else if (v.length > 8) v = v.replace(/^(\d{2})(\d{3})(\d{3})(\d{1,4})/, '$1.$2.$3/$4');
      else if (v.length > 5) v = v.replace(/^(\d{2})(\d{3})(\d{1,3})/, '$1.$2.$3');
      else if (v.length > 2) v = v.replace(/^(\d{2})(\d{1,3})/, '$1.$2');
    }
    input.value = v;
  },

  mascaraCEP(input) {
    let v = input.value.replace(/\D/g, '').slice(0, 8);
    if (v.length > 5) v = v.replace(/^(\d{5})(\d{1,3})/, '$1-$2');
    input.value = v;
  },

  mascaraTelefone(input) {
    let v = input.value.replace(/\D/g, '').slice(0, 11);
    if (v.length === 11) v = v.replace(/^(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    else if (v.length === 10) v = v.replace(/^(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    else if (v.length > 6) v = v.replace(/^(\d{2})(\d{4,5})(\d{0,4})/, '($1) $2-$3');
    else if (v.length > 2) v = v.replace(/^(\d{2})(\d{0,5})/, '($1) $2');
    input.value = v;
  }
};
