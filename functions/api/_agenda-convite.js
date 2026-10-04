// Convite da agenda: a ponte entre o formulário da LP e a página de
// agendamento (spec-agenda-propria.md, decisão 10). Arquivo separado de
// _agenda.js porque o /tracker importa isto, e _agenda.js importa o /tracker
// (para mandar o Schedule pelo mesmo caminho dos outros eventos).
//
// Prefixo "_": o Cloudflare Pages não transforma o arquivo em rota.

import { tipoDaLinha } from './_agenda-regras.js';

const agora = () => Math.floor(Date.now() / 1000);
// Convite vale 7 dias: tempo de o lead voltar ao link.
export const VIDA_CONVITE = 7 * 86400;

export function tokenAleatorio() {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ---------------------------------------------------------------------------

/** Tipo comercial ativo que atende o funil (o primeiro criado). */
export async function tipoDoFunil(env, funil) {
  const l = await env.DB.prepare(
    'SELECT * FROM agenda_tipos WHERE comercial = 1 AND ativo = 1 AND funil = ? ORDER BY id LIMIT 1',
  ).bind(String(funil || '')).first();
  return tipoDaLinha(l);
}

export async function criarConvite(env, tipo, lead) {
  const token = tokenAleatorio();
  const t = agora();
  await env.DB.prepare(
    `INSERT INTO agenda_convites (token, tipo_id, lead_event_id, session_id, nome, email, telefone, funil, criado_em, expira_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(token, tipo.id, lead.eventId || null, lead.sessionId || null, lead.nome || '', lead.email || '',
    lead.telefone || '', lead.funil || tipo.funil, t, t + VIDA_CONVITE).run();
  return token;
}

export async function lerConvite(env, token) {
  if (!token) return null;
  const c = await env.DB.prepare('SELECT * FROM agenda_convites WHERE token = ?').bind(String(token)).first();
  if (!c || c.expira_em < agora()) return null;
  return c;
}

/** Token do convite já criado para um lead (clique duplicado no formulário). */
export async function conviteDoLead(env, eventId) {
  if (!eventId) return null;
  const c = await env.DB.prepare(
    'SELECT token FROM agenda_convites WHERE lead_event_id = ? AND expira_em > ? ORDER BY criado_em DESC LIMIT 1',
  ).bind(String(eventId), agora()).first();
  return c ? c.token : null;
}
