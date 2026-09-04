// ===== Módulo Documentos: Agente de Documentos DIBREVA =====
// Chat com IA (Claude) que coleta os dados e chama uma ferramenta de geração.
// A IA nunca escreve HTML: ela entrega dados estruturados e o DocTemplates
// renderiza o A4 no padrão da empresa. Persistência no Supabase (tabela documentos).

const DOCS = {
  state: {
    docs: [],
    filtroTipo: 'todos',
    filtroStatus: 'todos',
    busca: '',
    page: 1,
    obraFiltro: null,
    atual: null,        // documento aberto no workspace
    messages: [],       // histórico para a API (inclui tool_use / tool_result)
    contexto: {},       // registros vinculados: cliente, lead, obra, receita, documento_pai
    busy: false,
    listas: { clientes: [], leads: [], obras: [], documentos: [] },
  },

  // ===============================================================
  // INICIALIZAÇÃO
  // ===============================================================
  async init() {
    const params = new URLSearchParams(window.location.search);
    this.state.obraFiltro = params.get('obra_id');

    await Promise.all([this.loadList(), this.loadListas()]);
    this.renderKPIs();
    this.renderList();

    if (!IA.hasKey()) {
      UI.warning('Chave da API Claude não configurada. Configure em Configurações para usar o agente.');
    }

    const novo = params.get('novo');
    const id = params.get('id');
    if (id) {
      await this.abrir(id);
    } else if (novo && DocTemplates.LABELS[novo]) {
      await this.openNovo(novo, {
        lead_id: params.get('lead_id'),
        obra_id: params.get('obra_id'),
        cliente_id: params.get('cliente_id'),
        receita_id: params.get('receita_id'),
        base_id: params.get('base'),
      });
    }

    const input = document.getElementById('chat-input');
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.enviar(); }
    });
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 160) + 'px';
    });
  },

  async loadListas() {
    const [clientes, leads, obras] = await Promise.all([
      DB.list('clientes', { orderBy: 'nome', ascending: true }).catch(() => []),
      DB.list('leads', { orderBy: 'condominio', ascending: true }).catch(() => []),
      DB.list('obras', { orderBy: 'condominio', ascending: true }).catch(() => []),
    ]);
    this.state.listas.clientes = clientes;
    this.state.listas.leads = leads.filter(l => l.status !== 'perdido');
    this.state.listas.obras = obras;
  },

  // ===============================================================
  // LISTAGEM
  // ===============================================================
  async loadList() {
    try {
      const { data, error } = await sb.from('vw_documentos').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      this.state.docs = data || [];
      this.state.listas.documentos = this.state.docs;
    } catch (error) {
      console.error('Erro ao carregar documentos:', error);
      if (/vw_documentos|relation .* does not exist/i.test(error.message)) {
        UI.error('Tabela de documentos não encontrada. Rode sql/migration-documentos.sql no Supabase.');
      } else {
        UI.error('Erro ao carregar documentos: ' + error.message);
      }
      this.state.docs = [];
    }
  },

  renderKPIs() {
    const ano = new Date().getFullYear();
    const doAno = this.state.docs.filter(d => (d.data_documento || '').startsWith(String(ano)));
    const orc = doAno.filter(d => d.tipo === 'orcamento');
    const ctr = doAno.filter(d => d.tipo === 'contrato');
    const abertos = orc.filter(d => d.status === 'enviado').reduce((s, d) => s + Number(d.valor || 0), 0);
    const rcb = doAno.filter(d => d.tipo === 'recibo').reduce((s, d) => s + Number(d.valor || 0), 0);
    document.getElementById('kpi-orcamentos').textContent = orc.length;
    document.getElementById('kpi-contratos').textContent = ctr.length;
    document.getElementById('kpi-abertos').textContent = UI.moeda(abertos);
    document.getElementById('kpi-recibos').textContent = UI.moeda(rcb);
  },

  setFiltro(campo, valor) {
    this.state[campo] = valor;
    this.state.page = 1;
    this.renderList();
  },

  renderList(page) {
    if (page) this.state.page = page;
    const s = this.state;
    s.busca = (document.getElementById('search-docs')?.value || '').toLowerCase();
    let lista = s.docs;
    if (s.obraFiltro) lista = lista.filter(d => d.obra_id === s.obraFiltro);
    if (s.filtroTipo !== 'todos') lista = lista.filter(d => d.tipo === s.filtroTipo);
    if (s.filtroStatus !== 'todos') lista = lista.filter(d => d.status === s.filtroStatus);
    if (s.busca) lista = lista.filter(d => `${d.numero} ${d.titulo} ${d.cliente_nome || ''} ${d.obra_condominio || ''} ${d.lead_condominio || ''}`.toLowerCase().includes(s.busca));

    const banner = document.getElementById('obra-filtro-banner');
    if (s.obraFiltro) {
      const obra = s.listas.obras.find(o => o.id === s.obraFiltro);
      banner.style.display = '';
      banner.innerHTML = `Mostrando documentos da obra <strong>${obra ? obra.condominio : ''}</strong>.
        <a href="documentos.html">Ver todos</a>
        <span class="banner-actions">
          <button class="btn btn-sm btn-primary" onclick="DOCS.openNovo('contrato', { obra_id: '${s.obraFiltro}' })">+ Contrato</button>
          <button class="btn btn-sm btn-secondary" onclick="DOCS.openNovo('aditivo', { obra_id: '${s.obraFiltro}' })">+ Aditivo</button>
          <button class="btn btn-sm btn-secondary" onclick="DOCS.openNovo('recibo', { obra_id: '${s.obraFiltro}' })">+ Recibo</button>
        </span>`;
    } else {
      banner.style.display = 'none';
    }

    const pag = UI.paginate(lista, s.page, 12);
    const tbody = document.getElementById('docs-table-body');
    if (!pag.items.length) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><p>Nenhum documento encontrado. Clique em "Novo" para gerar o primeiro com o agente.</p></div></td></tr>`;
    } else {
      tbody.innerHTML = pag.items.map(d => `
        <tr>
          <td><strong>${d.numero}</strong></td>
          <td>${this.tipoBadge(d.tipo)}</td>
          <td>${d.titulo}${d.documento_pai_numero ? `<div class="doc-ref">Ref. ${d.documento_pai_numero}</div>` : ''}</td>
          <td>${d.cliente_nome || d.obra_condominio || d.lead_condominio || '<span style="color:var(--cinza)">Sem vínculo</span>'}</td>
          <td>${UI.moeda(d.valor)}</td>
          <td>${UI.data(d.data_documento)}</td>
          <td>${this.statusBadge(d.status)}</td>
          <td>
            <div class="table-actions">
              <button class="btn btn-sm btn-primary btn-icon" title="Abrir no agente" onclick="DOCS.abrir('${d.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              ${d.drive_url ? `<a class="btn btn-sm btn-secondary btn-icon" title="Abrir no Google Drive (publicado ${UI.data(d.publicado_em)})" href="${d.drive_url}" target="_blank">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              </a>` : ''}
              <button class="btn btn-sm btn-secondary btn-icon" title="Imprimir / PDF" onclick="DOCS.imprimirId('${d.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              </button>
              <button class="btn btn-sm btn-secondary btn-icon" title="Excluir" onclick="DOCS.excluir('${d.id}')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
              </button>
            </div>
          </td>
        </tr>`).join('');
    }
    UI.renderPagination('docs-pagination', pag.page, pag.totalPages, 'DOCS.renderList');
  },

  tipoBadge(tipo) {
    const cls = { orcamento: 'badge-orcamento_enviado', contrato: 'badge-aprovado', aditivo: 'badge-em_execucao', recibo: 'badge-recebido' }[tipo] || '';
    return `<span class="badge ${cls}">${DocTemplates.LABELS[tipo] || tipo}</span>`;
  },

  statusBadge(status) {
    const map = { rascunho: ['badge-pendente', 'Rascunho'], enviado: ['badge-orcamento_enviado', 'Enviado'], assinado: ['badge-aprovado', 'Assinado'], cancelado: ['badge-perdido', 'Cancelado'] };
    const [cls, label] = map[status] || ['', status];
    return `<span class="badge ${cls}">${label}</span>`;
  },

  // ===============================================================
  // WORKSPACE (chat + preview)
  // ===============================================================
  async openNovo(tipo, ctx = {}) {
    if (!IA.hasKey()) {
      UI.error('Configure a chave da API Claude em Configurações antes de usar o agente.');
      return;
    }
    this.state.atual = {
      id: null, tipo, numero: null, dados: null, conversa: [], status: 'rascunho',
      cliente_id: ctx.cliente_id || null, lead_id: ctx.lead_id || null, obra_id: ctx.obra_id || null,
      documento_pai_id: ctx.base_id || null, html: null,
    };
    this.state.messages = [];
    this.state.contexto = {};
    await this.carregarContexto({ receita_id: ctx.receita_id });
    this.mostrarWorkspace();
    this.renderChat();
    this.renderPreviewVazio();
    this.addMsg('assistant', this.saudacao(tipo));
  },

  async abrir(id) {
    try {
      const doc = await DB.get('documentos', id);
      this.state.atual = { ...doc, html: null };
      this.state.messages = [];
      this.state.contexto = {};
      await this.carregarContexto({});
      this.mostrarWorkspace();
      this.renderChat();
      if (doc.dados && Object.keys(doc.dados).length) {
        await this.renderPreview();
        this.addMsg('assistant', `Abri o documento **${doc.numero}**. Me diga o que ajustar (valores, itens, prazos, datas) que eu regenero o documento mantendo o padrão.`, false);
      } else {
        this.renderPreviewVazio();
        this.addMsg('assistant', this.saudacao(doc.tipo), false);
      }
    } catch (error) {
      console.error('Erro ao abrir documento:', error);
      UI.error('Erro ao abrir documento: ' + error.message);
    }
  },

  saudacao(tipo) {
    const t = {
      orcamento: 'Vamos montar o **orçamento**. Me passe o que souber: cliente/condomínio, cidade, serviços que serão executados, valor, condições de pagamento (entrada e parcelas) e prazo em dias úteis. O que faltar eu pergunto.',
      contrato: 'Vamos montar o **contrato**. Me passe: contratante (CNPJ, endereço, síndico/representante e CPF), objeto e serviços (ou selecione o orçamento base ao lado), valor, entrada, número de parcelas, data de início e prazo em dias úteis.',
      aditivo: 'Vamos montar o **aditivo**. Me passe: contrato original (selecione ao lado ou informe data e contratante), novos serviços, valor do aditivo, forma de pagamento (parcelas e datas) e prazo adicional em dias úteis.',
      recibo: 'Vamos montar o **recibo**. Me passe: quem pagou (ou selecione o cliente/obra ao lado), valor, a que se refere (parcela, contrato), forma e data do pagamento.',
    }[tipo];
    return t || 'Vamos montar o documento. Me passe os dados.';
  },

  mostrarWorkspace() {
    const a = this.state.atual;
    document.getElementById('docs-workspace').classList.add('active');
    document.body.classList.add('workspace-open');
    document.getElementById('ws-tipo').textContent = DocTemplates.LABELS[a.tipo];
    document.getElementById('ws-numero').textContent = a.numero || 'Novo';
    document.getElementById('ws-status').value = a.status || 'rascunho';
    this.renderVinculos();
    this.atualizarLinkDrive();
    document.getElementById('chat-input').focus();
  },

  atualizarLinkDrive() {
    const a = this.state.atual;
    const link = document.getElementById('link-drive');
    if (a?.drive_url) { link.href = a.drive_url; link.style.display = ''; } else { link.style.display = 'none'; }
  },

  fecharWorkspace() {
    if (this.state.busy) { UI.warning('Aguarde o agente terminar.'); return; }
    document.getElementById('docs-workspace').classList.remove('active');
    document.body.classList.remove('workspace-open');
    this.state.atual = null;
    this.state.messages = [];
    history.replaceState(null, '', 'documentos.html' + (this.state.obraFiltro ? `?obra_id=${this.state.obraFiltro}` : ''));
  },

  renderVinculos() {
    const a = this.state.atual;
    const L = this.state.listas;
    const opt = (lista, campoNome, sel, extra) => `<option value="">${extra}</option>` + lista.map(x => `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${campoNome(x)}</option>`).join('');
    document.getElementById('vinc-cliente').innerHTML = opt(L.clientes, c => c.nome, a.cliente_id, 'Cliente cadastrado');
    document.getElementById('vinc-lead').innerHTML = opt(L.leads, l => `${l.condominio} (${UI.statusLabel(l.status)})`, a.lead_id, 'Lead do CRM');
    document.getElementById('vinc-obra').innerHTML = opt(L.obras, o => o.condominio, a.obra_id, 'Obra');
    const docsBase = L.documentos.filter(d => d.id !== a.id && (a.tipo === 'contrato' ? d.tipo === 'orcamento' : a.tipo === 'aditivo' || a.tipo === 'recibo' ? d.tipo === 'contrato' || d.tipo === 'aditivo' : true));
    document.getElementById('vinc-base').innerHTML = opt(docsBase, d => `${d.numero}: ${d.titulo}`, a.documento_pai_id, 'Documento base');
  },

  async mudarVinculo(campo, valor) {
    const a = this.state.atual;
    if (!a) return;
    const chave = { cliente: 'cliente_id', lead: 'lead_id', obra: 'obra_id', base: 'documento_pai_id' }[campo];
    a[chave] = valor || null;
    await this.carregarContexto({});
    const nomes = { cliente: 'Cliente', lead: 'Lead', obra: 'Obra', base: 'Documento base' };
    if (valor) this.addMsg('system', `${nomes[campo]} vinculado. O agente já enxerga os dados.`, false);
  },

  /** Busca os registros vinculados para alimentar o contexto do agente */
  async carregarContexto({ receita_id }) {
    const a = this.state.atual;
    const ctx = {};
    try {
      if (a.cliente_id) ctx.cliente = await DB.get('clientes', a.cliente_id).catch(() => null);
      if (a.lead_id) ctx.lead = await DB.get('leads', a.lead_id).catch(() => null);
      if (a.obra_id) ctx.obra = await DB.get('obras', a.obra_id).catch(() => null);
      if (a.documento_pai_id) ctx.documento_pai = await DB.get('documentos', a.documento_pai_id).catch(() => null);
      if (receita_id) {
        ctx.receita = await DB.get('receitas', receita_id).catch(() => null);
        if (ctx.receita?.obra_id && !a.obra_id) { a.obra_id = ctx.receita.obra_id; ctx.obra = await DB.get('obras', a.obra_id).catch(() => null); }
      }
      // Obra sem cliente vinculado: tenta achar o cliente pelo cliente_id da obra
      if (ctx.obra?.cliente_id && !a.cliente_id) { a.cliente_id = ctx.obra.cliente_id; ctx.cliente = await DB.get('clientes', a.cliente_id).catch(() => null); }
      // Lead sem cliente: tenta casar pelo nome do condomínio
      if (ctx.lead && !ctx.cliente) {
        const c = this.state.listas.clientes.find(x => (x.nome || '').toLowerCase() === (ctx.lead.condominio || '').toLowerCase());
        if (c) { a.cliente_id = c.id; ctx.cliente = c; }
      }
    } catch (error) {
      console.error('Erro ao carregar contexto:', error);
    }
    this.state.contexto = ctx;
    if (document.getElementById('docs-workspace').classList.contains('active')) this.renderVinculos();
  },

  // ===============================================================
  // CHAT
  // ===============================================================
  renderChat() {
    const box = document.getElementById('chat-messages');
    box.innerHTML = '';
    (this.state.atual?.conversa || []).forEach(m => this.addMsg(m.role, m.text, false, true));
  },

  addMsg(role, text, persistir = true, silencioso = false) {
    const box = document.getElementById('chat-messages');
    const el = document.createElement('div');
    el.className = `chat-msg ${role}`;
    el.innerHTML = this.md(text);
    box.appendChild(el);
    box.scrollTop = box.scrollHeight;
    if (persistir && this.state.atual && role !== 'system') {
      this.state.atual.conversa = this.state.atual.conversa || [];
      this.state.atual.conversa.push({ role, text, ts: new Date().toISOString() });
    }
    return el;
  },

  md(text) {
    const esc = String(text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return esc
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^(?:- |• )(.*)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`)
      .replace(/\n/g, '<br>');
  },

  setBusy(on) {
    this.state.busy = on;
    document.getElementById('chat-send').disabled = on;
    document.getElementById('chat-input').disabled = on;
    let t = document.getElementById('chat-typing');
    if (on) {
      if (!t) {
        t = document.createElement('div');
        t.id = 'chat-typing';
        t.className = 'chat-msg assistant typing';
        t.innerHTML = '<span></span><span></span><span></span>';
        document.getElementById('chat-messages').appendChild(t);
      }
      t.parentElement.scrollTop = t.parentElement.scrollHeight;
    } else if (t) {
      t.remove();
    }
  },

  async enviar() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text || this.state.busy || !this.state.atual) return;
    input.value = '';
    input.style.height = 'auto';
    this.addMsg('user', text);
    await this.runAgent(text);
  },

  async runAgent(userText) {
    const s = this.state;
    this.setBusy(true);
    try {
      // Na primeira mensagem de um documento já salvo, injeta os dados atuais
      if (!s.messages.length && s.atual.dados && Object.keys(s.atual.dados).length) {
        s.messages.push({ role: 'user', content: `Dados atuais do documento ${s.atual.numero} (JSON). Use como base para qualquer alteração e regenere com a ferramenta correspondente:\n${JSON.stringify(s.atual.dados)}` });
        s.messages.push({ role: 'assistant', content: [{ type: 'text', text: 'Entendido, tenho os dados atuais do documento. O que devo ajustar?' }] });
        s.atual.editadoManualmente = false;
      }
      // Se a Vanessa editou à mão depois da última conversa, o agente precisa dos dados novos
      let conteudo = userText;
      if (s.atual.editadoManualmente && s.atual.dados) {
        conteudo = `(Editei o documento manualmente. Dados atuais, use-os como base:\n${JSON.stringify(s.atual.dados)})\n\n${userText}`;
        s.atual.editadoManualmente = false;
      }
      s.messages.push({ role: 'user', content: conteudo });

      for (let volta = 0; volta < 8; volta++) {
        const resp = await IA.chat({
          system: this.systemPrompt(),
          messages: s.messages,
          tools: this.tools(),
        });
        s.messages.push({ role: 'assistant', content: resp.content });

        const texto = IA.textOf(resp);
        if (texto) this.addMsg('assistant', texto);

        if (resp.stop_reason !== 'tool_use') break;

        const results = [];
        for (const tu of IA.toolUsesOf(resp)) {
          const out = await this.executarTool(tu.name, tu.input);
          results.push({ type: 'tool_result', tool_use_id: tu.id, content: out.content, is_error: !!out.is_error });
        }
        s.messages.push({ role: 'user', content: results });
      }
    } catch (error) {
      console.error('Erro no agente:', error);
      this.addMsg('system', `Erro: ${error.message}`, false);
      // Remove a última mensagem do usuário se a API falhou antes de responder
      if (s.messages.length && s.messages[s.messages.length - 1].role === 'user' && typeof s.messages[s.messages.length - 1].content === 'string') s.messages.pop();
    } finally {
      this.setBusy(false);
      document.getElementById('chat-input').focus();
    }
  },

  // ===============================================================
  // PROMPT E FERRAMENTAS
  // ===============================================================
  systemPrompt() {
    const a = this.state.atual;
    const ctx = this.state.contexto;
    const hoje = DocTemplates.hojeISO();

    const base = `Você é o Agente de Documentos da DIBREVA, empresa de manutenção e restauração predial de Criciúma/SC (responsável técnica: Vanessa Lobo, arquiteta e urbanista). Você trabalha dentro do CRM da empresa e gera quatro tipos de documento: orçamento (proposta de mão de obra), contrato de prestação de serviços, termo aditivo e recibo de pagamento.

REGRA CENTRAL: você NUNCA escreve o documento em texto. Você coleta os dados, e quando tiver o suficiente chama a ferramenta gerar_* correspondente com os dados estruturados. O sistema renderiza o layout padrão A4 da DIBREVA automaticamente. Depois da ferramenta, responda em 2 ou 3 frases dizendo o que foi gerado e o que você (Vanessa) deve conferir, falando diretamente com ela.

COMO CONVERSAR
- Português do Brasil, direto, sem enrolação. Quem conversa com você é a Vanessa, dona da empresa: fale com ela diretamente ("você"), nunca na terceira pessoa.
- Se faltar dado obrigatório, pergunte tudo o que falta de uma vez, em lista curta. Não invente valores, CNPJ, endereços, nomes ou datas. Dados de cliente, obra, lead e documentos anteriores estão no CONTEXTO abaixo ou podem ser buscados com as ferramentas buscar_*.
- Quando o pedido for uma alteração num documento já gerado, chame a ferramenta de novo com os dados completos atualizados (não só o campo alterado).
- Nunca use travessão (—) nos textos. Use dois-pontos, vírgula ou ponto.
- Ao terminar, não repita o documento inteiro no chat.

PADRÃO DOS ORÇAMENTOS (gerar_orcamento)
- Itens de serviço em linguagem direta e prática, verbo no infinitivo: "Lavar toda a fachada...", "Lixar e raspar...", "Aplicar duas demãos...", "Fazer tratamento das ferragens expostas". Sem textos explicativos longos. Terminar cada item com ponto e vírgula.
- Etapas em ordem lógica de execução. Lavação normalmente é a Etapa 1. EXCEÇÃO: quando há remoção de cerâmicas, a remoção vem primeiro e a lavação logo em seguida como Etapa 2, antes do tratamento de ferragens e dos reparos de reboco. Última etapa costuma ser "Finalização" (limpeza total e retirada de resíduos).
- Etapa de pintura: inclua a observação "**Tintas:** toda a pintura é executada com tinta de linha premium, conforme padrão de cores aprovado pelo cliente."
- Modalidade: "com_material" quando a DIBREVA fornece mão de obra, equipamentos e materiais; "mao_de_obra" quando fornece somente mão de obra especializada e equipamentos. Pergunte se não estiver claro.
- Observações padrão (adapte a redação ao caso, mantendo o sentido): (1) o que a proposta contempla (mão de obra especializada e equipamentos, com ou sem material); (2) serviço com nota fiscal e execução conforme cronograma de obra acordado; (3) não executamos retirada de redes de proteção: havendo rede ou fechamento em vidro na sacada, a área não será objeto de pintura; (4) obra limpa e organizada, funcionários uniformizados e com EPIs, validade de 30 dias. O sistema acrescenta sozinho a observação das marcas de tinta (quando inclui_pintura = true) e a frase final de negociação. NÃO repita condições de pagamento nem cronograma nas observações.
- Valor: sempre o valor total. Entrada no percentual EXATO informado (sem ajustar centavos). Parcelas são calculadas pelo sistema (saldo dividido pelo número de parcelas). Pode haver mais de uma opção de parcelamento.
- Prazo sempre em dias úteis.
- Sem seção de autopromoção ("por que escolher a DIBREVA"). A página da empresa já é padrão.
- Dados obrigatórios: cliente_nome, cidade, tipo_servico, etapas com itens, valor_total, condições (entrada e parcelas), prazo_dias_uteis. Escopo geral e descrição intro você redige a partir das etapas.

PADRÃO DOS CONTRATOS (gerar_contrato)
- As cláusulas jurídicas (carga horária, obrigações, redes de proteção, rescisão e multa de 2%, regência legal, garantia de 24 meses, assinatura digital, foro em Criciúma) são fixas no sistema. Você preenche apenas: contratante completo, objeto resumido, grupos de serviços com itens, prazo, data de início, valor, entrada, parcelas e forma de pagamento.
- Os itens dos grupos de serviço no contrato são substantivados, sem ponto final: "Lavação da fachada externa com jato mecânico", "Tratamento das ferragens expostas".
- Quando houver um orçamento base no contexto, converta as etapas em grupos de serviços e reaproveite valor, prazo e condições, confirmando com a Vanessa apenas o que mudou (data de início, dados do contratante, representante).
- Dados obrigatórios do contratante: nome, CNPJ (ou CPF), endereço completo com CEP e bairro, representante (nome, cargo, CPF). Se faltar, pergunte.

PADRÃO DOS ADITIVOS (gerar_aditivo)
- Precisa do contrato original: data de assinatura, contratante e objeto original (use o documento base do contexto quando existir). Novos serviços em grupos com itens. Valor do aditivo, texto de pagamento e parcelas com datas. Prazo de execução do aditivo em dias úteis. Ordinal do aditivo (1º, 2º...).

PADRÃO DOS RECIBOS (gerar_recibo)
- Pagador completo, valor, referência (contrato e parcela), forma e data de pagamento. Descrição do serviço curta ("manutenção e restauração predial", "pintura externa").

DATA DE HOJE: ${hoje}. Documento em edição: ${DocTemplates.LABELS[a.tipo]}${a.numero ? ` ${a.numero}` : ' (novo, o número é atribuído ao salvar)'}.`;

    const contexto = this.contextoTexto(ctx);
    return [
      { type: 'text', text: base, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: contexto },
    ];
  },

  contextoTexto(ctx) {
    const partes = [];
    const compact = (obj, campos) => {
      const o = {};
      campos.forEach(c => { if (obj && obj[c] !== null && obj[c] !== undefined && obj[c] !== '') o[c] = obj[c]; });
      return JSON.stringify(o);
    };
    if (ctx.cliente) partes.push(`CLIENTE CADASTRADO: ${compact(ctx.cliente, ['nome', 'tipo', 'cpf_cnpj', 'nome_condominio', 'administradora', 'endereco_logradouro', 'endereco_numero', 'endereco_complemento', 'endereco_bairro', 'endereco_cidade', 'endereco_uf', 'endereco_cep', 'email', 'telefone', 'whatsapp', 'nome_responsavel', 'cargo_responsavel', 'nome_financeiro', 'observacoes'])}`);
    if (ctx.lead) partes.push(`LEAD DO CRM: ${compact(ctx.lead, ['condominio', 'cidade', 'tipo_servico', 'valor_estimado', 'status', 'nome_contato', 'telefone', 'email', 'administradora', 'observacoes', 'data_visita_tecnica'])}`);
    if (ctx.obra) partes.push(`OBRA: ${compact(ctx.obra, ['condominio', 'cliente', 'cnpj', 'cidade', 'valor_fechado', 'data_inicio', 'prazo_dias', 'status', 'observacoes'])}`);
    if (ctx.receita) partes.push(`RECEITA (parcela a receber/recebida): ${compact(ctx.receita, ['descricao', 'valor', 'data_prevista', 'status', 'data_recebimento', 'forma_pagamento'])}`);
    if (ctx.documento_pai) partes.push(`DOCUMENTO BASE ${ctx.documento_pai.numero} (${ctx.documento_pai.tipo}, ${UI.data(ctx.documento_pai.data_documento)}): ${JSON.stringify(ctx.documento_pai.dados)}`);
    return partes.length ? `CONTEXTO VINCULADO NO CRM:\n${partes.join('\n')}` : 'CONTEXTO VINCULADO NO CRM: nenhum registro vinculado ainda. Use buscar_cliente / buscar_obra / buscar_lead / buscar_documentos se a Vanessa citar um nome conhecido.';
  },

  tools() {
    const grupoServicos = {
      type: 'array',
      items: { type: 'object', properties: { titulo: { type: 'string' }, itens: { type: 'array', items: { type: 'string' } } }, required: ['titulo', 'itens'] },
    };
    const parte = (nomeDesc) => ({
      type: 'object',
      description: nomeDesc,
      properties: {
        nome: { type: 'string' },
        documento_tipo: { type: 'string', enum: ['CNPJ', 'CPF'] },
        documento: { type: 'string', description: 'CNPJ ou CPF formatado' },
        endereco: { type: 'string', description: 'Logradouro e número. Ex.: Rua Dr. José de Patta nº 337' },
        cep: { type: 'string' },
        bairro: { type: 'string' },
        cidade_uf: { type: 'string', description: 'Ex.: Criciúma/SC' },
        representante_nome: { type: 'string' },
        representante_cargo: { type: 'string', description: 'Ex.: síndico, sócio-administrador' },
        representante_cpf: { type: 'string' },
      },
      required: ['nome', 'documento_tipo', 'documento'],
    });

    return [
      {
        name: 'buscar_cliente',
        description: 'Busca clientes cadastrados no CRM pelo nome (condomínio, empresa ou pessoa). Retorna dados cadastrais completos.',
        input_schema: { type: 'object', properties: { termo: { type: 'string' } }, required: ['termo'] },
      },
      {
        name: 'buscar_obra',
        description: 'Busca obras cadastradas pelo nome do condomínio ou cliente. Retorna valor fechado, datas, prazo e CNPJ.',
        input_schema: { type: 'object', properties: { termo: { type: 'string' } }, required: ['termo'] },
      },
      {
        name: 'buscar_lead',
        description: 'Busca leads do pipeline comercial pelo nome do condomínio ou contato.',
        input_schema: { type: 'object', properties: { termo: { type: 'string' } }, required: ['termo'] },
      },
      {
        name: 'buscar_documentos',
        description: 'Busca documentos já emitidos (orçamentos, contratos, aditivos, recibos) por número ou nome do cliente. Retorna os dados estruturados para reaproveitar (ex.: contrato a partir do orçamento).',
        input_schema: { type: 'object', properties: { termo: { type: 'string' }, tipo: { type: 'string', enum: ['orcamento', 'contrato', 'aditivo', 'recibo'] } }, required: ['termo'] },
      },
      {
        name: 'gerar_orcamento',
        description: 'Gera (ou regenera) a proposta de mão de obra no padrão DIBREVA a partir dos dados estruturados. Chame quando tiver os dados obrigatórios.',
        input_schema: {
          type: 'object',
          properties: {
            cliente_nome: { type: 'string' },
            cliente_tipo: { type: 'string', description: 'Condomínio, Empresa, Pessoa Física, Prefeitura...' },
            cidade: { type: 'string' },
            uf: { type: 'string' },
            data: { type: 'string', description: 'AAAA-MM-DD (padrão: hoje)' },
            subtitulo_capa: { type: 'string', description: 'Resumo curto do serviço para a capa. Ex.: Pintura Externa e Lavação' },
            tipo_servico: { type: 'string', description: 'Ex.: Pintura Externa com Reparos na Textura' },
            tipo_servico_detalhe: { type: 'string', description: 'Ex.: Lavação, preparação, reparos, textura e pintura' },
            abrangencia: { type: 'string', description: 'Ex.: Área Externa' },
            abrangencia_detalhe: { type: 'string', description: 'Ex.: Fachadas, muros e portões das garagens' },
            modalidade: { type: 'string', enum: ['com_material', 'mao_de_obra'] },
            escopo_geral: { type: 'string', description: 'Parágrafo único resumindo tudo que a proposta contempla' },
            descricao_intro: { type: 'string', description: 'Frase de abertura da descrição dos serviços. Ex.: Pintura externa do X com reparos na textura, executada em cinco etapas sequenciais.' },
            etapas: { type: 'array', items: { type: 'object', properties: { nome: { type: 'string' }, itens: { type: 'array', items: { type: 'string' } }, observacao: { type: 'string' } }, required: ['nome', 'itens'] } },
            inclui_pintura: { type: 'boolean' },
            garantia_texto: { type: 'string', description: 'Só se a Vanessa pedir texto de garantia diferente do padrão' },
            observacoes: { type: 'array', items: { type: 'string' }, description: 'Observações importantes (sem a frase final de negociação e sem marcas de tinta, que o sistema adiciona)' },
            valor_total: { type: 'number' },
            entrada_valor: { type: 'number', description: '0 se não houver entrada' },
            entrada_percentual: { type: 'number', description: 'Percentual da entrada quando informado assim (ex.: 30)' },
            entrada_descricao: { type: 'string', description: 'Ex.: No início da obra' },
            opcoes_parcelamento: { type: 'array', items: { type: 'object', properties: { parcelas: { type: 'integer' }, descricao: { type: 'string' } }, required: ['parcelas'] }, description: 'Uma ou mais opções para o saldo. Ex.: [{parcelas: 15}, {parcelas: 18}]' },
            prazo_dias_uteis: { type: 'integer' },
            prazo_detalhe: { type: 'string' },
            validade_dias: { type: 'integer' },
          },
          required: ['cliente_nome', 'cidade', 'tipo_servico', 'modalidade', 'escopo_geral', 'descricao_intro', 'etapas', 'inclui_pintura', 'observacoes', 'valor_total', 'entrada_valor', 'opcoes_parcelamento', 'prazo_dias_uteis'],
        },
      },
      {
        name: 'gerar_contrato',
        description: 'Gera (ou regenera) o contrato de prestação de serviços no padrão DIBREVA.',
        input_schema: {
          type: 'object',
          properties: {
            contratante: parte('Dados completos do contratante'),
            local_obra: { type: 'string', description: 'Nome do empreendimento onde o serviço será executado' },
            objeto_resumo: { type: 'string', description: 'Objeto resumido em minúsculas. Ex.: reforma externa, reparos nas cerâmicas e pintura da fachada' },
            grupos_servicos: grupoServicos,
            prazo_dias_uteis: { type: 'integer' },
            data_inicio: { type: 'string', description: 'AAAA-MM-DD' },
            data_assinatura: { type: 'string', description: 'AAAA-MM-DD (padrão: hoje)' },
            cidade_assinatura: { type: 'string' },
            valor_total: { type: 'number' },
            entrada_valor: { type: 'number' },
            entrada_condicao: { type: 'string', description: 'Ex.: na assinatura do contrato' },
            num_parcelas: { type: 'integer' },
            primeira_parcela_data: { type: 'string', description: 'AAAA-MM-DD da 1ª parcela; as demais são mensais no mesmo dia' },
            forma_pagamento: { type: 'string', description: 'Ex.: cheque ou PIX' },
            fornece_material: { type: 'boolean', description: 'true se a DIBREVA fornece o material' },
            carga_horaria: { type: 'object', properties: { seg_qui: { type: 'string' }, sexta: { type: 'string' }, observacoes: { type: 'string' } } },
            multa_percentual: { type: 'number' },
            garantia_meses: { type: 'integer' },
          },
          required: ['contratante', 'local_obra', 'objeto_resumo', 'grupos_servicos', 'prazo_dias_uteis', 'valor_total', 'entrada_valor', 'num_parcelas', 'fornece_material'],
        },
      },
      {
        name: 'gerar_aditivo',
        description: 'Gera (ou regenera) o termo aditivo ao contrato no padrão DIBREVA.',
        input_schema: {
          type: 'object',
          properties: {
            ordinal: { type: 'integer', description: '1 para 1º aditivo, 2 para 2º...' },
            contratante: parte('Dados completos do contratante (iguais ao contrato)'),
            contrato_data: { type: 'string', description: 'AAAA-MM-DD da assinatura do contrato original' },
            contrato_numero: { type: 'string', description: 'Número de referência do contrato, se houver' },
            local_obra: { type: 'string' },
            objeto_original_resumo: { type: 'string' },
            servicos_originais: grupoServicos,
            novos_servicos: grupoServicos,
            valor_aditivo: { type: 'number' },
            pagamento_texto: { type: 'string', description: 'Frase explicando o pagamento. Ex.: O pagamento será efetuado em **4 parcelas** de R$ 8.000,00, iniciando-se após a última parcela do contrato principal:' },
            parcelas: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, valor: { type: 'number' }, data: { type: 'string', description: 'AAAA-MM-DD' } }, required: ['valor'] } },
            prazo_dias_uteis: { type: 'integer' },
            prazo_texto: { type: 'string' },
            data_assinatura: { type: 'string' },
            cidade_assinatura: { type: 'string' },
          },
          required: ['ordinal', 'contratante', 'contrato_data', 'objeto_original_resumo', 'novos_servicos', 'valor_aditivo', 'parcelas', 'prazo_dias_uteis'],
        },
      },
      {
        name: 'gerar_recibo',
        description: 'Gera (ou regenera) o recibo de pagamento no padrão DIBREVA.',
        input_schema: {
          type: 'object',
          properties: {
            pagador: parte('Quem pagou'),
            valor: { type: 'number' },
            data_emissao: { type: 'string', description: 'AAAA-MM-DD' },
            data_pagamento: { type: 'string', description: 'AAAA-MM-DD' },
            forma_pagamento: { type: 'string', description: 'Ex.: Transferência Bancária / PIX' },
            servico_descricao: { type: 'string', description: 'Ex.: manutenção e restauração predial' },
            local_obra: { type: 'string' },
            contrato_numero: { type: 'string' },
            parcela_descricao: { type: 'string', description: 'Ex.: 3ª parcela do contrato firmado entre as partes' },
            cidade: { type: 'string' },
          },
          required: ['pagador', 'valor', 'data_pagamento', 'forma_pagamento'],
        },
      },
    ];
  },

  async executarTool(name, input) {
    try {
      switch (name) {
        case 'buscar_cliente': {
          const rows = await DB.list('clientes', { search: input.termo, searchFields: ['nome', 'nome_condominio', 'cpf_cnpj', 'nome_responsavel'] });
          return { content: JSON.stringify(rows.slice(0, 5).map(c => ({ id: c.id, nome: c.nome, tipo: c.tipo, cpf_cnpj: c.cpf_cnpj, endereco: `${c.endereco_logradouro || ''} ${c.endereco_numero || ''}`.trim(), bairro: c.endereco_bairro, cidade: c.endereco_cidade, uf: c.endereco_uf, cep: c.endereco_cep, responsavel: c.nome_responsavel, cargo: c.cargo_responsavel, email: c.email, telefone: c.telefone })) || 'Nenhum cliente encontrado.') };
        }
        case 'buscar_obra': {
          const rows = await DB.list('obras', { search: input.termo, searchFields: ['condominio', 'cliente', 'cnpj'] });
          return { content: JSON.stringify(rows.slice(0, 5).map(o => ({ id: o.id, condominio: o.condominio, cliente: o.cliente, cnpj: o.cnpj, cidade: o.cidade, valor_fechado: o.valor_fechado, data_inicio: o.data_inicio, prazo_dias: o.prazo_dias, status: o.status }))) || 'Nenhuma obra encontrada.' };
        }
        case 'buscar_lead': {
          const rows = await DB.list('leads', { search: input.termo, searchFields: ['condominio', 'nome_contato', 'administradora'] });
          return { content: JSON.stringify(rows.slice(0, 5).map(l => ({ id: l.id, condominio: l.condominio, cidade: l.cidade, tipo_servico: l.tipo_servico, valor_estimado: l.valor_estimado, status: l.status, contato: l.nome_contato, telefone: l.telefone, email: l.email, observacoes: l.observacoes }))) || 'Nenhum lead encontrado.' };
        }
        case 'buscar_documentos': {
          const termo = (input.termo || '').toLowerCase();
          let rows = this.state.docs.filter(d => `${d.numero} ${d.titulo} ${d.cliente_nome || ''} ${d.obra_condominio || ''}`.toLowerCase().includes(termo));
          if (input.tipo) rows = rows.filter(d => d.tipo === input.tipo);
          return { content: rows.length ? JSON.stringify(rows.slice(0, 3).map(d => ({ id: d.id, numero: d.numero, tipo: d.tipo, titulo: d.titulo, data: d.data_documento, valor: d.valor, status: d.status, dados: d.dados }))) : 'Nenhum documento encontrado.' };
        }
        case 'gerar_orcamento': return await this.gerar('orcamento', input);
        case 'gerar_contrato': return await this.gerar('contrato', input);
        case 'gerar_aditivo': return await this.gerar('aditivo', input);
        case 'gerar_recibo': return await this.gerar('recibo', input);
        default:
          return { content: `Ferramenta desconhecida: ${name}`, is_error: true };
      }
    } catch (error) {
      console.error(`Erro na ferramenta ${name}:`, error);
      return { content: `Erro ao executar ${name}: ${error.message}`, is_error: true };
    }
  },

  async gerar(tipo, dados) {
    const a = this.state.atual;
    if (tipo !== a.tipo) {
      return { content: `Este workspace é de ${DocTemplates.LABELS[a.tipo]}. Gere apenas ${DocTemplates.LABELS[a.tipo].toLowerCase()} aqui.`, is_error: true };
    }
    a.dados = { ...dados, numero: a.numero || this.numeroProvisorio(tipo) };
    await this.renderPreview();
    const paginas = DocTemplates.contarPaginas(a.html);
    this.marcarNaoSalvo(true);
    return { content: `Documento renderizado no padrão DIBREVA: ${paginas} página(s), valor ${UI.moeda(DocTemplates.valorDe(tipo, a.dados))}. A Vanessa está vendo o preview ao lado. Número definitivo é atribuído ao salvar.` };
  },

  numeroProvisorio(tipo) {
    return `${DocTemplates.PREFIXOS[tipo]}-${new Date().getFullYear()}-•••`;
  },

  // ===============================================================
  // PREVIEW
  // ===============================================================
  async renderPreview() {
    const a = this.state.atual;
    const frame = document.getElementById('preview-frame');
    document.getElementById('preview-vazio').style.display = 'none';
    frame.style.display = '';
    try {
      a.html = await DocTemplates.renderAsync(a.tipo, a.dados);
      frame.srcdoc = a.html;
      document.getElementById('preview-info').textContent = `${DocTemplates.contarPaginas(a.html)} página(s)`;
    } catch (error) {
      console.error('Erro ao renderizar preview:', error);
      UI.error(error.message);
    }
  },

  renderPreviewVazio() {
    document.getElementById('preview-frame').style.display = 'none';
    document.getElementById('preview-vazio').style.display = '';
    document.getElementById('preview-info').textContent = '';
    this.marcarNaoSalvo(false);
  },

  marcarNaoSalvo(on) {
    document.getElementById('btn-salvar').classList.toggle('pendente', !!on);
  },

  // ===============================================================
  // EDIÇÃO MANUAL (sem IA): formulário gerado a partir do schema da ferramenta
  // ===============================================================
  CAMPOS_LONGOS: ['escopo_geral', 'descricao_intro', 'observacao', 'observacoes', 'pagamento_texto', 'prazo_texto', 'garantia_texto', 'objeto_resumo', 'objeto_original_resumo', 'parcela_descricao', 'entrada_condicao'],
  ROTULOS: {
    cliente_nome: 'Cliente', cliente_tipo: 'Tipo de cliente', uf: 'UF', subtitulo_capa: 'Subtítulo da capa', tipo_servico: 'Tipo de serviço',
    tipo_servico_detalhe: 'Detalhe do tipo de serviço', abrangencia: 'Abrangência', abrangencia_detalhe: 'Detalhe da abrangência', modalidade: 'Modalidade',
    escopo_geral: 'Escopo geral', descricao_intro: 'Introdução da descrição', etapas: 'Etapas', itens: 'Itens (um por linha)', observacao: 'Observação da etapa',
    inclui_pintura: 'Inclui pintura', garantia_texto: 'Texto de garantia', observacoes: 'Observações (uma por linha)', valor_total: 'Valor total (R$)',
    entrada_valor: 'Entrada (R$)', entrada_percentual: 'Entrada (%)', entrada_descricao: 'Descrição da entrada', opcoes_parcelamento: 'Opções de parcelamento',
    parcelas: 'Parcelas', descricao: 'Descrição', prazo_dias_uteis: 'Prazo (dias úteis)', prazo_detalhe: 'Detalhe do prazo', validade_dias: 'Validade (dias)',
    contratante: 'Contratante', pagador: 'Pagador', nome: 'Nome', documento_tipo: 'Tipo de documento', documento: 'CNPJ / CPF', endereco: 'Endereço', cep: 'CEP',
    bairro: 'Bairro', cidade_uf: 'Cidade/UF', representante_nome: 'Representante', representante_cargo: 'Cargo do representante', representante_cpf: 'CPF do representante',
    local_obra: 'Local da obra', objeto_resumo: 'Objeto (resumo)', grupos_servicos: 'Grupos de serviços', titulo: 'Título', data_inicio: 'Data de início',
    data_assinatura: 'Data de assinatura', cidade_assinatura: 'Cidade de assinatura', num_parcelas: 'Número de parcelas', primeira_parcela_data: 'Data da 1ª parcela',
    forma_pagamento: 'Forma de pagamento', fornece_material: 'DIBREVA fornece material', carga_horaria: 'Carga horária', seg_qui: 'Segunda a quinta', sexta: 'Sexta-feira',
    multa_percentual: 'Multa (%)', garantia_meses: 'Garantia (meses)', ordinal: 'Nº do aditivo (1, 2, 3...)', contrato_data: 'Data do contrato original',
    contrato_numero: 'Nº do contrato', objeto_original_resumo: 'Objeto original (resumo)', servicos_originais: 'Serviços originais', novos_servicos: 'Novos serviços',
    valor_aditivo: 'Valor do aditivo (R$)', pagamento_texto: 'Texto do pagamento', label: 'Rótulo', valor: 'Valor (R$)', data: 'Data', data_emissao: 'Data de emissão',
    data_pagamento: 'Data do pagamento', servico_descricao: 'Descrição do serviço', parcela_descricao: 'Referente a (parcela)', cidade: 'Cidade',
  },

  ROTULOS_ITEM: { etapas: 'Etapa', opcoes_parcelamento: 'Opção', grupos_servicos: 'Grupo', servicos_originais: 'Serviço original', novos_servicos: 'Novo serviço', parcelas: 'Parcela' },

  rotulo(chave) {
    return this.ROTULOS[chave] || chave.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
  },

  schemaDoTipo(tipo) {
    const t = this.tools().find(x => x.name === `gerar_${tipo}`);
    return t ? t.input_schema : { type: 'object', properties: {} };
  },

  abrirEditor() {
    const a = this.state.atual;
    if (!a?.dados) { UI.warning('Gere o documento no chat antes de editar.'); return; }
    if (this.state.busy) { UI.warning('Aguarde o agente terminar.'); return; }
    this.state.edicao = JSON.parse(JSON.stringify(a.dados));
    this.renderEditor();
    UI.openModal('modal-editar');
  },

  renderEditor() {
    const a = this.state.atual;
    const schema = this.schemaDoTipo(a.tipo);
    const body = document.getElementById('editor-body');
    body.innerHTML = `<div class="editor-numero">Número: <strong>${a.numero || 'atribuído ao salvar'}</strong></div>` +
      this.campoObjeto(schema, this.state.edicao, []);
  },

  /** Renderiza os campos de um objeto conforme o schema (inclui chaves extras presentes nos dados) */
  campoObjeto(schema, valor, caminho) {
    const props = schema.properties || {};
    const chaves = [...Object.keys(props), ...Object.keys(valor || {}).filter(k => !(k in props) && k !== 'numero')];
    return chaves.map(k => this.campo(k, props[k] || this.inferirSchema(valor?.[k]), valor?.[k], [...caminho, k])).join('');
  },

  inferirSchema(v) {
    if (Array.isArray(v)) return { type: 'array', items: typeof v[0] === 'object' ? this.inferirSchema(v[0]) : { type: 'string' } };
    if (v && typeof v === 'object') return { type: 'object', properties: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, this.inferirSchema(x)])) };
    if (typeof v === 'number') return { type: 'number' };
    if (typeof v === 'boolean') return { type: 'boolean' };
    return { type: 'string' };
  },

  campo(chave, sch, valor, caminho) {
    const path = caminho.join('.');
    const label = this.rotulo(chave);
    const dica = sch.description ? `<small class="editor-dica">${this.md(sch.description)}</small>` : '';
    const tipo = sch.type;
    const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

    if (tipo === 'object') {
      return `<fieldset class="editor-grupo"><legend>${label}</legend>${this.campoObjeto(sch, valor || {}, caminho)}</fieldset>`;
    }
    if (tipo === 'array') {
      const itemSch = sch.items || { type: 'string' };
      if (itemSch.type === 'object') {
        const lista = Array.isArray(valor) ? valor : [];
        return `<fieldset class="editor-grupo editor-lista"><legend>${label}</legend>${dica}
          ${lista.map((item, i) => `<div class="editor-item">
            <div class="editor-item-header"><span>${this.ROTULOS_ITEM[chave] || label} ${i + 1}</span>
              <button type="button" class="btn btn-sm btn-secondary" onclick="DOCS.removerItem('${path}', ${i})">Remover</button></div>
            ${this.campoObjeto(itemSch, item, [...caminho, String(i)])}
          </div>`).join('')}
          <button type="button" class="btn btn-sm btn-secondary" onclick="DOCS.adicionarItem('${path}')">+ Adicionar</button>
        </fieldset>`;
      }
      const linhas = Array.isArray(valor) ? valor.join('\n') : '';
      return `<div class="form-group"><label>${label}</label>${dica}
        <textarea class="form-control" rows="${Math.min(12, Math.max(3, (valor || []).length + 1))}" data-path="${path}" data-type="lista" oninput="DOCS.registrarEdicao(this)">${esc(linhas)}</textarea></div>`;
    }
    if (tipo === 'boolean') {
      return `<div class="form-group editor-check"><label><input type="checkbox" data-path="${path}" data-type="boolean" ${valor ? 'checked' : ''} onchange="DOCS.registrarEdicao(this)"> ${label}</label>${dica}</div>`;
    }
    if (sch.enum) {
      return `<div class="form-group"><label>${label}</label>${dica}
        <select class="form-control" data-path="${path}" data-type="string" onchange="DOCS.registrarEdicao(this)">
          ${sch.enum.map(o => `<option value="${o}" ${o === valor ? 'selected' : ''}>${o}</option>`).join('')}</select></div>`;
    }
    if (tipo === 'number' || tipo === 'integer') {
      return `<div class="form-group"><label>${label}</label>${dica}
        <input type="number" class="form-control" step="${tipo === 'integer' ? 1 : 0.01}" data-path="${path}" data-type="number" value="${esc(valor)}" oninput="DOCS.registrarEdicao(this)"></div>`;
    }
    const longo = this.CAMPOS_LONGOS.includes(chave) || String(valor || '').length > 90;
    const ehData = /AAAA-MM-DD/.test(sch.description || '') || /^\d{4}-\d{2}-\d{2}$/.test(String(valor || ''));
    if (ehData) {
      return `<div class="form-group"><label>${label}</label>${dica}
        <input type="date" class="form-control" data-path="${path}" data-type="string" value="${esc(valor)}" oninput="DOCS.registrarEdicao(this)"></div>`;
    }
    if (longo) {
      return `<div class="form-group"><label>${label}</label>${dica}
        <textarea class="form-control" rows="3" data-path="${path}" data-type="string" oninput="DOCS.registrarEdicao(this)">${esc(valor)}</textarea></div>`;
    }
    return `<div class="form-group"><label>${label}</label>${dica}
      <input type="text" class="form-control" data-path="${path}" data-type="string" value="${esc(valor)}" oninput="DOCS.registrarEdicao(this)"></div>`;
  },

  /** Lê/escreve num caminho "a.b.0.c" da cópia em edição */
  noCaminho(path, criar = false) {
    const partes = path.split('.');
    let obj = this.state.edicao;
    for (let i = 0; i < partes.length - 1; i++) {
      const p = partes[i];
      if (obj[p] === undefined || obj[p] === null) {
        if (!criar) return [null, null];
        obj[p] = /^\d+$/.test(partes[i + 1]) ? [] : {};
      }
      obj = obj[p];
    }
    return [obj, partes[partes.length - 1]];
  },

  registrarEdicao(el) {
    const [obj, chave] = this.noCaminho(el.dataset.path, true);
    if (!obj) return;
    const t = el.dataset.type;
    if (t === 'lista') obj[chave] = el.value.split('\n').map(s => s.trim()).filter(Boolean);
    else if (t === 'boolean') obj[chave] = el.checked;
    else if (t === 'number') obj[chave] = el.value === '' ? null : Number(el.value);
    else obj[chave] = el.value;
  },

  adicionarItem(path) {
    const [obj, chave] = this.noCaminho(path, true);
    if (!obj) return;
    if (!Array.isArray(obj[chave])) obj[chave] = [];
    const modelo = obj[chave][obj[chave].length - 1];
    const novo = modelo && typeof modelo === 'object'
      ? Object.fromEntries(Object.entries(modelo).map(([k, v]) => [k, Array.isArray(v) ? [] : typeof v === 'number' ? 0 : typeof v === 'boolean' ? false : '']))
      : {};
    obj[chave].push(novo);
    this.renderEditor();
  },

  removerItem(path, indice) {
    const [obj, chave] = this.noCaminho(path);
    if (!obj || !Array.isArray(obj[chave])) return;
    obj[chave].splice(indice, 1);
    this.renderEditor();
  },

  async aplicarEdicao() {
    const a = this.state.atual;
    if (!a || !this.state.edicao) return;
    a.dados = { ...this.state.edicao, numero: a.numero || this.numeroProvisorio(a.tipo) };
    a.editadoManualmente = true;
    UI.closeModal('modal-editar');
    await this.renderPreview();
    this.marcarNaoSalvo(true);
    this.addMsg('system', 'Documento regerado com a edição manual (sem uso da IA).', false);
  },

  // ===============================================================
  // AÇÕES: salvar, status, imprimir, baixar, excluir
  // ===============================================================
  async salvar() {
    const a = this.state.atual;
    if (!a || !a.dados) { UI.warning('Gere o documento no chat antes de salvar.'); return; }
    if (this.state.busy) { UI.warning('Aguarde o agente terminar.'); return; }
    try {
      if (!a.numero) {
        a.numero = await DB.rpc('proximo_numero_documento', { p_prefixo: DocTemplates.PREFIXOS[a.tipo] });
        a.dados.numero = a.numero;
        await this.renderPreview();
        document.getElementById('ws-numero').textContent = a.numero;
      }
      const registro = {
        tipo: a.tipo,
        numero: a.numero,
        titulo: DocTemplates.tituloDe(a.tipo, a.dados),
        cliente_id: a.cliente_id || null,
        lead_id: a.lead_id || null,
        obra_id: a.obra_id || null,
        documento_pai_id: a.documento_pai_id || null,
        dados: a.dados,
        conversa: a.conversa || [],
        status: document.getElementById('ws-status').value || 'rascunho',
        valor: DocTemplates.valorDe(a.tipo, a.dados),
        data_documento: a.dados.data || a.dados.data_assinatura || a.dados.data_emissao || DocTemplates.hojeISO(),
      };
      let salvo;
      if (a.id) salvo = await DB.update('documentos', a.id, registro);
      else salvo = await DB.create('documentos', registro);
      a.id = salvo.id;
      const statusAnterior = a.status;
      a.status = salvo.status;
      history.replaceState(null, '', `documentos.html?id=${a.id}`);
      this.marcarNaoSalvo(false);
      UI.success(`${DocTemplates.LABELS[a.tipo]} ${a.numero} salvo.`);
      await this.sincronizarVinculos(salvo);
      await this.loadList();
      this.renderKPIs();
      this.renderList();
      this.renderVinculos();
      // Publicação automática no Drive: orçamento Enviado, contrato/aditivo Assinado
      const gatilho = { orcamento: 'enviado', contrato: 'assinado', aditivo: 'assinado' }[a.tipo];
      if (gatilho && salvo.status === gatilho && (statusAnterior !== gatilho || !a.drive_url)) {
        await this.publicarNoDrive(true);
      }
    } catch (error) {
      console.error('Erro ao salvar documento:', error);
      UI.error('Erro ao salvar: ' + error.message);
    }
  },

  /** Efeitos colaterais úteis no CRM ao salvar */
  async sincronizarVinculos(doc) {
    try {
      if (doc.tipo === 'orcamento' && doc.lead_id && doc.status === 'enviado') {
        const lead = await DB.get('leads', doc.lead_id);
        if (['lead', 'visita_tecnica'].includes(lead.status)) {
          await DB.update('leads', lead.id, { status: 'orcamento_enviado', data_envio_orcamento: DocTemplates.hojeISO(), valor_estimado: doc.valor });
          this.addMsg('system', `Lead "${lead.condominio}" movido para Orçamento Enviado no CRM.`, false);
        }
      }
      if (doc.tipo === 'aditivo' && doc.obra_id && doc.status === 'assinado') {
        const existentes = await DB.list('aditivos', { filters: { obra_id: doc.obra_id } });
        if (!existentes.some(x => (x.observacoes || '').includes(doc.numero))) {
          await DB.create('aditivos', {
            obra_id: doc.obra_id,
            numero: Number(doc.dados.ordinal) || existentes.length + 1,
            descricao: (doc.dados.novos_servicos || []).map(g => g.titulo).join('; ') || doc.titulo,
            valor_adicional: doc.valor,
            prazo_adicional_dias: Number(doc.dados.prazo_dias_uteis) || 0,
            data_aditivo: doc.data_documento,
            observacoes: `Gerado pelo Agente de Documentos (${doc.numero})`,
          });
          this.addMsg('system', 'Aditivo registrado na obra (módulo Obras).', false);
        }
      }
    } catch (error) {
      console.error('Erro ao sincronizar vínculos:', error);
    }
  },

  async mudarStatus() {
    const a = this.state.atual;
    if (!a) return;
    if (a.id) await this.salvar();
    else a.status = document.getElementById('ws-status').value;
  },

  /** Gera o PDF no servidor e sobe para o Drive da DIBREVA (pasta do cliente) */
  async publicarNoDrive(automatico = false) {
    const a = this.state.atual;
    if (!a?.dados) { UI.warning('Gere o documento antes de enviar ao Drive.'); return; }
    if (!a.id) { UI.warning('Salve o documento antes de enviar ao Drive.'); return; }
    if (!a.html) await this.renderPreview();
    const btn = document.getElementById('btn-drive');
    const original = btn.textContent;
    btn.disabled = true; btn.textContent = 'Gerando PDF e enviando...';
    this.addMsg('system', automatico ? 'Publicando no Google Drive (PDF + HTML)...' : 'Enviando ao Google Drive...', false);
    try {
      const r = await Drive.publicar(a.id, a.html);
      a.drive_url = r.url;
      a.drive_pasta_url = r.pasta;
      a.publicado_em = new Date().toISOString();
      this.atualizarLinkDrive();
      this.addMsg('system', `Publicado no Drive: ${r.caminho}`, false);
      UI.success('PDF publicado no Google Drive.');
      await this.loadList();
      this.renderList();
    } catch (error) {
      console.error('Erro ao publicar no Drive:', error);
      this.addMsg('system', `Falha ao publicar no Drive: ${error.message}`, false);
      UI.error(error.message);
    } finally {
      btn.disabled = false; btn.textContent = original;
    }
  },

  imprimir() {
    const a = this.state.atual;
    if (!a?.html) { UI.warning('Nenhum documento gerado ainda.'); return; }
    this.abrirParaImpressao(a.html);
  },

  async imprimirId(id) {
    try {
      const doc = await DB.get('documentos', id);
      const html = await DocTemplates.renderAsync(doc.tipo, doc.dados);
      this.abrirParaImpressao(html);
    } catch (error) {
      console.error('Erro ao imprimir:', error);
      UI.error('Erro ao gerar impressão: ' + error.message);
    }
  },

  abrirParaImpressao(html) {
    const comPrint = html.replace('</body>', `<script>window.addEventListener('load', () => { (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => setTimeout(() => window.print(), 400)); });<\/script></body>`);
    const blob = new Blob([comPrint], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if (!w) UI.warning('O navegador bloqueou a janela. Permita pop-ups para dibreva-crm.');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  },

  baixarHTML() {
    const a = this.state.atual;
    if (!a?.html) { UI.warning('Nenhum documento gerado ainda.'); return; }
    const nome = `${a.numero || DocTemplates.PREFIXOS[a.tipo]}-${this.slug(DocTemplates.tituloDe(a.tipo, a.dados).split(': ')[1] || 'DIBREVA')}-DIBREVA.html`;
    const blob = new Blob([a.html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = nome;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  },

  slug(s) {
    return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '');
  },

  async excluir(id) {
    if (!await UI.confirm('Excluir este documento? O número emitido não será reaproveitado.')) return;
    try {
      await DB.remove('documentos', id);
      UI.success('Documento excluído.');
      if (this.state.atual?.id === id) this.fecharWorkspace();
      await this.loadList();
      this.renderKPIs();
      this.renderList();
    } catch (error) {
      console.error('Erro ao excluir documento:', error);
      UI.error('Erro ao excluir: ' + error.message);
    }
  },
};
