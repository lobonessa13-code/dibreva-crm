// GET /api/drive/callback?code=...&state=...  → guarda o refresh token e volta para o CRM
const { APP_URL, supabaseAdmin, validarState, trocarCodigo, emailDoToken, salvarIntegracao } = require('./_lib');

module.exports = async (req, res) => {
  const voltar = (params) => {
    res.statusCode = 302;
    res.setHeader('Location', `${APP_URL}/setup.html?${new URLSearchParams(params).toString()}`);
    res.end();
  };
  try {
    const { code, state, error } = req.query || {};
    if (error) return voltar({ drive: 'erro', motivo: String(error) });
    if (!code || !validarState(state)) return voltar({ drive: 'erro', motivo: 'Autorização inválida ou expirada. Tente de novo.' });

    const tokens = await trocarCodigo(code);
    if (!tokens.refresh_token) return voltar({ drive: 'erro', motivo: 'O Google não devolveu o token de acesso permanente. Remova o acesso do app em myaccount.google.com/permissions e conecte de novo.' });

    const email = await emailDoToken(tokens.access_token);
    await salvarIntegracao(supabaseAdmin(), {
      refresh_token: tokens.refresh_token,
      email,
      scope: tokens.scope,
      connected_at: new Date().toISOString(),
    });
    voltar({ drive: 'conectado', email: email || '' });
  } catch (err) {
    console.error('Erro em drive/callback:', err);
    voltar({ drive: 'erro', motivo: err.message || 'Erro interno' });
  }
};
