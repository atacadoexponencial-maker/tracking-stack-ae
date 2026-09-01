// Métricas do produto pago que roda na Greenn (spec-greenn-aba-dashboard.md).
//
// Módulo PURO: recebe as linhas já lidas do banco e devolve os números prontos
// para desenhar. Sem `env.DB`, sem `fetch`, sem `Date.now()` — é o que permite
// testá-lo com `node --test` sem subir Worker nem banco. Mesmo contrato de
// _cpl-calculo.js e _funil-etapas.js: "o endpoint só faz I/O e o dashboard só
// desenha".

// Endereços usados nos testes internos do checkout da Greenn.
//
// É uma lista de ENDEREÇOS, e não de domínios como em `INTERNAL_TEST_DOMAINS`
// (functions/tracker.js), por um motivo concreto: os testes do workshop foram
// feitos de um Gmail pessoal, e os quatro compradores reais também usam Gmail.
// Excluir o domínio apagaria a receita inteira. Se surgir um teste novo, é aqui
// que se acrescenta o endereço — e vale conferir a regra irmã do tracker.
export const EMAILS_TESTE_INTERNO = new Set([
  'marcellefernandesdemesquita@gmail.com',
]);

// Como reconhecer, em ad_spend, uma campanha deste produto.
//
// A nomenclatura é `ae_vendas-workshop-pago-<data>_<publico>`. O
// `resolverFunilAuto` de _funil-campanha.js não serve aqui: ele lê apenas o
// ÚLTIMO segmento do nome (`publico-frio`), então estas campanhas caem todas em
// `sem-funil`. Sem este padrão, uma campanha que gastou e não vendeu sumiria da
// tela — justamente o caso que a spec manda mostrar.
export const PADRAO_CAMPANHA_PRODUTO = /workshop-pago/i;

// Rótulo único das vendas que chegaram sem campanha identificada: acesso
// direto, link compartilhado, indicação. É um grupo legítimo, não um erro.
export const SEM_CAMPANHA = 'sem-campanha';

// Divisão que se recusa a mentir: sem denominador não existe resultado, e
// `null` é o que o dashboard desenha como "—". Devolver 0 ou Infinity aqui
// viraria número de verdade na tela.
function div(a, b) {
  if (!b) return null;
  const r = a / b;
  return Number.isFinite(r) ? r : null;
}

const normEmail = (e) => String(e || '').trim().toLowerCase();

export function ehTesteInterno(email) {
  return EMAILS_TESTE_INTERNO.has(normEmail(email));
}

// Traduz uma linha crua de greenn_webhook_event no que a aba precisa.
// Devolve null quando o payload é ilegível — a linha some sozinha sem derrubar
// as outras.
function lerVenda(linha) {
  let p;
  try {
    p = JSON.parse(linha.raw_json);
  } catch {
    return null;
  }
  if (!p || typeof p !== 'object') return null;

  return {
    id: linha.entity_id,
    status: linha.current_status || '',
    valor: Number(linha.amount || 0),
    data: linha.received_at,
    nome: p.client?.name || '',
    email: p.client?.email || '',
    metodo: p.sale?.method || '',
    produto: p.product?.name || '',
    trk: p.sf_trk || '',
  };
}

/**
 * @param {object} entrada
 * @param {Array} entrada.vendas   linhas de greenn_webhook_event (event = 'saleUpdated')
 * @param {Array} entrada.sessoes  linhas de checkout_sessions (trk + utms)
 * @param {Array} entrada.gastos   linhas de ad_spend já agrupadas por campanha
 */
export function calcularGreenn({ vendas = [], sessoes = [], gastos = [] } = {}) {
  // A atribuição mora em checkout_sessions.trk, que casa com o `sf_trk`
  // devolvido pela Greenn na venda. NÃO é event_log.session_id: cruzar por lá
  // devolve zero linhas e parece bug sem ser.
  const porTrk = new Map();
  for (const s of sessoes) porTrk.set(s.trk, s);

  const pagas = [];
  let naoPagas = 0;
  let ilegiveis = 0;
  let testesInternos = 0;

  for (const linha of vendas) {
    const v = lerVenda(linha);
    if (!v) { ilegiveis++; continue; }

    // Teste da própria equipe sai de tudo: dos números, das listas e das
    // contagens auxiliares. Some da tela por decisão da usuária; o dado segue
    // intacto no banco.
    if (ehTesteInterno(v.email)) { testesInternos++; continue; }

    if (v.status !== 'paid') { naoPagas++; continue; }

    const sessao = v.trk ? porTrk.get(v.trk) : null;
    const campanha = (sessao?.utm_campaign || '').trim();

    pagas.push({
      id: v.id,
      data: v.data,
      nome: v.nome,
      valor: v.valor,
      metodo: v.metodo,
      produto: v.produto,
      // Venda sem `sf_trk`, com `sf_trk` órfão, ou de sessão sem UTM: todas
      // entram na receita. O que muda é só o rótulo da origem.
      campanha: campanha || SEM_CAMPANHA,
      criativo: (sessao?.utm_content || '').trim(),
      origem: (sessao?.utm_source || '').trim(),
      sem_origem: !campanha,
    });
  }

  // Investimento por campanha, ciclo inteiro (sem recorte de data).
  const investPorCampanha = new Map();
  for (const g of gastos) {
    const nome = (g.campaign_name || '').trim();
    if (!nome) continue;
    const reais = Number(g.spend_cents || 0) / 100;
    investPorCampanha.set(nome, (investPorCampanha.get(nome) || 0) + reais);
  }

  // Receita por campanha.
  const receitaPorCampanha = new Map();
  for (const v of pagas) {
    const atual = receitaPorCampanha.get(v.campanha) || { receita: 0, vendas: 0 };
    atual.receita += v.valor;
    atual.vendas += 1;
    receitaPorCampanha.set(v.campanha, atual);
  }

  // A lista de campanhas é a UNIÃO de quem vendeu com quem gastou. Só quem
  // vendeu esconderia a campanha que queimou orçamento sem retorno.
  const nomes = new Set(receitaPorCampanha.keys());
  for (const nome of investPorCampanha.keys()) {
    if (PADRAO_CAMPANHA_PRODUTO.test(nome)) nomes.add(nome);
  }

  const por_campanha = [];
  for (const nome of nomes) {
    const r = receitaPorCampanha.get(nome) || { receita: 0, vendas: 0 };
    // "Sem campanha" não é uma campanha: não tem investimento próprio, e
    // atribuir zero a ela produziria um ROAS inventado.
    const investimento = nome === SEM_CAMPANHA
      ? null
      : (investPorCampanha.has(nome) ? investPorCampanha.get(nome) : null);

    por_campanha.push({
      campanha: nome,
      sem_campanha: nome === SEM_CAMPANHA,
      investimento,
      receita: r.receita,
      vendas: r.vendas,
      roas: div(r.receita, investimento),
      custo_por_venda: div(investimento, r.vendas),
    });
  }
  por_campanha.sort((a, b) => b.receita - a.receita || (b.investimento || 0) - (a.investimento || 0));

  const receita = pagas.reduce((s, v) => s + v.valor, 0);
  const investimento = por_campanha.reduce((s, c) => s + (c.investimento || 0), 0);

  return {
    resumo: {
      receita,
      vendas: pagas.length,
      ticket_medio: div(receita, pagas.length),
      investimento,
      roas: div(receita, investimento),
      nao_pagas: naoPagas,
      ilegiveis,
      testes_internos: testesInternos,
    },
    por_campanha,
    vendas: pagas.sort((a, b) => b.data - a.data),
  };
}
