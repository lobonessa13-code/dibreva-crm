// GET /api/drive/auth  → { url } para iniciar a autorização do Google Drive (exige login no CRM)
const { exigirUsuario, urlDeAutorizacao, json, tratarErro } = require('./_lib');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'GET') return json(res, 405, { erro: 'Método não permitido' });
    await exigirUsuario(req);
    json(res, 200, { url: urlDeAutorizacao() });
  } catch (error) {
    tratarErro(res, error, 'drive/auth');
  }
};
