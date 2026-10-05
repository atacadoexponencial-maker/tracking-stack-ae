// Coleta das fontes do relatório semanal do Argo (issue 405).
//
// Lê tudo o que o pacote de fatos precisa e entrega a `montarPacote`. Cada
// fonte é lida sozinha: a que falhar vira `{ erro }` e o resto segue. "Não
// consegui ler" nunca vira zero (montarPacote transforma em fato indisponível).
//
// Fontes: relatório de marketing (o mesmo `montarFeedback` das metas e do
// feedback diário, para os números nunca divergirem entre telas), metas por
// funil (D1), régua do Argo, propostas/ações/vereditos (Neon), gasto por
// anúncio (Graph API) com leads por anúncio (CRM), anúncios novos, registro de
// testes, contexto do negócio e o que a gestora disse no relatório anterior.
import { CONTA } from './_argo-db.js';
import { montarFeedback } from './feedback-marketing.js';
import { resolverPeriodo } from './_feedback-marketing-periodo.js';
import { metaVigente } from './_metas.js';
import { diasDoMes } from './_metas-acompanhamento.js';
import { REGRAS } from './_argo-regua.js';
import { insightsPorAnuncio, listarAnuncios } from './_argo-meta.js';
import { lerCardsCriadosNoPeriodo, lerTaskIdsDeTesteOuBot } from './_feedback-marketing-crm.js';
import { agruparPorAnuncio } from './_argo-leads-anuncio.js';
import { lerTestesComNumeros } from './_argo-testes-numeros.js';
import { montarContexto } from './_argo-contexto.js';
import { lerItensContexto } from './argo/contexto.js';
import { janelasDoRelatorio, limitesMs } from './_argo-relatorio-semana.js';

const tentar = async (fn, erro) => {
  try {
    return await fn();
  } catch {
    return { erro };
  }
};

async function feedbackDoPeriodo(env, janela, agoraUnix) {
  const r = resolverPeriodo({ inicio: janela.inicio, fim: janela.fim }, agoraUnix);
  if (!r.ok) return { erro: 'Período inválido para o relatório de marketing.' };
  return montarFeedback(env, r.periodo, []);
}

async function lerMetas(env, mes) {
  const [funisRes, linhasRes] = await Promise.all([
    env.DB.prepare(`SELECT id, nome FROM funis_relatorio WHERE situacao = 'ativo'`).all(),
    env.DB.prepare(`SELECT id, funil_id, mes_inicio, cpl_max_centavos, leads_novos, mqls, custo_mql_max_centavos FROM metas_funil`).all(),
  ]);
  const linhas = linhasRes.results || [];
  return (funisRes.results || []).map((f) => {
    const v = metaVigente(linhas.filter((l) => l.funil_id === f.id), mes);
    return v ? { nome: f.nome, cpl_max_centavos: v.cpl_max_centavos, leads_novos: v.leads_novos, mqls: v.mqls, custo_mql_max_centavos: v.custo_mql_max_centavos, dias_no_mes: diasDoMes(mes) } : null;
  }).filter(Boolean);
}

async function lerPiso(sql) {
  const linhas = await sql`SELECT regua FROM argo.config_conta WHERE conta = ${CONTA}`;
  const salvo = linhas[0] && linhas[0].regua ? Number(linhas[0].regua.avaliacao_piso_lead_multiplicador) : NaN;
  return { multiplicador: Number.isFinite(salvo) && salvo > 0 ? salvo : REGRAS.avaliacao_piso_lead_multiplicador.padrao };
}

async function lerArgo(sql, desde, ate) {
  const de = new Date(desde).toISOString();
  const a = new Date(ate).toISOString();
  const [propostas, acoes, vereditos] = await Promise.all([
    sql`SELECT id, tipo, alvo_nome, motivo, decisao, decidida_em, criada_em, por_que, acao_id
          FROM argo.propostas
         WHERE conta = ${CONTA} AND ((criada_em >= ${de} AND criada_em < ${a}) OR (decidida_em >= ${de} AND decidida_em < ${a}))
         ORDER BY criada_em`,
    sql`SELECT id, tipo, alvo_id, alvo_nome, motivo, aplicada, criada_em, desfaz_acao_id
          FROM argo.acoes
         WHERE conta = ${CONTA} AND criada_em >= ${de} AND criada_em < ${a}
         ORDER BY criada_em`,
    sql`SELECT v.acao_id, v.situacao, v.motivo, v.avaliada_em, ac.tipo, ac.alvo_nome, ac.criada_em
          FROM argo.vereditos v JOIN argo.acoes ac ON ac.id = v.acao_id
         WHERE v.conta = ${CONTA}
           AND ((v.avaliada_em >= ${de} AND v.avaliada_em < ${a}) OR (ac.criada_em >= ${de} AND ac.criada_em < ${a}))`,
  ]);
  return { propostas, acoes, vereditos };
}

