// GET  /api/bloqueios?key=...  → leads barrados na entrada do /tracker
// POST /api/bloqueios?key=...  → devolve um lead barrado por engano aos destinos
//
// Consome a aba "Bloqueios" do dashboard. Endpoint ADITIVO: nenhum endpoint
// existente foi alterado.
//
// A restauração NÃO reimplementa o envio: importa sendToClickUp/sendToGHL/
// sendToCRM do próprio tracker.js, que são as mesmas funções que o formulário
// usa. Uma segunda cópia da regra de envio aqui divergiria em silêncio — o lead
// devolvido cairia no ClickUp com campos diferentes do lead normal, e ninguém
// perceberia até alguém comparar dois cards à mão.

import { sendToClickUp, sendToGHL, sendToCRM } from '../tracker.js';

export async function onRequestGet(context) {
  const { request, env } = context;

  const url = new URL(request.url);
  if (!env.DASH_KEY || url.searchParams.get('key') !== env.DASH_KEY) {
    return json({ error: 'Unauthorized' }, 401);
  }

  // Restaurados continuam na lista: o histórico do que foi barrado é a única
  // maneira de perceber que uma regra ficou larga demais.
  const { results } = await env.DB.prepare(`
    SELECT id, email, nome, telefone, funnel, motivo, criado_em,
           restaurado_em, restaurado_resultado
    FROM leads_bloqueados
    ORDER BY criado_em DESC
    LIMIT 200
  `).all();

  return json({ rows: results || [] });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const url = new URL(request.url);
  if (!env.DASH_KEY || url.searchParams.get('key') !== env.DASH_KEY) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  const id = parseInt(corpo.id, 10);
  if (!Number.isFinite(id)) return json({ error: 'id obrigatório' }, 400);

  const linha = await env.DB.prepare(
    'SELECT * FROM leads_bloqueados WHERE id = ?'
  ).bind(id).first();

  if (!linha) return json({ error: 'Bloqueio não encontrado' }, 404);
  // Idempotente de propósito: dois cliques no botão não criam dois cards no
  // ClickUp. A dedup por telefone/email do sendToClickUp provavelmente seguraria,
  // mas depender dela seria contar com o comportamento de outro sistema.
  if (linha.restaurado_em) {
    return json({ error: 'Este lead já foi restaurado', restaurado_em: linha.restaurado_em }, 409);
  }

  let leadData = {};
  let sessionData = {};
  try { leadData = JSON.parse(linha.lead_json || '{}'); } catch { leadData = {}; }
  try { sessionData = JSON.parse(linha.session_json || '{}'); } catch { sessionData = {}; }

  // Os mesmos destinos que o /tracker aciona num Lead normal, na mesma ordem.
  // Meta e GA4 ficam DE FORA: o Meta recusa evento com mais de 7 dias e o GA4
  // com mais de 72 horas, e uma restauração acontece justamente depois de
  // alguém notar o engano. Fingir que mandamos seria pior que não mandar.
  const destinos = [
    { label: 'ClickUp', fn: () => sendToClickUp({ leadData, sessionData, env, eventId: linha.event_id || '' }) },
    { label: 'GoHighLevel', fn: () => sendToGHL({ leadData, env }) },
  ];
  for (const dest of [
    { url: env.LEAD_WEBHOOK_URL_CRM, token: env.LEAD_WEBHOOK_TOKEN_CRM, label: 'Supabase/CRM' },
    { url: env.LEAD_WEBHOOK_URL_WHATSAPP, token: env.LEAD_WEBHOOK_TOKEN_WHATSAPP, label: 'WhatsApp barramento' },
  ]) {
    if (!dest.url) continue;
    destinos.push({
      label: dest.label,
      fn: () => sendToCRM({
        leadData, sessionData,
        fbc: sessionData.fbc || '',
        externalId: sessionData.external_id || '',
        url: dest.url, token: dest.token, label: dest.label, env,
      }),
    });
  }

  // allSettled, não all: um destino fora do ar não pode impedir que os outros
  // recebam o lead — a pessoa foi barrada por engano, o objetivo é devolvê-la
  // ao máximo de lugares possível.
  const saidas = await Promise.allSettled(destinos.map((d) => d.fn()));
  const partes = destinos.map((d, i) => (saidas[i].status === 'fulfilled'
    ? `${d.label}: enviado`
    : `${d.label}: falhou (${saidas[i].reason?.message || 'erro'})`));

  // "Não lançou exceção" NÃO é "card criado": o sendToClickUp sai calado quando
  // falta CLICKUP_API_TOKEN e engole os próprios erros de HTTP. Dizer "ok" com
  // base nisso seria mentir para quem clicou. Quem sabe o desfecho de verdade é
  // a lead_dispatch, que o próprio sendToClickUp preenche — é ela que responde.
  const iClickUp = destinos.findIndex((d) => d.label === 'ClickUp');
  if (iClickUp !== -1 && linha.event_id) {
    let desfecho = null;
    try {
      const d = await env.DB.prepare(
        'SELECT resultado, erro FROM lead_dispatch WHERE event_id = ? ORDER BY id DESC LIMIT 1'
      ).bind(linha.event_id).first();
      desfecho = d || null;
    } catch { /* leitura de conferência: falhar aqui não invalida o envio */ }
    partes[iClickUp] = desfecho
      ? `ClickUp: ${desfecho.resultado}${desfecho.erro ? ` (${String(desfecho.erro).slice(0, 120)})` : ''}`
      : 'ClickUp: não tentou (integração sem token)';
  }

  const resultado = partes.join(' · ');

  const agora = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    'UPDATE leads_bloqueados SET restaurado_em = ?, restaurado_resultado = ? WHERE id = ?'
  ).bind(agora, resultado, id).run();

  // O evento correspondente volta a contar nas métricas do dash. Sem isto, o
  // lead estaria no ClickUp e ausente do dashboard — as duas telas se
  // contradiriam. Casa por event_id; bloqueio antigo sem event_id não casa nada,
  // e o UPDATE simplesmente não afeta linha alguma.
  if (linha.event_id) {
    await env.DB.prepare(
      'UPDATE event_log SET is_junk = 0 WHERE event_id = ?'
    ).bind(linha.event_id).run();
  }

  return json({ ok: true, restaurado_em: agora, resultado });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
