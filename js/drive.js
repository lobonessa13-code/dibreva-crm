// ===== Cliente da integração Google Drive (funções em /api/drive/*) =====

const Drive = {
  async token() {
    const { data } = await sb.auth.getSession();
    const t = data?.session?.access_token;
    if (!t) throw new Error('Sessão expirada. Faça login de novo.');
    return t;
  },

  async chamar(caminho, opts = {}) {
    const token = await this.token();
    let resp;
    try {
      resp = await fetch(`/api/drive/${caminho}`, {
        ...opts,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
      });
    } catch (err) {
      console.error(`Erro de rede em /api/drive/${caminho}:`, err);
      throw new Error('Não foi possível falar com o servidor do CRM.');
    }
    const texto = await resp.text();
    let j = {};
    try { j = texto ? JSON.parse(texto) : {}; } catch (_) { j = { erro: texto.slice(0, 200) }; }
    if (!resp.ok) throw new Error(j.erro || `Erro ${resp.status}`);
    return j;
  },

  status() { return this.chamar('status'); },

  async conectar() {
    const { url } = await this.chamar('auth');
    window.location.href = url;
  },

  desconectar() { return this.chamar('status', { method: 'DELETE' }); },

  /** Gera o PDF no servidor e publica no Drive. Retorna { url, pasta, caminho }. */
  publicar(documentoId, html) {
    return this.chamar('publicar', { method: 'POST', body: JSON.stringify({ documento_id: documentoId, html }) });
  },
};
