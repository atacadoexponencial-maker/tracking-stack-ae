// GET  /api/metas?key=...  → cadastro das metas mensais por funil
// POST /api/metas?key=...  → salva as metas de um funil { funil_id, meta, versao }
//
// Spec spec-metas-funil.md, issue 333. Só o D1: não depende do CRM. Regras
// em ../_metas.js; a aba Funis do relatório só coleta e desenha.
import {
  montarCadastro, montarFunil, validarMeta, funilEditavel, mesBrt,
  ALTERADA_POR, ERRO_CONCORRENCIA, ERRO_NAO_EDITAVEL, ERRO_FUNIL,
} from '../_metas.js';

const json = (dados, status = 200) => Response.json(dados, { status });
const autorizado = (url, env) => !!env.DASH_KEY && url.searchParams.get('key') === env.DASH_KEY;
const agora = () => Math.floor(Date.now() / 1000);

async function lerFunis(env) {
  const r = await env.DB.prepare(
    'SELECT id, nome, tipo, funil_tracking, situacao, posicao FROM funis_relatorio',
  ).all();
  return r.results || [];
}

async function lerLinhas(env, funilId = null) {
  const sql = `SELECT id, funil_id, mes_inicio, cpl_max_centavos, leads_novos, mqls,
                      custo_mql_max_centavos, alterada_em, alterada_por
                 FROM metas_funil ${funilId === null ? '' : 'WHERE funil_id = ?'}`;
  const stmt = env.DB.prepare(sql);
  const r = await (funilId === null ? stmt : stmt.bind(funilId)).all();
  return r.results || [];
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (!autorizado(url, env)) return json({ error: 'Unauthorized' }, 401);
  try {
    const [funis, linhas] = await Promise.all([lerFunis(env), lerLinhas(env)]);
    return json(montarCadastro({ funis, linhas, mes: mesBrt(agora()) }));
  } catch {
    return json({ erro: 'Não foi possível ler as metas agora.' }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  if (!autorizado(url, env)) return json({ error: 'Unauthorized' }, 401);

  let corpo;
  try { corpo = await request.json(); } catch { return json({ erro: 'Corpo inválido.' }, 400); }

  const funilId = Number(corpo?.funil_id);
  const funil = Number.isInteger(funilId) ? (await lerFunis(env)).find((f) => f.id === funilId) : null;
  if (!funil || funil.situacao !== 'ativo') return json({ erro: ERRO_FUNIL }, 404);
  if (!funilEditavel(funil)) return json({ erro: ERRO_NAO_EDITAVEL }, 403);

  const v = validarMeta(corpo.meta);
  if (!v.ok) return json({ erro: v.erro, campos: v.campos }, 400);

  // Concorrência: a versão lida tem de ser a linha mais recente do funil.
  const linhas = await lerLinhas(env, funilId);
  const maisRecente = linhas.reduce((m, l) => (!m || l.id > m.id ? l : m), null);
  const versaoAtual = maisRecente ? maisRecente.id : null;
  const versaoLida = corpo.versao === null || corpo.versao === undefined ? null : Number(corpo.versao);
  if (versaoLida !== versaoAtual) return json({ erro: ERRO_CONCORRENCIA }, 409);

  const quando = agora();
  const m = v.meta;
  // O INSERT confere a versão de novo, no mesmo comando: duas gravações
  // simultâneas com a mesma versão não passam juntas.
  const r = await env.DB.prepare(`
    INSERT INTO metas_funil (funil_id, mes_inicio, cpl_max_centavos, leads_novos, mqls,
                             custo_mql_max_centavos, alterada_em, alterada_por)
    SELECT ?, ?, ?, ?, ?, ?, ?, ?
     WHERE COALESCE((SELECT MAX(id) FROM metas_funil WHERE funil_id = ?), -1) = COALESCE(?, -1)
  `).bind(
    funilId, mesBrt(quando), m.cpl_max_centavos, m.leads_novos, m.mqls, m.custo_mql_max_centavos,
    quando, ALTERADA_POR, funilId, versaoAtual,
  ).run();
  if (!r.meta || !r.meta.changes) return json({ erro: ERRO_CONCORRENCIA }, 409);

  return json(montarFunil(funil, await lerLinhas(env, funilId), mesBrt(quando)));
}
