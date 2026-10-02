// GET /api/agenda/funil?key=...&from=&to=[&funnel=]
//
// Funil da agenda por coorte do formulário (spec-conversao-agenda.md, módulo 2):
// leads mandados para a agenda no período → abriram → escolheram horário →
// agendaram → compareceram, com as quebras por funil, origem e tipo e o tempo
// até agendar. Também devolve o período anterior (mesma duração) para a
// comparação. Só tipos comerciais, sem e-mail de teste.
import { calcularFunilAgenda } from '../_agenda-funil.js';
import { isInternalTestEmail } from '../../tracker.js';

const json = (dados, status = 200) => Response.json(dados, { status });
const autorizado = (url, env) => !!env.DASH_KEY && url.searchParams.get('key') === env.DASH_KEY;

async function lerConvites(env, de, ate, funil) {
  const r = await env.DB.prepare(
    `SELECT c.email, c.funil, c.criado_em, t.nome AS tipo_nome,
            (SELECT 1 FROM agenda_etapas e WHERE e.convite_token = c.token AND e.etapa = 'abriu') AS abriu,
            (SELECT 1 FROM agenda_etapas e WHERE e.convite_token = c.token AND e.etapa = 'escolheu') AS escolheu,
            r.criado_em AS agendou_em, r.situacao,
            s.utm_source, s.utm_campaign
       FROM agenda_convites c
       JOIN agenda_tipos t ON t.id = c.tipo_id AND t.comercial = 1
       LEFT JOIN agenda_reunioes r ON r.convite_token = c.token
       LEFT JOIN sessions s ON s.session_id = c.session_id
      WHERE c.criado_em >= ? AND c.criado_em <= ? ${funil ? 'AND c.funil = ?' : ''}`,
  ).bind(...[de, ate, ...(funil ? [funil] : [])]).all();
  return (r.results || []).filter((c) => !isInternalTestEmail(c.email));
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (!autorizado(url, env)) return json({ error: 'Unauthorized' }, 401);
  const agora = Math.floor(Date.now() / 1000);
  const ate = Number(url.searchParams.get('to')) || agora;
  const de = Number(url.searchParams.get('from')) || ate - 30 * 86400;
  const funil = url.searchParams.get('funnel') || '';
  const dur = ate - de;
  // Antes da agenda própria existir não há funil: o período anterior é "sem dado".
  const inicio = await env.DB.prepare('SELECT MIN(criado_em) AS m FROM agenda_convites').first();
  const [atual, anterior] = await Promise.all([
    lerConvites(env, de, ate, funil),
    lerConvites(env, de - dur - 1, de - 1, funil),
  ]);
  return json({
    atual: calcularFunilAgenda(atual),
    anterior: inicio && inicio.m && inicio.m <= de - 1 ? calcularFunilAgenda(anterior) : null,
    inicio_da_agenda: inicio ? inicio.m : null,
  });
}
