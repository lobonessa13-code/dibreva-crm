// ===== Templates dos Documentos DIBREVA =====
// Renderização determinística: a IA entrega DADOS (JSON), este arquivo entrega o HTML A4.
// Portado dos modelos de referência gerados no terminal (orçamento Residencial Helena,
// contrato e aditivo Residencial Trier, recibo modelo). Não alterar o padrão visual aqui
// sem alinhar com os modelos em /Documents/DIBREVA/Documentos.

const DocTemplates = (() => {

  // ---------------------------------------------------------------
  // DADOS FIXOS DA EMPRESA
  // ---------------------------------------------------------------
  const EMPRESA = {
    marca: 'DIBREVA',
    razao: 'DIBREVA LTDA',
    subtitulo: 'MANUTENÇÃO &amp; RESTAURAÇÃO PREDIAL',
    subtituloPlain: 'Manutenção & Restauração Predial',
    cnpj: '15.332.344/0001-75',
    endereco: 'Rua José do Patrocínio, 35',
    bairro: 'Centro',
    cidade: 'Criciúma',
    uf: 'SC',
    cep: '88801-680',
    telefone: '(48) 99635-0627',
    email: 'dibrevaltda@gmail.com',
    instagram: '@dibreva',
    facebook: '/dibreva',
    responsavel: 'Vanessa de Souza Lobo',
    responsavelCurto: 'Vanessa Lobo',
    cauOrcamento: 'CAU/SC A185622-7',   // usado na proposta (padrão dos orçamentos)
    cauJuridico: 'CAU/SC A196989-7',    // usado em contrato, aditivo e recibo
    cpf: '009.742.449-88',
    banco: 'Nubank (Banco 260)',
    agencia: '0001',
    conta: '59904590-9',
    pix: '15.332.344/0001-75',
    tagline: 'Devolvemos o estado de arte ao seu patrimônio.',
    testemunhas: [
      { nome: 'Bruna Marques dos Santos', cpf: '076.832.529-30' },
      { nome: 'Simone de Souza Lobo', cpf: '027.053.969-77' },
    ],
    documentos: ['Seguro de Vida em Grupo', 'RRT (CAU)', 'NR-35 (Altura)', 'NR-18 (Segurança)', 'PCMSO', 'PGR e LTCAT'],
    tintas: ['RENNER', 'SHERWIN-WILLIAMS', 'CORAL', 'GOLDEN'],
  };

  // ---------------------------------------------------------------
  // UTILITÁRIOS
  // ---------------------------------------------------------------
  const esc = (s) => String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // Texto simples com **negrito** permitido
  const rich = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  const num = (v) => {
    const n = typeof v === 'string' ? parseFloat(v.replace(/\./g, '').replace(',', '.')) : Number(v);
    return isNaN(n) ? 0 : n;
  };

  const moeda = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num(v));
  const moedaCurta = (v) => 'R$ ' + new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(Math.round(num(v)));
  const round2 = (v) => Math.round(num(v) * 100) / 100;

  const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  function parseISO(iso) {
    if (!iso) return null;
    const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) { const d = new Date(iso); return isNaN(d) ? null : d; }
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  const hojeISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const dataBR = (iso) => { const d = parseISO(iso); return d ? `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}` : ''; };
  const dataLonga = (iso, capitalizar = false) => {
    const d = parseISO(iso); if (!d) return '';
    const mes = capitalizar ? cap(MESES[d.getMonth()]) : MESES[d.getMonth()];
    return `${String(d.getDate()).padStart(2,'0')} de ${mes} de ${d.getFullYear()}`;
  };
  const mesAno = (iso) => { const d = parseISO(iso); return d ? `${cap(MESES[d.getMonth()])} ${d.getFullYear()}` : ''; };
  const addMeses = (iso, n) => {
    const d = parseISO(iso); if (!d) return '';
    const dia = d.getDate();
    const r = new Date(d.getFullYear(), d.getMonth() + n, 1);
    const ultimo = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
    r.setDate(Math.min(dia, ultimo));
    return `${r.getFullYear()}-${String(r.getMonth()+1).padStart(2,'0')}-${String(r.getDate()).padStart(2,'0')}`;
  };

  const ORDINAIS_F = ['', '1ª', '2ª', '3ª', '4ª', '5ª', '6ª', '7ª', '8ª', '9ª', '10ª', '11ª', '12ª', '13ª', '14ª', '15ª', '16ª', '17ª', '18ª', '19ª', '20ª', '21ª', '22ª', '23ª', '24ª', '25ª', '26ª', '27ª', '28ª', '29ª', '30ª', '31ª', '32ª', '33ª', '34ª', '35ª', '36ª'];
  const ordF = (n) => ORDINAIS_F[n] || `${n}ª`;

  // Valor por extenso (pt-BR)
  function extenso(valor) {
    const U = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
    const D = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
    const C = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
    const ate999 = (n) => {
      if (n === 0) return '';
      if (n === 100) return 'cem';
      const c = Math.floor(n / 100), r = n % 100;
      const p = [];
      if (c) p.push(C[c]);
      if (r > 0 && r < 20) p.push(U[r]);
      else if (r >= 20) { const d = Math.floor(r / 10), u = r % 10; p.push(D[d] + (u ? ' e ' + U[u] : '')); }
      return p.join(' e ');
    };
    const v = round2(valor);
    const inteiro = Math.floor(v);
    const cent = Math.round((v - inteiro) * 100);
    const mi = Math.floor(inteiro / 1e6), mil = Math.floor((inteiro % 1e6) / 1000), resto = inteiro % 1000;
    let s = '';
    if (mi) s += mi === 1 ? 'um milhão' : ate999(mi) + ' milhões';
    if (mil) {
      if (s) s += (resto === 0 && mil ? ' e ' : ', ');
      s += mil === 1 ? 'mil' : ate999(mil) + ' mil';
    }
    if (resto) {
      if (s) s += (resto < 100 || resto % 100 === 0) ? ' e ' : ', ';
      s += ate999(resto);
    }
    if (inteiro === 0) s = 'zero';
    s += inteiro === 1 ? ' real' : ' reais';
    if (cent) s += ` e ${ate999(cent)} ${cent === 1 ? 'centavo' : 'centavos'}`;
    return s;
  }

  const lines = (texto, porLinha) => Math.max(1, Math.ceil(String(texto || '').length / porLinha));
  const MM = 3.7795; // px por mm a 96dpi

  // ---------------------------------------------------------------
  // MOTOR DE PAGINAÇÃO
  // Cada bloco: { html, h (altura estimada em mm) }. Em `alturas` chegam as
  // alturas REAIS em px medidas no navegador (ver medirEMontar); sem elas,
  // usa a estimativa em mm convertida para px.
  // ---------------------------------------------------------------
  function distribuir(blocos, capacidadePx, alturas) {
    const grupos = [];
    let atual = [], usado = 0;
    blocos.forEach((b, i) => {
      if (!b || !b.html) return;
      const h = alturas && alturas[i] != null ? alturas[i] : b.h * MM;
      if (usado + h > capacidadePx && atual.length > 0) { grupos.push(atual); atual = []; usado = 0; }
      atual.push(i);
      usado += h;
    });
    if (atual.length) grupos.push(atual);
    return grupos;
  }

  function paginar(blocos, capacidadePx, alturas) {
    return distribuir(blocos, capacidadePx, alturas).map(g => g.map(i => blocos[i].html).join('\n'));
  }

  // ---------------------------------------------------------------
  // CSS COMPARTILHADO (A4)
  // ---------------------------------------------------------------
  const CSS_BASE = `
    :root { --laranja:#D46250; --laranja-hover:#D37E53; --azul-escuro:#1D2A3A; --cinza:#A6B0B3; --cinza-claro:#F2F4F5; --branco:#FFFFFF; --texto:#2D3436; --texto-leve:#636E72; }
    * { margin:0; padding:0; box-sizing:border-box; }
    @page { size: A4 portrait; margin: 0; }
    body { font-family:'Montserrat','Calibri',sans-serif; color:var(--texto); line-height:1.6; background:#e8e8e8; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    @media print { body { background:white; } .page { margin:0 !important; box-shadow:none !important; } }
    .page { width:210mm; height:297mm; margin:10px auto; background:var(--branco); box-shadow:0 4px 20px rgba(0,0,0,0.15); overflow:hidden; position:relative; page-break-after:always; }
    .page:last-child { page-break-after:auto; }
    .capa { background:var(--azul-escuro); display:flex; flex-direction:column; justify-content:center; align-items:center; }
    .capa::before { content:''; position:absolute; top:-50%; right:-30%; width:80%; height:200%; background:linear-gradient(135deg, rgba(212,98,80,0.08) 0%, rgba(212,98,80,0.02) 100%); transform:rotate(-15deg); }
    .capa::after { content:''; position:absolute; bottom:0; left:0; right:0; height:6px; background:var(--laranja); }
    .capa-logo svg { width:140px; height:auto; }
    .capa-empresa { font-size:48px; font-weight:800; color:var(--branco); letter-spacing:8px; margin-top:15px; }
    .capa-subtitulo { font-size:13px; font-weight:300; color:var(--cinza); letter-spacing:4px; margin-bottom:50px; }
    .capa-divider { width:80px; height:3px; background:var(--laranja); margin-bottom:50px; }
    .capa-tipo { font-size:11px; font-weight:600; color:var(--laranja); letter-spacing:6px; text-transform:uppercase; margin-bottom:12px; }
    .capa-titulo { font-size:26px; font-weight:700; color:var(--branco); text-align:center; margin-bottom:8px; line-height:1.3; }
    .capa-cliente { font-size:30px; font-weight:700; color:var(--branco); text-align:center; margin-bottom:8px; padding:0 40px; }
    .capa-cliente.secundario { font-size:22px; font-weight:600; color:var(--laranja-hover); margin-top:20px; }
    .capa-local { font-size:14px; font-weight:300; color:var(--cinza); letter-spacing:2px; text-align:center; padding:0 40px; }
    .capa-data { position:absolute; bottom:40px; font-size:12px; color:var(--cinza); letter-spacing:2px; }
    .capa-ref { position:absolute; top:30px; right:40px; font-size:10px; color:rgba(166,176,179,0.5); letter-spacing:1px; }
    .page-header { background:var(--azul-escuro); padding:20px 40px; display:flex; justify-content:space-between; align-items:center; }
    .page-header::after { content:''; position:absolute; top:64px; left:0; right:0; height:4px; background:var(--laranja); }
    .header-logo-text { font-size:20px; font-weight:800; color:var(--branco); letter-spacing:3px; }
    .header-sub { font-size:8px; color:var(--cinza); letter-spacing:2px; font-weight:300; }
    .header-page { font-size:10px; color:var(--cinza); letter-spacing:1px; }
    .content { padding:30px 40px 22px; }
    .section-tag { display:inline-block; background:var(--laranja); color:var(--branco); font-size:9px; font-weight:700; letter-spacing:3px; text-transform:uppercase; padding:4px 14px; border-radius:2px; margin-bottom:10px; }
    .section-title { font-size:24px; font-weight:700; color:var(--azul-escuro); margin-bottom:16px; }
    .section-subtitle { font-size:17px; font-weight:700; color:var(--azul-escuro); margin-bottom:10px; padding-bottom:6px; border-bottom:2px solid var(--laranja); display:inline-block; }
    .page-footer { position:absolute; bottom:0; left:0; right:0; padding:12px 40px; display:flex; justify-content:space-between; align-items:center; font-size:8px; color:var(--cinza); border-top:1px solid #E8ECEF; background:var(--branco); }
    .contato-final { background:var(--azul-escuro); padding:20px 40px; text-align:center; position:absolute; bottom:0; left:0; right:0; }
    .contato-final-titulo { font-size:17px; font-weight:700; color:var(--branco); margin-bottom:4px; }
    .contato-final-sub { font-size:11px; color:var(--cinza); margin-bottom:12px; }
    .contato-info { display:flex; justify-content:center; gap:25px; flex-wrap:wrap; }
    .contato-item { font-size:12px; color:var(--branco); font-weight:600; }
    .contato-item span { color:var(--laranja); font-weight:400; font-size:9px; display:block; letter-spacing:1px; text-transform:uppercase; margin-bottom:3px; }
    .validade-badge { display:inline-block; background:rgba(212,98,80,0.15); border:1px solid var(--laranja); color:var(--laranja); font-size:10px; font-weight:700; padding:5px 16px; border-radius:20px; letter-spacing:1px; margin-top:10px; }
    .valor-total-box { background:var(--azul-escuro); border-radius:8px; padding:24px; text-align:center; margin:16px 0; }
    .valor-label { font-size:10px; font-weight:600; color:var(--cinza); letter-spacing:3px; text-transform:uppercase; margin-bottom:8px; }
    .valor-numero { font-size:36px; font-weight:800; color:var(--laranja); }
    .valor-extenso { font-size:12px; color:var(--cinza); margin-top:5px; font-style:italic; }
    .doc-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; margin-top:10px; }
    .doc-item { background:var(--cinza-claro); border-radius:4px; padding:11px; text-align:center; font-size:11px; font-weight:600; color:var(--azul-escuro); }
    .digital-box { background:var(--cinza-claro); border-radius:8px; padding:14px; margin:12px 0; border-left:4px solid var(--azul-escuro); }
    .digital-titulo { font-size:10px; font-weight:700; color:var(--azul-escuro); letter-spacing:1px; text-transform:uppercase; margin-bottom:6px; }
    .digital-texto { font-size:9.5px; color:var(--texto-leve); line-height:1.6; }
    /* Ajuste automático: aplicado no navegador quando a página fica apertada (compacto) ou folgada */
    .page.compacto .content { padding-bottom:0; }
    .page.compacto .section-title { margin-bottom:8px; }
    .page.compacto .valor-total-box { padding:12px; margin:8px 0; }
    .page.compacto .pagamento-box { padding:12px; }
    .page.compacto .etapa { margin-bottom:8px; }
    .page.compacto .etapa-body { padding:6px 18px; }
    .page.compacto .clausula { margin-bottom:10px; }
    .page.compacto .clausula-body { padding:10px 14px; }
    .page.compacto .garantia-box { padding:14px; margin-top:10px; }
    .page.compacto .obs-list li { padding:4px 0 4px 22px; }
    .page.compacto .doc-item, .page.compacto .tinta-item { padding:7px 6px; }
    .page.compacto .servicos-box { margin-top:6px; margin-bottom:4px; }
    .page.compacto .parte-box { padding:10px 12px; margin-bottom:8px; }
    .page.compacto .intro-box { padding:10px; margin-bottom:10px; }
    .page.compacto2 .etapa-procedimentos li { padding:3px 0 3px 24px; line-height:1.4; }
    .page.compacto2 .clausula-body { font-size:10.5px; line-height:1.6; }
    .page.compacto2 .servicos-list li { padding:2px 0 2px 20px; }
    .page.compacto2 .paragrafo-texto { line-height:1.55; margin-bottom:4px; }
    .page.compacto2 .obs-list li { font-size:12px; line-height:1.5; }
    .page.compacto2 .garantia-texto, .page.compacto2 .scope-text { line-height:1.55; }
  `;

  const CSS_ORCAMENTO = `
    .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-bottom:16px; }
    .info-box { background:var(--cinza-claro); border-radius:6px; padding:16px; border-left:4px solid var(--laranja); }
    .info-label { font-size:9px; font-weight:700; color:var(--laranja); letter-spacing:2px; text-transform:uppercase; margin-bottom:4px; }
    .info-value { font-size:15px; font-weight:600; color:var(--azul-escuro); }
    .info-detail { font-size:12px; color:var(--texto-leve); margin-top:2px; }
    .empresa-text { font-size:13px; color:var(--texto-leve); line-height:1.7; margin-bottom:12px; }
    .empresa-destaque { display:flex; gap:12px; margin-bottom:14px; }
    .destaque-item { flex:1; background:var(--azul-escuro); color:var(--branco); padding:12px 8px; border-radius:6px; text-align:center; }
    .destaque-titulo { font-size:9px; font-weight:700; letter-spacing:1px; text-transform:uppercase; }
    .destaque-desc { font-size:8px; color:var(--cinza); margin-top:3px; }
    .scope-box { background:#FFF8F6; border:1px solid rgba(212,98,80,0.2); border-radius:8px; padding:16px 18px; margin-top:12px; }
    .scope-title { font-size:11px; font-weight:700; color:var(--laranja); letter-spacing:1px; text-transform:uppercase; margin-bottom:8px; }
    .scope-text { font-size:13px; color:var(--texto-leve); line-height:1.65; }
    .desc-intro { font-size:14px; color:var(--texto-leve); line-height:1.65; margin-bottom:16px; }
    .etapa { margin-bottom:12px; border:1px solid #E8ECEF; border-radius:8px; overflow:hidden; }
    .etapa-header { background:var(--azul-escuro); padding:11px 18px; display:flex; align-items:center; gap:12px; }
    .etapa-numero { background:var(--laranja); color:var(--branco); width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:800; flex-shrink:0; }
    .etapa-nome { font-size:15px; font-weight:700; color:var(--branco); }
    .etapa-body { padding:10px 18px; }
    .etapa-procedimentos { list-style:none; padding:0; }
    .etapa-procedimentos li { font-size:13px; color:var(--texto); padding:5px 0 5px 24px; position:relative; border-bottom:1px solid #F0F2F4; line-height:1.5; }
    .etapa-procedimentos li:last-child { border-bottom:none; }
    .etapa-procedimentos li::before { content:''; position:absolute; left:0; top:11px; width:8px; height:8px; background:var(--laranja); border-radius:2px; transform:rotate(45deg); }
    .page.folgada .etapa { margin-bottom:14px; }
    .page.folgada .etapa-header { padding:13px 18px; }
    .page.folgada .etapa-body { padding:16px 20px; }
    .page.folgada .etapa-procedimentos li { font-size:13.5px; padding:8px 0 8px 26px; }
    .page.folgada .etapa-procedimentos li::before { top:14px; }
    .page.folgada .desc-intro { margin-bottom:22px; }
    .page.folgada .garantia-box { padding:24px; margin-top:22px; }
    .page.folgada .obs-list li { padding:9px 0 9px 22px; }
    .etapa-obs { background:#FFF8F6; border-left:3px solid var(--laranja); border-radius:4px; padding:10px 14px; margin-top:10px; font-size:12px; color:var(--texto-leve); line-height:1.6; }
    .etapa-obs strong { color:var(--azul-escuro); }
    .garantia-box { background:linear-gradient(135deg, var(--azul-escuro), #2a3f54); border-radius:8px; padding:20px; margin-top:16px; color:var(--branco); }
    .garantia-titulo { font-size:15px; font-weight:700; margin-bottom:8px; }
    .garantia-titulo span { color:var(--laranja); }
    .garantia-texto { font-size:12px; color:var(--cinza); line-height:1.7; }
    .pagamento-grid { display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-top:14px; }
    .pagamento-grid.tres { grid-template-columns:1fr 1fr 1fr; margin-top:10px; }
    .pagamento-box { background:var(--cinza-claro); border-radius:6px; padding:16px; text-align:center; }
    .pagamento-box.destaque { background:linear-gradient(135deg, var(--laranja), var(--laranja-hover)); color:var(--branco); }
    .pagamento-box.destaque .pag-label { color:rgba(255,255,255,0.8); }
    .pagamento-box.destaque .pag-valor { color:var(--branco); }
    .pag-label { font-size:9px; font-weight:700; color:var(--texto-leve); letter-spacing:2px; text-transform:uppercase; margin-bottom:4px; }
    .pag-valor { font-size:21px; font-weight:800; color:var(--azul-escuro); }
    .pagamento-grid.tres .pag-valor { font-size:18px; }
    .pag-detalhe { font-size:11px; margin-top:3px; opacity:0.8; }
    .prazo-box { background:#FFF8F6; border:1px solid rgba(212,98,80,0.25); border-radius:6px; padding:12px 18px; margin-top:10px; display:flex; justify-content:space-between; align-items:center; }
    .prazo-label { font-size:9px; font-weight:700; color:var(--laranja); letter-spacing:2px; text-transform:uppercase; }
    .prazo-valor { font-size:19px; font-weight:800; color:var(--azul-escuro); }
    .prazo-detalhe { font-size:11px; color:var(--texto-leve); }
    .tinta-grid { display:grid; grid-template-columns:repeat(4, 1fr); gap:10px; margin-top:10px; }
    .tinta-item { background:var(--cinza-claro); border-bottom:3px solid var(--laranja); border-radius:4px; padding:9px 6px; text-align:center; font-size:11px; font-weight:700; color:var(--azul-escuro); letter-spacing:0.5px; }
    .obs-list { list-style:none; padding:0; }
    .obs-list li { font-size:12.5px; color:var(--texto-leve); padding:6px 0 6px 22px; position:relative; line-height:1.6; border-bottom:1px solid #F0F2F4; }
    .obs-list li:last-child { border-bottom:none; }
    .obs-list li::before { content:''; position:absolute; left:0; top:12px; width:6px; height:6px; border:2px solid var(--laranja); border-radius:50%; }
    .obs-list strong { color:var(--azul-escuro); }
    .assinatura-nome { font-size:13px; font-weight:700; color:var(--azul-escuro); }
    .assinatura-cargo { font-size:11px; color:var(--texto-leve); margin-top:2px; }
    .assinatura-reg { font-size:10px; color:var(--cinza); margin-top:2px; }
  `;

  const CSS_JURIDICO = `
    .page-header { padding:18px 40px; }
    .page-header::after { top:60px; }
    .header-logo-text { font-size:18px; }
    .header-sub { font-size:7px; }
    .content { padding:32px 40px 20px; }
    .section-tag { margin-bottom:8px; }
    .section-title { font-size:20px; margin-bottom:14px; }
    .clausula { margin-bottom:16px; }
    .clausula-header { background:var(--azul-escuro); color:var(--branco); padding:8px 16px; border-radius:6px 6px 0 0; font-size:11px; font-weight:700; letter-spacing:0.5px; display:flex; align-items:center; gap:10px; }
    .clausula-numero { background:var(--laranja); color:var(--branco); width:26px; height:26px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:800; flex-shrink:0; }
    .clausula-body { padding:14px 16px; border:1px solid #E8ECEF; border-top:none; border-radius:0 0 6px 6px; font-size:11px; color:var(--texto); line-height:1.7; }
    .clausula-body p { margin-bottom:8px; }
    .clausula-body p:last-child { margin-bottom:0; }
    .parte-box { background:var(--cinza-claro); border-radius:6px; padding:12px 14px; border-left:4px solid var(--laranja); margin-bottom:10px; }
    .parte-label { font-size:8px; font-weight:700; color:var(--laranja); letter-spacing:2px; text-transform:uppercase; margin-bottom:4px; }
    .parte-nome { font-size:14px; font-weight:700; color:var(--azul-escuro); margin-bottom:3px; }
    .parte-info { font-size:10.5px; color:var(--texto-leve); line-height:1.6; }
    .parte-info strong { color:var(--azul-escuro); font-weight:600; }
    .intro-box { background:#FFF8F6; border:1px solid rgba(212,98,80,0.2); border-radius:8px; padding:14px; margin-bottom:16px; font-size:11.5px; color:var(--texto); line-height:1.7; }
    .intro-box strong { color:var(--azul-escuro); }
    .servicos-box { border:1px solid #E8ECEF; border-radius:8px; overflow:hidden; margin-top:10px; margin-bottom:6px; }
    .servicos-header { background:var(--azul-escuro); color:var(--branco); padding:8px 14px; font-size:11px; font-weight:700; letter-spacing:0.5px; }
    .servicos-list { list-style:none; padding:8px 14px; }
    .servicos-list li { font-size:10.5px; color:var(--texto); padding:3px 0 3px 20px; position:relative; border-bottom:1px solid #F0F2F4; line-height:1.45; }
    .servicos-list li:last-child { border-bottom:none; }
    .servicos-list li::before { content:''; position:absolute; left:0; top:9px; width:6px; height:6px; background:var(--laranja); border-radius:2px; transform:rotate(45deg); }
    .valor-total-box { padding:18px; margin:14px 0; }
    .valor-label { font-size:9px; margin-bottom:4px; }
    .valor-numero { font-size:30px; }
    .valor-extenso { font-size:10px; margin-top:3px; }
    .parcelas-grid { display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:6px; margin-top:6px; }
    .parcelas-grid.duas { grid-template-columns:1fr 1fr; gap:8px; margin-top:12px; }
    .parcela-item { background:var(--cinza-claro); border-radius:6px; padding:8px; text-align:center; }
    .parcela-item.destaque { background:linear-gradient(135deg, var(--laranja), var(--laranja-hover)); color:var(--branco); }
    .parcela-label { font-size:7px; font-weight:700; color:var(--texto-leve); letter-spacing:1px; text-transform:uppercase; margin-bottom:2px; }
    .parcela-item.destaque .parcela-label { color:rgba(255,255,255,0.8); }
    .parcela-valor { font-size:13px; font-weight:800; color:var(--azul-escuro); }
    .parcela-item.destaque .parcela-valor { color:var(--branco); }
    .parcela-data { font-size:8px; margin-top:2px; opacity:0.7; }
    .prazo-destaque { background:linear-gradient(135deg, var(--azul-escuro), #2a3f54); border-radius:8px; padding:16px; color:var(--branco); margin-top:10px; }
    .prazo-titulo { font-size:13px; font-weight:700; margin-bottom:5px; }
    .prazo-titulo span { color:var(--laranja); }
    .prazo-texto { font-size:11px; color:var(--cinza); line-height:1.6; }
    .garantia-box { background:linear-gradient(135deg, var(--azul-escuro), #2a3f54); border-radius:8px; padding:16px; color:var(--branco); margin:10px 0; }
    .garantia-titulo { font-size:13px; font-weight:700; margin-bottom:5px; }
    .garantia-titulo span { color:var(--laranja); }
    .garantia-texto { font-size:10.5px; color:var(--cinza); line-height:1.6; }
    .horario-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin:10px 0; }
    .horario-item { background:var(--cinza-claro); border-radius:6px; padding:10px; text-align:center; border-left:3px solid var(--laranja); }
    .horario-dia { font-size:9px; font-weight:700; color:var(--laranja); letter-spacing:1px; text-transform:uppercase; }
    .horario-hora { font-size:13px; font-weight:700; color:var(--azul-escuro); margin-top:2px; }
    .banco-box { background:var(--cinza-claro); border-radius:6px; padding:12px 14px; border-left:4px solid var(--azul-escuro); margin-top:10px; }
    .banco-titulo { font-size:9px; font-weight:700; color:var(--azul-escuro); letter-spacing:2px; text-transform:uppercase; margin-bottom:6px; }
    .banco-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px; }
    .banco-item { font-size:10px; color:var(--texto-leve); }
    .banco-item strong { color:var(--azul-escuro); display:block; font-size:11px; }
    .data-local { text-align:center; font-size:12px; font-weight:500; color:var(--azul-escuro); margin:16px 0; }
    .assinaturas-grid { display:grid; grid-template-columns:1fr 1fr; gap:30px; margin-top:20px; }
    .assinatura-box { text-align:center; padding-top:10px; }
    .assinatura-linha { border-top:2px solid var(--azul-escuro); padding-top:8px; }
    .assinatura-nome { font-size:12px; font-weight:700; color:var(--azul-escuro); }
    .assinatura-cargo { font-size:9px; color:var(--texto-leve); margin-top:2px; text-transform:uppercase; letter-spacing:1px; }
    .testemunhas-section { margin-top:20px; }
    .testemunhas-titulo { font-size:10px; font-weight:700; color:var(--azul-escuro); letter-spacing:2px; text-transform:uppercase; margin-bottom:12px; }
    .testemunhas-grid { display:grid; grid-template-columns:1fr 1fr; gap:30px; }
    .testemunha-box { border-top:1px solid var(--cinza); padding-top:8px; }
    .testemunha-nome { font-size:11px; font-weight:600; color:var(--azul-escuro); }
    .testemunha-cpf { font-size:9px; color:var(--texto-leve); }
    .paragrafo { margin-top:10px; }
    .paragrafo-titulo { font-size:10px; font-weight:700; color:var(--laranja); letter-spacing:1px; text-transform:uppercase; margin-bottom:4px; }
    .paragrafo-texto { font-size:10.5px; color:var(--texto-leve); line-height:1.7; margin-bottom:6px; }
    .doc-grid { gap:8px; }
    .doc-item { padding:8px; font-size:10px; }
    .disposicoes-text { font-size:11px; color:var(--texto-leve); line-height:1.7; margin-bottom:6px; }
    .nota { font-size:10px; color:var(--texto-leve); margin-top:8px; }
    .nota.italico { font-style:italic; margin-top:10px; }
    .contato-final { padding:18px 40px; }
    .contato-final-titulo { font-size:15px; margin-bottom:3px; }
    .contato-final-sub { font-size:9px; margin-bottom:10px; }
    .contato-info { gap:22px; }
    .contato-item { font-size:10px; }
    .contato-item span { font-size:7px; margin-bottom:2px; }
    .page-footer { padding:10px 40px; }
  `;

  // ---------------------------------------------------------------
  // PEÇAS COMPARTILHADAS
  // ---------------------------------------------------------------
  const LOGO_SVG = `<svg viewBox="0 0 120 130" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="20" y="10" width="80" height="95" rx="2" stroke="#D46250" stroke-width="4" fill="none"/>
      <polyline points="40,90 60,72 80,90" stroke="#D46250" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <polyline points="40,76 60,58 80,76" stroke="#D46250" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <polyline points="40,62 60,44 80,62" stroke="#D46250" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

  const pad2 = (n) => String(n).padStart(2, '0');

  const headerHTML = (pagina, total) => `
    <div class="page-header">
      <div><div class="header-logo-text">${EMPRESA.marca}</div><div class="header-sub">${EMPRESA.subtitulo}</div></div>
      <div class="header-page">${pad2(pagina)} / ${pad2(total)}</div>
    </div>`;

  const footerHTML = (esq, dir) => `<div class="page-footer"><span>${esq}</span><span>${esc(dir)}</span></div>`;

  const capaHTML = ({ ref, tipo, titulo, cliente, clienteSecundario, local, data }) => `
    <div class="page capa">
      <div class="capa-ref">REF: ${esc(ref)}</div>
      <div class="capa-logo">${LOGO_SVG}</div>
      <div class="capa-empresa">${EMPRESA.marca}</div>
      <div class="capa-subtitulo">${EMPRESA.subtitulo}</div>
      <div class="capa-divider"></div>
      <div class="capa-tipo">${esc(tipo)}</div>
      ${titulo ? `<div class="capa-titulo">${titulo}</div>` : ''}
      <div class="capa-cliente${clienteSecundario ? ' secundario' : ''}">${esc(cliente)}</div>
      <div class="capa-local">${esc(local)}</div>
      <div class="capa-data">${esc(data)}</div>
    </div>`;

  const contatoJuridicoHTML = () => `
    <div class="contato-final">
      <div class="contato-final-titulo">${EMPRESA.marca}</div>
      <div class="contato-final-sub">${esc(EMPRESA.subtituloPlain)}</div>
      <div class="contato-info">
        <div class="contato-item"><span>Telefone</span>${EMPRESA.telefone}</div>
        <div class="contato-item"><span>E-mail</span>${EMPRESA.email}</div>
        <div class="contato-item"><span>Endereço</span>${EMPRESA.endereco}, ${EMPRESA.bairro}, ${EMPRESA.cidade}/${EMPRESA.uf}</div>
        <div class="contato-item"><span>CNPJ</span>${EMPRESA.cnpj}</div>
      </div>
    </div>`;

  const documento = (titulo, css, corpo, extraHead = '') => `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(titulo)}</title>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&family=Dancing+Script:wght@700&display=swap" rel="stylesheet">
