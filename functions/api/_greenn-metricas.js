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

// Como reconhecer, em ad_spend, uma campanha deste produto: o nome CONTÉM o
// trecho do nome da campanha do funil ativo do tipo "Venda na Greenn" no
// cadastro de funis (spec-feedback-marketing.md, módulo 3). O padrão fixo
// `/workshop-pago/i` deixou de existir; o cadastro inicial (migration 0040)
// traz o trecho `workshop-pago`, que reproduz exatamente o mesmo resultado.
//
// Sem diferenciar maiúsculas e minúsculas, e o trecho é TEXTO literal — nunca
// regex: `a.b` não casa `axb`. Mesma comparação do reconhecimento pelo trecho
// em _funis-relatorio-conflitos.js.
//
// O `resolverFunilAuto` de _funil-campanha.js não serve aqui: ele lê apenas o
// ÚLTIMO segmento do nome (`publico-frio`), então estas campanhas caem todas em
// `sem-funil`. Sem o trecho, uma campanha que gastou e não vendeu sumiria da
// tela — é o que acontece, de propósito, quando não há funil de venda com
// trecho (a tela avisa).
export function campanhaDoProduto(nome, trecho) {
  const t = String(trecho == null ? '' : trecho).trim().toLowerCase();
  if (!t) return false;
  return String(nome == null ? '' : nome).toLowerCase().includes(t);
}

export const AVISO_SEM_FUNIL_VENDA = 'Nenhum funil de venda cadastrado — as campanhas do produto que não venderam não aparecem. Cadastre em Funis do relatório.';

// Faixa da aba Greenn (spec-feedback-marketing.md, módulo 3). Montada aqui para
// a tela só exibir. `funil` = { nome, trecho_campanha } do funil ativo do tipo
// "Venda na Greenn", ou null quando não há nenhum (arquivado, nunca cadastrado
// ou tabela ainda inexistente). Devolve null quando não há o que avisar.
export function avisoFunilVenda(funil) {
  if (!funil) return AVISO_SEM_FUNIL_VENDA;
  if (!String(funil.trecho_campanha == null ? '' : funil.trecho_campanha).trim()) {
    return `O funil ${funil.nome} não tem trecho do nome da campanha.`;
  }
  return null;
}

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

// Uma linha por VENDA: a Greenn manda um `saleUpdated` a cada mudança de
// status (waiting_payment → paid → refunded...) e sem reentrega garantida, então
// a mesma `entity_id` aparece várias vezes na tabela. Contar cada linha como
// uma venda inflava receita e quantidade; classificar pela primeira linha
// deixaria um estorno passar como pago. Fica a linha mais RECENTE (maior
// `received_at`; empate pelo maior `id`, que é a ordem de chegada) — e só
// depois disso se decide paid/não paga.
export function reduzirPorVenda(vendas) {
  const porVenda = new Map();
  for (const linha of vendas || []) {
    if (!linha) continue;
    const chave = String(linha.entity_id);
    const atual = porVenda.get(chave);
    if (!atual || maisRecente(linha, atual)) porVenda.set(chave, linha);
  }
  return [...porVenda.values()];
}

function maisRecente(a, b) {
  const ra = Number(a.received_at) || 0;
  const rb = Number(b.received_at) || 0;
  if (ra !== rb) return ra > rb;
  return (Number(a.id) || 0) > (Number(b.id) || 0);
}

/**
 * @param {object} entrada
 * @param {Array} entrada.vendas   linhas de greenn_webhook_event (event = 'saleUpdated')
 * @param {Array} entrada.sessoes  linhas de checkout_sessions (trk + utms)
 * @param {Array} entrada.gastos   linhas de ad_spend já agrupadas por campanha
 * @param {string|null} entrada.trechoCampanha  trecho do funil ativo de venda
 *   na Greenn; vazio/null = nenhuma campanha entra só por ter gastado
 */
export function calcularGreenn({ vendas = [], sessoes = [], gastos = [], trechoCampanha = null } = {}) {
  // A atribuição mora em checkout_sessions.trk, que casa com o `sf_trk`
  // devolvido pela Greenn na venda. NÃO é event_log.session_id: cruzar por lá
  // devolve zero linhas e parece bug sem ser.
  const porTrk = new Map();
  for (const s of sessoes) porTrk.set(s.trk, s);

  const pagas = [];
  let naoPagas = 0;
  let ilegiveis = 0;
  let testesInternos = 0;

  for (const linha of reduzirPorVenda(vendas)) {
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
  // vendeu esconderia a campanha que queimou orçamento sem retorno. Sem trecho,
  // sobram só as que venderam.
  const nomes = new Set(receitaPorCampanha.keys());
  for (const nome of investPorCampanha.keys()) {
    if (campanhaDoProduto(nome, trechoCampanha)) nomes.add(nome);
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
