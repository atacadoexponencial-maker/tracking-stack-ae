// GET /api/agenda/horarios?key=...&tipo=<id>[&de=YYYY-MM-DD&ate=YYYY-MM-DD]
//   → horários livres do tipo, para a equipe conferir a configuração antes de
//     divulgar o link (spec, módulo 3) e para remarcar pela equipe (módulo 8).
//     Funciona também com o tipo pausado.
import { lerTipo, calcularHorarios } from '../_agenda.js';

const json = (dados, status = 200) => Response.json(dados, { status });
const autorizado = (url, env) => !!env.DASH_KEY && url.searchParams.get('key') === env.DASH_KEY;

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (!autorizado(url, env)) return json({ error: 'Unauthorized' }, 401);
  const tipo = await lerTipo(env, { id: url.searchParams.get('tipo') });
  if (!tipo) return json({ error: 'Tipo não encontrado.' }, 404);
  const ymd = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : null);
  let ignorar = null;
  const reuniao = url.searchParams.get('reuniao');
  if (reuniao) {
    const r = await env.DB.prepare('SELECT inicio, fim FROM agenda_reunioes WHERE id = ?').bind(reuniao).first();
    if (r) ignorar = { ini: r.inicio, fim: r.fim };
  }
  const r = await calcularHorarios(env, tipo, { de: ymd(url.searchParams.get('de')), ate: ymd(url.searchParams.get('ate')), ignorar });
  if (r.erro) return json({ error: r.erro }, 502);
  return json({ dias: r.dias });
}
