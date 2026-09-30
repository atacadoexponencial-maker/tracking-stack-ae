// GET /api/marketing/instagram/resumo — cabeçalho da tela Instagram: perfil,
// última coleta de cada tipo, atraso e última falha (issue 336).
import { conectar, falhaDeLeitura } from '../../_marketing-db.js';
import { recusarSemChave } from '../../_argo-auth.js';
import { montarResumo, CONTA } from '../../_ig-painel.js';

export async function onRequestGet({ request, env }) {
  const recusa = recusarSemChave(request, env);
  if (recusa) return recusa;
  try {
    const sql = conectar(env);
    // 7 dias bastam: os stories rodam de hora em hora (~170 linhas por semana).
    const [execucoes, perfil] = await Promise.all([
      sql`SELECT coleta, ok, erro, iniciada_em, concluida_em FROM marketing.execucoes
          WHERE conta = ${CONTA} AND iniciada_em > now() - interval '7 days'
          ORDER BY iniciada_em DESC LIMIT 400`,
      sql`SELECT seguidores_total, posts_total FROM marketing.ig_perfil_diario
          WHERE conta = ${CONTA} AND seguidores_total IS NOT NULL AND total_reconstruido IS FALSE
          ORDER BY dia DESC LIMIT 1`,
    ]);
    return Response.json(montarResumo({ execucoes, perfil: perfil[0] || null }));
  } catch {
    return falhaDeLeitura();
  }
}
