// GET /api/drive/status → { conectado, email, connected_at }
// DELETE /api/drive/status → desconecta (remove o refresh token)
const { exigirUsuario, lerIntegracao, removerIntegracao, json, tratarErro } = require('./_lib');

module.exports = async (req, res) => {
  try {
    const { sb } = await exigirUsuario(req);
    if (req.method === 'DELETE') {
      await removerIntegracao(sb);
      return json(res, 200, { conectado: false });
    }
    if (req.method !== 'GET') return json(res, 405, { erro: 'Método não permitido' });
    const integ = await lerIntegracao(sb);
    json(res, 200, { conectado: !!integ?.refresh_token, email: integ?.email || null, connected_at: integ?.connected_at || null });
  } catch (error) {
    tratarErro(res, error, 'drive/status');
  }
};
