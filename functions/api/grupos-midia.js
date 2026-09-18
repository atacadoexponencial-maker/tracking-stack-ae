// POST /api/grupos-midia?key=...  — sobe um arquivo para ser agendado
//
// multipart/form-data, campo `arquivo`. Devolve a ficha pronta, com a URL
// pública que a Evolution vai baixar na hora do envio.
//
// Toda a validação é aqui, nunca no formulário: tipo, extensão e tamanho. E é
// AQUI mesmo que ela tem que acontecer — recusar um arquivo grande demais no
// momento em que a pessoa escolhe é gentil; descobrir isso às 12h da live,
// quando o disparo falha, não é.

import { classificar, validarTamanho, guardar, urlPublica } from './_midia.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  const url = new URL(request.url);
  if (!env.DASH_KEY || url.searchParams.get('key') !== env.DASH_KEY) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let arquivo;
  try {
    const form = await request.formData();
    arquivo = form.get('arquivo');
  } catch {
    return json({ error: 'Envio inválido: esperado multipart/form-data.' }, 400);
  }

  if (!arquivo || typeof arquivo.arrayBuffer !== 'function') {
    return json({ error: 'Nenhum arquivo enviado.' }, 400);
  }

  const tipo = classificar(arquivo.name);
  // 415 e não 400: o pedido está bem formado, o que não serve é o tipo do
  // arquivo — e a tela mostra mensagens diferentes para os dois casos.
  if (tipo.erro) return json({ error: tipo.erro }, 415);

  const bytes = new Uint8Array(await arquivo.arrayBuffer());

  const tamanho = validarTamanho(tipo.mediatype, bytes.length);
  if (tamanho.erro) return json({ error: tamanho.erro }, 413);

  const agora = Math.floor(Date.now() / 1000);
  const { id, chave } = await guardar(env, {
    bytes, nome: arquivo.name, mimetype: tipo.mimetype, mediatype: tipo.mediatype,
  }, agora);

  return json({
    id,
    chave,
    nome: arquivo.name,
    mediatype: tipo.mediatype,
    mimetype: tipo.mimetype,
    tamanho: bytes.length,
    url: urlPublica(env, chave),
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
