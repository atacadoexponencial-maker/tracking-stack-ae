// GET /api/marketing/instagram/publico — sub-aba Público: retrato mais recente
// de seguidores e de quem interagiu, e seguidores online por hora (issue 343).
// Não usa o filtro de datas: a Meta só entrega o retrato atual.
import { conectar, falhaDeLeitura } from '../../_marketing-db.js';
import { recusarSemChave } from '../../_argo-auth.js';
import { montarPublico, CONTA } from '../../_ig-painel.js';

export async function onRequestGet({ request, env }) {
  const recusa = recusarSemChave(request, env);
  if (recusa) return recusa;
  try {
    const sql = conectar(env);
    const [linhas, online] = await Promise.all([
      sql`SELECT dia::text AS dia, publico, dimensao, valores, vazio FROM marketing.ig_publico
          WHERE conta = ${CONTA}
          AND dia = (SELECT max(dia) FROM marketing.ig_publico WHERE conta = ${CONTA})`,
      sql`SELECT dia::text AS dia, por_hora FROM marketing.ig_online WHERE conta = ${CONTA} ORDER BY dia DESC LIMIT 1`,
    ]);
    return Response.json(montarPublico({ linhas, online: online[0] || null }));
  } catch {
    return falhaDeLeitura();
  }
}
