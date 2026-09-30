// GET /api/marketing/instagram/crescimento?from&to&antFrom&antTo — sub-aba
// Crescimento: indicadores com comparação, seguidores e série diária (issue 340).
import { conectar, falhaDeLeitura, periodoInvalido } from '../../_marketing-db.js';
import { recusarSemChave } from '../../_argo-auth.js';
import { montarCrescimento, periodoDaRequisicao, CONTA } from '../../_ig-painel.js';
import { ymdBrt } from '../../_data-brt.js';

const COLUNAS = `dia, alcance_total, alcance_por_tipo, views_por_tipo, interacoes_por_tipo, visitas_perfil,
  toques_link, curtidas, comentarios, compartilhamentos, salvamentos, respostas, reposts,
  seguidores_ganhos, seguidores_perdidos, seguidores_total, total_reconstruido`;

export async function onRequestGet({ request, env }) {
  const recusa = recusarSemChave(request, env);
  if (recusa) return recusa;
  const p = periodoDaRequisicao(new URL(request.url), ymdBrt, { comAnterior: true });
  if (!p) return periodoInvalido();
  try {
    const sql = conectar(env);
    // COLUNAS é literal do código-fonte; os valores vão como parâmetros.
    const [linhas, linhasAnteriores, publicacoes, limites] = await Promise.all([
      sql.query(`SELECT ${COLUNAS} FROM marketing.ig_perfil_diario WHERE conta = $1 AND dia BETWEEN $2 AND $3`, [CONTA, p.de, p.ate]),
      sql.query(`SELECT ${COLUNAS} FROM marketing.ig_perfil_diario WHERE conta = $1 AND dia BETWEEN $2 AND $3`, [CONTA, p.antDe, p.antAte]),
      sql`SELECT to_char(publicado_em AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS dia, formato
          FROM marketing.ig_posts WHERE conta = ${CONTA}
          AND publicado_em >= to_timestamp(${p.from}) AND publicado_em <= to_timestamp(${p.to})`,
      sql`SELECT to_char(min(dia) FILTER (WHERE seguidores_ganhos IS NOT NULL), 'YYYY-MM-DD') AS historico,
                 to_char(max(dia) FILTER (WHERE alcance_total IS NOT NULL), 'YYYY-MM-DD') AS ultimo
          FROM marketing.ig_perfil_diario WHERE conta = ${CONTA}`,
    ]);
    const normalizar = (ls) => ls.map((l) => ({ ...l, dia: typeof l.dia === 'string' ? l.dia.slice(0, 10) : new Date(l.dia).toISOString().slice(0, 10) }));
    return Response.json(montarCrescimento({
      de: p.de, ate: p.ate, antDe: p.antDe, antAte: p.antAte,
      linhas: normalizar(linhas), linhasAnteriores: normalizar(linhasAnteriores), publicacoes,
      historicoSeguidoresDesde: limites[0]?.historico || null, ultimoDiaColetado: limites[0]?.ultimo || null,
    }));
  } catch {
    return falhaDeLeitura();
  }
}
