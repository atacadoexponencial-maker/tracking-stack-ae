// TEMPORÁRIO (sonda de 26/10/2026): auditoria dos níveis de qualificação da
// Visão geral. Lista, card a card, os leads novos dos funis de MQL com o
// faturamento informado e a faixa em que caíram — as mesmas funções do dash
// (lerCardsCriadosNoPeriodo, atribuirCards, faixaDeFaturamento, ehMql).
// Só leitura. Apagar depois da auditoria.
//
// GET /api/agenda/auditoria-qualificacao?key=...&inicio=AAAA-MM-DD&fim=AAAA-MM-DD
import { resolverPeriodo, limitesDoPeriodoUnix } from '../_feedback-marketing-periodo.js';
import { lerCardsCriadosNoPeriodo, lerTaskIdsDeTesteOuBot, atribuirCards, lerCampo, CAMPO_UTM_SOURCE } from '../_feedback-marketing-crm.js';
import { faixaDeFaturamento, ehMql, ehSql, CAMPO_FATURAMENTO } from '../_feedback-marketing-mql.js';
import { MQL_FUNIS } from './taxas.js';

const json = (dados, status = 200) => Response.json(dados, { status });

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (!env.DASH_KEY || url.searchParams.get('key') !== env.DASH_KEY) return json({ error: 'Unauthorized' }, 401);
  const r = resolverPeriodo({ inicio: url.searchParams.get('inicio'), fim: url.searchParams.get('fim') }, Math.floor(Date.now() / 1000));
  if (!r.ok) return json({ error: 'período inválido' }, 400);
  const limites = limitesDoPeriodoUnix(r.periodo);
  const crm = await lerCardsCriadosNoPeriodo(env, limites);
  if (!crm.ok) return json({ error: crm.aviso }, 502);
  const funis = (await env.DB.prepare(`SELECT id, nome, tipo, posicao, funil_tracking, trecho_campanha, opcoes_crm, origem_lead, situacao
    FROM funis_relatorio WHERE situacao IN ('ativo', 'arquivado') ORDER BY (situacao = 'ativo') DESC, posicao, id`).all()).results || [];
  const venda = (await env.DB.prepare(`SELECT opcoes_crm FROM funis_relatorio WHERE tipo = 'venda_greenn'`).all()).results || [];
  const excluidos = await lerTaskIdsDeTesteOuBot(env.DB, crm.cards.map((c) => c.id));
  const leads = atribuirCards({ cards: crm.cards, funisAtivos: funis.map((f) => ({ ...f, arquivado: f.situacao === 'arquivado' })), limites, taskIdsExcluidos: excluidos, funisDeVenda: venda });
  const linhas = [];
  for (const f of funis) {
    if (!MQL_FUNIS.includes(f.funil_tracking)) continue;
    for (const c of leads.blocos.get(f.id) || []) {
      linhas.push({
        funil: f.funil_tracking, id: c.id, url: c.url,
        criado: new Date(Number(c.date_created)).toISOString(),
        status: c.status && c.status.status,
        utm_source: lerCampo(c, CAMPO_UTM_SOURCE),
        faturamento: lerCampo(c, CAMPO_FATURAMENTO),
        faixa: faixaDeFaturamento(c), mql: ehMql(c), sql: ehSql(c),
      });
    }
  }
  return json({ periodo: r.periodo, total_cards_lidos: crm.cards.length, excluidos_teste_bot: excluidos.length, linhas });
}
