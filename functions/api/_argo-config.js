// Validação da grade de permissões do Argo (spec 2026-09-20).
//
// A aba NÃO decide nada: esta é a regra de proteção de verdade, não fiação —
// o endpoint só chama `validarConfig` e grava o que ela devolver. Por isso
// mora aqui, testável por `node --test`, no mesmo padrão de
// `_argo-registro.js` e `_cpl-calculo.js`.
//
// Duas decisões deliberadas, as duas por segurança e não por conveniência:
//
// - `permissoes` tem que trazer as SEIS ações conhecidas, sempre. Um POST
//   parcial (por exemplo, só mudando `parada_geral`) que omitisse
//   `permissoes` gravaria `{}` por cima da grade real — apagando em
//   silêncio a proteção que hoje roda em produção
//   (`pausar_campanha_trafego: executar`). Explícito é mais seguro que
//   merge silencioso com o que já existe no banco.
// - Nenhuma coerção. `parseInt` truncaria `3.7` para `3`; `Boolean("false")`
//   vira `true`. Aqui, fora do formato exato — inteiro de verdade,
//   booleano de verdade — é erro 400, nunca valor corrigido.

export const ERRO_SEM_GRADE =
  'A grade de permissões desta conta ainda não foi configurada.';

export const ERRO_GRADE_MUDOU =
  'A grade mudou desde que esta tela carregou. Recarregue antes de salvar.';

export const ACOES = Object.freeze([
  'pausar_campanha_trafego',
  'pausar_anuncio',
  'pausar_conjunto',
  'realocar_verba',
  'reduzir_orcamento',
  'aumentar_orcamento',
]);

export const ESTADOS = Object.freeze(['desligado', 'propor', 'executar']);

// Quem de fato lê a grade hoje: o monitor de tráfego (8h50) e o de anúncios
// (8h55), na VPS. As outras quatro ações vivem numa esteira que continua
// desligada. Os três estados têm destino: `propor` vira proposta na aba
// Propostas (issue 309/310). A aba mostra essas listas como legenda para que
// ninguém saia da tela achando que autorizou algo que não acontece. Vive
// aqui, e não na aba, pelo mesmo motivo de ACOES/ESTADOS: uma fonte da
// verdade só.
export const ACOES_COM_CONSUMIDOR = Object.freeze(['pausar_campanha_trafego', 'pausar_anuncio']);
export const ESTADOS_COM_CONSUMIDOR = Object.freeze(['desligado', 'propor', 'executar']);

// Ações em que `executar` ainda só propõe: o monitor de anúncios não pausa
// sozinho até a régua nova de anúncio (issue 314) — sem piso de entrega, um
// anúncio com 1 lead seria pausado por ruído. A faixa da aba lista estas em
// "Propõe", nunca em "Executa sozinho".
export const EXECUTAR_AINDA_PROPOE = Object.freeze(['pausar_anuncio']);

// O contrato que o GET devolve à aba. A aba desenha a grade a partir DISTO,
// nunca de uma cópia própria: uma sétima ação no backend passa a aparecer na
// tela sozinha, em vez de a tela mandar seis e o POST recusar tudo — travando
// a única tela de controle do agente.
export const CONTRATO_GRADE = Object.freeze({
  acoes: ACOES,
  estados: ESTADOS,
  acoes_com_consumidor: ACOES_COM_CONSUMIDOR,
  estados_com_consumidor: ESTADOS_COM_CONSUMIDOR,
  executar_ainda_propoe: EXECUTAR_AINDA_PROPOE,
});

function ehObjetoSimples(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// `null` é "sem dado" (não muda o valor no banco); qualquer outra coisa
// tem que ser um inteiro >= 0. Zero é um valor válido e diferente de nulo
// (ex.: teto zerado = "sem verba para aumentar").
function validarInteiroOuNulo(valor, nome, erros) {
  if (valor === undefined || valor === null) return null;
  if (typeof valor !== 'number' || !Number.isInteger(valor) || valor < 0) {
    erros.push(`${nome} deve ser nulo ou um número inteiro maior ou igual a zero.`);
    return null;
  }
  return valor;
}

export function validarConfig(corpo) {
  const erros = [];

  if (!ehObjetoSimples(corpo)) {
    return { ok: false, erros: ['Corpo inválido: esperado um objeto.'] };
  }

  const permissoes = corpo.permissoes;
  if (permissoes === undefined) {
    erros.push('Campo "permissoes" é obrigatório: envie a grade completa com as seis ações.');
  } else if (!ehObjetoSimples(permissoes)) {
    erros.push('Campo "permissoes" deve ser um objeto com as seis ações.');
  } else {
    for (const acao of Object.keys(permissoes)) {
      if (!ACOES.includes(acao)) erros.push(`Ação desconhecida: ${acao}`);
    }
    const faltando = ACOES.filter((acao) => !(acao in permissoes));
    if (faltando.length) {
      erros.push(`Ação(ões) ausente(s) na grade: ${faltando.join(', ')}`);
    }
    for (const acao of ACOES) {
      if (acao in permissoes && !ESTADOS.includes(permissoes[acao])) {
        erros.push(`Estado inválido para ${acao}: ${JSON.stringify(permissoes[acao])}`);
      }
    }
  }

  const teto = validarInteiroOuNulo(corpo.teto_mensal_meta_centavos, 'teto_mensal_meta_centavos', erros);
  const limite = validarInteiroOuNulo(corpo.limite_por_acao_centavos, 'limite_por_acao_centavos', erros);

  let maxPausas = 3;
  if (corpo.max_pausas_por_rodada !== undefined) {
    const v = corpo.max_pausas_por_rodada;
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) {
      erros.push('max_pausas_por_rodada deve ser um número inteiro maior ou igual a zero.');
    } else {
      maxPausas = v;
    }
  }

  // Carimbo da versão que a tela leu (controle de concorrência otimista).
  // `null`/ausente = a tela não informou versão e o endpoint grava sem
  // comparar — é o contrato de "sem dado" do resto do arquivo. Quando vem,
  // tem que ser um carimbo legível; texto qualquer viraria comparação
  // impossível e um 409 eterno, travando a tela.
  let atualizadaEm = null;
  if (corpo.atualizada_em !== undefined && corpo.atualizada_em !== null) {
    const v = corpo.atualizada_em;
    if (typeof v !== 'string' || v.trim() === '' || Number.isNaN(Date.parse(v))) {
      erros.push('atualizada_em deve ser nulo ou o carimbo de data que a tela leu.');
    } else {
      atualizadaEm = v;
    }
  }

  let paradaGeral = false;
  if (corpo.parada_geral !== undefined) {
    if (typeof corpo.parada_geral !== 'boolean') {
      erros.push('parada_geral deve ser um booleano (true ou false).');
    } else {
      paradaGeral = corpo.parada_geral;
    }
  }

  if (erros.length) return { ok: false, erros };

  return {
    ok: true,
    valores: {
      permissoes,
      teto_mensal_meta_centavos: teto,
      limite_por_acao_centavos: limite,
      max_pausas_por_rodada: maxPausas,
      parada_geral: paradaGeral,
      atualizada_em: atualizadaEm,
    },
  };
}
