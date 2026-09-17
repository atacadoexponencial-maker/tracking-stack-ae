// POST /webhook/clickup — recebe eventos do ClickUp (ponte tracking↔CRM).
//
// Registrado pelo /api/crm-setup (que guarda o secret em config_kv). Valida a
// assinatura HMAC-SHA256 do corpo (header X-Signature). Processa
// taskStatusUpdated: grava o estágio em crm_status_log e, quando a tarefa
// chega em "contrato assinado", lê o campo 💰 Arrecadado e registra a venda
// pelo MESMO pipeline dos gateways (webhook/_core.processPurchase) — Receita/
// ROAS do dash e conversão na Meta saem de graça.
import { processPurchase } from './_core.js';
import { registrarHorario } from '../api/_horario-registro.js';

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
  let item = null;
  for (const h of payload.history_items || []) {
    if (h.field === 'status' && h.after) { status = (h.after.status || '').toLowerCase(); item = h; break; }
  }
  const taskId = String(payload.task_id);

  // Identidade e instante REAL da mudança de estágio (revisão 2026-09-13). O
  // ClickUp retenta entregas e não garante ordem: sem o id do history_item, a
  // reentrega virava segunda linha; sem a data dele, o funil ordenava por
  // recebido_em e uma reentrega atrasada "voltava" o card de estágio. `date`
  // vem em milissegundos como string. INSERT OR IGNORE contra o UNIQUE de
  // hist_id (0037) faz a reentrega ser no-op; linhas sem history_item (hist_id
  // NULL) continuam entrando, pois NULL não colide em UNIQUE.
  //
  // Quem LÊ crm_status_log (crm-funnel/leads) deve ordenar por
  // COALESCE(hist_date, recebido_em) — leitura é de outra frente.
  const histItem = item || (payload.history_items || [])[0] || null;
  const histId = histItem && histItem.id ? String(histItem.id) : null;
  const histDateMs = histItem ? Number(histItem.date) : NaN;
  const histDate = Number.isFinite(histDateMs) && histDateMs > 0 ? Math.floor(histDateMs / 1000) : null;
  // Horário suspeito (spec-protecoes-integracoes.md): só observação.
  context.waitUntil(registrarHorario(env, 'clickup', histDate ? histDateMs : null, { ref: histId || taskId }));

  let gravouNovo = true;
  if (status) {
    const r = await env.DB.prepare(
      `INSERT OR IGNORE INTO crm_status_log (task_id, status, recebido_em, hist_id, hist_date)
       VALUES (?, ?, strftime('%s','now'), ?, ?)`
    ).bind(taskId, status, histId, histDate).run();
    gravouNovo = !histId || !!(r && r.meta && r.meta.changes);
  }

  // Reentrega do mesmo history_item: nada novo aconteceu, não reprocessa a venda.
  if (!gravouNovo) return json({ ok: true, dedup: true, hist_id: histId });

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

    // Card em "contrato assinado" com 💰 Arrecadado vazio ou zero: acontece
    // quando o comercial move o card antes de preencher o valor (e o webhook
    // não dispara de novo quando o valor é preenchido depois). Gravar isso
    // criava uma compra de R$ 0 no purchase_log/Receita e um Purchase de valor
    // 0 na Meta — que polui o ROAS sem somar nada. E, como transaction_id é
    // `clickup:<task>`, a dedup do _core barraria a venda REAL quando o valor
    // fosse acertado e o card passasse de novo pelo estágio. Não grava nada.
    if (!(arrecadado > 0)) {
      console.error('clickup venda ignorada: 💰 Arrecadado vazio ou zero na task', taskId);
      return;
    }

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
        forceSend: true, // venda de CRM não tem sessão de checkout; match por email/telefone
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
