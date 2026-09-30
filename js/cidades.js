// ===================================================================
// Cidades — grafia padrão e sugestões da região da AMREC
// Evita "Criciuma", "CRICIÚMA" e "Criciúma" virarem 3 cidades nos gráficos
// ===================================================================
const Cidades = {
  // Municípios da AMREC (Associação dos Municípios da Região Carbonífera)
  amrec: [
    'Balneário Rincão', 'Cocal do Sul', 'Criciúma', 'Forquilhinha', 'Içara', 'Lauro Müller',
    'Morro da Fumaça', 'Nova Veneza', 'Orleans', 'Siderópolis', 'Treviso', 'Urussanga'
  ],

  // Outras cidades que já aparecem nos cadastros
  outras: ['Araranguá', 'Maracajá', 'Sombrio', 'São Joaquim'],

  // Grafias abreviadas que já foram digitadas
  apelidos: { 'rincao': 'Balneário Rincão' },

  chave(txt) {
    return String(txt || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/\s+/g, ' ').trim();
  },

  // "criciuma" / "CRICIÚMA" -> "Criciúma"; cidade fora da lista só tem espaços ajustados
  normalizar(txt) {
    const limpo = String(txt || '').replace(/\s+/g, ' ').trim();
    if (!limpo) return limpo;
    const k = this.chave(limpo);
    const conhecida = [...this.amrec, ...this.outras].find(c => this.chave(c) === k);
    return conhecida || this.apelidos[k] || limpo;
  },

  // Liga a lista de sugestões ao campo e padroniza ao sair dele
  ligar(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (!document.getElementById('lista-cidades')) {
      const dl = document.createElement('datalist');
      dl.id = 'lista-cidades';
      dl.innerHTML = [...this.amrec, ...this.outras].map(c => `<option value="${c}">`).join('');
      document.body.appendChild(dl);
    }
    input.setAttribute('list', 'lista-cidades');
    input.setAttribute('autocomplete', 'off');
    input.addEventListener('change', () => { input.value = this.normalizar(input.value); });
  }
};
