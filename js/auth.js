// ===== Autenticação Supabase =====

const Auth = {
  // Verifica se o usuário está logado E autorizado (e-mail na tabela
  // usuarios_autorizados). Caso contrário redireciona para login.html.
  async guard() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
      window.location.href = 'login.html';
      return false;
    }

    const autorizado = await this.isAutorizado();
    if (!autorizado) {
      await sb.auth.signOut();
      window.location.href = 'login.html?erro=nao-autorizado';
      return false;
    }
    return true;
  },

  // Consulta a função usuario_autorizado() no banco (RLS usa a mesma).
  // Em caso de erro de rede/banco, nega o acesso por segurança.
  async isAutorizado() {
    try {
      const { data, error } = await sb.rpc('usuario_autorizado');
      if (error) {
        console.error('Erro ao verificar autorização:', error.message);
        return false;
      }
      return data === true;
    } catch (err) {
      console.error('Erro ao verificar autorização:', err);
      return false;
    }
  },

  // Login com email e senha
  async login(email, password) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  // Logout
  async logout() {
    await sb.auth.signOut();
    window.location.href = 'login.html';
  },

  // Retorna o usuário logado
  async getUser() {
    const { data: { user } } = await sb.auth.getUser();
    return user;
  }
};
