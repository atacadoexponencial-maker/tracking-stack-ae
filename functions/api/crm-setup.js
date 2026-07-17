// POST /api/crm-setup?key=<DASH_KEY>&endpoint=<url-base>
//
// Registra (ou re-registra) o webhook do ClickUp que alimenta a ponte
// tracking↔CRM: taskStatusUpdated da lista 🤑 CRM → /webhook/clickup.
// Guarda o secret retornado em config_kv (usado na validação de assinatura).
// Idempotente: remove webhooks antigos apontando para o mesmo path antes.
// `endpoint` opcional (default = origem da própria requisição) permite apontar
// para o preview durante a validação e re-apontar para produção depois.

const CU_API = 'https://api.clickup.com/api/v2';

export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  if (!env.DASH_KEY || url.searchParams.get('key') !== env.DASH_KEY) {
    return json({ error: 'Unauthorized' }, 401);
  }
  if (!env.CLICKUP_API_TOKEN) return json({ error: 'CLICKUP_API_TOKEN ausente' }, 500);

  const base = (url.searchParams.get('endpoint') || url.origin).replace(/\/$/, '');
  const alvo = `${base}/webhook/clickup`;
  const listId = env.CLICKUP_LIST_ID || '205126080';

  const cu = (path, options) => fetch(`${CU_API}${path}`, {
    ...options,
    headers: { Authorization: env.CLICKUP_API_TOKEN, 'Content-Type': 'application/json' },
  });

  // Time (workspace) dono da lista.
  const teams = await (await cu('/team')).json();
  const teamId = teams.teams && teams.teams[0] && teams.teams[0].id;
  if (!teamId) return json({ error: 'não achei o workspace no token' }, 500);

  // Remove webhooks anteriores da ponte (qualquer host, mesmo path).
  const existentes = await (await cu(`/team/${teamId}/webhook`)).json();
  const removidos = [];
  for (const w of existentes.webhooks || []) {
    if ((w.endpoint || '').endsWith('/webhook/clickup')) {
      await cu(`/webhook/${w.id}`, { method: 'DELETE' });
      removidos.push(w.endpoint);
    }
  }

  const criado = await cu(`/team/${teamId}/webhook`, {
    method: 'POST',
    body: JSON.stringify({ endpoint: alvo, events: ['taskStatusUpdated'], list_id: Number(listId) }),
  });
  const corpo = await criado.json();
  if (!criado.ok || !corpo.webhook) return json({ error: 'falha ao criar webhook', detalhe: corpo }, 502);

  await env.DB.prepare(
    `INSERT INTO config_kv (chave, valor) VALUES ('clickup_webhook_secret', ?)
     ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor`
  ).bind(corpo.webhook.secret || '').run();

  return json({ ok: true, endpoint: alvo, webhook_id: corpo.id, removidos });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
