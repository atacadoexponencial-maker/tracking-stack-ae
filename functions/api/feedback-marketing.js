// GET /api/feedback-marketing
//
// Conteúdo pronto do relatório de marketing (diário, semanal e mensal) para o
// agente do Slack apenas FORMATAR (spec-feedback-marketing.md). Só leitura:
// nada é escrito no D1, no CRM, no Meta nem na Greenn.
//
// Tudo calculado de verdade, sem dado fixo:
//   - período (issue 254) — _feedback-marketing-periodo.js;
//   - investimento e reconhecimento de campanhas (255, 256) —
//     _feedback-marketing-investimento.js;
//   - novos leads e MQLs do CRM (257, 258) — _feedback-marketing-crm.js e
//     _feedback-marketing-mql.js;
//   - compras realizadas na Greenn e origem (261, 262) —
//     _feedback-marketing-greenn.js;
//   - blocos por tipo e "sem funil" (259, 260, 263, 264) —
//     _feedback-marketing-blocos.js;
//   - resposta final: ordem, totais, frescor e avisos (265) —
//     _feedback-marketing-resposta.js.
//
// Autenticação (issue 253): chave própria `FEEDBACK_MARKETING_KEY` no
// cabeçalho `Authorization: Bearer <chave>` — ver _feedback-marketing-auth.js.
// Só GET; qualquer outro método recebe 405 sem ler nada.
//
// Convenções do contrato — as mesmas de _greenn-metricas.js e _cpl-calculo.js:
//   - `null` = sem denominador ou fonte que não respondeu (o relatório escreve
//     "—"); nunca 0 inventado;
//   - `{ calculado: false, motivo }` = métrica que a consulta não calcula
//     (tipo Manual); ausente, nunca zero;
//   - valores monetários em reais com duas casas; a formatação é do agente.
//
// Falha inesperada: 500 com "Não foi possível montar o feedback agora." e
// nenhum número — parcial nunca sai disfarçado de completo.

import { autorizarFeedbackMarketing } from './_feedback-marketing-auth.js';
import { resolverPeriodo, limitesDoPeriodoUnix } from './_feedback-marketing-periodo.js';
import { reconhecerCampanhasDoPeriodo, montarInvestimento } from './_feedback-marketing-investimento.js';
import { listarFunisConhecidos } from './_funil-campanha.js';
import { lerOpcoesFunilCrm } from './_crm-opcoes-funil.js';
import {
  lerCardsCriadosNoPeriodo,
  lerTaskIdsDeTesteOuBot,
  atribuirCards,
  avisosOpcoesInexistentes,
} from './_feedback-marketing-crm.js';
import { montarResposta, ERRO_FALHA_INESPERADA } from './_feedback-marketing-resposta.js';
import {
  montarBlocoLead,
  montarBlocoManual,
  montarBlocoVenda,
  avisoVendasSemFunilDeVenda,
  montarSemFunil,
  avisoInvestimentoSemFunil,
} from './_feedback-marketing-blocos.js';
import {
  lerVendasGreennDoPeriodo,
  contarComprasDoPeriodo,
  avisosGreenn,
  lerSessoesCheckout,
  contarPorOrigem,
} from './_feedback-marketing-greenn.js';

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'GET') {
    return json({ error: 'Método não permitido.' }, 405, { Allow: 'GET' });
  }

  const acesso = autorizarFeedbackMarketing(
    { url: request.url, authorization: request.headers.get('Authorization') },
    env,
  );
  if (!acesso.ok) return json(acesso.corpo, acesso.status);

  const url = new URL(request.url);
  const resolucao = resolverPeriodo({
    inicio: url.searchParams.get('inicio'),
    fim: url.searchParams.get('fim'),
  });
  if (!resolucao.ok) return json({ error: resolucao.erro }, 400);
  const { periodo } = resolucao;

  try {
    return json(await montarFeedback(env, periodo, resolucao.avisos));
  } catch (e) {
    // Sem números parciais: o detalhe fica só no log.
    console.error('feedback-marketing — falha inesperada:', e && e.message ? e.message : e);
    return json({ error: ERRO_FALHA_INESPERADA }, 500);
  }
}

