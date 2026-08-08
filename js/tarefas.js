// ===== Módulo Tarefas: gestão compartilhada entre sócias =====

// Nomes exibidos no campo "Responsável". Para renomear, basta editar esta lista.
const RESPONSAVEIS = ['Vanessa', 'Sócia', 'Ambas'];

// Mapeia o email de login para o nome exibido nos comentários.
// Adicione o email da sócia aqui quando ela criar o login dela.
const USUARIOS = {
  'lobo.nessa13@gmail.com': 'Vanessa'
};

const TAREFAS = {
  stages: [
    { id: 'a_fazer', label: 'A Fazer' },
    { id: 'em_andamento', label: 'Em Andamento' },
    { id: 'aguardando_decisao', label: 'Aguardando Decisão' },
    { id: 'concluida', label: 'Concluída' }
  ],

  tarefas: [],
  comentariosCount: {},
  currentUser: null,
  currentDetailId: null,
  tablePage: 1,
  realtimeTimer: null,

  async init() {
    const user = await Auth.getUser();
    this.currentUser = user;
    await this.load();
    this.renderAll();
    this.subscribeRealtime();
  },

  nomeUsuario() {
    const email = this.currentUser?.email || '';
    return USUARIOS[email] || email.split('@')[0] || 'Usuário';
  },

  async load() {
    try {
      this.tarefas = await DB.list('tarefas', { orderBy: 'created_at', ascending: false });
      const { data, error } = await sb.from('tarefa_comentarios').select('tarefa_id');
      if (error) throw error;
      this.comentariosCount = {};
      (data || []).forEach(c => {
        this.comentariosCount[c.tarefa_id] = (this.comentariosCount[c.tarefa_id] || 0) + 1;
      });
    } catch (err) {
      console.error('Erro ao carregar tarefas:', err);
      UI.error('Erro ao carregar tarefas. A migration do banco já foi aplicada?');
    }
  },

  async reload() {
    await this.load();
    this.renderAll();
    if (this.currentDetailId && document.getElementById('modal-tarefa-detalhe').classList.contains('active')) {
      this.renderDetalhe(this.currentDetailId);
    }
  },

  renderAll() {
    this.renderKpis();
    this.renderBoard();
    this.renderTable();
  },

  // --- Sincronização em tempo real entre as sócias ---
  subscribeRealtime() {
    try {
      sb.channel('tarefas-sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tarefas' }, () => this.onRealtime())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tarefa_comentarios' }, () => this.onRealtime())
        .subscribe();
    } catch (err) {
      console.warn('Realtime indisponível (a página ainda funciona, só sem atualização automática):', err);
    }
  },

  onRealtime() {
    clearTimeout(this.realtimeTimer);
    this.realtimeTimer = setTimeout(() => this.reload(), 400);
  },

  // --- Helpers ---
  atrasada(t) {
    if (!t.data_entrega || t.status === 'concluida') return false;
    return t.data_entrega < new Date().toISOString().split('T')[0];
  },

  urgenciaLabel(u) {
    return { baixa: 'Baixa', media: 'Média', alta: 'Alta', urgente: 'Urgente' }[u] || u;
  },

  urgenciaBadge(u) {
    return `<span class="badge badge-urg-${u}">${this.urgenciaLabel(u)}</span>`;
  },

  statusLabelTarefa(s) {
    const stage = this.stages.find(st => st.id === s);
    return stage ? stage.label : s;
  },

  // --- KPIs ---
  renderKpis() {
    const mesAtual = new Date().toISOString().slice(0, 7);
    const count = s => this.tarefas.filter(t => t.status === s).length;
    document.getElementById('kpi-a-fazer').textContent = count('a_fazer');
    document.getElementById('kpi-andamento').textContent = count('em_andamento');
    document.getElementById('kpi-decisao').textContent = count('aguardando_decisao');
    document.getElementById('kpi-atrasadas').textContent = this.tarefas.filter(t => this.atrasada(t)).length;
    document.getElementById('kpi-concluidas-mes').textContent =
      this.tarefas.filter(t => t.status === 'concluida' && (t.concluida_em || '').slice(0, 7) === mesAtual).length;
  },

  // --- Board (Kanban) ---
  renderBoard() {
    const container = document.getElementById('board-container');
    if (!container) return;

    container.innerHTML = this.stages.map(stage => {
      const items = this.tarefas
        .filter(t => t.status === stage.id)
        .sort((a, b) => (a.data_entrega || '9999') < (b.data_entrega || '9999') ? -1 : 1);

      return `
        <div class="pipeline-stage stage-${stage.id}">
          <div class="pipeline-header">
            <h3>${stage.label}</h3>
            <span class="count">${items.length}</span>
          </div>
          <div class="pipeline-body" data-status="${stage.id}"
               ondragover="TAREFAS.dragOver(event)"
               ondragleave="TAREFAS.dragLeave(event)"
               ondrop="TAREFAS.drop(event)">
            ${items.map(t => this.renderCard(t)).join('')}
          </div>
        </div>
      `;
    }).join('');
  },

  renderCard(t) {
    const nComentarios = this.comentariosCount[t.id] || 0;
    const entregaClass = this.atrasada(t) ? 'tarefa-entrega-atrasada' : '';
    return `
      <div class="pipeline-card" draggable="true" data-id="${t.id}"
           ondragstart="TAREFAS.dragStart(event, '${t.id}')"
           ondragend="TAREFAS.dragEnd(event)"
           onclick="TAREFAS.openDetalhe('${t.id}')">
        <strong>${this.esc(t.titulo)}</strong>
        <div class="tarefa-card-badges">
          ${this.urgenciaBadge(t.urgencia)}
          ${t.tipo === 'decisao' ? '<span class="badge badge-decisao">Decisão</span>' : ''}
        </div>
        <div class="tarefa-card-meta">
          <span>👤 ${this.esc(t.responsavel)}</span>
          <span class="${entregaClass}">${t.data_entrega ? '📅 ' + UI.data(t.data_entrega + 'T12:00:00') : ''}</span>
        </div>
        ${nComentarios ? `<div class="tarefa-card-meta"><span>💬 ${nComentarios} comentário${nComentarios > 1 ? 's' : ''}</span></div>` : ''}
      </div>
    `;
  },

  esc(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
  },

  // --- Drag & Drop ---
  dragStart(e, id) {
    e.stopPropagation();
    e.dataTransfer.setData('text/plain', id);
    e.target.classList.add('dragging');
  },

  dragEnd(e) {
    e.target.classList.remove('dragging');
    document.querySelectorAll('.pipeline-body.drag-over').forEach(el => el.classList.remove('drag-over'));
  },

  dragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
  },

  dragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
  },

  async drop(e) {
    e.preventDefault();
    const body = e.currentTarget;
    body.classList.remove('drag-over');
    const id = e.dataTransfer.getData('text/plain');
    const novoStatus = body.dataset.status;
    const tarefa = this.tarefas.find(t => t.id === id);
    if (!tarefa || tarefa.status === novoStatus) return;

    try {
      const updates = { status: novoStatus };
      updates.concluida_em = novoStatus === 'concluida' ? new Date().toISOString() : null;
      await DB.update('tarefas', id, updates);
      tarefa.status = novoStatus;
      tarefa.concluida_em = updates.concluida_em;
      this.renderAll();
    } catch (err) {
      console.error('Erro ao mover tarefa:', err);
      UI.error('Erro ao mover tarefa');
    }
  },

  // --- Tabela ---
  renderTable(page = null) {
    if (page) this.tablePage = page;
    const tbody = document.getElementById('tarefas-table-body');
    if (!tbody) return;

    const busca = (document.getElementById('search-tarefas')?.value || '').toLowerCase();
    const fStatus = document.getElementById('filtro-status')?.value || 'todos';
    const fResp = document.getElementById('filtro-responsavel')?.value || 'todos';
    const fUrg = document.getElementById('filtro-urgencia')?.value || 'todos';

    let items = this.tarefas.filter(t => {
      if (busca && !(`${t.titulo} ${t.descricao || ''}`.toLowerCase().includes(busca))) return false;
      if (fStatus !== 'todos' && t.status !== fStatus) return false;
      if (fResp !== 'todos' && t.responsavel !== fResp) return false;
      if (fUrg !== 'todos' && t.urgencia !== fUrg) return false;
      return true;
    });

    items.sort((a, b) => (a.data_entrega || '9999') < (b.data_entrega || '9999') ? -1 : 1);

    const { items: pageItems, totalPages } = UI.paginate(items, this.tablePage, 10);

    tbody.innerHTML = pageItems.length ? pageItems.map(t => `
      <tr>
        <td>
          <strong style="cursor:pointer" onclick="TAREFAS.openDetalhe('${t.id}')">${this.esc(t.titulo)}</strong>
          ${t.tipo === 'decisao' ? ' <span class="badge badge-decisao">Decisão</span>' : ''}
        </td>
        <td>${this.esc(t.responsavel)}</td>
        <td>${this.urgenciaBadge(t.urgencia)}</td>
        <td><span class="badge badge-${t.status}">${this.statusLabelTarefa(t.status)}</span></td>
        <td>${t.data_inicio ? UI.data(t.data_inicio + 'T12:00:00') : '—'}</td>
        <td class="${this.atrasada(t) ? 'tarefa-entrega-atrasada' : ''}">${t.data_entrega ? UI.data(t.data_entrega + 'T12:00:00') : '—'}</td>
        <td>
          <button class="btn btn-sm btn-secondary" onclick="TAREFAS.openEdit('${t.id}')">Editar</button>
          <button class="btn btn-sm btn-secondary" onclick="TAREFAS.remove('${t.id}')">Excluir</button>
        </td>
      </tr>
    `).join('') : '<tr><td colspan="7" style="text-align:center; color: var(--cinza); padding: 24px;">Nenhuma tarefa encontrada</td></tr>';

    UI.renderPagination('tarefas-pagination', this.tablePage, totalPages, 'TAREFAS.renderTable');
  },

  switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector(`.tab-btn[data-tab="${tab}"]`).classList.add('active');
    document.getElementById(`tab-${tab}`).classList.add('active');
  },

  // --- Formulário (criar / editar) ---
  openNew() {
    document.getElementById('modal-tarefa-title').textContent = 'Nova Tarefa';
    document.getElementById('tarefa-id').value = '';
    document.getElementById('tarefa-titulo').value = '';
    document.getElementById('tarefa-descricao').value = '';
    document.getElementById('tarefa-tipo').value = 'tarefa';
    document.getElementById('tarefa-responsavel').value = RESPONSAVEIS[0];
    document.getElementById('tarefa-status').value = 'a_fazer';
    document.getElementById('tarefa-urgencia').value = 'media';
    document.getElementById('tarefa-data-inicio').value = new Date().toISOString().split('T')[0];
    document.getElementById('tarefa-data-entrega').value = '';
    UI.openModal('modal-tarefa');
  },

  openEdit(id) {
    const t = this.tarefas.find(x => x.id === id);
    if (!t) return;
    UI.closeModal('modal-tarefa-detalhe');
    document.getElementById('modal-tarefa-title').textContent = 'Editar Tarefa';
    document.getElementById('tarefa-id').value = t.id;
    document.getElementById('tarefa-titulo').value = t.titulo;
    document.getElementById('tarefa-descricao').value = t.descricao || '';
    document.getElementById('tarefa-tipo').value = t.tipo;
    document.getElementById('tarefa-responsavel').value = t.responsavel;
    document.getElementById('tarefa-status').value = t.status;
    document.getElementById('tarefa-urgencia').value = t.urgencia;
    document.getElementById('tarefa-data-inicio').value = t.data_inicio || '';
    document.getElementById('tarefa-data-entrega').value = t.data_entrega || '';
    UI.openModal('modal-tarefa');
  },

  async save() {
    const id = document.getElementById('tarefa-id').value;
    const titulo = document.getElementById('tarefa-titulo').value.trim();
    if (!titulo) return UI.warning('Informe o título da tarefa');

    const status = document.getElementById('tarefa-status').value;
    const record = {
      titulo,
      descricao: document.getElementById('tarefa-descricao').value.trim() || null,
      tipo: document.getElementById('tarefa-tipo').value,
      responsavel: document.getElementById('tarefa-responsavel').value,
      status,
      urgencia: document.getElementById('tarefa-urgencia').value,
      data_inicio: document.getElementById('tarefa-data-inicio').value || null,
      data_entrega: document.getElementById('tarefa-data-entrega').value || null
    };

    try {
      if (id) {
        const anterior = this.tarefas.find(t => t.id === id);
        if (status === 'concluida' && anterior?.status !== 'concluida') record.concluida_em = new Date().toISOString();
        if (status !== 'concluida') record.concluida_em = null;
        await DB.update('tarefas', id, record);
        UI.success('Tarefa atualizada!');
      } else {
        record.criado_por = this.nomeUsuario();
        if (status === 'concluida') record.concluida_em = new Date().toISOString();
        await DB.create('tarefas', record);
        UI.success('Tarefa criada!');
      }
      UI.closeModal('modal-tarefa');
      await this.reload();
    } catch (err) {
      console.error('Erro ao salvar tarefa:', err);
      UI.error('Erro ao salvar tarefa');
    }
  },

  async remove(id) {
    if (!await UI.confirm('Excluir esta tarefa?')) return;
    try {
      await DB.remove('tarefas', id);
      UI.success('Tarefa excluída');
      UI.closeModal('modal-tarefa-detalhe');
      await this.reload();
    } catch (err) {
      console.error('Erro ao excluir tarefa:', err);
      UI.error('Erro ao excluir tarefa');
    }
  },

  // --- Detalhe + comentários (comunicação entre as sócias) ---
  async openDetalhe(id) {
    this.currentDetailId = id;
    await this.renderDetalhe(id);
    UI.openModal('modal-tarefa-detalhe');
  },

  async renderDetalhe(id) {
    const t = this.tarefas.find(x => x.id === id);
    if (!t) return;

    document.getElementById('detalhe-titulo').textContent = t.titulo;
    document.getElementById('detalhe-badges').innerHTML = `
      <span class="badge badge-${t.status}">${this.statusLabelTarefa(t.status)}</span>
      ${this.urgenciaBadge(t.urgencia)}
      ${t.tipo === 'decisao' ? '<span class="badge badge-decisao">Decisão</span>' : ''}
    `;
    document.getElementById('detalhe-grid').innerHTML = `
      <div class="tarefa-detalhe-item"><small>Responsável</small><span>${this.esc(t.responsavel)}</span></div>
      <div class="tarefa-detalhe-item"><small>Criada por</small><span>${this.esc(t.criado_por || '—')}</span></div>
      <div class="tarefa-detalhe-item"><small>Data de início</small><span>${t.data_inicio ? UI.data(t.data_inicio + 'T12:00:00') : '—'}</span></div>
      <div class="tarefa-detalhe-item"><small>Data de entrega</small><span class="${this.atrasada(t) ? 'tarefa-entrega-atrasada' : ''}">${t.data_entrega ? UI.data(t.data_entrega + 'T12:00:00') : '—'}${this.atrasada(t) ? ' (atrasada)' : ''}</span></div>
    `;
    document.getElementById('detalhe-descricao').textContent = t.descricao || 'Sem descrição.';

    try {
      const { data, error } = await sb.from('tarefa_comentarios')
        .select('*').eq('tarefa_id', id).order('created_at', { ascending: true });
      if (error) throw error;
      const lista = document.getElementById('detalhe-comentarios');
      lista.innerHTML = (data || []).length ? data.map(c => `
        <div class="comentario">
          <div class="comentario-header">
            <span class="comentario-autor">${this.esc(c.autor)}</span>
            <span class="comentario-data">${new Date(c.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div class="comentario-texto">${this.esc(c.texto)}</div>
        </div>
      `).join('') : '<div style="color: var(--cinza); font-size: 13px;">Nenhum comentário ainda. Use os comentários para se comunicarem sobre esta tarefa e registrarem decisões.</div>';
      lista.scrollTop = lista.scrollHeight;
    } catch (err) {
      console.error('Erro ao carregar comentários:', err);
    }
  },

  async addComentario() {
    const input = document.getElementById('novo-comentario');
    const texto = input.value.trim();
    if (!texto || !this.currentDetailId) return;

    try {
      await sb.from('tarefa_comentarios').insert({
        tarefa_id: this.currentDetailId,
        autor: this.nomeUsuario(),
        texto
      });
      input.value = '';
      this.comentariosCount[this.currentDetailId] = (this.comentariosCount[this.currentDetailId] || 0) + 1;
      await this.renderDetalhe(this.currentDetailId);
      this.renderBoard();
    } catch (err) {
      console.error('Erro ao comentar:', err);
      UI.error('Erro ao enviar comentário');
    }
  }
};
