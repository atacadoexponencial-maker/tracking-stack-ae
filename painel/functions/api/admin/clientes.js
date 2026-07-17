// /api/admin/clientes — GET lista · POST cria · PUT edita/ações.
// A "duplicação em 1 clique": criar cliente = nome + IDs das contas; o slug
// secreto nasce aqui e o dashboard já existe em /c/<slug>.
import { json } from './_auth.js';

function gerarSlug(nome) {
  const base = String(nome).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '').slice(0, 24) || 'cliente';
  const rand = [...crypto.getRandomValues(new Uint8Array(4))].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${base}-${rand}`;
}

const limpar = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    'SELECT id, nome, slug, meta_account_id, gads_customer_id, ga4_property_id, ativo, criado_em FROM clientes ORDER BY nome'
  ).all();
  return json({ clientes: results });
}

export async function onRequestPost({ request, env }) {
  let b = {};
  try { b = await request.json(); } catch {}
  const nome = limpar(b.nome);
  if (!nome) return json({ error: 'nome obrigatório' }, 400);

  const slug = gerarSlug(nome);
  const r = await env.DB.prepare(
    `INSERT INTO clientes (nome, slug, meta_account_id, gads_customer_id, ga4_property_id, ativo, criado_em)
     VALUES (?, ?, ?, ?, ?, 1, strftime('%s','now'))`
  ).bind(nome, slug, limpar(b.meta_account_id), limpar(b.gads_customer_id), limpar(b.ga4_property_id)).run();
  return json({ ok: true, id: r.meta.last_row_id, slug });
}

export async function onRequestPut({ request, env }) {
  let b = {};
  try { b = await request.json(); } catch {}
  const id = Number(b.id);
  if (!id) return json({ error: 'id obrigatório' }, 400);

  if (b.acao === 'regenerar_slug') {
    const row = await env.DB.prepare('SELECT nome FROM clientes WHERE id = ?').bind(id).first();
    if (!row) return json({ error: 'not_found' }, 404);
    const slug = gerarSlug(row.nome);
    await env.DB.prepare('UPDATE clientes SET slug = ?, ativo = 1 WHERE id = ?').bind(slug, id).run();
    return json({ ok: true, slug });
  }
  if (b.acao === 'revogar') {
    await env.DB.prepare('UPDATE clientes SET ativo = 0 WHERE id = ?').bind(id).run();
    return json({ ok: true });
  }
  if (b.acao === 'reativar') {
    await env.DB.prepare('UPDATE clientes SET ativo = 1 WHERE id = ?').bind(id).run();
    return json({ ok: true });
  }

  const nome = limpar(b.nome);
  if (!nome) return json({ error: 'nome obrigatório' }, 400);
  await env.DB.prepare(
    'UPDATE clientes SET nome = ?, meta_account_id = ?, gads_customer_id = ?, ga4_property_id = ? WHERE id = ?'
  ).bind(nome, limpar(b.meta_account_id), limpar(b.gads_customer_id), limpar(b.ga4_property_id), id).run();
  return json({ ok: true });
}
