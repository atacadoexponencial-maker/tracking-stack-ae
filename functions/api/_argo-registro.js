// Formatação do registro do Argo para a aba (spec 2026-09-20).
//
// A aba NÃO decide nada: agrupamento, cabeçalho e sinalização de falha saem
// prontos daqui. Convenções do contrato, iguais às de _cpl-calculo.js:
// `null` = sem dado, nunca 0 inventado.

export const ERRO_SEM_GRADE =
  'A grade de permissões desta conta ainda não foi configurada.';

// Desfecho de uma ação. O agente grava a intenção antes de agir e completa o
// registro depois — `estado_posterior` e `aplicada` se combinam em três
// significados distintos que a aba precisa distinguir sem interpretar nada:
//
// - `estado_posterior` nulo: a intenção foi registrada, mas o desfecho é
//   DESCONHECIDO (o banco caiu entre agir e confirmar). Dizer "não aplicada"
//   aqui seria mentira — a campanha pode ou não ter sido pausada de fato.
// - `estado_posterior` preenchido e `aplicada` verdadeiro: pausada com
//   sucesso.
// - `estado_posterior` preenchido e `aplicada` falso: nada foi mudado — ou já
//   estava pausada (status dentro de `estado_posterior` já era PAUSED), ou a
//   pausa não pegou (status ficou diferente de PAUSED).
export const DESFECHO_DESCONHECIDO = 'desfecho desconhecido — banco caiu entre agir e confirmar';
export const DESFECHO_PAUSADA_SUCESSO = 'pausada com sucesso';
export const DESFECHO_JA_ESTAVA_PAUSADA = 'já estava pausada';
export const DESFECHO_NAO_PAUSOU = 'não pausou';

function desfechoDaAcao(acao) {
  if (acao.estado_posterior == null) return DESFECHO_DESCONHECIDO;
  if (acao.aplicada) return DESFECHO_PAUSADA_SUCESSO;
  const status = acao.estado_posterior?.status;
  return status === 'PAUSED' ? DESFECHO_JA_ESTAVA_PAUSADA : DESFECHO_NAO_PAUSOU;
}

export function montarRegistro({ rodadas = [], acoes = [] } = {}) {
  const porRodada = new Map();
  for (const acao of acoes) {
    if (!porRodada.has(acao.rodada_id)) porRodada.set(acao.rodada_id, []);
    porRodada.get(acao.rodada_id).push({ ...acao, desfecho: desfechoDaAcao(acao) });
  }

  const lista = rodadas.map((r) => ({
    id: r.id,
    executor: r.executor,
    iniciada_em: r.iniciada_em,
    ok: r.ok,
    conclusao: r.conclusao ?? null,
    acoes: porRodada.get(r.id) ?? [],
  }));

  const ultima = lista[0] ?? null;

  return {
    rodadas: lista,
    cabecalho: {
      ultima_rodada_em: ultima ? ultima.iniciada_em : null,
      // `ok` nulo é rodada que abriu e não fechou: falha, não sucesso.
      ultima_falhou: ultima ? ultima.ok !== true : false,
      // `lista` não carrega `leitura`, então a origem sai da linha crua.
      origem_permissao: rodadas[0]?.leitura?.origem_permissao ?? null,
    },
  };
}
