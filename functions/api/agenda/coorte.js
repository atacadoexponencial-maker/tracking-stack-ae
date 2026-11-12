// GET /api/agenda/coorte?key=...&from=&to=[&antFrom=&antTo=]
//
// Detalhe das reuniões da Visão geral (spec-funil-leads-novos.md, S9): das
// reuniões que CAEM no período (pela data da reunião, de leads novos e
// antigos), quantas foram realizadas, faltaram, foram canceladas, ainda vão
// acontecer ou passaram sem presença marcada, com comparecimento e no-show.
// Total e por funil, no período e no anterior. Em `agendou`, quantas reuniões
// foram agendadas no período (pela data em que a pessoa agendou).
//
// Sem cache de período fechado, de propósito: a situação de uma semana
// passada muda a cada presença marcada. A leitura é leve (agenda_reunioes e
// calendly_consultorias do período, e o funil pelo e-mail do lead).
import { coorteDasAgendadas, resumirCoorte, comNoShow } from '../_reunioes-agendadas.js';

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
  const [atual, anterior] = await Promise.all([lado(env.DB, de, ate, agora), lado(env.DB, antDe, antAte, agora)]);
  return json({ atual, anterior });
}

// Um período: o resumo das reuniões que caem nele e a contagem das agendadas nele.
async function lado(DB, de, ate, agora) {
  const [naAgenda, agendadas] = await Promise.all([
    coorteDasAgendadas(DB, de, ate, agora, { por: 'reuniao' }),
    coorteDasAgendadas(DB, de, ate, agora),
  ]);
  const ag = resumirCoorte(agendadas);
  return {
    ...comNoShow(resumirCoorte(naAgenda)),
    agendou: {
      total: ag.total.agendadas,
      por_funil: Object.fromEntries(Object.entries(ag.por_funil).map(([f, r]) => [f, r.agendadas])),
    },
  };
}
