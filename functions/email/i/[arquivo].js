// GET /email/i/<chave>.<ext> — imagem de e-mail (spec-editor-email.md, módulo 4; issue 392).
//
// PÚBLICA de propósito: quem abre é o leitor de e-mail de cada lead, que não
// tem como se autenticar. A proteção é a chave de 32 hex aleatórios.
//
// Imagem apagada da biblioteca CONTINUA respondendo: e-mails já enviados
// apontam para este endereço, e apagar só tira a imagem da lista.
//
// O conteúdo de uma chave nunca muda (chave nova a cada envio), então o cache é
// de um ano e a borda da Cloudflare guarda a resposta: o KV só é lido uma vez
// por região, mesmo com milhares de aberturas.
import { fichaPorChave, lerBytes } from '../../api/_email-imagens.js';

export async function onRequestGet(context) {
  const { request, env, params, waitUntil } = context;
  const m = /^([0-9a-f]{32})\.(png|jpg|gif|webp)$/.exec(String(params?.arquivo || ''));
  if (!m) return naoEncontrado();

  const cache = typeof caches !== 'undefined' ? caches.default : null;
  if (cache) {
    const guardada = await cache.match(request);
    if (guardada) return guardada;
  }

  const f = await fichaPorChave(env, m[1]);
  if (!f || f.extensao !== m[2]) return naoEncontrado();
  const bytes = await lerBytes(env, f.chave);
  if (!bytes) return naoEncontrado();

  const resp = new Response(bytes, {
    headers: {
      'Content-Type': f.mimetype,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Access-Control-Allow-Origin': '*',
    },
  });
  if (cache) {
    const p = cache.put(request, resp.clone());
    if (waitUntil) waitUntil(p); else await p;
  }
  return resp;
}

function naoEncontrado() {
  return new Response('Não encontrado', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
