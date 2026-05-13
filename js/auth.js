// ===== Autenticação Supabase =====

const Auth = {
  // Verifica se o usuário está logado — redireciona para login.html se não
  async guard() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
      window.location.href = 'login.html';
      return false;
    }
    return true;
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
