// POST /api/drive/publicar  { documento_id, html }
// Gera o PDF do documento (Chrome headless, idêntico ao PDF do terminal), cria a pasta
// do cliente no Drive da DIBREVA se não existir, sobe PDF + HTML e grava o link no documento.
//
// Árvore no Drive (confirmada pela Vanessa em 2026-06-17):
//   DIBREVA/01 - ADMINISTRATIVO/01 - ORCAMENTOS/1 - 2026/{Cliente}/
//   DIBREVA/01 - ADMINISTRATIVO/02 - CONTRATOS/1 - 2026/{CLIENTE}/
//   DIBREVA/01 - ADMINISTRATIVO/03 - ADITIVO/1 - 2026/{CLIENTE}/
//   DIBREVA/01 - ADMINISTRATIVO/04 - RECIBOS/1 - 2026/{Cliente}/   (criada se não existir)

const { exigirUsuario, accessTokenDrive, garantirPasta, enviarArquivo, json, tratarErro } = require('./_lib');

const PASTAS_TIPO = { orcamento: '01 - ORCAMENTOS', contrato: '02 - CONTRATOS', aditivo: '03 - ADITIVO', recibo: '04 - RECIBOS' };
const NOME_TIPO = { orcamento: 'Orcamento', contrato: 'Contrato', aditivo: 'Aditivo', recibo: 'Recibo' };
const MAIUSCULAS = new Set(['contrato', 'aditivo']); // padrão das pastas de contratos e aditivos

const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '');
const limparNomePasta = (s) => String(s || '').replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim();

function nomeCliente(doc) {
  const d = doc.dados || {};
  return d.cliente_nome || d.contratante?.nome || d.pagador?.nome || doc.titulo.split(': ').slice(1).join(': ') || 'Sem cliente';
}

async function gerarPDF(html) {
  const chromium = require('@sparticuz/chromium');
  const puppeteer = require('puppeteer-core');
  const browser = await puppeteer.launch({
    args: [...chromium.args, '--font-render-hinting=none'],
    defaultViewport: { width: 1240, height: 1754 },
    executablePath: await chromium.executablePath(),
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 40000 });
    try { await page.evaluate(() => document.fonts && document.fonts.ready); } catch (_) { /* fontes opcionais */ }
    await page.emulateMediaType('print');
    return await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  } finally {
    await browser.close();
  }
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return json(res, 405, { erro: 'Método não permitido' });
    const { sb } = await exigirUsuario(req);
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { documento_id, html } = body;
    if (!documento_id || !html) return json(res, 400, { erro: 'Informe documento_id e html' });
    if (html.length > 2_000_000) return json(res, 413, { erro: 'HTML grande demais' });

    const { data: doc, error } = await sb.from('documentos').select('*').eq('id', documento_id).is('deleted_at', null).single();
    if (error || !doc) return json(res, 404, { erro: 'Documento não encontrado' });

    const { token, email } = await accessTokenDrive(sb);

    // 1. PDF
    const pdf = await gerarPDF(html);

    // 2. Pastas
    const ano = String(doc.data_documento || new Date().toISOString()).slice(0, 4);
    const raiz = await garantirPasta(token, 'DIBREVA', null);
    const adm = await garantirPasta(token, '01 - ADMINISTRATIVO', raiz.id);
    const tipoPasta = await garantirPasta(token, PASTAS_TIPO[doc.tipo], adm.id);
    const anoPasta = await garantirPasta(token, `1 - ${ano}`, tipoPasta.id, { regex: new RegExp(`^\\d+\\s*-\\s*${ano}$`) });
    let cliente = limparNomePasta(nomeCliente(doc));
    if (MAIUSCULAS.has(doc.tipo)) cliente = cliente.toUpperCase();
    const clientePasta = await garantirPasta(token, cliente, anoPasta.id);

    // 3. Arquivos (atualiza se já publicou antes)
    const base = `${slug(nomeCliente(doc))}-${NOME_TIPO[doc.tipo]}-${doc.numero}-DIBREVA`;
    const pdfFile = await enviarArquivo(token, { nome: `${base}.pdf`, mime: 'application/pdf', conteudo: pdf, parentId: clientePasta.id, fileId: doc.drive_pdf_id || undefined });
    const htmlFile = await enviarArquivo(token, { nome: `${base}.html`, mime: 'text/html', conteudo: html, parentId: clientePasta.id, fileId: doc.drive_html_id || undefined });

    // 4. Grava no documento
    const pastaUrl = `https://drive.google.com/drive/folders/${clientePasta.id}`;
    const { error: upErr } = await sb.from('documentos').update({
      drive_url: pdfFile.webViewLink || pastaUrl,
      drive_pasta_url: pastaUrl,
      drive_pdf_id: pdfFile.id,
      drive_html_id: htmlFile.id,
      publicado_em: new Date().toISOString(),
    }).eq('id', doc.id);
    if (upErr) throw new Error(`PDF subiu, mas não gravou o link no documento: ${upErr.message}`);

    json(res, 200, { ok: true, url: pdfFile.webViewLink || pastaUrl, pasta: pastaUrl, conta: email, caminho: `DIBREVA/01 - ADMINISTRATIVO/${PASTAS_TIPO[doc.tipo]}/${anoPasta.name}/${clientePasta.name}/${base}.pdf` });
  } catch (error) {
    tratarErro(res, error, 'drive/publicar');
  }
};
