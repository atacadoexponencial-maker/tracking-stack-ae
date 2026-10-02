// POST /api/agenda/publico/etapa  { c: <convite>, etapa: 'abriu' | 'escolheu' }
//
// Registra a etapa do lead dentro da agenda (spec-conversao-agenda.md, módulo 1).
// Só tipos comerciais, uma vez por convite e etapa, sem pré-visualização da
// equipe, e-mail de teste nem robô. Nada vai para o Meta nem para o GA4.
// Responde sempre 204: a página não espera nem mostra nada.
import { lerConvite } from '../../_agenda-convite.js';
import { isInternalTestEmail } from '../../../tracker.js';
import { detectBot, detectBotPorIp } from '../../../_bots.js';

const ETAPAS = new Set(['abriu', 'escolheu']);
const nada = () => new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });

export async function onRequestPost({ request, env }) {
  const corpo = await request.json().catch(() => ({}));
  if (!ETAPAS.has(corpo.etapa)) return nada();
  const ua = request.headers.get('user-agent') || '';
  const ip = request.headers.get('cf-connecting-ip') || '';
  if (detectBot(ua).isBot || detectBotPorIp(ip).isBot) return nada();
  const convite = await lerConvite(env, corpo.c);
  if (!convite || isInternalTestEmail(convite.email)) return nada();
  const tipo = await env.DB.prepare('SELECT comercial FROM agenda_tipos WHERE id = ?').bind(convite.tipo_id).first();
  if (!tipo || !tipo.comercial) return nada();
  await env.DB.prepare('INSERT OR IGNORE INTO agenda_etapas (convite_token, etapa, criado_em) VALUES (?, ?, ?)')
    .bind(convite.token, corpo.etapa, Math.floor(Date.now() / 1000)).run();
  return nada();
}
