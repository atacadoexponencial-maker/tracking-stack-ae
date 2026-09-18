// GET  /api/grupos-catalogo?key=...  → todos os grupos do número, com quais são monitorados
// POST /api/grupos-catalogo?key=...  → { group_jid, acao: 'monitorar' | 'desligar' | 'meta', ligar? }
//
// Consome o card "Grupos monitorados" da aba Grupos. Endpoint ADITIVO:
// /api/grupos e /api/grupos-conexao não foram tocados.
//
// Fica separado do /api/grupos-conexao de propósito, mesmo os dois falando com
// a Evolution: este aqui lista TODOS os grupos e é lento (a usuária clicou e
// está esperando), enquanto aquele é consultado a cada abertura da aba e
// precisa ser rápido. Juntar os dois faria a aba inteira esperar por uma lista
// que quase nunca muda.
//
// A apikey da Evolution nunca chega ao navegador — as consultas acontecem aqui.

import { catalogo, monitorar, desligar, alternarMeta } from './_grupos-catalogo.js';

export async function onRequestGet(context) {
  const { request, env, fetchImpl = fetch } = context;
  if (!autorizado(request, env)) return json({ error: 'Unauthorized' }, 401);

  const r = await catalogo(env, fetchImpl);
  // 200 mesmo com erro da Evolution: a tela precisa distinguir "não consegui
  // falar com o WhatsApp" de "você não tem permissão", e mostrar o motivo.
  return json(r.ok ? { ok: true, grupos: r.grupos } : { ok: false, error: r.erro, grupos: [] });
}

export async function onRequestPost(context) {
  const { request, env, fetchImpl = fetch } = context;
  if (!autorizado(request, env)) return json({ error: 'Unauthorized' }, 401);

  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  const agora = Math.floor(Date.now() / 1000);
  const jid = corpo?.group_jid;

  if (corpo?.acao === 'desligar') {
    const r = await desligar(env, jid);
    return r.ok ? json({ ok: true }) : json({ error: r.erro }, 400);
  }

  if (corpo?.acao === 'meta') {
    const r = await alternarMeta(env, jid, !!corpo.ligar, agora);
    return r.ok ? json({ ok: true }) : json({ error: r.erro }, 400);
  }

  if (corpo?.acao === 'monitorar') {
    const r = await monitorar(env, jid, agora, fetchImpl);
    return r.ok ? json(r) : json({ error: r.erro }, 400);
  }

  return json({ error: 'Ação desconhecida. Use monitorar, desligar ou meta.' }, 400);
}

function autorizado(request, env) {
  const url = new URL(request.url);
  return !!env.DASH_KEY && url.searchParams.get('key') === env.DASH_KEY;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
