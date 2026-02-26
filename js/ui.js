// ===== UI Helpers: Modais, Toasts, Formatadores =====

const UI = {
  // --- Toasts ---
  toast(message, type = 'success') {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  },

  success(msg) { this.toast(msg, 'success'); },
  error(msg) { this.toast(msg, 'error'); },
  warning(msg) { this.toast(msg, 'warning'); },
  info(msg) { this.toast(msg, 'info'); },

  // --- Modais ---
  openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add('active');
  },

  closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('active');
  },

  closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
  },

  // --- Formatadores ---
  moeda(valor) {
    if (valor === null || valor === undefined) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  },

  data(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR');
  },

  dataISO(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toISOString().split('T')[0];
  },

  telefone(tel) {
    if (!tel) return '—';
    const nums = tel.replace(/\D/g, '');
    if (nums.length === 11) return `(${nums.slice(0,2)}) ${nums.slice(2,7)}-${nums.slice(7)}`;
    if (nums.length === 10) return `(${nums.slice(0,2)}) ${nums.slice(2,6)}-${nums.slice(6)}`;
    return tel;
  },

  // --- Labels de Status ---
  statusLabel(status) {
    const labels = {
      lead: 'Lead',
      visita_tecnica: 'Visita Técnica',
      orcamento_enviado: 'Orçamento Enviado',
      negociacao: 'Negociação',
      aprovado: 'Aprovado',
      perdido: 'Perdido',
      planejamento: 'Planejamento',
      em_execucao: 'Em Execução',
      finalizada: 'Finalizada',
      previsto: 'Previsto',
      recebido: 'Recebido',
      pendente: 'Pendente',
      pago: 'Pago'
    };
    return labels[status] || status;
  },

  statusBadge(status) {
    return `<span class="badge badge-${status}">${this.statusLabel(status)}</span>`;
  },

  // --- Confirmação ---
  async confirm(message) {
    return window.confirm(message);
  },

  // --- Paginação ---
  paginate(items, page, perPage = 10) {
    const start = (page - 1) * perPage;
    const end = start + perPage;
    return {
      items: items.slice(start, end),
      total: items.length,
      totalPages: Math.ceil(items.length / perPage),
      page,
      perPage
    };
  },

  renderPagination(containerId, currentPage, totalPages, onPageChange) {
    const container = document.getElementById(containerId);
    if (!container || totalPages <= 1) {
      if (container) container.innerHTML = '';
      return;
    }

    let html = `<span>Página ${currentPage} de ${totalPages}</span><div class="pagination-btns">`;
    html += `<button ${currentPage === 1 ? 'disabled' : ''} onclick="${onPageChange}(${currentPage - 1})">‹</button>`;

    for (let i = 1; i <= totalPages; i++) {
      if (totalPages > 7 && i > 3 && i < totalPages - 2 && Math.abs(i - currentPage) > 1) {
        if (i === 4 || i === totalPages - 3) html += `<button disabled>…</button>`;
        continue;
      }
      html += `<button class="${i === currentPage ? 'active' : ''}" onclick="${onPageChange}(${i})">${i}</button>`;
    }

    html += `<button ${currentPage === totalPages ? 'disabled' : ''} onclick="${onPageChange}(${currentPage + 1})">›</button>`;
    html += '</div>';
    container.innerHTML = html;
  },

  // --- Exportar CSV ---
  exportCSV(data, filename, columns) {
    if (!data.length) return UI.warning('Nenhum dado para exportar');
    const headers = columns.map(c => c.label).join(',');
    const rows = data.map(row => columns.map(c => {
      let val = c.accessor(row);
      if (typeof val === 'string') val = `"${val.replace(/"/g, '""')}"`;
      return val ?? '';
    }).join(','));
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    UI.success('CSV exportado!');
  },

  // --- Loading state ---
  setLoading(elementId, loading = true) {
    const el = document.getElementById(elementId);
    if (!el) return;
    if (loading) {
      el.dataset.originalContent = el.innerHTML;
      el.innerHTML = '<div class="spinner"></div>';
    } else if (el.dataset.originalContent) {
      el.innerHTML = el.dataset.originalContent;
      delete el.dataset.originalContent;
    }
  },

  // --- Meses em português ---
  mesNome(mes) {
    const nomes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    return nomes[mes - 1] || '';
  }
};

// Fechar modais com click no overlay
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
  }
});

// Fechar modais com Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') UI.closeAllModals();
});
