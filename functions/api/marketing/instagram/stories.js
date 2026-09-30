// GET /api/marketing/instagram/stories?from&to — sub-aba Stories: stories
// publicados no período com o último número capturado (issue 342).
import { conectar, falhaDeLeitura, periodoInvalido } from '../../_marketing-db.js';
import { recusarSemChave } from '../../_argo-auth.js';
import { montarStories, periodoDaRequisicao, CONTA } from '../../_ig-painel.js';
import { ymdBrt } from '../../_data-brt.js';

export async function onRequestGet({ request, env }) {
  const recusa = recusarSemChave(request, env);
  if (recusa) return recusa;
  const p = periodoDaRequisicao(new URL(request.url), ymdBrt);
  if (!p) return periodoInvalido();
  try {
    const sql = conectar(env);
    const [stories, registro] = await Promise.all([
      sql`SELECT story_id, publicado_em, tipo, link, miniatura, alcance, views, respostas, compartilhamentos,
                 interacoes, seguidores, visitas_perfil, navegacao, ultima_captura_em
          FROM marketing.ig_stories WHERE conta = ${CONTA}
          AND publicado_em >= to_timestamp(${p.from}) AND publicado_em <= to_timestamp(${p.to})
          ORDER BY publicado_em DESC LIMIT 1000`,
      sql`SELECT min(primeira_captura_em) AS desde FROM marketing.ig_stories WHERE conta = ${CONTA}`,
    ]);
    return Response.json(montarStories({ stories, registroDesde: registro[0]?.desde || null, de: p.de }));
  } catch {
    return falhaDeLeitura();
  }
}
