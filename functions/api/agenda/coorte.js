// GET /api/agenda/coorte?key=...&from=&to=[&antFrom=&antTo=]
//
// Coorte de agendamento da Visão geral (ajuste de 26/10): das reuniões
// agendadas no período, quantas já foram realizadas, faltaram, foram
// canceladas, ainda vão acontecer ou passaram sem presença marcada — até
// agora, em qualquer data. Total e por funil, no período e no anterior.
//
// Sem cache de período fechado, de propósito: a coorte de uma semana passada
// muda a cada presença marcada. A leitura é leve (agenda_reunioes e
// calendly_consultorias do período, e o funil pelo e-mail do lead).
import { coorteDasAgendadas, resumirCoorte } from '../_reunioes-agendadas.js';

const json = (dados, status = 200) => Response.json(dados, { status });

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (!env.DASH_KEY || url.searchParams.get('key') !== env.DASH_KEY) return json({ error: 'Unauthorized' }, 401);
  const agora = Math.floor(Date.now() / 1000);
  const p = url.searchParams;
  const ate = Number(p.get('to')) || agora;
  const de = Number(p.get('from')) || ate - 30 * 86400;
  const antAte = Number(p.get('antTo')) || de - 1;
  const antDe = Number(p.get('antFrom')) || antAte - (ate - de);
  const [atual, anterior] = await Promise.all([
    coorteDasAgendadas(env.DB, de, ate, agora).then(resumirCoorte),
    coorteDasAgendadas(env.DB, antDe, antAte, agora).then(resumirCoorte),
  ]);
  return json({ atual, anterior });
}