${extraHead}
<style>${CSS_BASE}${css}</style>
</head>
<body>
${corpo}
</body>
</html>`;

  const servicosBox = (titulo, itens) => `
    <div class="servicos-box">
      <div class="servicos-header">${esc(titulo)}</div>
      <ul class="servicos-list">${(itens || []).map(i => `<li>${rich(i)}</li>`).join('')}</ul>
    </div>`;
  const servicosBoxH = (g) => 16.5 + (g.itens || []).reduce((s, i) => s + 5.8 * lines(i, 130), 0);

  const parteContratante = (p, label = 'Contratante', denominacao = 'CONTRATANTE') => {
    const docTipo = (p.documento_tipo || 'CNPJ').toUpperCase();
    const pj = docTipo === 'CNPJ';
    const end = [p.endereco, p.cep ? `CEP ${p.cep}` : '', p.bairro ? `Bairro ${p.bairro}` : '', p.cidade_uf].filter(Boolean).join(', ');
    let info;
    if (pj) {
      const rep = p.representante_nome
        ? `, neste ato representado por seu ${esc(p.representante_cargo || 'representante legal')} <strong>${esc(p.representante_nome)}</strong>${p.representante_cpf ? `, inscrito no CPF nº ${esc(p.representante_cpf)}` : ''}`
        : '';
      info = `Inscrito no <strong>CNPJ ${esc(p.documento)}</strong>, situado à ${esc(end)}${rep}, doravante denominado simplesmente <strong>${denominacao}</strong>.`;
    } else {
      info = `Inscrito(a) no <strong>CPF ${esc(p.documento)}</strong>, residente e domiciliado(a) à ${esc(end)}, doravante denominado(a) simplesmente <strong>${denominacao}</strong>.`;
    }
    return `
    <div class="parte-box">
      <div class="parte-label">${label}</div>
      <div class="parte-nome">${esc(p.nome)}</div>
      <div class="parte-info">${info}</div>
    </div>`;
  };

  const parteContratada = () => `
    <div class="parte-box">
      <div class="parte-label">Contratada</div>
      <div class="parte-nome">${EMPRESA.razao}</div>
      <div class="parte-info">Pessoa jurídica de direito privado, com sede à ${EMPRESA.endereco}, CEP ${EMPRESA.cep}, Bairro ${EMPRESA.bairro}, ${EMPRESA.cidade}/${EMPRESA.uf}, inscrita no <strong>CNPJ ${EMPRESA.cnpj}</strong>, representada por sua sócia gerente e responsável técnica, a arquiteta e urbanista <strong>${EMPRESA.responsavel}</strong>, inscrita no <strong>${EMPRESA.cauJuridico}</strong> e no CPF nº ${EMPRESA.cpf}, doravante denominada simplesmente <strong>CONTRATADA</strong>.</div>
    </div>`;

  const digitalBox = (titulo = 'Validade Jurídica da Assinatura Eletrônica') => `
    <div class="digital-box">
      <div class="digital-titulo">${titulo}</div>
      <div class="digital-texto">As Partes e as testemunhas declaram e reconhecem que o presente instrumento poderá ser assinado eletronicamente, seja por meio da plataforma <strong>ZapSign</strong> (https://www.zapsign.com.br), seja por meio da plataforma oficial do <strong>GOV.BR</strong> (https://www.gov.br), ou ainda por qualquer outro meio idôneo de assinatura eletrônica disponível, com fundamento no artigo 10, § 2º, da Medida Provisória nº 2.200-2/2001, e no artigo 6º do Decreto nº 10.278/2020.</div>
      <div class="digital-texto" style="margin-top:5px;">As assinaturas eletrônicas produzirão os mesmos efeitos jurídicos de um documento físico assinado de próprio punho e registrado em cartório, sendo consideradas plenamente válidas, vinculantes e executáveis. As Partes renunciam à exigência de apresentação das vias originais físicas, bem como ao direito de impugnar ou contestar a validade das assinaturas eletrônicas, na máxima extensão permitida pela legislação aplicável.</div>
    </div>`;

  const assinaturasJuridico = (contratanteNome, cidade, dataISO) => `
    <div class="data-local">${esc(cidade)}, ${dataLonga(dataISO)}.</div>
    <div class="assinaturas-grid">
      <div class="assinatura-box"><div class="assinatura-linha"><div class="assinatura-nome">${esc(contratanteNome)}</div><div class="assinatura-cargo">Contratante</div></div></div>
      <div class="assinatura-box"><div class="assinatura-linha"><div class="assinatura-nome">${EMPRESA.razao}</div><div class="assinatura-cargo">Contratada</div></div></div>
    </div>
    <div class="testemunhas-section">
      <div class="testemunhas-titulo">Testemunhas</div>
      <div class="testemunhas-grid">
        ${EMPRESA.testemunhas.map(t => `<div class="testemunha-box"><div class="testemunha-nome">${t.nome}</div><div class="testemunha-cpf">CPF: ${t.cpf}</div></div>`).join('')}
      </div>
    </div>`;

  const clausula = (n, titulo, corpo) => `
    <div class="clausula">
      <div class="clausula-header"><div class="clausula-numero">${n}</div>${titulo}</div>
      <div class="clausula-body">${corpo}</div>
    </div>`;

  const NOMES_CLAUSULA = ['', 'PRIMEIRA', 'SEGUNDA', 'TERCEIRA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÉTIMA', 'OITAVA', 'NONA', 'DÉCIMA', 'DÉCIMA PRIMEIRA', 'DÉCIMA SEGUNDA'];
  const tituloClausula = (n, nome) => `CLÁUSULA ${NOMES_CLAUSULA[n]}: ${nome}`;

  // Monta páginas de fluxo (header + conteúdo + rodapé fino)
  function paginasFluxo(paginas, offsetPagina, totalPaginas, rodapeEsq, rodapeDir) {
    return paginas.map((conteudo, i) => `
    <div class="page">
      ${headerHTML(offsetPagina + i, totalPaginas)}
      <div class="content">${conteudo}</div>
      ${footerHTML(rodapeEsq, rodapeDir)}
    </div>`).join('\n');
  }

  // Capacidade útil (px) das páginas de fluxo com rodapé fino. Valores de
  // fallback; no navegador a capacidade real é medida (ver medirEMontar).
  const CAP_ORCAMENTO = 930;
  const CAP_JURIDICO = 950;

  // ---------------------------------------------------------------
  // ORÇAMENTO (Proposta de Mão de Obra)
  // ---------------------------------------------------------------
  const FRASE_FECHAMENTO = 'Estamos abertos a novas propostas e negociações. **Antes de fechar com outra empresa, entre em contato conosco.** Faremos o possível para atender às suas necessidades';
  const OBS_TINTAS = 'Toda a pintura será executada com **tinta de linha premium** (Renner, Sherwin-Williams, Coral ou Golden), conforme padrão de cores aprovado pelo cliente';

  function normalizarOrcamento(d) {
    const o = { ...d };
    o.numero = o.numero || 'ORC-0000-000';
    o.data = o.data || hojeISO();
    o.uf = o.uf || 'SC';
    o.cliente_tipo = o.cliente_tipo || 'Condomínio';
    o.validade_dias = o.validade_dias || 30;
    o.modalidade = o.modalidade === 'mao_de_obra' ? 'mao_de_obra' : 'com_material';
    o.etapas = (o.etapas || []).map(e => ({ nome: e.nome || '', itens: (e.itens || []).filter(Boolean), observacao: e.observacao || '' }));
    o.observacoes = (o.observacoes || []).filter(Boolean);
    if (o.inclui_pintura && !o.observacoes.some(x => /premium/i.test(x))) o.observacoes.splice(1, 0, OBS_TINTAS);
    if (!o.observacoes.some(x => /fechar com outra empresa/i.test(x))) o.observacoes.push(FRASE_FECHAMENTO);
    o.valor_total = round2(o.valor_total);
    o.entrada_valor = round2(o.entrada_valor);
    o.opcoes_parcelamento = (o.opcoes_parcelamento || []).map(p => ({ parcelas: Number(p.parcelas) || 0, descricao: p.descricao || '' })).filter(p => p.parcelas > 0);
    if (!o.opcoes_parcelamento.length && o.valor_total > o.entrada_valor) o.opcoes_parcelamento = [{ parcelas: 1 }];
    o.garantia_texto = o.garantia_texto || 'A DIBREVA garante a qualidade de todos os serviços executados, conforme padrão técnico vigente. Mantemos a obra limpa e organizada durante toda a execução, evitamos a rotatividade de funcionários e respeitamos os horários estabelecidos pelo cliente.';
    o.prazo_detalhe = o.prazo_detalhe || 'Conforme cronograma de obra acordado com o cliente';
    return o;
  }

  function construirOrcamento(dados) {
    const o = normalizarOrcamento(dados);
    const local = `${o.cidade || EMPRESA.cidade}, ${o.uf}`;
    const rodapeDir = `Proposta de Mão de Obra: ${o.cliente_nome}`;
    const labelValor = o.modalidade === 'com_material' ? 'Valor da Mão de Obra com Material' : 'Valor da Mão de Obra';
    const modalidadeCurta = o.modalidade === 'com_material' ? 'Mão de obra com material' : 'Somente mão de obra e equipamentos';

    // Página 2: dados + empresa (fixa)
    const pagDados = `
      <div class="section-tag">Identificação</div>
      <div class="section-title" style="margin-bottom:14px;">Dados do Projeto</div>
      <div class="info-grid">
        <div class="info-box"><div class="info-label">Cliente</div><div class="info-value">${esc(o.cliente_nome)}</div><div class="info-detail">${esc(o.cliente_tipo)}</div></div>
        <div class="info-box"><div class="info-label">Localização</div><div class="info-value">${esc(local)}</div><div class="info-detail">${o.uf === 'SC' ? 'Santa Catarina' : esc(o.uf)}</div></div>
        <div class="info-box"><div class="info-label">Tipo de Serviço</div><div class="info-value">${esc(o.tipo_servico)}</div><div class="info-detail">${esc(o.tipo_servico_detalhe || '')}</div></div>
        <div class="info-box"><div class="info-label">Abrangência</div><div class="info-value">${esc(o.abrangencia || '')}</div><div class="info-detail">${esc(o.abrangencia_detalhe || '')}</div></div>
        <div class="info-box"><div class="info-label">Referência</div><div class="info-value">${esc(o.numero)}</div><div class="info-detail">${modalidadeCurta}</div></div>
        <div class="info-box"><div class="info-label">Data</div><div class="info-value">${dataLonga(o.data, true)}</div><div class="info-detail">Validade: ${o.validade_dias} dias</div></div>
      </div>
      <div class="section-tag">Sobre nós</div>
      <div class="section-title" style="margin-bottom:12px;">A Empresa</div>
      <p class="empresa-text">A <strong style="color:var(--azul-escuro);">DIBREVA</strong> é uma empresa especializada em reformas, pintura e manutenção predial, com atuação em todo o estado de Santa Catarina. Nossa missão é devolver o <strong style="color:var(--azul-escuro);">estado de arte</strong> a cada empreendimento, renovando função, cor e significado aos patrimônios de nossos clientes.</p>
      <p class="empresa-text">Contamos com equipe de profissionais qualificados, devidamente certificados nas normas regulamentadoras NR-18 e NR-35, além de engenheiros civis e arquitetos que garantem a excelência técnica em cada projeto.</p>
      <div class="empresa-destaque">
        <div class="destaque-item"><div class="destaque-titulo">Equipe Certificada</div><div class="destaque-desc">NR-18 e NR-35</div></div>
        <div class="destaque-item"><div class="destaque-titulo">Segurança Total</div><div class="destaque-desc">Seguro de vida em grupo</div></div>
        <div class="destaque-item"><div class="destaque-titulo">Resp. Técnica</div><div class="destaque-desc">RRT junto ao CAU</div></div>
        <div class="destaque-item"><div class="destaque-titulo">Documentação</div><div class="destaque-desc">PCMSO, PGR e LTCAT</div></div>
      </div>
      <div class="scope-box">
        <div class="scope-title">Escopo Geral dos Serviços</div>
        <div class="scope-text">${rich(o.escopo_geral || '')}</div>
      </div>`;

    // Blocos de fluxo: etapas, garantia, observações
    const blocos = [];
    blocos.push({
      h: 20 + 6.5 * lines(o.descricao_intro, 95),
      html: `<div class="section-tag">Serviços</div><div class="section-title" style="margin-bottom:10px;">Descrição dos Serviços</div><p class="desc-intro">${rich(o.descricao_intro || '')}</p>`,
    });
    o.etapas.forEach((e, i) => {
      const hItens = e.itens.reduce((s, it) => s + 8.1 * lines(it, 95), 0);
      const hObs = e.observacao ? 11 + 5.2 * lines(e.observacao, 105) : 0;
      blocos.push({
        h: 22 + hItens + hObs,
        html: `
        <div class="etapa">
          <div class="etapa-header"><div class="etapa-numero">${i + 1}</div><div class="etapa-nome">${esc(e.nome)}</div></div>
          <div class="etapa-body">
            <ul class="etapa-procedimentos">${e.itens.map(it => `<li>${rich(it)}</li>`).join('')}</ul>
            ${e.observacao ? `<div class="etapa-obs">${rich(e.observacao)}</div>` : ''}
          </div>
        </div>`,
      });
    });
    blocos.push({
      h: 22 + 5.4 * lines(o.garantia_texto, 110),
      html: `<div class="garantia-box"><div class="garantia-titulo"><span>&#9670;</span> Garantia e Compromisso</div><div class="garantia-texto">${rich(o.garantia_texto)}</div></div>`,
    });
    blocos.push({
      h: 15 + o.observacoes.reduce((s, x) => s + 8.5 + 5.3 * (lines(x, 105) - 1), 0),
      html: `<div style="margin-top:16px;"><div class="section-subtitle">Observações Importantes</div><ul class="obs-list">${o.observacoes.map(x => `<li>${rich(x)}</li>`).join('')}</ul></div>`,
    });

    // Página final: investimento (fixa)
    const saldo = round2(o.valor_total - o.entrada_valor);
    const temEntrada = o.entrada_valor > 0;
    const opcoes = o.opcoes_parcelamento;
    const tres = (temEntrada ? 1 : 0) + opcoes.length >= 3;
    const boxes = [];
    if (temEntrada) {
      const pct = o.valor_total ? Math.round((o.entrada_valor / o.valor_total) * 100) : 0;
      boxes.push(`<div class="pagamento-box destaque"><div class="pag-label">Entrada${o.entrada_percentual ? `: ${esc(o.entrada_percentual)}%` : (pct ? `: ${pct}%` : '')}</div><div class="pag-valor">${moeda(o.entrada_valor)}</div><div class="pag-detalhe">${esc(o.entrada_descricao || 'No início da obra')}</div></div>`);
    }
    opcoes.forEach((p, i) => {
      const base = temEntrada ? saldo : o.valor_total;
      const parcela = round2(base / p.parcelas);
      const label = opcoes.length > 1 ? `Opção ${i + 1}: saldo em ${p.parcelas}x` : (temEntrada ? `Saldo em ${p.parcelas}x` : (p.parcelas === 1 ? 'Pagamento' : `Parcelado em ${p.parcelas}x`));
      const valor = p.parcelas === 1 ? moeda(base) : `${p.parcelas} × ${moeda(parcela)}`;
      const detalhe = p.descricao || (p.parcelas === 1 ? (temEntrada ? 'Na conclusão da obra' : 'À vista') : `Parcelas mensais, saldo de ${moeda(base)}`);
      boxes.push(`<div class="pagamento-box"><div class="pag-label">${esc(label)}</div><div class="pag-valor">${valor}</div><div class="pag-detalhe">${esc(detalhe)}</div></div>`);
    });

    const pagInvestimento = `
      <div class="section-tag">Investimento</div>
      <div class="section-title" style="margin-bottom:8px;">Valor e Condições de Pagamento</div>
      <div class="valor-total-box" style="padding:18px; margin:10px 0;">
        <div class="valor-label">${labelValor}</div>
        <div class="valor-numero" style="font-size:32px;">${moeda(o.valor_total)}</div>
        <div class="valor-extenso">(${extenso(o.valor_total)})</div>
      </div>
      <div class="section-subtitle">Condições de Pagamento</div>
      <div class="pagamento-grid${tres ? ' tres' : ''}">${boxes.join('')}</div>
      <div class="prazo-box">
        <div><div class="prazo-label">Prazo de Execução</div><div class="prazo-detalhe">${esc(o.prazo_detalhe)}</div></div>
        <div class="prazo-valor">${esc(o.prazo_dias_uteis)} dias úteis</div>
      </div>
      ${o.inclui_pintura ? `<div style="margin-top:12px;"><div class="section-subtitle">Tintas de Linha Premium que Trabalhamos</div><div class="tinta-grid">${EMPRESA.tintas.map(t => `<div class="tinta-item">${t}</div>`).join('')}</div></div>` : ''}
      <div style="margin-top:12px;">
        <div class="section-subtitle">Documentação Apresentada</div>
        <div class="doc-grid">${EMPRESA.documentos.map(x => `<div class="doc-item">${x}</div>`).join('')}</div>
      </div>
      <div style="text-align:center; margin-top:${o.inclui_pintura ? 8 : 26}px;">
        <div class="assinatura-nome">${EMPRESA.responsavelCurto}</div>
        <div class="assinatura-cargo">Arquiteta e Urbanista Responsável</div>
        <div class="assinatura-reg">${EMPRESA.cauOrcamento}</div>
      </div>`;

    const rodapeEsq = EMPRESA.razao;
    const montar = (paginasServicos) => {
      const total = 2 + paginasServicos.length + 1;
      const corpo = [
      capaHTML({ ref: o.numero, tipo: 'Proposta de Mão de Obra', cliente: o.cliente_nome, local: `${local}${o.subtitulo_capa ? `: ${o.subtitulo_capa}` : ''}`, data: mesAno(o.data) }),
      `<div class="page">${headerHTML(2, total)}<div class="content">${pagDados}</div>${footerHTML(rodapeEsq, rodapeDir)}</div>`,
      paginasFluxo(paginasServicos, 3, total, rodapeEsq, rodapeDir),
      `<div class="page">${headerHTML(total, total)}<div class="content" style="padding-top:12px;">${pagInvestimento}</div>
        <div class="contato-final">
          <div class="contato-final-titulo">${EMPRESA.tagline}</div>
          <div class="contato-final-sub">Entre em contato para agendar uma visita técnica</div>
          <div class="contato-info">
            <div class="contato-item"><span>Telefone</span>${EMPRESA.telefone}</div>
            <div class="contato-item"><span>Endereço</span>${EMPRESA.endereco}, ${EMPRESA.bairro}, ${EMPRESA.cidade}/${EMPRESA.uf} | CEP ${EMPRESA.cep}</div>
          </div>
          <div class="contato-info" style="margin-top:6px;">
            <div class="contato-item"><span>Instagram</span>${EMPRESA.instagram}</div>
            <div class="contato-item"><span>Facebook</span>${EMPRESA.facebook}</div>
          </div>
          <div class="validade-badge">Proposta válida por ${o.validade_dias} dias</div>
        </div>
      </div>`,
      ].join('\n');
      return documento(`Proposta de Mão de Obra: ${o.cliente_nome} | DIBREVA`, CSS_ORCAMENTO, corpo);
    };

    return { css: CSS_ORCAMENTO, blocos, capacidade: CAP_ORCAMENTO, rodape: [rodapeEsq, rodapeDir], montar };
  }

  // ---------------------------------------------------------------
  // CONTRATO
  // ---------------------------------------------------------------
  function normalizarContrato(d) {
    const c = { ...d };
    c.numero = c.numero || 'CTR-0000-000';
    c.data_assinatura = c.data_assinatura || hojeISO();
    c.cidade_assinatura = c.cidade_assinatura || EMPRESA.cidade;
    c.contratante = c.contratante || {};
    c.grupos_servicos = (c.grupos_servicos || []).map(g => ({ titulo: g.titulo || '', itens: (g.itens || []).filter(Boolean) }));
    c.valor_total = round2(c.valor_total);
    c.entrada_valor = round2(c.entrada_valor);
    c.num_parcelas = Number(c.num_parcelas) || 0;
    c.forma_pagamento = c.forma_pagamento || 'cheque ou PIX';
    c.entrada_condicao = c.entrada_condicao || 'na assinatura do contrato';
    c.multa_percentual = c.multa_percentual || 2;
    c.garantia_meses = c.garantia_meses || 24;
    c.fornece_material = c.fornece_material !== false;
    c.carga_horaria = Object.assign({ seg_qui: '8h às 12h / 13h às 17h', sexta: '8h às 12h / 13h às 16h', observacoes: 'Acesso ao local a partir das **7h**. Atividades com ruído somente a partir das **8h** (regimento interno). Sábados, domingos e feriados: sem expediente.' }, c.carga_horaria || {});
    c.local_obra = c.local_obra || c.contratante.nome || '';
    return c;
  }

  function parcelasContrato(c) {
    const saldo = round2(c.valor_total - c.entrada_valor);
    const n = c.num_parcelas;
    const valor = n ? round2(saldo / n) : 0;
    const primeira = c.primeira_parcela_data || (c.data_inicio ? addMeses(c.data_inicio, 1) : addMeses(c.data_assinatura, 1));
    const lista = [];
    for (let i = 0; i < n; i++) lista.push({ label: `${ordF(i + 1)} Parcela`, valor, data: addMeses(primeira, i) });
    return { saldo, valor, lista };
  }

  function construirContrato(dados) {
    const c = normalizarContrato(dados);
    const ct = c.contratante;
    const rodapeEsq = `${EMPRESA.razao}, CNPJ ${EMPRESA.cnpj}`;
    const rodapeDir = `Contrato: ${ct.nome}`;
    const { saldo, valor: valorParcela, lista: parcelas } = parcelasContrato(c);
    const blocos = [];

    // Partes + intro + cláusula 1 (com o primeiro grupo dentro)
    const [g0, ...gRest] = c.grupos_servicos;
    blocos.push({
      h: 20 + 17.5 + 4.4 * 3 + 17.5 + 4.4 * 3 + 12 + 5.2 + 23 + 5.5 * lines(c.objeto_resumo, 125) + (g0 ? servicosBoxH(g0) : 0),
      html: `
      <div class="section-tag">Partes</div><div class="section-title">Identificação</div>
      ${parteContratante(ct)}
      ${parteContratada()}
      <div class="intro-box">O <strong>CONTRATANTE</strong> e a <strong>CONTRATADA</strong> ajustam e convencionam um contrato de prestação de serviços que se regerá pelas cláusulas e considerações seguintes.</div>
      ${clausula(1, tituloClausula(1, 'DO OBJETO'), `
        <p>A CONTRATADA se obriga a prestar com zelo e eficiência, observados os princípios de conduta ética e as normas que regem o direito, os seus serviços ao CONTRATANTE, tendo como objeto: <strong>${rich(c.objeto_resumo || '')}</strong>, no ${esc(c.local_obra)}.</p>
        ${g0 ? servicosBox(g0.titulo, g0.itens) : ''}`)}`,
    });
    gRest.forEach(g => blocos.push({ h: servicosBoxH(g), html: servicosBox(g.titulo, g.itens) }));

    // Cláusula 2: prazo
    blocos.push({
      h: 23 + 14 + 4.7 * 3 + 12,
      html: `<div style="margin-top:12px;"></div>` + clausula(2, tituloClausula(2, 'DO PRAZO'), `
        <div class="prazo-destaque">
          <div class="prazo-titulo">Prazo de Conclusão: <span>${esc(c.prazo_dias_uteis)} dias úteis</span></div>
          <div class="prazo-texto">A contar do primeiro dia útil após a data determinada no presente contrato, exceto por motivo de força maior, dias de chuvas, greves, paralisação dos trabalhos por ordem das autoridades constituídas, ou demais situações especiais anotadas no livro diário de obra.</div>
        </div>
        ${c.data_inicio ? `<p style="margin-top:10px; font-weight:600;">Início da obra: <span style="color:var(--laranja); font-size:13px;">${dataLonga(c.data_inicio)}</span></p>` : ''}`),
    });

    // Cláusula 3: preço
    const temEntrada = c.entrada_valor > 0;
    blocos.push({
      h: 23 + 39 + 16,
      html: clausula(3, tituloClausula(3, 'DO PREÇO'), `
        <div class="valor-total-box"><div class="valor-label">Valor Total do Contrato</div><div class="valor-numero">${moeda(c.valor_total)}</div><div class="valor-extenso">${cap(extenso(c.valor_total))}</div></div>
        ${temEntrada ? `<p><strong>Entrada:</strong> ${moeda(c.entrada_valor)} (${extenso(c.entrada_valor)}) ${esc(c.entrada_condicao)}.</p>` : ''}
        ${c.num_parcelas > 0 ? `<p><strong>${temEntrada ? 'Saldo' : 'Pagamento'}:</strong> ${moeda(saldo)} em ${c.num_parcelas} ${c.num_parcelas === 1 ? 'parcela' : 'parcelas fixas'} de ${moeda(valorParcela)}${c.num_parcelas > 1 ? ', mensais e consecutivas' : ''}.</p>` : (temEntrada && saldo > 0 ? `<p><strong>Saldo:</strong> ${moeda(saldo)} na conclusão da obra.</p>` : '')}`),
    });

    // Cronograma de parcelas + banco + carga horária
    const itensGrid = [];
    if (temEntrada) itensGrid.push(`<div class="parcela-item destaque"><div class="parcela-label">Entrada</div><div class="parcela-valor">${moedaCurta(c.entrada_valor)}</div><div class="parcela-data">Assinatura</div></div>`);
    parcelas.forEach(p => itensGrid.push(`<div class="parcela-item"><div class="parcela-label">${p.label}</div><div class="parcela-valor">${moedaCurta(p.valor)}</div><div class="parcela-data">${dataBR(p.data)}</div></div>`));
    const linhasGrid = [];
    for (let i = 0; i < itensGrid.length; i += 4) linhasGrid.push(`<div class="parcelas-grid">${itensGrid.slice(i, i + 4).join('')}</div>`);
    if (linhasGrid.length) {
      blocos.push({
        h: 20 + 16 * linhasGrid.length + 8 + 22 + 12,
        html: `
        <div class="section-tag">Parcelas</div><div class="section-title">Cronograma de Pagamento</div>
        ${linhasGrid.join('')}
        <p class="nota">Forma de pagamento: ${esc(c.forma_pagamento)}.</p>
        <div class="banco-box">
          <div class="banco-titulo">Dados Bancários</div>
          <div class="banco-grid">
            <div class="banco-item"><strong>${EMPRESA.banco}</strong>CNPJ: ${EMPRESA.cnpj}</div>
            <div class="banco-item"><strong>Agência: ${EMPRESA.agencia}</strong>Conta: ${EMPRESA.conta}</div>
            <div class="banco-item"><strong>PIX</strong>${EMPRESA.pix}</div>
          </div>
        </div>
        <p class="nota italico"><strong>Parágrafo Único:</strong> Todo serviço solicitado após a assinatura do contrato será incluído como aditivo de contrato, assinado previamente por seu representante.</p>`,
      });
    }

    blocos.push({
      h: 61,
      html: `<div style="margin-top:14px;"></div>` + clausula(4, tituloClausula(4, 'DA CARGA HORÁRIA'), `
        <div class="horario-grid">
          <div class="horario-item"><div class="horario-dia">Segunda a Quinta</div><div class="horario-hora">${esc(c.carga_horaria.seg_qui)}</div></div>
          <div class="horario-item"><div class="horario-dia">Sexta-feira</div><div class="horario-hora">${esc(c.carga_horaria.sexta)}</div></div>
        </div>
        <p>${rich(c.carga_horaria.observacoes)}</p>
        <p>A CONTRATADA mantém autonomia para o controle interno de sua equipe, observando rigorosamente os prazos da Cláusula Segunda.</p>`),
    });

    blocos.push({
      h: 82,
      html: clausula(5, tituloClausula(5, 'DAS OBRIGAÇÕES DO CONTRATANTE'), `
        <p>O CONTRATANTE se obriga a liberar a circulação dos funcionários da CONTRATADA em suas dependências com o fim de proporcionar o melhor desempenho e execução dos serviços. O trânsito dos funcionários será autorizado desde que estejam uniformizados e identificados.</p>
        <div class="paragrafo">
          <div class="paragrafo-titulo">Parágrafo Primeiro: Das Redes de Proteção</div>
          <div class="paragrafo-texto">A CONTRATADA <strong>não realiza</strong> retirada, reinstalação, fornecimento, manutenção ou qualquer tipo de manipulação das redes de proteção instaladas nas unidades autônomas.</div>
          <div class="paragrafo-texto">As redes de proteção, ainda que fixadas na fachada do edifício (área comum), são instaladas por interesse e responsabilidade exclusiva do morador/proprietário da unidade, conforme o disposto no Código Civil (art. 1.336, I e IV).</div>
          <div class="paragrafo-texto">O morador/proprietário compromete-se a providenciar, às suas expensas, a retirada das redes de proteção quando solicitado, bem como sua posterior reinstalação.</div>
          <div class="paragrafo-texto">A não retirada das redes no prazo solicitado poderá impedir ou limitar a execução dos serviços naquele ponto da fachada, sem gerar responsabilidade, ônus, multa, reprogramação obrigatória ou qualquer tipo de compensação por parte da CONTRATADA ou do CONTRATANTE.</div>
        </div>`),
    });

    blocos.push({
      h: 58,
      html: clausula(6, tituloClausula(6, 'DAS OBRIGAÇÕES DA CONTRATADA'), `
        <p>A CONTRATADA se obriga a fornecer a mão de obra${c.fornece_material ? ' e o material' : ', os equipamentos e as ferramentas'} para execução dos serviços, ficando responsável pela administração da mão de obra, encargos trabalhistas e demais encargos com os colaboradores, inclusive qualquer reclamação decorrente de acidente de trabalho. Seus funcionários não possuem nenhum vínculo com o CONTRATANTE.</p>
        <div class="doc-grid" style="margin-top:10px;">${EMPRESA.documentos.map(x => `<div class="doc-item">${x}</div>`).join('')}</div>`),
    });

    blocos.push({
      h: 37,
      html: clausula(7, tituloClausula(7, 'DA RESCISÃO E DAS MULTAS'), `
        <p>Além das hipóteses previstas em Lei, determinará a rescisão do presente contrato o descumprimento, pelas partes, de qualquer uma das cláusulas ou condições previstas, devendo haver comunicação por escrito.</p>
        <p>O descumprimento ensejará a fixação de multa correspondente a <strong>${pad2(c.multa_percentual)}% (${extenso(c.multa_percentual).replace(/ reais?$/, '')} por cento)</strong> do valor estimado para o contrato.</p>`),
    });

    blocos.push({
      h: 58,
      html: clausula(8, tituloClausula(8, 'DA REGÊNCIA LEGAL'), `
        <p>O presente instrumento será regido pelas normas do Direito Civil pátrio, não gerando qualquer vínculo de natureza trabalhista entre as partes.</p>
        <div class="paragrafo">
          <div class="paragrafo-texto"><strong>§1º</strong> Quaisquer danos causados a terceiros provenientes da execução dos trabalhos serão de inteira responsabilidade da CONTRATADA.</div>
          <div class="paragrafo-texto"><strong>§2º</strong> A CONTRATADA exerce de maneira autônoma seus serviços, não mantendo vínculo trabalhista. O CONTRATANTE poderá vistoriar as obras quando entender necessário.</div>
          <div class="paragrafo-texto"><strong>§3º</strong> A CONTRATADA deverá cumprir rigorosamente as normas de segurança do trabalho, sendo qualquer eventualidade de responsabilidade total da CONTRATADA.</div>
        </div>`),
    });

    blocos.push({
      h: 102,
      html: clausula(9, tituloClausula(9, 'DA GARANTIA TÉCNICA DOS SERVIÇOS'), `
        <div class="garantia-box">
          <div class="garantia-titulo">Garantia Técnica: <span>${c.garantia_meses} meses</span></div>
          <div class="garantia-texto">Contados a partir da data de entrega final da obra, limitada exclusivamente a vícios de execução vinculados à mão de obra empregada na realização dos serviços descritos neste contrato.</div>
        </div>
        <div class="paragrafo" style="margin-top:12px;">
          <div class="paragrafo-titulo">A garantia não abrange</div>
          <div class="paragrafo-texto">• Patologias causadas por movimentação estrutural, recalques, infiltrações oriundas de instalações preexistentes ou falhas internas do edifício;</div>
          <div class="paragrafo-texto">• Desgaste natural por intempéries, desbotamento, sujeira, mofo ou alterações cromáticas;</div>
          <div class="paragrafo-texto">• Intervenções posteriores realizadas por terceiros ou ausência de manutenção predial;</div>
          <div class="paragrafo-texto">• Áreas onde a CONTRATADA não pôde atuar plenamente devido a impedimentos de acesso (ex.: redes de proteção, equipamentos, grades, antenas).</div>
        </div>
        <div class="paragrafo">
          <div class="paragrafo-titulo">Limitações Técnicas</div>
          <div class="paragrafo-texto">A garantia limita-se ao tratamento pontual das áreas afetadas, não implicando obrigação de refazer integralmente superfícies, panos de fachada ou elementos não comprometidos pelo vício comprovado.</div>
        </div>
        <div class="paragrafo">
          <div class="paragrafo-titulo">Procedimento para Acionamento</div>
          <div class="paragrafo-texto">O acionamento deverá ser formalizado pelo CONTRATANTE para que a CONTRATADA realize vistoria técnica. Confirmado o vício coberto, os reparos serão executados somente no ponto afetado, sem ônus adicional.</div>
        </div>`),
    });

    blocos.push({ h: 54, html: clausula(10, tituloClausula(10, 'ASSINATURA DIGITAL'), digitalBox()) });

    blocos.push({
      h: 30,
      html: clausula(11, tituloClausula(11, 'DO FORO'), `<p>As partes elegem o foro da comarca de <strong>${esc(c.cidade_assinatura)}, ${EMPRESA.uf}</strong>, com renúncia expressa de qualquer outro, para dirimir as dúvidas e/ou omissões que porventura possam advir do presente instrumento de contrato.</p>`),
    });

    const montar = (paginas) => {
      const total = 1 + paginas.length + 1;
      const corpo = [
        capaHTML({ ref: c.numero, tipo: 'Contrato de Prestação de Serviço', titulo: 'Contrato Particular de<br>Prestação de Serviços', cliente: ct.nome, clienteSecundario: true, local: `${c.cidade_assinatura}, ${EMPRESA.uf}`, data: mesAno(c.data_assinatura) }),
        paginasFluxo(paginas, 2, total, rodapeEsq, rodapeDir),
        `<div class="page">${headerHTML(total, total)}<div class="content">
          <div class="section-tag">Formalização</div><div class="section-title">Assinaturas</div>
          <div class="intro-box">E, por estarem assim, justas e contratadas, assinam o presente instrumento na presença das testemunhas abaixo.</div>
          ${assinaturasJuridico(ct.nome, c.cidade_assinatura, c.data_assinatura)}
        </div>${contatoJuridicoHTML()}</div>`,
      ].join('\n');
      return documento(`Contrato de Prestação de Serviço: ${ct.nome} | DIBREVA`, CSS_JURIDICO, corpo);
    };

    return { css: CSS_JURIDICO, blocos, capacidade: CAP_JURIDICO, rodape: [rodapeEsq, rodapeDir], montar };
  }

  // ---------------------------------------------------------------
  // ADITIVO
  // ---------------------------------------------------------------
  const ORD_M = ['', '1º', '2º', '3º', '4º', '5º', '6º', '7º', '8º', '9º', '10º'];

  function normalizarAditivo(d) {
    const a = { ...d };
    a.numero = a.numero || 'ADT-0000-000';
    a.ordinal = Number(a.ordinal) || 1;
    a.data_assinatura = a.data_assinatura || hojeISO();
    a.cidade_assinatura = a.cidade_assinatura || EMPRESA.cidade;
    a.contratante = a.contratante || {};
    a.servicos_originais = (a.servicos_originais || []).map(g => ({ titulo: g.titulo || '', itens: (g.itens || []).filter(Boolean) }));
    a.novos_servicos = (a.novos_servicos || []).map(g => ({ titulo: g.titulo || '', itens: (g.itens || []).filter(Boolean) }));
    a.valor_aditivo = round2(a.valor_aditivo);
    a.parcelas = (a.parcelas || []).map((p, i) => ({ label: p.label || `${ordF(i + 1)} Parcela`, valor: round2(p.valor), data: p.data || '' }));
    a.local_obra = a.local_obra || a.contratante.nome || '';
    return a;
  }

  function construirAditivo(dados) {
    const a = normalizarAditivo(dados);
    const ct = a.contratante;
    const ord = ORD_M[a.ordinal] || `${a.ordinal}º`;
    const rodapeEsq = `${EMPRESA.razao}, CNPJ ${EMPRESA.cnpj}`;
    const rodapeDir = `${ord} Aditivo: ${ct.nome}`;
    const blocos = [];

    const [s0, ...sRest] = a.servicos_originais;
    blocos.push({
      h: 23 + 17.5 + 13 + 17.5 + 13 + 12 + 10.4 + 23 + 5.5 * lines(a.objeto_original_resumo, 125) + (s0 ? servicosBoxH(s0) : 0),
      html: `
      ${clausula(1, tituloClausula(1, 'IDENTIFICAÇÃO DAS PARTES'), parteContratante(ct) + parteContratada())}
      <div class="intro-box">As partes contratantes celebraram <strong>CONTRATO DE PRESTAÇÃO DE SERVIÇOS</strong> em <strong>${dataLonga(a.contrato_data)}</strong>${a.contrato_numero ? ` (Ref. ${esc(a.contrato_numero)})` : ''}, tendo o objeto a seguir descrito, sendo que, desejando modificar e incluir algumas cláusulas do pacto, assinam o presente <strong>${ord} Termo Aditivo</strong>, com o seguinte conteúdo:</div>
      ${clausula(2, tituloClausula(2, 'OBJETO CONTRATUAL'), `
        <p>O objeto do contrato permanece o mesmo: ${rich(a.objeto_original_resumo || '')}, no <strong>${esc(a.local_obra)}</strong>.${a.servicos_originais.length ? ' Os serviços originais contratados compreendem:' : ''}</p>
        ${s0 ? servicosBox(s0.titulo, s0.itens) : ''}`)}`,
    });
    sRest.forEach(g => blocos.push({ h: servicosBoxH(g), html: servicosBox(g.titulo, g.itens) }));

    const [n0, ...nRest] = a.novos_servicos;
    blocos.push({
      h: 23 + 12 + (n0 ? servicosBoxH(n0) : 0),
      html: `<div style="margin-top:18px;"></div>` + clausula(3, tituloClausula(3, 'NOVOS SERVIÇOS CONTRATADOS'), `
        <p>As partes declaram que desejam incluir como serviços contratados, para o <strong>${esc(a.local_obra)}</strong>, na forma a seguir:</p>
        ${n0 ? servicosBox(n0.titulo, n0.itens) : ''}`),
    });
    nRest.forEach(g => blocos.push({ h: servicosBoxH(g), html: servicosBox(g.titulo, g.itens) }));

    const linhasParc = [];
    const itensParc = a.parcelas.map((p, i) => `<div class="parcela-item${i === 0 ? ' destaque' : ''}"><div class="parcela-label">${esc(p.label)}</div><div class="parcela-valor">${moedaCurta(p.valor)}</div><div class="parcela-data">${p.data ? dataBR(p.data) : ''}</div></div>`);
    const porLinha = a.parcelas.length <= 4 ? 2 : 4;
    for (let i = 0; i < itensParc.length; i += porLinha) linhasParc.push(`<div class="parcelas-grid${porLinha === 2 ? ' duas' : ''}">${itensParc.slice(i, i + porLinha).join('')}</div>`);
    blocos.push({
      h: 23 + 39 + 5.5 * lines(a.pagamento_texto, 125) + 8 + (porLinha === 2 ? 20 : 16) * linhasParc.length,
      html: clausula(4, tituloClausula(4, 'DO PREÇO'), `
        <div class="valor-total-box"><div class="valor-label">Valor do Aditivo</div><div class="valor-numero">${moeda(a.valor_aditivo)}</div><div class="valor-extenso">${cap(extenso(a.valor_aditivo))}</div></div>
        ${a.pagamento_texto ? `<p>${rich(a.pagamento_texto)}</p>` : ''}
        ${linhasParc.join('')}`),
    });

    blocos.push({
      h: 23 + 14 + 4.7 * 3,
      html: clausula(5, tituloClausula(5, 'DO PRAZO'), `
        <div class="prazo-destaque">
          <div class="prazo-titulo">Prazo de Execução: <span>${esc(a.prazo_dias_uteis)} dias úteis</span></div>
          <div class="prazo-texto">${rich(a.prazo_texto || 'A contar do primeiro dia útil após a assinatura, exceto por força maior, chuvas, greves, paralisação por autoridades constituídas, ou demais situações especiais anotadas no livro diário de obra.')}</div>
        </div>`),
    });

    const montar = (paginas) => {
      const total = 1 + paginas.length + 1;
      const corpo = [
        capaHTML({ ref: a.numero, tipo: 'Termo Aditivo', titulo: `${ord} Aditivo ao Contrato Particular<br>de Prestação de Serviços`, cliente: ct.nome, clienteSecundario: true, local: `${a.cidade_assinatura}, ${EMPRESA.uf}`, data: mesAno(a.data_assinatura) }),
        paginasFluxo(paginas, 2, total, rodapeEsq, rodapeDir),
        `<div class="page">${headerHTML(total, total)}<div class="content">
          <div class="section-tag">Disposições Finais</div><div class="section-title">Termos &amp; Condições</div>
          <div class="disposicoes-text">As demais cláusulas contratuais permanecem as mesmas, sem qualquer alteração, valendo entre as partes, fazendo este ${ord} Aditivo parte integrante e acessória ao pacto primitivo avençado entre as partes.</div>
          <div class="disposicoes-text">As partes elegem o foro da Comarca de <strong>${esc(a.cidade_assinatura)}, ${EMPRESA.uf}</strong> para as questões decorrentes do presente instrumento, renunciando a qualquer outro, por mais privilegiado que seja.</div>
          <div class="disposicoes-text">E, por estarem assim, justas e contratadas, assinam o presente instrumento na presença das testemunhas abaixo.</div>
          ${digitalBox('Parágrafo Único: Assinatura Digital')}
          ${assinaturasJuridico(ct.nome, a.cidade_assinatura, a.data_assinatura)}
        </div>${contatoJuridicoHTML()}</div>`,
      ].join('\n');
      return documento(`${ord} Aditivo: ${ct.nome} | DIBREVA`, CSS_JURIDICO, corpo);
    };

    return { css: CSS_JURIDICO, blocos, capacidade: CAP_JURIDICO, rodape: [rodapeEsq, rodapeDir], montar };
  }

  // ---------------------------------------------------------------
  // RECIBO (A4, página única, sem capa)
  // O modelo original era A5 e estourava a página; aqui o mesmo layout
  // ocupa uma folha A4 com tipografia um pouco maior.
  // ---------------------------------------------------------------
  const CSS_RECIBO = `
    .page-header { padding:18px 40px; }
    .page-header::after { top:62px; }
    .header-left { display:flex; align-items:center; gap:12px; }
    .header-logo svg { width:40px; height:auto; }
    .header-logo-text { font-size:18px; }
    .header-sub { font-size:7px; letter-spacing:1.5px; }
    .header-right { text-align:right; }
    .header-doc-tipo { font-size:8px; font-weight:700; color:var(--laranja); letter-spacing:2px; text-transform:uppercase; }
    .header-doc-num { font-size:13px; font-weight:800; color:var(--branco); letter-spacing:1px; margin-top:1px; }
    .content { padding:22px 40px 16px; }
    .recibo-meta { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; }
    .recibo-numero-box { background:var(--azul-escuro); border-radius:6px; padding:10px 18px; text-align:center; }
    .recibo-numero-label { font-size:8px; font-weight:700; color:var(--cinza); letter-spacing:1.5px; text-transform:uppercase; margin-bottom:1px; }
    .recibo-numero-valor { font-size:18px; font-weight:800; color:var(--laranja); }
    .recibo-data-box { text-align:right; }
    .recibo-data-label { font-size:8px; font-weight:700; color:var(--texto-leve); letter-spacing:1.5px; text-transform:uppercase; margin-bottom:1px; }
    .recibo-data-valor { font-size:14px; font-weight:700; color:var(--azul-escuro); }
    .valor-destaque { background:linear-gradient(135deg, var(--azul-escuro), #2a3f54); border-radius:8px; padding:16px; text-align:center; margin-bottom:14px; }
    .valor-destaque .valor-label { font-size:9px; letter-spacing:2px; margin-bottom:4px; }
    .valor-destaque .valor-numero { font-size:34px; }
    .valor-destaque .valor-extenso { font-size:11px; margin-top:4px; }
    .section-tag { font-size:8px; letter-spacing:2px; padding:3px 12px; margin-bottom:6px; }
    .section-title { font-size:16px; margin-bottom:10px; }
    .parte-box { background:var(--cinza-claro); border-radius:6px; padding:12px 16px; border-left:4px solid var(--laranja); margin-bottom:10px; }
    .parte-label { font-size:8px; font-weight:700; color:var(--laranja); letter-spacing:1.5px; text-transform:uppercase; margin-bottom:3px; }
    .parte-nome { font-size:14px; font-weight:700; color:var(--azul-escuro); margin-bottom:3px; }
    .parte-info { font-size:11px; color:var(--texto-leve); line-height:1.6; }
    .parte-info strong { color:var(--azul-escuro); font-weight:600; }
    .descricao-box { border:1px solid #E8ECEF; border-radius:6px; overflow:hidden; margin:10px 0; }
    .descricao-header { background:var(--azul-escuro); color:var(--branco); padding:7px 16px; font-size:10px; font-weight:700; letter-spacing:0.5px; }
    .descricao-body { padding:12px 16px; font-size:11px; color:var(--texto); line-height:1.65; }
    .descricao-body p { margin-bottom:6px; }
    .descricao-body p:last-child { margin-bottom:0; }
    .pagamento-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin:10px 0; }
    .pagamento-item { background:var(--cinza-claro); border-radius:6px; padding:10px 14px; border-left:4px solid var(--laranja); }
    .pagamento-label { font-size:8px; font-weight:700; color:var(--laranja); letter-spacing:1px; text-transform:uppercase; margin-bottom:3px; }
    .pagamento-valor { font-size:12px; font-weight:700; color:var(--azul-escuro); }
    .declaracao-box { background:#FFF8F6; border:1px solid rgba(212,98,80,0.2); border-radius:6px; padding:12px 14px; margin:10px 0; font-size:11px; color:var(--texto); line-height:1.65; }
    .assinatura-section { margin-top:18px; text-align:center; }
    .data-local { text-align:center; font-size:12px; font-weight:500; color:var(--azul-escuro); margin-bottom:26px; }
    .assinatura-box { display:inline-block; text-align:center; min-width:280px; }
    .assinatura-cursiva { font-family:'Dancing Script', cursive; font-size:34px; font-weight:700; color:var(--azul-escuro); margin-bottom:8px; line-height:1; }
    .assinatura-linha { border-top:2px solid var(--azul-escuro); padding-top:8px; }
    .assinatura-nome { font-size:12px; font-weight:700; color:var(--azul-escuro); }
    .assinatura-cargo { font-size:9px; color:var(--texto-leve); margin-top:2px; text-transform:uppercase; letter-spacing:1px; }
    .assinatura-doc { font-size:9px; color:var(--texto-leve); margin-top:2px; }
    .digital-box { margin:14px 0 0; }
    .page-footer { background:var(--azul-escuro); padding:14px 40px; text-align:center; display:block; border-top:none; }
    .footer-empresa { font-size:12px; font-weight:700; color:var(--branco); letter-spacing:2px; margin-bottom:2px; }
    .footer-sub { font-size:7px; color:var(--cinza); letter-spacing:1px; margin-bottom:8px; }
    .footer-contatos { display:flex; justify-content:center; gap:22px; flex-wrap:wrap; }
    .footer-item { font-size:10px; color:var(--branco); font-weight:500; }
    .footer-item span { color:var(--laranja); font-weight:400; font-size:7px; display:block; letter-spacing:1px; text-transform:uppercase; margin-bottom:2px; }
  `;

  function normalizarRecibo(d) {
    const r = { ...d };
    r.numero = r.numero || 'RCB-0000-000';
    r.data_emissao = r.data_emissao || hojeISO();
    r.data_pagamento = r.data_pagamento || r.data_emissao;
    r.valor = round2(r.valor);
    r.pagador = r.pagador || {};
    r.servico_descricao = r.servico_descricao || 'manutenção e restauração predial';
    r.forma_pagamento = r.forma_pagamento || 'Transferência Bancária / PIX';
    r.cidade = r.cidade || EMPRESA.cidade;
    return r;
  }

  function construirRecibo(dados) {
    const r = normalizarRecibo(dados);
    const p = r.pagador;
    const m = r.numero.match(/^RCB-(\d{4})-(\d+)$/);
    const numDisplay = m ? `${m[2]}/${m[1]}` : r.numero;
    const pj = (p.documento_tipo || 'CNPJ').toUpperCase() === 'CNPJ';
    const end = [p.endereco, p.cep ? `CEP ${p.cep}` : '', p.bairro ? `Bairro ${p.bairro}` : '', p.cidade_uf].filter(Boolean).join(', ');
    const pagadorInfo = pj
      ? `Inscrito no <strong>CNPJ ${esc(p.documento || '')}</strong>${end ? `, situado à ${esc(end)}` : ''}${p.representante_nome ? `, representado por <strong>${esc(p.representante_nome)}</strong>${p.representante_cpf ? `, inscrito no CPF nº ${esc(p.representante_cpf)}` : ''}` : ''}.`
      : `Inscrito(a) no <strong>CPF ${esc(p.documento || '')}</strong>${end ? `, residente à ${esc(end)}` : ''}.`;

    const corpo = `
    <div class="page">
      <div class="page-header">
        <div class="header-left">
          <div class="header-logo">${LOGO_SVG}</div>
          <div><div class="header-logo-text">${EMPRESA.marca}</div><div class="header-sub">${EMPRESA.subtitulo}</div></div>
        </div>
        <div class="header-right"><div class="header-doc-tipo">Recibo de Pagamento</div><div class="header-doc-num">N° ${esc(numDisplay)}</div></div>
      </div>
      <div class="content">
        <div class="recibo-meta">
          <div class="recibo-numero-box"><div class="recibo-numero-label">Recibo N°</div><div class="recibo-numero-valor">${esc(numDisplay)}</div></div>
          <div class="recibo-data-box"><div class="recibo-data-label">Data de Emissão</div><div class="recibo-data-valor">${dataLonga(r.data_emissao, true)}</div></div>
        </div>
        <div class="valor-destaque">
          <div class="valor-label">Valor Recebido</div>
          <div class="valor-numero">${moeda(r.valor)}</div>
          <div class="valor-extenso">(${extenso(r.valor)})</div>
        </div>
        <div class="section-tag">Pagador</div>
        <div class="section-title">Identificação</div>
        <div class="parte-box">
          <div class="parte-label">Recebemos de</div>
          <div class="parte-nome">${esc(p.nome || '')}</div>
          <div class="parte-info">${pagadorInfo}</div>
        </div>
        <div class="descricao-box">
          <div class="descricao-header">Referente a</div>
          <div class="descricao-body">
            <p>Pagamento referente à prestação de serviços de <strong>${rich(r.servico_descricao)}</strong>${r.contrato_numero ? `, conforme Contrato de Prestação de Serviço <strong>Ref. ${esc(r.contrato_numero)}</strong>` : ''}${r.local_obra ? `, no ${esc(r.local_obra)}` : ''}.</p>
            ${r.parcela_descricao ? `<p>Correspondente à <strong>${rich(r.parcela_descricao)}</strong>.</p>` : ''}
          </div>
        </div>
        <div class="pagamento-grid">
          <div class="pagamento-item"><div class="pagamento-label">Forma de Pagamento</div><div class="pagamento-valor">${esc(r.forma_pagamento)}</div></div>
          <div class="pagamento-item"><div class="pagamento-label">Data do Pagamento</div><div class="pagamento-valor">${dataBR(r.data_pagamento)}</div></div>
        </div>
        <div class="declaracao-box">Para maior clareza, firmo o presente recibo, declarando ter recebido a importância acima especificada, dando plena, geral e irrevogável quitação do valor indicado, para que produza seus efeitos legais e jurídicos.</div>
        <div class="assinatura-section">
          <div class="data-local">${esc(r.cidade)}/${EMPRESA.uf}, ${dataLonga(r.data_emissao, true)}</div>
          <div class="assinatura-box">
            <div class="assinatura-cursiva">${EMPRESA.responsavelCurto}</div>
            <div class="assinatura-linha">
              <div class="assinatura-nome">${EMPRESA.responsavel}</div>
              <div class="assinatura-cargo">Sócia Gerente, ${EMPRESA.razao}</div>
              <div class="assinatura-doc">${EMPRESA.cauJuridico} | CPF ${EMPRESA.cpf}</div>
            </div>
          </div>
        </div>
        <div class="digital-box">
          <div class="digital-titulo">Assinatura Digital</div>
          <div class="digital-texto">Este documento poderá ser assinado eletronicamente pelas partes, por meio de plataforma de assinatura digital (ZapSign, GOV.BR ou equivalente), com validade jurídica conforme Lei nº 14.063/2020 e MP nº 2.200-2/2001.</div>
        </div>
      </div>
      <div class="page-footer">
        <div class="footer-empresa">${EMPRESA.marca}</div>
        <div class="footer-sub">${EMPRESA.subtitulo}</div>
        <div class="footer-contatos">
          <div class="footer-item"><span>CNPJ</span>${EMPRESA.cnpj}</div>
          <div class="footer-item"><span>Endereço</span>${EMPRESA.endereco}, ${EMPRESA.bairro}, ${EMPRESA.cidade}/${EMPRESA.uf}</div>
          <div class="footer-item"><span>Telefone</span>${EMPRESA.telefone}</div>
          <div class="footer-item"><span>E-mail</span>${EMPRESA.email}</div>
        </div>
      </div>
    </div>`;

    const montar = () => documento(`Recibo de Pagamento ${numDisplay} | DIBREVA`, CSS_RECIBO, corpo);
    return { css: CSS_RECIBO, blocos: [], capacidade: 0, rodape: [], montar };
  }

  // ---------------------------------------------------------------
  // API PÚBLICA
  // ---------------------------------------------------------------
  const CONSTRUTORES = { orcamento: construirOrcamento, contrato: construirContrato, aditivo: construirAditivo, recibo: construirRecibo };
  const PREFIXOS = { orcamento: 'ORC', contrato: 'CTR', aditivo: 'ADT', recibo: 'RCB' };
  const LABELS = { orcamento: 'Orçamento', contrato: 'Contrato', aditivo: 'Aditivo', recibo: 'Recibo' };

  function construir(tipo, dados) {
    const fn = CONSTRUTORES[tipo];
    if (!fn) throw new Error(`Tipo de documento desconhecido: ${tipo}`);
    return fn(dados || {});
  }

  /**
   * Renderização síncrona (estimativas de altura). Usada no Node e como fallback.
   * @param {string} tipo
   * @param {Object} dados
   * @param {number[]} [alturas] alturas reais dos blocos em px (opcional)
   * @param {number} [capacidade] capacidade real da página em px (opcional)
   */
  function render(tipo, dados, alturas, capacidade) {
    try {
      const b = construir(tipo, dados);
      const paginas = b.blocos.length ? paginar(b.blocos, capacidade || b.capacidade, alturas) : [];
      return b.montar(paginas);
    } catch (error) {
      console.error(`Erro ao renderizar ${tipo}:`, error);
      throw new Error(`Falha ao renderizar ${LABELS[tipo]}: ${error.message}`);
    }
  }

  // ---------------------------------------------------------------
  // MEDIÇÃO REAL NO NAVEGADOR
  // Mede cada bloco num iframe oculto (mesmo CSS, mesma largura A4, fontes
  // carregadas), pagina com as alturas reais e depois aplica o ajuste fino:
  // páginas apertadas recebem .compacto/.compacto2, páginas de etapas com
  // muito espaço sobrando recebem .folgada.
  // ---------------------------------------------------------------
  function criarIframeOculto(html) {
    return new Promise((resolve) => {
      const iframe = document.createElement('iframe');
      iframe.setAttribute('aria-hidden', 'true');
      iframe.style.cssText = 'position:fixed; left:-3000px; top:0; width:900px; height:1200px; visibility:hidden; border:0;';
      document.body.appendChild(iframe);
      iframe.addEventListener('load', async () => {
        try { await iframe.contentDocument.fonts.ready; } catch (_) { /* fontes opcionais */ }
        resolve(iframe);
      });
      iframe.srcdoc = html;
    });
  }

  async function medirEMontar(tipo, dados) {
    const b = construir(tipo, dados);
    let alturas = null, capacidade = b.capacidade;

    if (b.blocos.length) {
      const [esq, dir] = b.rodape;
      const htmlMedida = documento('medida', b.css, `
        <div class="page">${headerHTML(2, 9)}<div class="content" id="medidor"></div>${footerHTML(esq, dir)}</div>`);
      const iframe = await criarIframeOculto(htmlMedida);
      try {
        const doc = iframe.contentDocument;
        const medidor = doc.getElementById('medidor');
        const page = doc.querySelector('.page');
        const footer = doc.querySelector('.page-footer');
        const contentTop = medidor.getBoundingClientRect().top - page.getBoundingClientRect().top;
        const paddingBottom = parseFloat(doc.defaultView.getComputedStyle(medidor).paddingBottom) || 0;
        const paddingTop = parseFloat(doc.defaultView.getComputedStyle(medidor).paddingTop) || 0;
        const footerTop = footer.getBoundingClientRect().top - page.getBoundingClientRect().top;
        capacidade = Math.floor(footerTop - contentTop - paddingTop - paddingBottom - 4);
        alturas = b.blocos.map(bl => {
          medidor.innerHTML = `<div style="display:flow-root;">${bl.html}</div>`;
          return Math.ceil(medidor.firstElementChild.getBoundingClientRect().height);
        });
      } finally {
        iframe.remove();
      }
    }

    if (!b.blocos.length) return ajustarPaginas(b.montar([])).then(r => r.html);

    const paginas = paginar(b.blocos, capacidade, alturas);
    let resultado = await ajustarPaginas(b.montar(paginas));

    // Última página de fluxo muito vazia: tenta espremer com capacidade maior
    // (as páginas apertadas recebem .compacto). Só aceita se nada estourar.
    const ultimaVazia = alturas && paginas.length > 1 && (() => {
      const grupos = distribuir(b.blocos, capacidade, alturas);
      const usada = grupos[grupos.length - 1].reduce((s, i) => s + alturas[i], 0);
      return usada / capacidade < 0.5;
    })();
    if (ultimaVazia) {
      const apertadas = paginar(b.blocos, Math.floor(capacidade * 1.1), alturas);
      if (apertadas.length < paginas.length) {
        const tentativa = await ajustarPaginas(b.montar(apertadas));
        if (tentativa.ok) resultado = tentativa;
      }
    }
    return resultado.html;
  }

  async function ajustarPaginas(html) {
    const iframe = await criarIframeOculto(html);
    let ok = true;
    try {
      const doc = iframe.contentDocument;
      const paginas = Array.from(doc.querySelectorAll('.page'));
      // Mesmo critério do validador da DIBREVA: o padding-bottom do .content conta como conteúdo
      const sobra = (page) => {
        const content = page.querySelector('.content');
        const rodape = page.querySelector('.page-footer, .contato-final');
        if (!content || !rodape) return 0;
        return rodape.getBoundingClientRect().top - content.getBoundingClientRect().bottom; // >0 sobra, <0 estoura
      };
      for (const page of paginas) {
        if (page.classList.contains('capa')) continue;
        const content = page.querySelector('.content');
        if (!content) continue;
        let s = sobra(page);
        if (s < 0) { page.classList.add('compacto'); s = sobra(page); }
        if (s < 0) { page.classList.add('compacto2'); s = sobra(page); }
        if (s < 0) { ok = false; console.warn('Documento: página ainda apertada após ajuste', page); }
        // Página de etapas com muito espaço sobrando: espalha o conteúdo
        if (s > 0 && page.querySelector('.etapa') && !page.querySelector('.contato-final')) {
          const util = page.querySelector('.page-footer').getBoundingClientRect().top - content.getBoundingClientRect().top;
          if (s / util > 0.22) {
            page.classList.add('folgada');
            if (sobra(page) < 0) page.classList.remove('folgada');
          }
        }
      }
      return { ok, html: '<!DOCTYPE html>\n' + doc.documentElement.outerHTML };
    } finally {
      iframe.remove();
    }
  }

  /** Renderização recomendada no navegador (alturas reais + ajuste fino). */
  async function renderAsync(tipo, dados) {
    if (typeof document === 'undefined') return render(tipo, dados);
    try {
      const html = await medirEMontar(tipo, dados);
      if (typeof html !== 'string') throw new Error('medição não retornou HTML');
      return html;
    } catch (error) {
      console.error(`Erro na medição do ${tipo}, usando estimativa:`, error);
      return render(tipo, dados);
    }
  }

  /** Valor principal do documento (para a listagem/KPIs) */
  function valorDe(tipo, dados) {
    if (!dados) return 0;
    if (tipo === 'orcamento' || tipo === 'contrato') return num(dados.valor_total);
    if (tipo === 'aditivo') return num(dados.valor_aditivo);
    if (tipo === 'recibo') return num(dados.valor);
    return 0;
  }

  /** Título curto do documento */
  function tituloDe(tipo, dados) {
    const nome = dados?.cliente_nome || dados?.contratante?.nome || dados?.pagador?.nome || '';
    if (tipo === 'aditivo') return `${ORD_M[Number(dados?.ordinal) || 1] || ''} Aditivo: ${nome}`.trim();
    return `${LABELS[tipo]}: ${nome}`;
  }

  function contarPaginas(html) {
    return (html.match(/class="page[" ]/g) || []).length;
  }

  return { render, renderAsync, construir, valorDe, tituloDe, contarPaginas, extenso, EMPRESA, PREFIXOS, LABELS, hojeISO };
})();

if (typeof module !== 'undefined') module.exports = DocTemplates;
