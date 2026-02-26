// ===== Supabase Config =====
const SUPABASE_URL = 'https://xokskfdzsdxzieboqozq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_29mOMtIRKUJWI5ltD_GLZg_G7kMVqTE';

// Inicializa o cliente (nome diferente para não colidir com window.supabase da CDN)
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Verifica conexão
async function checkConnection() {
  try {
    const { error } = await sb.from('leads').select('id', { count: 'exact', head: true });
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Erro de conexão com Supabase:', err.message);
    return false;
  }
}
