// GET /api/agenda/publico/horarios?slug=<slug>&de=YYYY-MM-DD&ate=YYYY-MM-DD[&c=<convite>|&g=<gestão>]
//
// Horários livres para a página pública (spec, módulo 4) e para remarcar
// (módulo 6, com o token de gestão). Calculados no servidor a partir da grade
// e das agendas de conflito; a página só desenha. Tipo comercial exige o
// convite do formulário (ou o token de quem já marcou).
import { lerTipo, lerReuniao, calcularHorarios } from '../../_agenda.js';
import { lerConvite } from '../../_agenda-convite.js';

const json = (dados, status = 200) => Response.json(dados, { status, headers: { 'Cache-Control': 'no-store' } });
const ymd = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : null);

export async function onRequestGet({ request, env }) {
  const p = new URL(request.url).searchParams;
  let tipo;
  let ignorar = null;
  if (p.get('g')) {
    const r = await lerReuniao(env, { tokenGestao: p.get('g') });
    if (!r) return json({ error: 'Link inválido.' }, 404);
    tipo = await lerTipo(env, { id: r.tipo_id });
    ignorar = { ini: r.inicio, fim: r.fim };
  } else {
    tipo = await lerTipo(env, { slug: p.get('slug') });
    if (!tipo || !tipo.ativo) return json({ error: 'Agenda indisponível.' }, 404);
    if (tipo.comercial) {
      const c = await lerConvite(env, p.get('c'));
      if (!c || c.tipo_id !== tipo.id) return json({ error: 'Link expirado.' }, 403);
    }
  }
  const r = await calcularHorarios(env, tipo, { de: ymd(p.get('de')), ate: ymd(p.get('ate')), ignorar });
  if (r.erro) return json({ error: 'Não foi possível carregar os horários agora. Tente de novo em instantes.' }, 503);
  return json({ dias: r.dias });
}