// Leituras e montagem. Qualquer exceção sobe para o erro geral de onRequest.
async function montarFeedback(env, periodo, avisosDoPeriodo) {
  const limites = limitesDoPeriodoUnix(periodo);
  // Só leitura. `ad_spend.date` já é dia de Brasília: o recorte é direto por
  // intervalo de data, pelo índice (platform, date), agregado por campanha.
  // Sem HAVING: o investido geral precisa ver também campanha com soma ≤ 0.
  // As duas chamadas ao CRM saem junto com as leituras do D1: só GET, e nunca
  // lançam (CRM fora do ar vira aviso, não erro).
  const [gastosRes, overridesRes, ativosRes, vendaRes, funisConhecidos, sync, crm, opcoesCrm, greenn] = await Promise.all([
    env.DB.prepare(`
      SELECT campaign_id, MAX(campaign_name) AS campaign_name, SUM(spend_cents) AS spend_cents
      FROM ad_spend
      WHERE platform = 'meta' AND date BETWEEN ? AND ?
      GROUP BY campaign_id
    `).bind(periodo.inicio, periodo.fim).all(),
    env.DB.prepare('SELECT campaign_id, funnel FROM campaign_funnel_map').all(),
    env.DB.prepare(`
      SELECT id, nome, tipo, posicao, funil_tracking, trecho_campanha, opcoes_crm, origem_lead
      FROM funis_relatorio WHERE situacao = 'ativo'
      ORDER BY posicao, id
    `).all(),
    // Funis de venda ativos E arquivados: a opção de comprador nunca vira lead.
    env.DB.prepare(`SELECT opcoes_crm FROM funis_relatorio WHERE tipo = 'venda_greenn'`).all(),
    listarFunisConhecidos(env.DB),
    // Última sincronização com sucesso do Meta — mesma fonte do /api/attribution.
    env.DB.prepare(`
      SELECT MAX(run_at) AS ultimo FROM sync_log WHERE platform = 'meta' AND status = 'ok'
    `).first(),
    lerCardsCriadosNoPeriodo(env, limites),
    lerOpcoesFunilCrm(env),
    lerVendasGreennDoPeriodo(env.DB, limites),
  ]);

  const gastos = gastosRes.results || [];
  const funisAtivos = ativosRes.results || [];
  const reconhecimento = reconhecerCampanhasDoPeriodo(gastos, {
    overrides: overridesRes.results || [],
    funisAtivos,
    funisConhecidos,
  });
  const investimento = montarInvestimento({
    gastos,
    campanhas: reconhecimento.campanhas,
    funisAtivos,
    ultimaAtualizacaoUnix: sync ? sync.ultimo : null,
    periodo,
  });

  // CRM indisponível (ou acima do teto de páginas): leads vêm null, nunca 0.
  const excluidos = crm.ok ? await lerTaskIdsDeTesteOuBot(env.DB, crm.cards.map((c) => c.id)) : [];
  const leads = crm.ok
    ? atribuirCards({ cards: crm.cards, funisAtivos, limites, taskIdsExcluidos: excluidos, funisDeVenda: vendaRes.results || [] })
    : null;

  // Compras realizadas na Greenn (issue 261): todas as vendas pagas no período.
  const vendas = contarComprasDoPeriodo({ linhas: greenn.linhas, limites });
  // Origem de cada compra pela sessão de checkout (issue 262).
  const sessoesCheckout = await lerSessoesCheckout(env.DB, vendas.compras.map((c) => c.trk));
  const comprasPorOrigem = contarPorOrigem(vendas.compras, sessoesCheckout);

  const blocos = funisAtivos.map((f) => {
    const inv = investimento.blocos.get(f.id);
    if (f.tipo === 'lead_mql') {
      return montarBlocoLead({ funil: f, investimento: inv, cards: leads ? leads.blocos.get(f.id) : null });
    }
    if (f.tipo === 'manual') return montarBlocoManual({ funil: f, investimento: inv });
    return montarBlocoVenda({
      funil: f,
      investimento: inv,
      compras: { total: vendas.compras.length, por_origem: comprasPorOrigem },
    });
  });

  return montarResposta({
    periodo,
    agoraUnix: Math.floor(Date.now() / 1000),
    investimento,
    blocos,
    semFunil: montarSemFunil({ investimento: investimento.sem_funil, leads: leads ? leads.sem_funil : null }),
    crmLido: crm.ok,
    ultimoEventoGreennUnix: greenn.ultimoEventoUnix,
    avisos: [
      ...avisosDoPeriodo,
      ...reconhecimento.avisos,
      ...investimento.avisos,
      ...(crm.ok ? [] : [crm.aviso]),
      ...avisosOpcoesInexistentes(funisAtivos, opcoesCrm.ok ? opcoesCrm.opcoes : null),
      ...avisosGreenn({ ilegiveis: vendas.ilegiveis, ultimoEventoUnix: greenn.ultimoEventoUnix, limites }),
      ...avisoVendasSemFunilDeVenda(funisAtivos, vendas.compras.length),
      ...avisoInvestimentoSemFunil(investimento.sem_funil.investido),
    ],
  });
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}