async function lerAnuncios(env, janela) {
  const ins = await insightsPorAnuncio(env, { desde: janela.inicio, ate: janela.fim });
  if (!ins.ok) return { erro: ins.aviso };
  const { desde, ate } = limitesMs(janela);
  const crm = await lerCardsCriadosNoPeriodo(env, { desde: Math.floor(desde / 1000), ate: Math.ceil(ate / 1000) });
  if (!crm.ok) return { erro: crm.aviso };
  const excluidos = new Set(await lerTaskIdsDeTesteOuBot(env.DB, crm.cards.map((c) => c.id)));
  const cards = crm.cards.filter((c) => !excluidos.has(String(c.id)));
  const g = agruparPorAnuncio({ cards, maduroAteMs: ate, funis: [] });
  const leadsPorNome = {};
  let total = g.sem_utm_content;
  for (const x of g.anuncios) {
    leadsPorNome[x.utm_content] = { leads: x.leads_maduros + x.leads_recentes, mqls: x.qualificados };
    total += x.leads_maduros + x.leads_recentes;
  }
  return { insights: ins.linhas, leadsPorNome, totalLeadsPagos: total };
}

async function lerSemanaAnterior(sql, semanaInicio) {
  const rel = await sql`
    SELECT id, analise FROM argo.relatorios
     WHERE conta = ${CONTA} AND semana_inicio < ${semanaInicio} AND substituido_em IS NULL AND situacao <> 'falhou'
     ORDER BY semana_inicio DESC, id DESC LIMIT 1`;
  if (!rel.length) return { tem: false, reacoes: [], descartes: [] };
  const id = rel[0].id;
  const [reacoes, decisoes] = await Promise.all([
    sql`SELECT bloco, tipo, comentario FROM argo.relatorio_reacoes WHERE relatorio_id = ${id} ORDER BY bloco`,
    sql`SELECT sugestao_chave, motivo FROM argo.sugestoes_decisoes WHERE relatorio_id = ${id} AND decisao = 'descartada'`,
  ]);
  const blocos = Array.isArray(rel[0].analise) ? rel[0].analise : [];
  const tituloSugestao = (chave) => {
    const b = blocos.find((x) => x.chave === chave);
    return b && b.sugestao ? b.sugestao.hipotese || b.titulo : chave;
  };
  return { tem: true, reacoes, descartes: decisoes.map((d) => ({ chave: d.sugestao_chave, titulo: tituloSugestao(d.sugestao_chave), motivo: d.motivo })) };
}

/** Lê todas as fontes do relatório da semana que termina ontem (Brasília). */
export async function coletarFontes(env, sql, hoje, agoraMs = Date.now()) {
  const janelas = janelasDoRelatorio(hoje);
  const agoraUnix = Math.floor(agoraMs / 1000);
  const { desde, ate } = limitesMs(janelas.semana);
  const [atual, anterior, media4, metas, piso, argo, anuncios, novos, testes, contexto, semanaAnterior] = await Promise.all([
    tentar(() => feedbackDoPeriodo(env, janelas.semana, agoraUnix), 'O relatório de marketing não respondeu.'),
    tentar(() => feedbackDoPeriodo(env, janelas.anterior, agoraUnix), 'O relatório de marketing da semana anterior não respondeu.'),
    tentar(() => feedbackDoPeriodo(env, janelas.media4, agoraUnix), 'O relatório de marketing das 4 semanas anteriores não respondeu.'),
    tentar(() => lerMetas(env, janelas.semana.fim.slice(0, 7)), 'As metas por funil não responderam.'),
    tentar(() => lerPiso(sql), 'A régua do Argo não respondeu.'),
    tentar(() => lerArgo(sql, desde, ate), 'As ações do Argo não responderam.'),
    tentar(() => lerAnuncios(env, janelas.semana), 'Os resultados por anúncio não responderam.'),
    tentar(async () => { const r = await listarAnuncios(env); return r.ok ? r.anuncios : { erro: r.aviso }; }, 'A lista de anúncios não respondeu.'),
    tentar(() => lerTestesComNumeros(sql, env, hoje), 'O registro de testes não respondeu.'),
    tentar(async () => montarContexto(await lerItensContexto(sql), hoje), 'O contexto do negócio não respondeu.'),
    tentar(() => lerSemanaAnterior(sql, janelas.semana.inicio), 'O relatório anterior não respondeu.'),
  ]);
  return {
    hoje,
    janelas,
    resultados: { atual, anterior, media4 },
    metas,
    piso: piso.erro ? { multiplicador: REGRAS.avaliacao_piso_lead_multiplicador.padrao } : piso,
    argo,
    anuncios,
    anunciosNovos: novos.erro ? null : novos,
    testes,
    contexto,
    semanaAnterior: semanaAnterior.erro ? { reacoes: [], descartes: [] } : semanaAnterior,
    temRelatorioAnterior: !semanaAnterior.erro && semanaAnterior.tem,
  };
}
