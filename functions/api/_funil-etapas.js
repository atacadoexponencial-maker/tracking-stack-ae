// Funil de micro-conversões por página (spec 2026-08-31).
//
// Módulo PURO: recebe os números já contados pelo SQL e devolve os degraus
// prontos para desenhar. Sem `env.DB`, sem `fetch`, sem `Date.now()` — é o que
// permite testá-lo com `node --test` sem subir Worker nem banco (mesmo
// contrato de _cpl-calculo.js: "o endpoint só faz I/O e o dashboard só
// desenha").
//
// Os instantes (início da coleta, início do período) são INJETADOS, nunca
// lidos aqui dentro — mesma disciplina de src/data/lotes-workshop.js, que é o
// que torna as bordas testáveis.

// Ordem dos degraus. É informação de verdade: o funil só é legível porque cada
// degrau é subconjunto do anterior.
//
// `novo: true` marca os degraus que passaram a existir com esta spec. São os
// que levam o asterisco no dashboard — `visita`, `formStart` e `lead` já
// existiam e têm histórico real.
const DEGRAUS_FIXOS = [
  { chave: 'visita', rotulo: 'acessaram a página', novo: false },
  { chave: 'clique', rotulo: 'clicaram no CTA', novo: true },
  { chave: 'formStart', rotulo: 'tocaram no formulário', novo: false },
];
const DEGRAU_LEAD = { chave: 'lead', rotulo: 'viraram lead', novo: false };

/** Número seguro: `null`/`undefined`/`NaN` do banco viram 0, nunca poluem a conta. */
function n(valor) {
  const num = Number(valor);
  return Number.isFinite(num) && num > 0 ? Math.floor(num) : 0;
}

/**
 * Monta os degraus do funil de uma página.
 *
 * Devolve `{ degraus, avisoInicioColetaMs }`. Cada degrau traz `sessoes`
 * (absoluto), `passagem` (fração sobre o degrau ANTERIOR, `null` no primeiro),
 * `novo` e `maiorQueda`.
 *
 * O percentual é sobre o degrau anterior, e não sobre o total, porque é o que
 * localiza a perda: "68% de quem concluiu a etapa 1 concluiu a etapa 2" é
 * acionável; "9,5% do total chegou na etapa 2" não é.
 */
export function montarFunil({
  visitantes,
  cliques,
  formStarts,
  etapas = [],
  leads,
  inicioColetaMs = null,
  periodoInicioMs = null,
} = {}) {
  // Etapas na ordem do formulário. `step` fora de ordem é normal (o SQL não
  // garante ordem); buraco na numeração também pode acontecer se um evento se
  // perder — nos dois casos usamos o que existe, sem inventar degrau ausente e
  // sem reindexar (reindexar mentiria sobre qual etapa é qual).
  const degrausEtapa = (Array.isArray(etapas) ? etapas : [])
    .filter((e) => e && Number.isFinite(Number(e.step)))
    .slice()
    .sort((a, b) => Number(a.step) - Number(b.step))
    .map((e) => ({
      chave: 'etapa-' + Number(e.step),
      rotulo: 'concluíram a etapa ' + Number(e.step),
      novo: true,
      sessoes: n(e.sessoes),
    }));

  const brutos = [
    { ...DEGRAUS_FIXOS[0], sessoes: n(visitantes) },
    { ...DEGRAUS_FIXOS[1], sessoes: n(cliques) },
    { ...DEGRAUS_FIXOS[2], sessoes: n(formStarts) },
    ...degrausEtapa,
    { ...DEGRAU_LEAD, sessoes: n(leads) },
  ];

  // Normalização da direita para a esquerda: cada degrau vale no MÍNIMO o do
  // degrau seguinte. Um `FormStep` perdido por falha de rede faria o funil
  // "subir" (95 na etapa 2, 110 leads) e um funil que cresce no meio não é
  // lido, é debugado. O erro de rede subnotifica; aqui ele para de mentir.
  for (let i = brutos.length - 2; i >= 0; i -= 1) {
    if (brutos[i].sessoes < brutos[i + 1].sessoes) {
      brutos[i] = { ...brutos[i], sessoes: brutos[i + 1].sessoes };
    }
  }

  // Passagem sobre o degrau anterior. Anterior zerado devolve `null`, nunca
  // Infinity nem NaN: zero de zero não é 0%, é ausência de dado.
  const degraus = brutos.map((d, i) => {
    const anterior = i > 0 ? brutos[i - 1].sessoes : null;
    const passagem = i === 0 || !anterior ? null : d.sessoes / anterior;
    return { ...d, passagem, maiorQueda: false };
  });

  // A maior queda é a MENOR passagem — o degrau onde mais gente desiste. Só
  // entre os que têm passagem calculável.
  let piorIndice = -1;
  for (let i = 1; i < degraus.length; i += 1) {
    if (degraus[i].passagem === null) continue;
    if (piorIndice === -1 || degraus[i].passagem < degraus[piorIndice].passagem) piorIndice = i;
  }
  if (piorIndice !== -1) degraus[piorIndice].maiorQueda = true;

  return {
    degraus,
    avisoInicioColetaMs: avisoInicioColeta(inicioColetaMs, periodoInicioMs),
  };
}

/**
 * Quando o dashboard deve avisar desde quando os degraus novos são medidos.
 *
 * Só quando o período consultado COMEÇA ANTES do início da coleta — que é
 * exatamente quando o número engana: `PageView` e `Lead` aparecem com o
 * histórico inteiro e os degraus novos, zerados, fazem o funil parecer ter
 * desabado. Fora disso devolve `null` e o aviso some sozinho.
 *
 * Sem início de coleta (nenhum evento novo gravado ainda) não há data a
 * anunciar: `null` também.
 */
export function avisoInicioColeta(inicioColetaMs, periodoInicioMs) {
  if (!Number.isFinite(inicioColetaMs)) return null;
  if (!Number.isFinite(periodoInicioMs)) return null;
  return periodoInicioMs < inicioColetaMs ? inicioColetaMs : null;
}
