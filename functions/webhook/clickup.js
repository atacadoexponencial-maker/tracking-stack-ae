// POST /webhook/clickup — recebe eventos do ClickUp (ponte tracking↔CRM).
//
// Registrado pelo /api/crm-setup (que guarda o secret em config_kv). Valida a
// assinatura HMAC-SHA256 do corpo (header X-Signature). Processa
// taskStatusUpdated: grava o estágio em crm_status_log e, quando a tarefa
// chega em "contrato assinado", lê o campo 💰 Arrecadado e registra a venda
// pelo MESMO pipeline dos gateways (webhook/_core.processPurchase) — Receita/
// ROAS do dash e conversão na Meta saem de graça.
import { processPurchase } from './_core.js';

const CU_API = 'https://api.clickup.com/api/v2';
const CAMPO_ARRECADADO = '85ef1a33-01f7-4ea4-9f24-f742b660a04e'; // 💰 Arrecadado (currency)
const CAMPO_EMAIL = '24f5a3d3-e21e-4e08-b396-8a4ce2133a98';      // 📩 E-mail
const CAMPO_WHATSAPP = '754a41c9-2835-48d5-a70e-8b61841e0037';   // ☎️ Whatsapp
const CAMPO_FUNIL = 'a663b002-661c-4dc1-86c3-612e94f3a447';      // 🔻 Funil (dropdown)
const STATUS_VENDA = 'contrato assinado';

export async function onRequestPost(context) {
  const { request, env } = context;
  const corpo = await request.text();

  // --- Assinatura ---
  const secretRow = await env.DB.prepare(
    "SELECT valor FROM config_kv WHERE chave = 'clickup_webhook_secret'"
  ).first();
  if (!secretRow) return json({ error: 'webhook não configurado' }, 503);

  const assinatura = request.headers.get('X-Signature') || '';
  const esperada = await hmacHex(secretRow.valor, corpo);
  if (!assinatura || assinatura !== esperada) return json({ error: 'assinatura inválida' }, 401);

  let payload = {};
  try { payload = JSON.parse(corpo); } catch { return json({ error: 'json inválido' }, 400); }

  if (payload.event !== 'taskStatusUpdated' || !payload.task_id) return json({ ok: true, ignorado: true });

  // Status novo vem no history_items (after.status). Fallback: consulta a task.
  let status = '';
  for (const h of payload.history_items || []) {
    if (h.field === 'status' && h.after) { status = (h.after.status || '').toLowerCase(); break; }
  }
  const taskId = String(payload.task_id);

  if (status) {
    await env.DB.prepare(
      `INSERT INTO crm_status_log (task_id, status, recebido_em) VALUES (?, ?, strftime('%s','now'))`
    ).bind(taskId, status).run();
  }

  if (status === STATUS_VENDA) {
    // Processa em background — resposta rápida ao ClickUp.
    context.waitUntil(processarVenda(taskId, env, context));
  }

  return json({ ok: true });
}

async function processarVenda(taskId, env, context) {
  try {
    const res = await fetch(`${CU_API}/task/${taskId}`, {
      headers: { Authorization: env.CLICKUP_API_TOKEN },
    });
    if (!res.ok) throw new Error(`ClickUp GET task ${res.status}`);
    const task = await res.json();

    const campo = (id) => (task.custom_fields || []).find((f) => f.id === id);
    const arrecadado = Number((campo(CAMPO_ARRECADADO) || {}).value || 0);
    const email = String((campo(CAMPO_EMAIL) || {}).value || '').trim().toLowerCase();
    const phone = String((campo(CAMPO_WHATSAPP) || {}).value || '').trim();
    const funilField = campo(CAMPO_FUNIL);
    let funil = '';
    if (funilField && funilField.type_config && Array.isArray(funilField.type_config.options)) {
      const op = funilField.type_config.options.find((o) => o.id === funilField.value || o.orderindex === funilField.value);
      funil = op ? op.name : '';
    }

    await processPurchase({
      parsed: {
        platform: 'clickup',
        trk: '',
        email,
        name: task.name || '',
        phone,
        value: arrecadado,
        currency: 'BRL',
        transactionId: `clickup:${taskId}`,
        productId: `contrato-${(funil || 'crm').toLowerCase().replace(/\s+/g, '-')}`,
        productName: `Contrato${funil ? ' — ' + funil : ''} (${task.name || taskId})`,
        items: [],
        platformUtm: {},
      },
      env, context,
    });
  } catch (e) {
    console.error('clickup venda error:', e.message);
  }
}

async function hmacHex(secret, corpo) {
  const enc = new TextEncoder();
  const chave = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', chave, enc.encode(corpo));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
