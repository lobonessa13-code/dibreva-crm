// ===== Módulo de Vistoria Predial — DIBREVA =====

const VISTORIA = {

  // ── Estado ────────────────────────────────────────────────────────
  lista: [],
  currentId: null,
  currentPatologias: [],
  currentResultado: null,
  fotoBase64: null,
  activeSistema: 'estrutural',
  activeResultTab: 'diagnostico',

  sistemas: [
    { id: 'estrutural',        label: 'Estrutural' },
    { id: 'fachadas',          label: 'Fachadas' },
    { id: 'cobertura',         label: 'Cobertura' },
    { id: 'impermeabilizacao', label: 'Impermeab.' },
    { id: 'hidraulico',        label: 'Hidráulico' },
    { id: 'eletrico',          label: 'Elétrico' },
    { id: 'esquadrias',        label: 'Esquadrias' },
    { id: 'areas_comuns',      label: 'Áreas Comuns' },
  ],

  sistemaLabels: {
    estrutural: 'Estrutural', fachadas: 'Fachadas',
    cobertura: 'Cobertura', impermeabilizacao: 'Impermeabilização',
    hidraulico: 'Hidráulico', eletrico: 'Elétrico',
    esquadrias: 'Esquadrias', areas_comuns: 'Áreas Comuns',
  },

  // ── Init ──────────────────────────────────────────────────────────
  async init() {
    try {
      await this.loadLista();
      this.renderKPIs();
      this.renderLista();
      this.showView('list');
    } catch (err) {
      console.error('Erro ao inicializar Vistoria:', err);
      UI.error('Erro ao carregar vistorias.');
    }
  },

  // ── Views ─────────────────────────────────────────────────────────
  showView(view) {
    document.querySelectorAll('.vistoria-view').forEach(el => el.style.display = 'none');
    const el = document.getElementById('view-' + view);
    if (el) el.style.display = '';

    const titles = {
      list:        'Vistoria Predial',
      form:        'Dados do Imóvel',
      checklist:   'Registrar Patologias',
      processando: 'Gerando Laudo...',
      resultado:   'Laudo Técnico',
    };
    const h1 = document.querySelector('.page-header h1');
    if (h1) h1.textContent = titles[view] || 'Vistoria Predial';

    const backBtn = document.getElementById('btn-voltar');
    if (backBtn) backBtn.style.display = view === 'list' ? 'none' : '';

    const newBtn = document.getElementById('btn-nova-vistoria');
    if (newBtn) newBtn.style.display = view === 'list' ? '' : 'none';
  },

  voltar() {
    const views = ['resultado', 'processando', 'checklist', 'form'];
    for (const v of views) {
      const el = document.getElementById('view-' + v);
      if (el && el.style.display !== 'none') {
        if (v === 'resultado' || v === 'processando') {
          this.showView('checklist');
        } else {
          this.showView('list');
        }
        return;
      }
    }
    this.showView('list');
  },

  // ── Lista ─────────────────────────────────────────────────────────
  async loadLista() {
    this.lista = await DB.list('vistorias', { orderBy: 'created_at', ascending: false });
  },

  renderKPIs() {
    const total     = this.lista.length;
    const concluidas = this.lista.filter(v => v.status === 'concluida').length;
    const andamento  = this.lista.filter(v => v.status === 'em_andamento').length;
    const mes = new Date().getMonth(), ano = new Date().getFullYear();
    const estesMes   = this.lista.filter(v => {
      const d = new Date(v.created_at);
      return d.getMonth() === mes && d.getFullYear() === ano;
    }).length;

    document.getElementById('kpi-v-total').textContent     = total;
    document.getElementById('kpi-v-concluidas').textContent = concluidas;
    document.getElementById('kpi-v-andamento').textContent  = andamento;
    document.getElementById('kpi-v-mes').textContent        = estesMes;
  },

  renderLista() {
    const container = document.getElementById('lista-vistorias');
    if (!this.lista.length) {
      container.innerHTML = `
        <div style="text-align:center;padding:60px 20px;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--cinza-light)" stroke-width="1.5" style="display:block;margin:0 auto 16px;">
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
            <rect x="9" y="3" width="6" height="4" rx="1"/>
            <line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/>
          </svg>
          <p style="color:var(--cinza);font-size:16px;margin-bottom:6px;">Nenhuma vistoria registrada</p>
          <p style="color:var(--cinza-light);font-size:13px;">Clique em "Nova Vistoria" para começar</p>
        </div>`;
      return;
    }

    container.innerHTML = this.lista.map(v => {
      const [cls, lbl] = this.statusInfo(v.status);
      const [ecls, elbl] = v.estado_geral ? this.estadoInfo(v.estado_geral) : ['', ''];
      return `
        <div class="panel" style="margin-bottom:10px;cursor:pointer;transition:box-shadow .15s;"
             onmouseover="this.style.boxShadow='var(--shadow-md)'"
             onmouseout="this.style.boxShadow=''"
             onclick="VISTORIA.abrirVistoria('${v.id}')">
          <div class="panel-body" style="padding:14px 20px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
              <div style="flex:1;min-width:0;">
                <div style="font-weight:700;font-family:var(--font-heading);font-size:15px;color:var(--azul);margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                  ${v.imovel_nome}
                </div>
                <div style="font-size:13px;color:var(--cinza);">
                  ${v.imovel_tipo.charAt(0).toUpperCase() + v.imovel_tipo.slice(1)}
                  · ${v.imovel_cidade || 'Criciúma'} · ${UI.data(v.data_vistoria)}
                </div>
                ${v.imovel_pavimentos || v.imovel_area ? `
                  <div style="font-size:12px;color:var(--cinza-light);margin-top:3px;">
                    ${v.imovel_pavimentos ? v.imovel_pavimentos + ' pav.' : ''}
                    ${v.imovel_area ? (v.imovel_pavimentos ? ' · ' : '') + v.imovel_area + ' m²' : ''}
                  </div>` : ''}
              </div>
              <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex-shrink:0;">
                <span class="badge badge-${cls}">${lbl}</span>
                ${ecls ? `<span class="badge badge-${ecls}">${elbl}</span>` : ''}
              </div>
            </div>
          </div>
        </div>`;
    }).join('');
  },

  statusInfo(status) {
    return { em_andamento: ['warning','Em Andamento'], processando: ['info','Processando'], concluida: ['aprovado','Concluída'] }[status] || ['lead', status];
  },

  estadoInfo(estado) {
    return { bom: ['aprovado','Bom'], regular: ['warning','Regular'], degradado: ['orcamento_enviado','Degradado'], critico: ['perdido','Crítico'] }[estado] || ['lead', estado];
  },

  // ── Formulário (Step 1) ───────────────────────────────────────────
  novaVistoria() {
    this.currentId = null;
    this.currentPatologias = [];
    this.currentResultado = null;
    document.getElementById('form-vistoria').reset();
    document.getElementById('form-data-vistoria').value = new Date().toISOString().split('T')[0];
    this.showView('form');
  },

  async salvarForm() {
    const imovel_nome = document.getElementById('form-imovel-nome').value.trim();
    if (!imovel_nome) { UI.error('Informe o nome do imóvel.'); return; }

    const btn = document.getElementById('btn-salvar-form');
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    try {
      const record = {
        imovel_nome,
        imovel_tipo:      document.getElementById('form-imovel-tipo').value,
        data_vistoria:    document.getElementById('form-data-vistoria').value,
        imovel_endereco:  document.getElementById('form-endereco').value.trim() || null,
        imovel_cidade:    document.getElementById('form-cidade').value.trim() || 'Criciúma',
        imovel_idade:     parseInt(document.getElementById('form-idade').value) || null,
        imovel_pavimentos:parseInt(document.getElementById('form-pavimentos').value) || null,
        imovel_area:      parseFloat(document.getElementById('form-area').value) || null,
        sistemas_construtivos: document.getElementById('form-sistemas').value.trim() || null,
        observacoes:      document.getElementById('form-observacoes').value.trim() || null,
        status: 'em_andamento',
      };

      const vistoria = this.currentId
        ? await DB.update('vistorias', this.currentId, record)
        : await DB.create('vistorias', record);

      this.currentId = vistoria.id;
      this.activeSistema = 'estrutural';
      await this.loadPatologias();
      this.renderChecklist();
      this.showView('checklist');
    } catch (err) {
      console.error(err);
      UI.error('Erro ao salvar: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Continuar →';
    }
  },

  // ── Abrir existente ───────────────────────────────────────────────
  async abrirVistoria(id) {
    try {
      this.currentId = id;
      this.currentResultado = null;
      const v = await DB.get('vistorias', id);

      document.getElementById('form-imovel-nome').value  = v.imovel_nome || '';
      document.getElementById('form-imovel-tipo').value  = v.imovel_tipo || 'residencial';
      document.getElementById('form-data-vistoria').value = v.data_vistoria || '';
      document.getElementById('form-endereco').value     = v.imovel_endereco || '';
      document.getElementById('form-cidade').value       = v.imovel_cidade || 'Criciúma';
      document.getElementById('form-idade').value        = v.imovel_idade || '';
      document.getElementById('form-pavimentos').value   = v.imovel_pavimentos || '';
      document.getElementById('form-area').value         = v.imovel_area || '';
      document.getElementById('form-sistemas').value     = v.sistemas_construtivos || '';
      document.getElementById('form-observacoes').value  = v.observacoes || '';

      await this.loadPatologias();

      if (v.status === 'concluida') {
        const { data } = await sb.from('vistoria_resultados')
          .select('resultado_json').eq('vistoria_id', id).single();
        if (data?.resultado_json) {
          this.currentResultado = data.resultado_json;
          this.mostrarResultado(data.resultado_json);
          return;
        }
      }

      this.activeSistema = 'estrutural';
      this.renderChecklist();
      this.showView('checklist');
    } catch (err) {
      console.error(err);
      UI.error('Erro ao abrir vistoria: ' + err.message);
    }
  },

  // ── Patologias ────────────────────────────────────────────────────
  async loadPatologias() {
    const { data, error } = await sb.from('vistoria_patologias')
      .select('*').eq('vistoria_id', this.currentId).order('created_at', { ascending: true });
    if (error) throw error;
    this.currentPatologias = data || [];
  },

  // ── Checklist ─────────────────────────────────────────────────────
  renderChecklist() {
    // Tabs
    document.getElementById('sistema-tabs').innerHTML = this.sistemas.map(s => {
      const n = this.currentPatologias.filter(p => p.sistema === s.id).length;
      return `
        <button class="tab-btn ${s.id === this.activeSistema ? 'active' : ''}"
                onclick="VISTORIA.switchSistema('${s.id}')">
          ${s.label}
          ${n > 0 ? `<span style="background:var(--laranja);color:#fff;border-radius:10px;padding:1px 6px;font-size:10px;margin-left:5px;">${n}</span>` : ''}
        </button>`;
    }).join('');

    this.renderSistemaContent();
    this.renderPatologiasResumo();
  },

  switchSistema(sistema) {
    this.activeSistema = sistema;
    this.renderChecklist();
  },

  renderSistemaContent() {
    const label = this.sistemaLabels[this.activeSistema] || this.activeSistema;
    const pats  = this.currentPatologias.filter(p => p.sistema === this.activeSistema);

    document.getElementById('sistema-content').innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <h3 style="font-size:15px;color:var(--azul);">${label}</h3>
        <button class="btn btn-primary" style="padding:8px 14px;font-size:13px;"
                onclick="VISTORIA.abrirModalPatologia('${this.activeSistema}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Adicionar
        </button>
      </div>
      ${pats.length === 0
        ? `<div style="text-align:center;padding:28px 0;color:var(--cinza-light);font-size:13px;">
             Nenhuma patologia neste sistema
           </div>`
        : pats.map(p => this.cardPatologia(p)).join('')
      }`;
  },

  cardPatologia(p) {
    const sevColor = { leve: 'var(--success)', moderado: 'var(--warning)', grave: 'var(--danger)', critico: '#8B0000' }[p.severidade] || 'var(--cinza)';
    const sevBadge = { leve: 'aprovado', moderado: 'warning', grave: 'danger', critico: 'perdido' }[p.severidade] || 'info';
    const sevLabel = { leve: 'Leve', moderado: 'Moderado', grave: 'Grave', critico: 'Crítico' }[p.severidade] || p.severidade;

    return `
      <div class="panel" style="margin-bottom:10px;border-left:3px solid ${sevColor};">
        <div class="panel-body" style="padding:12px 16px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
            <div style="flex:1;">
              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:5px;">
                <span class="badge badge-${sevBadge}" style="font-size:11px;">${sevLabel}</span>
                <span style="font-weight:700;font-size:13px;color:var(--azul);">${p.tipo_manifestacao}</span>
              </div>
              <div style="font-size:12px;color:var(--cinza);margin-bottom:2px;">
                <strong>Local:</strong> ${p.localizacao}
                ${p.dimensao ? ` &nbsp;·&nbsp; <strong>Dim.:</strong> ${p.dimensao}` : ''}
              </div>
              ${p.causa_provavel ? `<div style="font-size:12px;color:var(--cinza);margin-bottom:2px;"><strong>Causa:</strong> ${p.causa_provavel}</div>` : ''}
              ${p.observacoes ? `<div style="font-size:12px;color:var(--cinza-light);">${p.observacoes}</div>` : ''}
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0;">
              ${p.foto_base64 ? `
                <img src="${p.foto_base64}" style="width:52px;height:52px;object-fit:cover;border-radius:6px;cursor:pointer;"
                     onclick="VISTORIA.verFoto('${p.id}')">` : ''}
              <button onclick="VISTORIA.removerPatologia('${p.id}')"
                      style="background:var(--danger-bg);border:none;border-radius:6px;padding:5px 7px;cursor:pointer;color:var(--danger);display:flex;align-items:center;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>`;
  },

  renderPatologiasResumo() {
    const total    = this.currentPatologias.length;
    const criticos = this.currentPatologias.filter(p => p.severidade === 'critico').length;
    const graves   = this.currentPatologias.filter(p => p.severidade === 'grave').length;

    document.getElementById('patologias-resumo').innerHTML = `
      <span style="font-size:13px;color:var(--cinza);">${total} patologia${total !== 1 ? 's' : ''}</span>
      ${criticos > 0 ? `<span class="badge badge-perdido">${criticos} crítico${criticos > 1 ? 's' : ''}</span>` : ''}
      ${graves   > 0 ? `<span class="badge badge-danger">${graves} grave${graves > 1 ? 's' : ''}</span>` : ''}
    `;

    const btn = document.getElementById('btn-gerar-laudo');
    if (btn) btn.disabled = total === 0;
  },

  // ── Modal Patologia ───────────────────────────────────────────────
  abrirModalPatologia(sistema) {
    this.activeSistema = sistema;
    this.fotoBase64 = null;
    document.getElementById('form-patologia').reset();
    document.getElementById('pat-sistema').value = sistema;
    const preview = document.getElementById('foto-preview');
    preview.style.display = 'none';
    preview.src = '';
    UI.openModal('modal-patologia');
    document.getElementById('modal-sistema-label').textContent = this.sistemaLabels[sistema] || sistema;
  },

  fotoChanged(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 900;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else { w = Math.round(w * MAX / h); h = MAX; }
        }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        this.fotoBase64 = canvas.toDataURL('image/jpeg', 0.72);
        const preview = document.getElementById('foto-preview');
        preview.src = this.fotoBase64;
        preview.style.display = 'block';
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  },

  async salvarPatologia() {
    const tipo      = document.getElementById('pat-tipo').value.trim();
    const local     = document.getElementById('pat-localizacao').value.trim();
    const severidade = document.getElementById('pat-severidade').value;

    if (!tipo || !local) { UI.error('Preencha o tipo de manifestação e a localização.'); return; }

    const btn = document.getElementById('btn-salvar-patologia');
    btn.disabled = true;

    try {
      const record = {
        vistoria_id:      this.currentId,
        sistema:          this.activeSistema,
        tipo_manifestacao: tipo,
        localizacao:      local,
        severidade,
        dimensao:         document.getElementById('pat-dimensao').value.trim() || null,
        causa_provavel:   document.getElementById('pat-causa').value.trim() || null,
        observacoes:      document.getElementById('pat-obs').value.trim() || null,
        foto_base64:      this.fotoBase64 || null,
      };

      const saved = await DB.create('vistoria_patologias', record);
      this.currentPatologias.push(saved);
      UI.closeModal('modal-patologia');
      this.renderChecklist();
      UI.success('Patologia registrada!');
    } catch (err) {
      console.error(err);
      UI.error('Erro ao salvar: ' + err.message);
    } finally {
      btn.disabled = false;
    }
  },

  async removerPatologia(id) {
    if (!await UI.confirm('Remover esta patologia?')) return;
    try {
      await sb.from('vistoria_patologias').delete().eq('id', id);
      this.currentPatologias = this.currentPatologias.filter(p => p.id !== id);
      this.renderChecklist();
    } catch (err) {
      UI.error('Erro: ' + err.message);
    }
  },

  verFoto(patId) {
    const p = this.currentPatologias.find(x => x.id === patId);
    if (!p?.foto_base64) return;
    const win = window.open('', '_blank');
    win.document.write(`<html><body style="margin:0;background:#000;display:flex;justify-content:center;align-items:center;min-height:100vh;">
      <img src="${p.foto_base64}" style="max-width:100%;max-height:100vh;object-fit:contain;">
    </body></html>`);
  },

  // ── Gerar Laudo com IA ────────────────────────────────────────────
  async gerarLaudo() {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      UI.error('Configure a chave da API Claude em Configurações → Integração com IA.');
      return;
    }
    if (!this.currentPatologias.length) {
      UI.error('Registre ao menos uma patologia antes de gerar o laudo.');
      return;
    }

    this.showView('processando');
    this.animarProcessando();

    try {
      const vistoria = await DB.get('vistorias', this.currentId);
      const prompt   = this.buildPrompt(vistoria, this.currentPatologias);
      const texto    = await this.callClaude(apiKey, prompt);
      const resultado = this.parseResposta(texto);

      // Salvar resultado
      const totais = this.calcTotais(resultado);
      await sb.from('vistoria_resultados').upsert({
        vistoria_id: this.currentId,
        resultado_json: resultado,
        ...totais,
        updated_at: new Date().toISOString(),
      });

      // Atualizar status
      await DB.update('vistorias', this.currentId, {
        status: 'concluida',
        estado_geral: resultado.agente01?.estado_geral || 'degradado',
      });

      this.currentResultado = resultado;
      this.mostrarResultado(resultado);
      UI.success('Laudo gerado com sucesso!');
    } catch (err) {
      console.error(err);
      UI.error('Erro ao gerar laudo: ' + err.message);
      this.showView('checklist');
    }
  },

  animarProcessando() {
    const steps = [
      'Agente 01 — Vistoria e Diagnóstico',
      'Agente 02 — Classificação dos Serviços',
      'Agente 03 — Descrição Técnica',
      'Agente 04 — Plano de Execução',
      'Agente 05 — Orçamento Tabelado',
    ];
    let i = 0;
    const el = document.getElementById('processando-step');
    if (!el) return;
    el.textContent = steps[0];
    const iv = setInterval(() => {
      i++;
      if (i >= steps.length) { clearInterval(iv); return; }
      if (el) el.textContent = steps[i];
    }, 3500);
  },

  calcTotais(r) {
    const a5 = r.agente05 || {};
    return {
      total_p1: a5.subtotal_a || 0,
      total_p2: a5.subtotal_b || 0,
      total_preventivo_anual: a5.subtotal_c_anual || 0,
      total_reforma: a5.subtotal_d || 0,
      total_geral: a5.total_geral || 0,
    };
  },

  buildPrompt(vistoria, patologias) {
    const patsText = patologias.map((p, i) => [
      `${i + 1}. Sistema: ${this.sistemaLabels[p.sistema] || p.sistema}`,
      `   Tipo: ${p.tipo_manifestacao} | Local: ${p.localizacao}`,
      `   Dimensão: ${p.dimensao || 'não informada'} | Causa: ${p.causa_provavel || 'a determinar'}`,
      `   Severidade: ${p.severidade.toUpperCase()} | Obs: ${p.observacoes || '-'}`,
    ].join('\n')).join('\n\n');

    return `Você é um squad técnico especializado em reforma e manutenção predial (NBR 5674, NBR 16280, NBR 9575).
Analise os dados da vistoria abaixo e execute os 5 agentes técnicos, retornando APENAS um JSON válido, sem texto fora do JSON.

DADOS DA VISTORIA:
Imóvel: ${vistoria.imovel_nome}
Tipo: ${vistoria.imovel_tipo}
Endereço: ${vistoria.imovel_endereco || 'não informado'} — ${vistoria.imovel_cidade || 'Criciúma/SC'}
Idade: ${vistoria.imovel_idade ? vistoria.imovel_idade + ' anos' : 'não informada'}
Pavimentos: ${vistoria.imovel_pavimentos || 'não informado'}
Área: ${vistoria.imovel_area ? vistoria.imovel_area + ' m²' : 'não informada'}
Sistemas construtivos: ${vistoria.sistemas_construtivos || 'não informado'}
Data da vistoria: ${vistoria.data_vistoria}
Observações: ${vistoria.observacoes || 'nenhuma'}

PATOLOGIAS IDENTIFICADAS (${patologias.length} registros):
${patsText}

Referência de valores: mercado Sul do Brasil. BDI: 28% sobre mão de obra.

Retorne SOMENTE o JSON com esta estrutura exata (sem markdown):
{
  "agente01": {
    "estado_geral": "bom|regular|degradado|critico",
    "conclusao": "resumo do estado da edificação",
    "sistemas": {
      "estrutural": "avaliação do sistema",
      "fachadas": "avaliação do sistema",
      "cobertura": "avaliação do sistema",
      "impermeabilizacao": "avaliação do sistema",
      "hidraulico": "avaliação do sistema",
      "eletrico": "avaliação do sistema",
      "esquadrias": "avaliação do sistema",
      "areas_comuns": "avaliação do sistema"
    }
  },
  "agente02": {
    "servicos": [
      {
        "nome": "Nome do serviço",
        "sistema": "nome do sistema",
        "categoria": "corretiva_urgente|corretiva|preventiva|reforma",
        "prioridade": "P1|P2|P3",
        "norma": "NBR XXXXX",
        "periodicidade": "mensal|trimestral|semestral|anual|null"
      }
    ]
  },
  "agente03": {
    "descricoes": [
      {
        "nome": "Nome do serviço",
        "escopo": "o que será feito",
        "metodo": "passo a passo resumido",
        "materiais": "especificação técnica dos materiais",
        "unidade": "m²|ml|m³|vb|un|h",
        "equipamentos": "equipamentos e andaimes",
        "epi_epc": "EPIs obrigatórios",
        "interfere_uso": true,
        "descricao_interferencia": "descrição ou null"
      }
    ]
  },
  "agente04": {
    "etapas": [
      {
        "numero": 1,
        "nome": "Nome da etapa",
        "servicos": ["serviço 1", "serviço 2"],
        "depende_de": null,
        "duracao_dias": 10,
        "interfere_uso": true,
        "descricao_interferencia": "descrição ou null"
      }
    ],
    "cronograma_resumo": ["Semanas 1-2: ...", "Semanas 3-4: ..."],
    "interdicoes": ["interdição 1", "interdição 2"],
    "requer_art": ["serviço que requer ART/RRT"],
    "regime_recomendado": "obra contínua|fim de semana|noturna"
  },
  "agente05": {
    "tabelaA": [
      {
        "sistema": "Sistema",
        "servico": "Nome do serviço",
        "unidade": "m²",
        "quantidade": 100,
        "material_unit": 50.00,
        "mao_obra_unit": 80.00,
        "total": 13000.00
      }
    ],
    "tabelaB": [],
    "tabelaC": [
      {
        "sistema": "Sistema",
        "servico": "Nome do serviço",
        "periodicidade": "anual",
        "unidade": "vb",
        "quantidade_ciclo": 1,
        "custo_ciclo": 2000.00,
        "custo_anual": 2000.00
      }
    ],
    "tabelaD": [],
    "subtotal_a": 0.00,
    "subtotal_b": 0.00,
    "subtotal_c_anual": 0.00,
    "subtotal_d": 0.00,
    "mobilizacao": 0.00,
    "art_rrt": 0.00,
    "bdi_valor": 0.00,
    "total_geral": 0.00
  },
  "resumo": {
    "investimento": {
      "urgente": 0.00,
      "corretivo": 0.00,
      "preventivo_anual": 0.00,
      "reforma": 0.00,
      "total": 0.00
    },
    "prazo_corretivas": "X dias úteis",
    "custo_manutencao_anual": 0.00,
    "servicos_art": ["serviços que requerem ART/RRT"],
    "alertas_regulatorios": ["alerta 1", "alerta 2"],
    "riscos": ["risco 1 se não executar urgentes", "risco 2", "risco 3"],
    "proximos_passos": ["passo 1", "passo 2", "passo 3"]
  }
}`;
  },

  async callClaude(apiKey, prompt) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `Erro na API (${response.status})`);
    }

    const data = await response.json();
    return data.content[0].text;
  },

  parseResposta(text) {
    let s = text.trim()
      .replace(/^```json\s*/i, '').replace(/\s*```$/i, '')
      .replace(/^```\s*/i, '').replace(/\s*```$/i, '');
    try {
      return JSON.parse(s);
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) return JSON.parse(m[0]);
      throw new Error('Não foi possível processar a resposta da IA. Tente novamente.');
    }
  },

  // ── Resultado ─────────────────────────────────────────────────────
  mostrarResultado(resultado) {
    this.currentResultado = resultado;
    this.showView('resultado');
    this.switchResultTab('diagnostico');
  },

  switchResultTab(tab) {
    this.activeResultTab = tab;
    document.querySelectorAll('#resultado-tabs .tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    const renders = {
      diagnostico:  () => this.renderDiagnostico(this.currentResultado),
      classificacao:() => this.renderClassificacao(this.currentResultado),
      plano:        () => this.renderPlano(this.currentResultado),
      orcamento:    () => this.renderOrcamento(this.currentResultado),
      resumo:       () => this.renderResumo(this.currentResultado),
    };
    document.getElementById('resultado-content').innerHTML = (renders[tab] || (() => ''))();
  },

  renderDiagnostico(r) {
    const a1 = r.agente01 || {};
    const [ecls, elbl] = this.estadoInfo(a1.estado_geral || 'degradado');
    const sev = { critico:0, grave:0, moderado:0, leve:0 };
    this.currentPatologias.forEach(p => { if (sev[p.severidade] !== undefined) sev[p.severidade]++; });

    const sistemasRows = Object.entries(a1.sistemas || {}).map(([k, v]) => `
      <tr style="border-top:1px solid var(--cinza-bg);">
        <td style="padding:10px 14px;font-weight:600;font-size:13px;width:160px;white-space:nowrap;">${this.sistemaLabels[k] || k}</td>
        <td style="padding:10px 14px;font-size:13px;color:var(--cinza);">${v}</td>
      </tr>`).join('');

    return `
      <div class="kpi-grid" style="margin-bottom:20px;">
        <div class="kpi-card"><div class="kpi-label">Estado Geral</div>
          <div class="kpi-value" style="font-size:16px;"><span class="badge badge-${ecls}">${elbl}</span></div>
        </div>
        <div class="kpi-card"><div class="kpi-label">Crítico</div><div class="kpi-value danger">${sev.critico}</div></div>
        <div class="kpi-card"><div class="kpi-label">Grave</div><div class="kpi-value warning">${sev.grave}</div></div>
        <div class="kpi-card"><div class="kpi-label">Total</div><div class="kpi-value">${this.currentPatologias.length}</div></div>
      </div>
      ${a1.conclusao ? `
        <div class="panel" style="margin-bottom:16px;border-left:3px solid var(--laranja);">
          <div class="panel-body" style="padding:14px 18px;">
            <p style="font-size:14px;line-height:1.75;color:var(--azul);margin:0;">${a1.conclusao}</p>
          </div>
        </div>` : ''}
      <div class="panel">
        <div class="panel-header"><h3>Avaliação por Sistema</h3></div>
        <div class="panel-body" style="padding:0;">
          <table style="width:100%;border-collapse:collapse;"><tbody>${sistemasRows}</tbody></table>
        </div>
      </div>`;
  },

  renderClassificacao(r) {
    const servicos = r.agente02?.servicos || [];
    const p1   = servicos.filter(s => s.prioridade === 'P1');
    const p2   = servicos.filter(s => s.prioridade === 'P2');
    const prev = servicos.filter(s => s.categoria === 'preventiva');
    const p3   = servicos.filter(s => s.prioridade === 'P3');

    const tabela = (lista, isPrev) => {
      if (!lista.length) return '<p style="padding:12px 16px;font-size:13px;color:var(--cinza-light);">Nenhum serviço nesta categoria.</p>';
      return `<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;min-width:500px;">
        <thead><tr style="background:var(--bg);">
          <th style="padding:9px 14px;text-align:left;font-size:11px;font-weight:700;letter-spacing:.5px;">SERVIÇO</th>
          <th style="padding:9px 14px;text-align:left;font-size:11px;font-weight:700;">SISTEMA</th>
          <th style="padding:9px 14px;text-align:left;font-size:11px;font-weight:700;">NORMA</th>
          ${isPrev ? '<th style="padding:9px 14px;text-align:left;font-size:11px;font-weight:700;">PERIOD.</th>' : ''}
        </tr></thead>
        <tbody>
          ${lista.map(s => `
            <tr style="border-top:1px solid var(--cinza-bg);">
              <td style="padding:9px 14px;font-size:13px;font-weight:600;">${s.nome}</td>
              <td style="padding:9px 14px;font-size:12px;color:var(--cinza);">${this.sistemaLabels[s.sistema] || s.sistema}</td>
              <td style="padding:9px 14px;font-size:12px;color:var(--cinza);">${s.norma || '—'}</td>
              ${isPrev ? `<td style="padding:9px 14px;font-size:12px;color:var(--cinza);">${s.periodicidade || '—'}</td>` : ''}
            </tr>`).join('')}
        </tbody>
      </table></div>`;
    };

    return `
      <div class="panel" style="margin-bottom:14px;">
        <div class="panel-header"><h3>P1 — Corretiva Urgente</h3><span class="badge badge-perdido">${p1.length}</span></div>
        <div class="panel-body" style="padding:0;">${tabela(p1, false)}</div>
      </div>
      <div class="panel" style="margin-bottom:14px;">
        <div class="panel-header"><h3>P2 — Corretiva</h3><span class="badge badge-warning">${p2.length}</span></div>
        <div class="panel-body" style="padding:0;">${tabela(p2, false)}</div>
      </div>
      <div class="panel" style="margin-bottom:14px;">
        <div class="panel-header"><h3>Preventiva Programada</h3><span class="badge badge-aprovado">${prev.length}</span></div>
        <div class="panel-body" style="padding:0;">${tabela(prev, true)}</div>
      </div>
      ${p3.length ? `<div class="panel">
        <div class="panel-header"><h3>P3 — Reforma / Melhoria</h3><span class="badge badge-info">${p3.length}</span></div>
        <div class="panel-body" style="padding:0;">${tabela(p3, false)}</div>
      </div>` : ''}`;
  },

  renderPlano(r) {
    const a4 = r.agente04 || {};
    const etapas      = a4.etapas || [];
    const cronograma  = a4.cronograma_resumo || [];
    const interdicoes = a4.interdicoes || [];
    const art         = a4.requer_art || [];

    return `
      <div class="panel" style="margin-bottom:14px;">
        <div class="panel-header"><h3>Sequência de Execução</h3></div>
        <div class="panel-body" style="padding:0;overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;min-width:480px;">
            <thead><tr style="background:var(--bg);">
              <th style="padding:9px 14px;font-size:11px;width:32px;">#</th>
              <th style="padding:9px 14px;font-size:11px;text-align:left;">ETAPA</th>
              <th style="padding:9px 14px;font-size:11px;text-align:right;white-space:nowrap;">DURAÇÃO</th>
              <th style="padding:9px 14px;font-size:11px;text-align:left;">INTERFERÊNCIA</th>
            </tr></thead>
            <tbody>
              ${etapas.map(e => `
                <tr style="border-top:1px solid var(--cinza-bg);">
                  <td style="padding:10px 14px;font-weight:800;color:var(--laranja);font-size:14px;">${e.numero}</td>
                  <td style="padding:10px 14px;">
                    <div style="font-weight:600;font-size:13px;">${e.nome}</div>
                    ${e.servicos?.length ? `<div style="font-size:11px;color:var(--cinza);margin-top:2px;">${e.servicos.join(' · ')}</div>` : ''}
                  </td>
                  <td style="padding:10px 14px;font-size:13px;text-align:right;white-space:nowrap;">${e.duracao_dias}d</td>
                  <td style="padding:10px 14px;font-size:12px;color:var(--cinza);">${e.interfere_uso ? (e.descricao_interferencia || 'Sim') : 'Não'}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
      ${cronograma.length ? `
        <div class="panel" style="margin-bottom:14px;">
          <div class="panel-header"><h3>Cronograma Resumido</h3></div>
          <div class="panel-body">
            ${cronograma.map(c => `<p style="font-size:13px;color:var(--cinza);margin:0 0 8px;padding-left:12px;border-left:3px solid var(--laranja);">${c}</p>`).join('')}
          </div>
        </div>` : ''}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;flex-wrap:wrap;">
        ${interdicoes.length ? `<div class="panel"><div class="panel-header"><h3>Interdições</h3></div>
          <div class="panel-body">${interdicoes.map(i => `<p style="font-size:13px;color:var(--cinza);margin:0 0 5px;">• ${i}</p>`).join('')}</div></div>` : ''}
        ${art.length ? `<div class="panel"><div class="panel-header"><h3>Requer ART/RRT</h3></div>
          <div class="panel-body">${art.map(a => `<p style="font-size:13px;color:var(--cinza);margin:0 0 5px;">• ${a}</p>`).join('')}</div></div>` : ''}
      </div>
      ${a4.regime_recomendado ? `
        <div class="panel" style="margin-top:14px;">
          <div class="panel-body" style="padding:12px 16px;">
            <span style="font-size:13px;color:var(--cinza);">Regime recomendado: </span>
            <strong style="font-size:13px;">${a4.regime_recomendado}</strong>
          </div>
        </div>` : ''}`;
  },

  renderOrcamento(r) {
    const a5 = r.agente05 || {};

    const tabela = (items, titulo, badge, isPrev) => {
      if (!items?.length) return '';
      const totalCol = isPrev ? 'custo_anual' : 'total';
      const subtotal = items.reduce((s, i) => s + (i[totalCol] || 0), 0);
      return `
        <div class="panel" style="margin-bottom:14px;">
          <div class="panel-header"><h3>${titulo}</h3><span class="badge ${badge}">${UI.moeda(subtotal)}</span></div>
          <div class="panel-body" style="padding:0;overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;min-width:560px;">
              <thead><tr style="background:var(--bg);">
                <th style="padding:8px 12px;font-size:10px;text-align:left;">SISTEMA</th>
                <th style="padding:8px 12px;font-size:10px;text-align:left;">SERVIÇO</th>
                <th style="padding:8px 12px;font-size:10px;text-align:center;">UNID.</th>
                <th style="padding:8px 12px;font-size:10px;text-align:right;">QTD.</th>
                ${isPrev
                  ? `<th style="padding:8px 12px;font-size:10px;text-align:left;">PERIOD.</th>
                     <th style="padding:8px 12px;font-size:10px;text-align:right;">CUSTO/CICLO</th>`
                  : `<th style="padding:8px 12px;font-size:10px;text-align:right;">MAT. UNIT.</th>
                     <th style="padding:8px 12px;font-size:10px;text-align:right;">M.O. UNIT.</th>`}
                <th style="padding:8px 12px;font-size:10px;text-align:right;">${isPrev ? 'ANUAL' : 'TOTAL'}</th>
              </tr></thead>
              <tbody>
                ${items.map(i => `
                  <tr style="border-top:1px solid var(--cinza-bg);">
                    <td style="padding:8px 12px;font-size:11px;color:var(--cinza);">${i.sistema || '—'}</td>
                    <td style="padding:8px 12px;font-size:12px;font-weight:600;">${i.servico || '—'}</td>
                    <td style="padding:8px 12px;font-size:11px;text-align:center;">${i.unidade || '—'}</td>
                    <td style="padding:8px 12px;font-size:11px;text-align:right;">${isPrev ? (i.quantidade_ciclo ?? '—') : (i.quantidade ?? '—')}</td>
                    ${isPrev
                      ? `<td style="padding:8px 12px;font-size:11px;">${i.periodicidade || '—'}</td>
                         <td style="padding:8px 12px;font-size:11px;text-align:right;">${UI.moeda(i.custo_ciclo || 0)}</td>`
                      : `<td style="padding:8px 12px;font-size:11px;text-align:right;">${UI.moeda(i.material_unit || 0)}</td>
                         <td style="padding:8px 12px;font-size:11px;text-align:right;">${UI.moeda(i.mao_obra_unit || 0)}</td>`}
                    <td style="padding:8px 12px;font-size:12px;font-weight:700;text-align:right;">${UI.moeda(i[totalCol] || 0)}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>`;
    };

    return `
      ${tabela(a5.tabelaA, 'Tabela A — Corretivas Urgentes (P1)', 'badge-perdido', false)}
      ${tabela(a5.tabelaB, 'Tabela B — Corretivas (P2)', 'badge-warning', false)}
      ${tabela(a5.tabelaC, 'Tabela C — Preventiva Programada', 'badge-aprovado', true)}
      ${tabela(a5.tabelaD, 'Tabela D — Reforma e Melhorias (P3)', 'badge-info', false)}
      <div class="panel">
        <div class="panel-header"><h3>Totais</h3></div>
        <div class="panel-body" style="padding:0;">
          <table style="width:100%;border-collapse:collapse;">
            ${a5.subtotal_a   ? `<tr style="border-top:1px solid var(--cinza-bg);"><td style="padding:10px 16px;font-size:13px;">P1 — Corretivas urgentes</td><td style="padding:10px 16px;text-align:right;font-size:13px;">${UI.moeda(a5.subtotal_a)}</td></tr>` : ''}
            ${a5.subtotal_b   ? `<tr style="border-top:1px solid var(--cinza-bg);"><td style="padding:10px 16px;font-size:13px;">P2 — Corretivas</td><td style="padding:10px 16px;text-align:right;font-size:13px;">${UI.moeda(a5.subtotal_b)}</td></tr>` : ''}
            ${a5.subtotal_d   ? `<tr style="border-top:1px solid var(--cinza-bg);"><td style="padding:10px 16px;font-size:13px;">P3 — Reforma</td><td style="padding:10px 16px;text-align:right;font-size:13px;">${UI.moeda(a5.subtotal_d)}</td></tr>` : ''}
            ${a5.mobilizacao  ? `<tr style="border-top:1px solid var(--cinza-bg);"><td style="padding:10px 16px;font-size:13px;">Mobilização/Desmobilização</td><td style="padding:10px 16px;text-align:right;font-size:13px;">${UI.moeda(a5.mobilizacao)}</td></tr>` : ''}
            ${a5.art_rrt      ? `<tr style="border-top:1px solid var(--cinza-bg);"><td style="padding:10px 16px;font-size:13px;">ART/RRT</td><td style="padding:10px 16px;text-align:right;font-size:13px;">${UI.moeda(a5.art_rrt)}</td></tr>` : ''}
            ${a5.bdi_valor    ? `<tr style="border-top:1px solid var(--cinza-bg);"><td style="padding:10px 16px;font-size:13px;">BDI (28% s/ M.O.)</td><td style="padding:10px 16px;text-align:right;font-size:13px;">${UI.moeda(a5.bdi_valor)}</td></tr>` : ''}
            <tr style="background:var(--azul);">
              <td style="padding:13px 16px;font-size:15px;font-weight:800;color:#fff;font-family:var(--font-heading);">TOTAL GERAL</td>
              <td style="padding:13px 16px;text-align:right;font-size:15px;font-weight:800;color:var(--laranja);font-family:var(--font-heading);">${UI.moeda(a5.total_geral || 0)}</td>
            </tr>
          </table>
        </div>
      </div>
      ${a5.subtotal_c_anual ? `
        <div style="margin-top:12px;padding:12px 16px;background:var(--success-bg);border-radius:var(--radius-sm);border-left:3px solid var(--success);">
          <div style="font-size:13px;color:var(--success);font-weight:700;">Manutenção preventiva anual: ${UI.moeda(a5.subtotal_c_anual)}</div>
          <div style="font-size:12px;color:var(--cinza);margin-top:2px;">Custo anual estimado após execução das corretivas</div>
        </div>` : ''}`;
  },

  renderResumo(r) {
    const res = r.resumo || {};
    const inv = res.investimento || {};

    return `
      <div class="kpi-grid" style="margin-bottom:20px;">
        ${inv.urgente         ? `<div class="kpi-card"><div class="kpi-label">Urgente (P1)</div><div class="kpi-value danger">${UI.moeda(inv.urgente)}</div></div>` : ''}
        ${inv.corretivo       ? `<div class="kpi-card"><div class="kpi-label">Corretivo (P2)</div><div class="kpi-value warning">${UI.moeda(inv.corretivo)}</div></div>` : ''}
        ${inv.preventivo_anual? `<div class="kpi-card"><div class="kpi-label">Preventivo/ano</div><div class="kpi-value success">${UI.moeda(inv.preventivo_anual)}</div></div>` : ''}
        ${inv.total           ? `<div class="kpi-card"><div class="kpi-label">Total Geral</div><div class="kpi-value">${UI.moeda(inv.total)}</div></div>` : ''}
      </div>
      ${res.prazo_corretivas ? `
        <div class="panel" style="margin-bottom:14px;">
          <div class="panel-body" style="padding:14px 16px;display:flex;align-items:center;gap:12px;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--laranja)" stroke-width="2" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <div>
              <div style="font-size:11px;color:var(--cinza);text-transform:uppercase;letter-spacing:.5px;">Prazo total das corretivas</div>
              <div style="font-weight:700;font-size:16px;color:var(--azul);">${res.prazo_corretivas}</div>
            </div>
          </div>
        </div>` : ''}
      ${res.riscos?.length ? `
        <div class="panel" style="margin-bottom:14px;border-left:3px solid var(--danger);">
          <div class="panel-header"><h3 style="color:var(--danger);">Riscos se não executar corretivas</h3></div>
          <div class="panel-body">
            ${res.riscos.map(risco => `
              <div style="display:flex;gap:10px;margin-bottom:10px;align-items:flex-start;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2" style="flex-shrink:0;margin-top:1px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <p style="font-size:13px;color:var(--cinza);margin:0;">${risco}</p>
              </div>`).join('')}
          </div>
        </div>` : ''}
      ${res.alertas_regulatorios?.length ? `
        <div class="panel" style="margin-bottom:14px;border-left:3px solid var(--warning);">
          <div class="panel-header"><h3 style="color:var(--warning);">Alertas Regulatórios</h3></div>
          <div class="panel-body">
            ${res.alertas_regulatorios.map(a => `<p style="font-size:13px;color:var(--cinza);margin:0 0 6px;padding-left:12px;border-left:2px solid var(--warning);">• ${a}</p>`).join('')}
          </div>
        </div>` : ''}
      ${res.servicos_art?.length ? `
        <div class="panel" style="margin-bottom:14px;">
          <div class="panel-header"><h3>Requer ART/RRT</h3></div>
          <div class="panel-body">
            ${res.servicos_art.map(s => `<p style="font-size:13px;color:var(--cinza);margin:0 0 5px;">• ${s}</p>`).join('')}
          </div>
        </div>` : ''}
      ${res.proximos_passos?.length ? `
        <div class="panel" style="margin-bottom:20px;">
          <div class="panel-header"><h3>Próximos Passos</h3></div>
          <div class="panel-body">
            ${res.proximos_passos.map((p, i) => `
              <div style="display:flex;gap:12px;margin-bottom:10px;align-items:flex-start;">
                <span style="background:var(--laranja);color:#fff;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;">${i + 1}</span>
                <p style="font-size:13px;color:var(--cinza);margin:2px 0 0;">${p}</p>
              </div>`).join('')}
          </div>
        </div>` : ''}
      <div style="display:flex;gap:12px;flex-wrap:wrap;">
        <button class="btn btn-primary" onclick="window.print()">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Imprimir / PDF
        </button>
        <button class="btn btn-secondary" onclick="VISTORIA.converterEmLead()">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          Criar Lead no CRM
        </button>
      </div>`;
  },

  // ── Utilitários ───────────────────────────────────────────────────
  getApiKey() {
    return localStorage.getItem('dibreva_claude_key') || '';
  },

  async converterEmLead() {
    if (!this.currentId) return;
    try {
      const v = await DB.get('vistorias', this.currentId);
      const total = this.currentResultado?.agente05?.total_geral || 0;

      await DB.create('leads', {
        condominio:    v.imovel_nome,
        cidade:        v.imovel_cidade || 'Criciúma',
        tipo_servico:  'Restauração predial',
        valor_estimado: total,
        status:        'visita_tecnica',
        proxima_acao:  'Enviar proposta com base no laudo técnico',
        observacoes:   `Lead gerado via vistoria técnica de ${UI.data(v.data_vistoria)}.`,
        probabilidade: 55,
      });

      UI.success('Lead criado no CRM!');
      setTimeout(() => { window.location.href = 'crm.html'; }, 1400);
    } catch (err) {
      UI.error('Erro ao criar lead: ' + err.message);
    }
  },
};
