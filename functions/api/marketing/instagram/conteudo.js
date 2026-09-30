// GET /api/marketing/instagram/conteudo?from&to — sub-aba Conteúdo: desempenho
// por formato e ranking de posts e reels publicados no período (issue 341).
import { conectar, falhaDeLeitura, periodoInvalido } from '../../_marketing-db.js';
import { recusarSemChave } from '../../_argo-auth.js';
import { montarConteudo, periodoDaRequisicao, CONTA } from '../../_ig-painel.js';
import { ymdBrt } from '../../_data-brt.js';

export async function onRequestGet({ request, env }) {
  const recusa = recusarSemChave(request, env);
  if (recusa) return recusa;
  const p = periodoDaRequisicao(new URL(request.url), ymdBrt);
  if (!p) return periodoInvalido();
  try {
    const sql = conectar(env);
    const [posts, stories] = await Promise.all([
      sql`SELECT media_id, formato, publicado_em, legenda, link, miniatura, alcance, views, curtidas, comentarios,
                 compartilhamentos, salvamentos, interacoes, tempo_medio_ms, visitas_perfil, seguidores,
                 pago_alcance, pago_views, pago_investimento, pago_campanhas, pago_inicio::text, pago_fim::text, atualizado_em
          FROM marketing.ig_posts WHERE conta = ${CONTA}
          AND publicado_em >= to_timestamp(${p.from}) AND publicado_em <= to_timestamp(${p.to})
          ORDER BY publicado_em DESC LIMIT 500`,
      sql`SELECT story_id, publicado_em, link, miniatura, alcance, views, interacoes, seguidores
          FROM marketing.ig_stories WHERE conta = ${CONTA}
          AND publicado_em >= to_timestamp(${p.from}) AND publicado_em <= to_timestamp(${p.to})
          LIMIT 1000`,
    ]);
    return Response.json(montarConteudo({ posts, stories }));
  } catch {
    return falhaDeLeitura();
  }
}
