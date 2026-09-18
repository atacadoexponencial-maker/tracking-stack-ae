// GET  /api/grupos-acoes?key=...               → agenda, histórico e grupos disponíveis
// POST /api/grupos-acoes?key=...               → agenda uma ação
// POST /api/grupos-acoes?key=...&acao=cancelar → cancela (só enquanto agendada)
// POST /api/grupos-acoes?key=...&acao=agora    → cria e executa na hora
//
// Consome a aba "Grupos" do dashboard. Endpoint ADITIVO: /api/grupos e
// /api/grupos-conexao não foram tocados.
//
// A regra de negócio não está aqui — está em _grupos-acoes.js, para que o cron
// e o botão "fazer agora" passem exatamente pelo mesmo caminho.
//
// `acao=agora` também grava a ação antes de executar: disparo manual que não
// deixa rastro é disparo que ninguém consegue investigar depois.

import { criarAcao, cancelarAcao, listarAcoes, executarAcao } from './_grupos-acoes.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!autorizado(request, env)) return json({ error: 'Unauthorized' }, 401);

  const agora = Math.floor(Date.now() / 1000);
  const { results } = await env.DB.prepare(
    'SELECT group_jid, label, parent_jid FROM whatsapp_groups_tracked WHERE enabled = 1 ORDER BY label'
  ).all();

  const lista = await listarAcoes(env, agora);
  return json({
    ...lista,
    // `tem_par` em vez do JID do par: o navegador não precisa do identificador
    // do outro grupo para desenhar uma caixinha de seleção.
    grupos: (results || []).map((g) => ({ group_jid: g.group_jid, label: g.label, tem_par: !!g.parent_jid })),
  });
}

export async function onRequestPost(context) {
  // fetchImpl injetável só para o teste; em produção é o fetch do Worker.
  const { request, env, fetchImpl = fetch } = context;
  if (!autorizado(request, env)) return json({ error: 'Unauthorized' }, 401);

  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  const agora = Math.floor(Date.now() / 1000);
  const acao = new URL(request.url).searchParams.get('acao');

  if (acao === 'cancelar') {
    const r = await cancelarAcao(env, corpo?.id);
    // 409 e não 400: o pedido estava bem formado, o estado é que mudou — e a
    // tela precisa saber a diferença para dizer "já saiu" em vez de "erro".
    return r.ok ? json({ ok: true }) : json({ error: r.erro }, 409);
  }

  const quando = acao === 'agora' ? agora : corpo?.agendada_para;
  const criada = await criarAcao(env, { ...corpo, agendada_para: quando }, agora);
  if (criada.erro) return json({ error: criada.erro }, criada.status || 400);

  if (acao !== 'agora') return json({ ok: true, id: criada.id });

  const r = await executarAcao(env, criada.id, agora, fetchImpl);
  return json({ ok: r.status === 'concluida', id: criada.id, status: r.status, erro: r.erro || null });
}

function autorizado(request, env) {
  const url = new URL(request.url);
  return !!env.DASH_KEY && url.searchParams.get('key') === env.DASH_KEY;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
