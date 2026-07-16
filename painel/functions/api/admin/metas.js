// /api/admin/metas — GET lista por cliente · POST upsert do mês.
// Valores chegam em reais no form e são gravados em cents; projeções são
// calculadas na leitura (issue 99), nunca digitadas.
import { json } from './_auth.js';

export async function onRequestGet({ request, env }) {
  const clienteId = Number(new URL(request.url).searchParams.get('cliente_id'));
  if (!clienteId) return json({ error: 'cliente_id obrigatório' }, 400);
  const { results } = await env.DB.prepare(
    'SELECT id, mes, meta_faturamento_cents, meta_investimento_cents, taxa_projetada FROM metas WHERE cliente_id = ? ORDER BY mes DESC LIMIT 24'
  ).bind(clienteId).all();
  return json({ metas: results });
}

export async function onRequestPost({ request, env }) {
  let b = {};
  try { b = await request.json(); } catch {}
  const clienteId = Number(b.cliente_id);
  const mes = String(b.mes || '');
  if (!clienteId || !/^\d{4}-\d{2}$/.test(mes)) return json({ error: 'cliente_id e mes (YYYY-MM) obrigatórios' }, 400);

  const fat = Math.round(Number(b.meta_faturamento) * 100) || 0;
  const inv = Math.round(Number(b.meta_investimento) * 100) || 0;
  const taxa = b.taxa_projetada === null || b.taxa_projetada === '' ? null : Number(b.taxa_projetada);
  if (fat < 0 || inv < 0 || (taxa !== null && !(taxa >= 0 && taxa <= 100))) return json({ error: 'valores inválidos' }, 400);

  await env.DB.prepare(
    `INSERT INTO metas (cliente_id, mes, meta_faturamento_cents, meta_investimento_cents, taxa_projetada)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(cliente_id, mes) DO UPDATE SET
       meta_faturamento_cents = excluded.meta_faturamento_cents,
       meta_investimento_cents = excluded.meta_investimento_cents,
       taxa_projetada = excluded.taxa_projetada`
  ).bind(clienteId, mes, fat, inv, taxa).run();
  return json({ ok: true });
}
