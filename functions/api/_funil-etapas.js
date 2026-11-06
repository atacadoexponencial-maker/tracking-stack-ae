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

// Rótulo de cada etapa pelo nome da pergunta (série S6). Chat: "responderam
// o …"; cartão da aplicação: "preencheram o …". Nome fora da lista (pergunta
// nova sem rótulo aqui) aparece como "responderam: <nome>" (SUP-S6-05) — nunca
// some nem vira número.
const ROTULOS_ETAPA = {
  nome: 'responderam o nome',
  whatsapp: 'responderam o WhatsApp',
  email: 'responderam o e-mail',
  instagram: 'responderam o Instagram',
  faturamento: 'responderam o faturamento',
  cargo: 'responderam o cargo',
  desafio: 'responderam o desafio',
  objetivo: 'responderam o objetivo',
  contato: 'preencheram o contato',
  perfil: 'preencheram o perfil',
};

const nomeValido = (v) => typeof v === 'string' && v !== '';

/**
 * Junta as linhas de etapa (página × posição × nome) num degrau por etapa.
 *
 * Etapa COM nome soma todas as posições em que apareceu: o desafio que era a
 * etapa 6 e virou a 7 continua sendo o mesmo degrau. A posição usada para
 * ordenar é a da linha vista por último (`ultimaMs`), que é a ordem ATUAL do
 * formulário. Etapa SEM nome (JS antigo, nome inválido) fica como antes: um
 * degrau por posição, "concluíram a etapa N".
 */
function agruparEtapas(etapas, periodoInicioMs) {
  const grupos = new Map();
  for (const e of Array.isArray(etapas) ? etapas : []) {
    if (!e || !Number.isFinite(Number(e.step))) continue;
    const step = Number(e.step);
    const comNome = nomeValido(e.nome);
    const chave = comNome ? 'etapa-' + e.nome : 'etapa-' + step;
    const g = grupos.get(chave) || { chave, nome: comNome ? e.nome : null, step, ultimaMs: -Infinity, sessoes: 0, desdeMs: null };
    g.sessoes += n(e.sessoes);
    const ultima = Number.isFinite(Number(e.ultimaMs)) ? Number(e.ultimaMs) : -Infinity;
    if (ultima > g.ultimaMs || (ultima === g.ultimaMs && step > g.step)) { g.ultimaMs = ultima; g.step = step; }
    if (Number.isFinite(Number(e.desdeMs)) && e.desdeMs !== null) {
      g.desdeMs = g.desdeMs === null ? Number(e.desdeMs) : Math.min(g.desdeMs, Number(e.desdeMs));
    }
    grupos.set(chave, g);
  }
  return [...grupos.values()]
    .sort((a, b) => a.step - b.step || a.chave.localeCompare(b.chave))
    .map((g) => {
      // Etapa que começou a ser medida DENTRO do período: o número dela não é
      // comparável com o dos vizinhos (que têm o período inteiro).
      const comecouNoPeriodo = g.desdeMs !== null && Number.isFinite(periodoInicioMs) && g.desdeMs > periodoInicioMs;
      return {
        chave: g.chave,
        rotulo: g.nome ? (ROTULOS_ETAPA[g.nome] || 'responderam: ' + g.nome) : 'concluíram a etapa ' + g.step,
        novo: true,
        sessoes: g.sessoes,
        ...(comecouNoPeriodo ? { medidaDesdeMs: g.desdeMs } : {}),
      };
    });
}

/**
 * Monta os degraus do funil de uma página.
 *
 * Devolve `{ degraus, avisoInicioColetaMs }`. Cada degrau traz `sessoes`
 * (absoluto), `passagem` (fração sobre o degrau ANTERIOR, `null` no primeiro),
 * `novo` e `maiorQueda`. Etapa que começou a ser medida dentro do período traz
 * `medidaDesdeMs` e fica FORA da conta: sem passagem, nunca a maior queda, sem
 * entrar na normalização, e o degrau seguinte compara com o anterior a ela.
 *
 * `etapas`: linhas `{ step, nome?, sessoes, ultimaMs?, desdeMs? }` — uma por
 * posição × nome (ver agruparEtapas).
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
  const brutos = [
    { ...DEGRAUS_FIXOS[0], sessoes: n(visitantes) },
    { ...DEGRAUS_FIXOS[1], sessoes: n(cliques) },
    { ...DEGRAUS_FIXOS[2], sessoes: n(formStarts) },
    ...agruparEtapas(etapas, periodoInicioMs),
    { ...DEGRAU_LEAD, sessoes: n(leads) },
  ];

  // Só os degraus comparáveis entram na conta (índices em `brutos`).
  const cadeia = brutos.map((d, i) => i).filter((i) => brutos[i].medidaDesdeMs === undefined);

  // Normalização da direita para a esquerda: cada degrau vale no MÍNIMO o do
  // degrau seguinte. Um `FormStep` perdido por falha de rede faria o funil
  // "subir" (95 na etapa 2, 110 leads) e um funil que cresce no meio não é
  // lido, é debugado. O erro de rede subnotifica; aqui ele para de mentir.
  for (let k = cadeia.length - 2; k >= 0; k -= 1) {
    const i = cadeia[k];
    const seguinte = cadeia[k + 1];
    if (brutos[i].sessoes < brutos[seguinte].sessoes) {
      brutos[i] = { ...brutos[i], sessoes: brutos[seguinte].sessoes };
    }
  }

  // Passagem sobre o degrau comparável anterior. Anterior zerado devolve
  // `null`, nunca Infinity nem NaN: zero de zero não é 0%, é ausência de dado.
  const degraus = brutos.map((d) => ({ ...d, passagem: null, maiorQueda: false }));
  for (let k = 1; k < cadeia.length; k += 1) {
    const anterior = brutos[cadeia[k - 1]].sessoes;
    degraus[cadeia[k]].passagem = anterior ? brutos[cadeia[k]].sessoes / anterior : null;
  }

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
