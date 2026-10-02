// Funil de conversão da agenda e custo por reunião (spec-conversao-agenda.md).
//
// Funções puras: recebem linhas já lidas do D1 e devolvem os números prontos.
// O endpoint só faz I/O e o dash só desenha. Testes em tests/agenda-funil.test.js.
//
// Prefixo "_": o Cloudflare Pages não transforma o arquivo em rota.

import { canalDeLead } from './_canal.js';

// As 5 etapas, em ordem. `chave` é o nome usado nas respostas.
export const ETAPAS = [
  { chave: 'leads', rotulo: 'Lead' },
  { chave: 'abriu', rotulo: 'Abriu a agenda' },
  { chave: 'escolheu', rotulo: 'Escolheu horário' },
  { chave: 'agendou', rotulo: 'Agendou' },
  { chave: 'compareceu', rotulo: 'Compareceu' },
];

/**
 * Etapa mais avançada de um convite (1 a 5). Etapa posterior implica as
 * anteriores: quem agendou abriu e escolheu, mesmo que o registro da abertura
 * tenha se perdido (aba fechada antes do envio, bloqueador).
 */
function nivelDoConvite(c) {
  if (c.situacao === 'realizada') return 5;
  if (c.agendou_em) return 4;
  if (c.escolheu) return 3;
  if (c.abriu) return 2;
  return 1;
}

function vazio() {
  return { leads: 0, abriu: 0, escolheu: 0, agendou: 0, compareceu: 0, cancelou: 0, faltou: 0 };
}

function somar(acc, c) {
  const n = nivelDoConvite(c);
  acc.leads++;
  if (n >= 2) acc.abriu++;
  if (n >= 3) acc.escolheu++;
  if (n >= 4) acc.agendou++;
  if (n >= 5) acc.compareceu++;
  if (c.situacao === 'cancelada') acc.cancelou++;
  if (c.situacao === 'faltou') acc.faltou++;
}

/** Passagem de cada etapa para a próxima, e a maior perda (em pessoas). */
function comPassagens(contagem) {
  const etapas = ETAPAS.map((e, i) => {
    const qtd = contagem[e.chave];
    const anterior = i ? contagem[ETAPAS[i - 1].chave] : null;
    return {
      chave: e.chave,
      rotulo: e.rotulo,
      qtd,
      passagem: i && anterior ? qtd / anterior : null,
      perdidos: i ? Math.max(0, (anterior || 0) - qtd) : 0,
    };
  });
  let maior = null;
  for (const e of etapas.slice(1)) if (e.perdidos > 0 && (!maior || e.perdidos > maior.perdidos)) maior = e;
  for (const e of etapas) e.maiorPerda = !!maior && e.chave === maior.chave;
  return {
    ...contagem,
    etapas,
    taxa_lead_reuniao: contagem.leads ? contagem.compareceu / contagem.leads : null,
  };
}

