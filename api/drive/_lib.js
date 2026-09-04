// ===== Utilitários compartilhados das funções do Google Drive =====
// Variáveis de ambiente necessárias na Vercel:
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET  (cliente OAuth do projeto "DIBREVA CRM")
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (JWT legacy service_role)
//   APP_URL (opcional, padrão https://dibreva-crm.vercel.app)

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const APP_URL = (process.env.APP_URL || 'https://dibreva-crm.vercel.app').replace(/\/$/, '');
const REDIRECT_URI = `${APP_URL}/api/drive/callback`;
const SCOPES = ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/userinfo.email'];
const CHAVE_INTEGRACAO = 'google_drive';

function env(nome) {
  const v = (process.env[nome] || '').trim();
  if (!v) throw new Error(`Variável de ambiente ${nome} não configurada na Vercel`);
  return v;
}

// Chave pública do CRM (a mesma de js/supabase-config.js): serve só para validar a sessão do usuário
const PUBLISHABLE_KEY = (process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_29mOMtIRKUJWI5ltD_GLZg_G7kMVqTE').trim();

function supabaseAdmin() {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Valida o JWT do usuário do CRM (header Authorization: Bearer ...) */
async function exigirUsuario(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) { const e = new Error('Não autenticado'); e.status = 401; throw e; }
  const publico = createClient(env('SUPABASE_URL'), PUBLISHABLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await publico.auth.getUser(token);
  const sb = supabaseAdmin();
  if (error || !data?.user) {
    console.error('Falha ao validar sessão:', error);
    const motivo = error?.message ? ` (${error.message})` : '';
    const e = new Error(`Sessão inválida. Faça login de novo no CRM.${motivo}`); e.status = 401; throw e;
  }
  return { user: data.user, sb };
}

// ---- state assinado (protege o callback contra fluxos iniciados por terceiros) ----
function assinarState() {
  const payload = `${Date.now()}.${crypto.randomBytes(8).toString('hex')}`;
  const mac = crypto.createHmac('sha256', env('GOOGLE_CLIENT_SECRET')).update(payload).digest('hex');
  return `${payload}.${mac}`;
}

function validarState(state) {
  if (!state) return false;
  const partes = String(state).split('.');
  if (partes.length !== 3) return false;
  const [ts, nonce, mac] = partes;
  const esperado = crypto.createHmac('sha256', env('GOOGLE_CLIENT_SECRET')).update(`${ts}.${nonce}`).digest('hex');
  if (mac.length !== esperado.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(esperado))) return false;
  return Date.now() - Number(ts) < 10 * 60 * 1000; // 10 minutos
}

function urlDeAutorizacao() {
  const p = new URLSearchParams({
    client_id: env('GOOGLE_CLIENT_ID'),
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: assinarState(),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}

async function trocarCodigo(code) {
  const body = new URLSearchParams({
    code,
    client_id: env('GOOGLE_CLIENT_ID'),
    client_secret: env('GOOGLE_CLIENT_SECRET'),
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code',
  });
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  const j = await r.json();
  if (!r.ok) throw new Error(`Google recusou o código: ${j.error_description || j.error || r.status}`);
  return j;
}

async function emailDoToken(accessToken) {
  const r = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${accessToken}` } });
  const j = await r.json().catch(() => ({}));
  return j.email || null;
}

// ---- integração persistida (tabela integracoes, só service role) ----
async function lerIntegracao(sb) {
  const { data, error } = await sb.from('integracoes').select('valor').eq('chave', CHAVE_INTEGRACAO).maybeSingle();
  if (error) {
    const k = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    throw new Error(`Erro ao ler integração (confira SUPABASE_SERVICE_ROLE_KEY na Vercel: valor atual começa com "${k.slice(0, 6)}" e tem ${k.length} caracteres; o esperado começa com "eyJhbG" e tem mais de 200): ${error.message}`);
  }
  return data?.valor || null;
}

async function salvarIntegracao(sb, valor) {
  const { error } = await sb.from('integracoes').upsert({ chave: CHAVE_INTEGRACAO, valor, updated_at: new Date().toISOString() });
  if (error) throw new Error(`Erro ao salvar integração: ${error.message}`);
}

async function removerIntegracao(sb) {
  const { error } = await sb.from('integracoes').delete().eq('chave', CHAVE_INTEGRACAO);
  if (error) throw new Error(`Erro ao remover integração: ${error.message}`);
}

/** Access token novo a partir do refresh token guardado */
async function accessTokenDrive(sb) {
  const integ = await lerIntegracao(sb);
  if (!integ?.refresh_token) { const e = new Error('Google Drive não conectado. Conecte em Configurações.'); e.status = 409; throw e; }
  const body = new URLSearchParams({
    client_id: env('GOOGLE_CLIENT_ID'),
    client_secret: env('GOOGLE_CLIENT_SECRET'),
    refresh_token: integ.refresh_token,
    grant_type: 'refresh_token',
  });
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  const j = await r.json();
  if (!r.ok) {
    const e = new Error(`Google não renovou o acesso (${j.error || r.status}). Reconecte o Drive em Configurações.`);
    e.status = 409; throw e;
  }
  return { token: j.access_token, email: integ.email };
}

// ---- Drive API (fetch puro) ----
async function driveFetch(token, url, opts = {}) {
  const r = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) } });
  const texto = await r.text();
  let j = {};
  try { j = texto ? JSON.parse(texto) : {}; } catch (_) { j = { raw: texto }; }
  if (!r.ok) throw new Error(`Drive API ${r.status}: ${j.error?.message || texto.slice(0, 200)}`);
  return j;
}

const escQ = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

async function buscarPasta(token, nome, parentId, { regex } = {}) {
  const q = [
    "mimeType = 'application/vnd.google-apps.folder'",
    'trashed = false',
    parentId ? `'${escQ(parentId)}' in parents` : "'root' in parents",
  ];
  if (!regex) q.push(`name = '${escQ(nome)}'`);
  const j = await driveFetch(token, `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q.join(' and '))}&fields=files(id,name)&pageSize=200&supportsAllDrives=true&includeItemsFromAllDrives=true`);
  const arquivos = j.files || [];
  if (regex) return arquivos.find(f => regex.test(f.name)) || null;
  // 1) exata; 2) sem maiúsculas/acentos; 3) pelo "nome-chave" do cliente (ignora palavras
  // genéricas como Residencial, Edifício, EDF, Condomínio), desde que só UMA pasta combine.
  // Ex.: "Residencial Helena" reaproveita a pasta "HELENA - EDF".
  const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const exata = arquivos.find(f => f.name === nome) || arquivos.find(f => norm(f.name) === norm(nome));
  if (exata) return exata;
  const chave = chaveCliente(nome);
  if (chave.length >= 4) {
    const candidatos = arquivos.filter(f => { const c = chaveCliente(f.name); return c && (c === chave || c.includes(chave) || chave.includes(c)); });
    if (candidatos.length === 1) return candidatos[0];
  }
  return null;
}

const PALAVRAS_GENERICAS = new Set(['residencial', 'res', 'edificio', 'edf', 'ed', 'condominio', 'cond', 'predio', 'torre', 'ltda', 'me', 'sa', 'de', 'do', 'da', 'dos', 'das', 'e', 'o', 'a']);
function chaveCliente(nome) {
  return String(nome).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(w => w && !PALAVRAS_GENERICAS.has(w)).join(' ');
}

async function criarPasta(token, nome, parentId) {
  return driveFetch(token, 'https://www.googleapis.com/drive/v3/files?fields=id,name&supportsAllDrives=true', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: nome, mimeType: 'application/vnd.google-apps.folder', parents: parentId ? [parentId] : undefined }),
  });
}

async function garantirPasta(token, nome, parentId, opcoes) {
  const existente = await buscarPasta(token, nome, parentId, opcoes);
  if (existente) return existente;
  return criarPasta(token, nome, parentId);
}

/** Upload (ou atualização) multipart de um arquivo */
async function enviarArquivo(token, { nome, mime, conteudo, parentId, fileId }) {
  const boundary = `dibreva${crypto.randomBytes(8).toString('hex')}`;
  const meta = fileId ? { name: nome } : { name: nome, parents: [parentId] };
  const partes = [
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n`,
    `--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`,
  ];
  const corpo = Buffer.concat([Buffer.from(partes.join(''), 'utf8'), Buffer.isBuffer(conteudo) ? conteudo : Buffer.from(conteudo, 'utf8'), Buffer.from(`\r\n--${boundary}--`, 'utf8')]);
  const url = fileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart&fields=id,webViewLink&supportsAllDrives=true`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink&supportsAllDrives=true';
  return driveFetch(token, url, { method: fileId ? 'PATCH' : 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body: corpo });
}

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function tratarErro(res, error, contexto) {
  console.error(`Erro em ${contexto}:`, error);
  json(res, error.status || 500, { erro: error.message || 'Erro interno' });
}

module.exports = {
  APP_URL, REDIRECT_URI, supabaseAdmin, exigirUsuario, urlDeAutorizacao, validarState, trocarCodigo, emailDoToken,
  lerIntegracao, salvarIntegracao, removerIntegracao, accessTokenDrive, buscarPasta, criarPasta, garantirPasta, enviarArquivo, json, tratarErro,
};
