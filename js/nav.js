// ===== Navegação Sidebar + Mobile =====

document.addEventListener('DOMContentLoaded', () => {
  // Mobile toggle
  const toggle = document.querySelector('.mobile-toggle');
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.mobile-overlay');

  if (toggle) {
    toggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('active');
    });
  }

  if (overlay) {
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
    });
  }

  // Mark active nav item
  const currentPage = window.location.pathname.split('/').pop() || 'crm.html';
  document.querySelectorAll('.sidebar-nav a').forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPage) {
      link.classList.add('active');
    }
  });
});

// SVG do Logo DIBREVA (inline)
function renderLogo() {
  return `
    <svg viewBox="0 0 200 60" xmlns="http://www.w3.org/2000/svg">
      <!-- Retângulo (edifício) -->
      <rect x="4" y="8" width="28" height="44" rx="2" fill="none" stroke="#D46250" stroke-width="2.5"/>
      <!-- 3 Chevrons (elevação) -->
      <polyline points="12,36 18,28 24,36" fill="none" stroke="#D46250" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <polyline points="12,30 18,22 24,30" fill="none" stroke="#D46250" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <polyline points="12,24 18,16 24,24" fill="none" stroke="#D46250" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <!-- Texto DIBREVA -->
      <text x="42" y="32" font-family="Montserrat, sans-serif" font-weight="800" font-size="20" fill="white" letter-spacing="3">DIBREVA</text>
      <!-- Tagline -->
      <text x="42" y="48" font-family="Calibri, sans-serif" font-size="8" fill="#A6B0B3" letter-spacing="1.5">MANUTENÇÃO &amp; RESTAURAÇÃO PREDIAL</text>
    </svg>
  `;
}

// Gera o HTML da sidebar
function renderSidebar(activePage) {
  return `
    <div class="sidebar-brand">
      <div class="sidebar-logo">${renderLogo()}</div>
    </div>
    <div class="sidebar-divider"></div>

    <div class="sidebar-section">Módulos</div>
    <ul class="sidebar-nav">
      <li><a href="crm.html" ${activePage === 'crm' ? 'class="active"' : ''}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
        CRM
      </a></li>
      <li><a href="obras.html" ${activePage === 'obras' ? 'class="active"' : ''}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
        </svg>
        Obras
      </a></li>
      <li><a href="financeiro.html" ${activePage === 'financeiro' ? 'class="active"' : ''}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
        </svg>
        Financeiro
      </a></li>
    </ul>

    <div class="sidebar-section">Sistema</div>
    <ul class="sidebar-nav">
      <li><a href="setup.html" ${activePage === 'setup' ? 'class="active"' : ''}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
        Configurações
      </a></li>
    </ul>

    <div class="sidebar-footer">
      <small>DIBREVA Mini ERP v1.0</small>
    </div>
  `;
}