function mediana(valores) {
  if (!valores.length) return null;
  const v = [...valores].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/**
 * Funil da agenda por coorte do formulário.
 *   convites: [{ email, funil, criado_em, abriu, escolheu, agendou_em,
 *               situacao, tipo_nome, utm_source, utm_campaign, material }]
 * Uma pessoa que preencheu o formulário duas vezes no período conta uma vez,
 * pela etapa mais avançada que alcançou.
 */
export function calcularFunilAgenda(convites) {
  const porPessoa = new Map();
  for (const c of convites || []) {
    const chave = String(c.email || '').trim().toLowerCase() || `sem-email-${porPessoa.size}`;
    const atual = porPessoa.get(chave);
    if (!atual || nivelDoConvite(c) > nivelDoConvite(atual)
      || (nivelDoConvite(c) === nivelDoConvite(atual) && c.criado_em < atual.criado_em)) {
      porPessoa.set(chave, c);
    }
  }
  const pessoas = [...porPessoa.values()];

  const total = vazio();
  const grupos = { funil: new Map(), origem: new Map(), tipo: new Map() };
  const tempos = [];
  for (const c of pessoas) {
    somar(total, c);
    const canal = canalDeLead(c);
    const origem = c.utm_campaign ? `${canal} · ${c.utm_campaign}` : canal;
    for (const [g, valor] of [['funil', c.funil || 'sem-funil'], ['origem', origem], ['tipo', c.tipo_nome || 'sem tipo']]) {
      if (!grupos[g].has(valor)) grupos[g].set(valor, vazio());
      somar(grupos[g].get(valor), c);
    }
    if (c.agendou_em && c.agendou_em >= c.criado_em) tempos.push(c.agendou_em - c.criado_em);
  }
  const lista = (m) => [...m.entries()]
    .map(([nome, cont]) => ({ nome, ...comPassagens(cont) }))
    .sort((a, b) => b.leads - a.leads);

  return {
    ...comPassagens(total),
    por_funil: lista(grupos.funil),
    por_origem: lista(grupos.origem),
    por_tipo: lista(grupos.tipo),
    mediana_segundos_ate_agendar: mediana(tempos),
  };
}

/**
 * Custo por reunião agendada e realizada, granular por funil.
 *   porFunilCpl: o `por_funil` do /api/cpl ([{ funnel, spend }], spend em reais)
 *   agendadas / realizadas: [{ funil }] (comerciais, sem teste, já no período)
 *   funisComAgenda: funis com tipo comercial (entram no total mesmo sem reunião)
 * No total, só entra o investimento dos funis que agendam reunião: gasto de
 * workshop ou de live não pode inflar o custo por reunião.
 */
export function custoPorReuniao({ porFunilCpl = [], agendadas = [], realizadas = [], funisComAgenda = [] }) {
  const gasto = new Map(porFunilCpl.map((f) => [f.funnel, Number(f.spend) || 0]));
  const conta = (lista) => lista.reduce((m, r) => m.set(r.funil || 'sem-funil', (m.get(r.funil || 'sem-funil') || 0) + 1), new Map());
  const ag = conta(agendadas);
  const re = conta(realizadas);
  const funis = new Set([...funisComAgenda, ...ag.keys(), ...re.keys()]);
  const custo = (spend, qtd) => (spend > 0 && qtd > 0 ? spend / qtd : null);
  const por_funil = {};
  let spendTotal = 0;
  for (const f of funis) {
    const spend = gasto.get(f) || 0;
    spendTotal += spend;
    por_funil[f] = {
      spend,
      agendadas: ag.get(f) || 0,
      realizadas: re.get(f) || 0,
      custo_agendada: custo(spend, ag.get(f) || 0),
      custo_realizada: custo(spend, re.get(f) || 0),
    };
  }
  const totalAg = agendadas.length;
  const totalRe = realizadas.length;
  return {
    por_funil,
    total: {
      spend: spendTotal,
      agendadas: totalAg,
      realizadas: totalRe,
      custo_agendada: custo(spendTotal, totalAg),
      custo_realizada: custo(spendTotal, totalRe),
    },
  };
}

// ---------------------------------------------------------------------------
// Taxas de passagem (pedido de 02/10): Lead → MQL → RA → RR e no-show
// ---------------------------------------------------------------------------

const razao = (a, b) => (b > 0 && a !== null && a !== undefined ? a / b : null);

/**
 * Taxas de um recorte.
 *   leads_novos / mqls: do relatório de marketing (CRM); null = CRM não lido
 *   agendadas: reuniões agendadas no período (pela data em que agendou)
 *   ocorridas: reuniões que já deveriam ter acontecido no período (passaram da
 *              data e não foram canceladas): realizadas + faltas + sem presença
 *   realizadas / faltas: entre as ocorridas
 */
export function calcularTaxas({ leads_novos = null, mqls = null, agendadas = 0, ocorridas = 0, realizadas = 0, faltas = 0 }) {
  return {
    leads_novos, mqls, agendadas, ocorridas, realizadas, faltas,
    lead_mql: leads_novos === null || mqls === null ? null : razao(mqls, leads_novos),
    mql_ra: mqls === null ? null : razao(agendadas, mqls),
    ra_rr: razao(realizadas, ocorridas),
    no_show: razao(faltas, realizadas + faltas),
  };
}

/**
 * Junta as métricas do CRM por funil (`crm`: { funil: { leads_novos, mqls } },
 * ou null quando o CRM não foi lido) com as contagens da agenda por funil
 * (`agenda`: { funil: { agendadas, ocorridas, realizadas, faltas } }).
 * No total, Lead → MQL usa todos os funis de lead; as demais taxas usam só os
 * funis que agendam reunião (`funisComAgenda`), para MQL de workshop não
 * diluir MQL → RA.
 */
export function taxasPorFunil({ crm, agenda = {}, funisComAgenda = [] }) {
  const comAgenda = new Set([...funisComAgenda, ...Object.keys(agenda)]);
  const zero = { agendadas: 0, ocorridas: 0, realizadas: 0, faltas: 0 };
  const por_funil = {};
  for (const f of comAgenda) {
    const c = crm ? (crm[f] || { leads_novos: 0, mqls: 0 }) : { leads_novos: null, mqls: null };
    por_funil[f] = calcularTaxas({ ...c, ...(agenda[f] || zero) });
  }
  const soma = (lista, campo) => lista.reduce((s, x) => s + (x[campo] || 0), 0);
  const ag = Object.values(agenda);
  const crmTodos = crm ? Object.values(crm) : null;
  const crmAgenda = crm ? [...comAgenda].map((f) => crm[f] || { leads_novos: 0, mqls: 0 }) : null;
  const total = calcularTaxas({
    leads_novos: crmAgenda ? soma(crmAgenda, 'leads_novos') : null,
    mqls: crmAgenda ? soma(crmAgenda, 'mqls') : null,
    agendadas: soma(ag, 'agendadas'), ocorridas: soma(ag, 'ocorridas'),
    realizadas: soma(ag, 'realizadas'), faltas: soma(ag, 'faltas'),
  });
  // Lead → MQL do total olha todos os funis de lead, não só os que agendam.
  total.lead_mql = crmTodos ? razao(soma(crmTodos, 'mqls'), soma(crmTodos, 'leads_novos')) : null;
  return { por_funil, total };
}
