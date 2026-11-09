// GET /api/agenda/detalhe?key=...&from=&to=[&funil=]
//
// Listas do Detalhe das reuniões na Visão geral (spec-detalhe-reunioes.md,
// S7-03): das reuniões agendadas no período (a mesma coorte de
// /api/agenda/coorte), quem ainda vai fazer, quem faltou, quem cancelou, quem
// passou sem presença marcada e quem remarcou. Só nome, funil e horário: nada
// de telefone, e o e-mail só aparece quando não há nome (SUP-S7-03/04).
//
// Sem cache, como a coorte: muda a cada presença marcada.
import { listasDaCoorte } from '../_reunioes-agendadas.js';

const json = (dados, status = 200) => Response.json(dados, { status });

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (!env.DASH_KEY || url.searchParams.get('key') !== env.DASH_KEY) return json({ error: 'Unauthorized' }, 401);
  const agora = Math.floor(Date.now() / 1000);
  const p = url.searchParams;
  const ate = Number(p.get('to')) || agora;
  const de = Number(p.get('from')) || ate - 30 * 86400;
  const funil = (p.get('funil') || '').trim();
  const listas = await listasDaCoorte(env.DB, de, ate, agora, funil);
  return json({ listas });
}
