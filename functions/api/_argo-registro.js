// Formatação do registro do Argo para a aba (spec 2026-09-20).
//
// A aba NÃO decide nada: agrupamento, cabeçalho e sinalização de falha saem
// prontos daqui. Convenções do contrato, iguais às de _cpl-calculo.js:
// `null` = sem dado, nunca 0 inventado.
//
// Contrato de quem chama: `rodadas` chega ordenada da mais recente para a
// mais antiga (o endpoint ordena por data decrescente) — este módulo lê
// `rodadas[0]` como a última rodada e não reordena. Reordenar aqui esconderia
// um erro do endpoint em vez de revelá-lo.

// `ERRO_SEM_GRADE` não mora aqui: é mensagem da grade de permissões e vive em
// `_argo-config.js`, junto de quem a usa.

// Fonte única dos campos de `argo.acoes` que este módulo lê e repassa.
// `registro.js` monta o `SELECT` a partir desta lista — assim os dois nunca
// divergem por construção. Um `SELECT` que esqueça `estado_posterior` (como
// já aconteceu) faria toda ação real virar "desfecho desconhecido" em
// silêncio; com a lista compartilhada não há o que divergir para quebrar
// isso de novo. Se este módulo passar a ler outro campo, acrescente-o aqui.
import { ymdBrt } from './_data-brt.js';

export const CAMPOS_ACAO = Object.freeze([
  'id',
  'rodada_id',
  'tipo',
  'alvo_tipo',
  'alvo_id',
  'alvo_nome',
  'motivo',
  'estado_posterior',
  'aplicada',
  'desfeita_em',
  'criada_em',
]);

// Desfecho de uma ação. O agente grava a intenção antes de agir e completa o
// registro depois — `estado_posterior` e `aplicada` se combinam em três
// significados distintos que a aba precisa distinguir sem interpretar nada:
//
// - `estado_posterior` nulo: a intenção foi registrada, mas o desfecho é
//   DESCONHECIDO (o banco caiu entre agir e confirmar). Dizer "não aplicada"
//   aqui seria mentira — a campanha pode ou não ter sido pausada de fato.
// - `estado_posterior` preenchido e `aplicada === true`: pausada com sucesso.
// - `estado_posterior` preenchido e `aplicada === false`: nada foi mudado —
//   ou já estava pausada (status dentro de `estado_posterior` já era
//   PAUSED), ou a pausa não pegou (status ficou diferente de PAUSED).
//
// Regra geral: quando o dado não sustenta a afirmação, o desfecho é
// desconhecido — nunca uma categoria confiante por falta de informação.
// Por isso `aplicada` só conta como sucesso quando `=== true` e só permite
// classificar "nada mudou" quando `=== false` (nulo/ausente é desconhecido,
// não "nada mudou"); e `estado_posterior` só permite distinguir "já estava
// pausada" de "não pausou" quando ele carrega uma chave `status` utilizável
// (string não vazia) — objeto vazio ou sem `status` também é desconhecido.
//
// `desfeita_em` preenchido vem antes de tudo: a ação foi revertida, e seguir
// dizendo "pausada com sucesso" seria a tela afirmando algo falso sobre
// dinheiro — a campanha está no ar de novo. O desfazer ainda não existe na
// tela, mas a coluna já é lida e repassada; tratá-la só quando o botão
// chegar é contar com alguém lembrar disso depois.
export const DESFECHO_DESCONHECIDO = 'desfecho desconhecido';
export const DESFECHO_DESFEITA = 'desfeita';
export const DESFECHO_PAUSADA_SUCESSO = 'pausada com sucesso';
export const DESFECHO_JA_ESTAVA_PAUSADA = 'já estava pausada';
export const DESFECHO_NAO_PAUSOU = 'não pausou';

// O desfazer (issue 312) é uma ação NOVA, `tipo = desfazer_pausa`, ligada à
// pausa original por `desfaz_acao_id` — a linha da pausa não é reescrita e
// continua dizendo o que aconteceu naquele dia. Mesma regra de dado
// insuficiente = desconhecido, com o status-alvo invertido.
export const TIPO_DESFAZER = 'desfazer_pausa';
export const DESFECHO_REATIVADA = 'reativada com sucesso';
export const DESFECHO_JA_ESTAVA_ATIVA = 'já estava ativa';
export const DESFECHO_NAO_REATIVOU = 'não reativou';

// Ações de orçamento (issue 317 e plano 3) não são pausa: `estado_posterior`
// guarda `daily_budget`, não `status`. Sem este ramo a redução aparecia como
// "pausada com sucesso". O desfazer de orçamento é ação nova também
// (`desfazer_orcamento`), ligada à original.
export const TIPOS_ORCAMENTO = Object.freeze(['reduzir_orcamento', 'aumentar_orcamento', 'realocar_verba']);
export const TIPO_DESFAZER_ORCAMENTO = 'desfazer_orcamento';
export const DESFECHO_ORCAMENTO_ALTERADO = 'orçamento alterado';
export const DESFECHO_ORCAMENTO_NAO_MUDOU = 'orçamento não mudou';
export const DESFECHO_ORCAMENTO_DEVOLVIDO = 'orçamento devolvido';
export const DESFECHO_ORCAMENTO_NAO_VOLTOU = 'orçamento não voltou';

function desfechoDaAcao(acao) {
  if (acao.desfeita_em != null) return DESFECHO_DESFEITA;
  if (acao.estado_posterior == null) return DESFECHO_DESCONHECIDO;
  if (TIPOS_ORCAMENTO.includes(acao.tipo) || acao.tipo === TIPO_DESFAZER_ORCAMENTO) {
    const devolve = acao.tipo === TIPO_DESFAZER_ORCAMENTO;
    if (acao.aplicada === true) return devolve ? DESFECHO_ORCAMENTO_DEVOLVIDO : DESFECHO_ORCAMENTO_ALTERADO;
    if (acao.aplicada === false) return devolve ? DESFECHO_ORCAMENTO_NAO_VOLTOU : DESFECHO_ORCAMENTO_NAO_MUDOU;
    return DESFECHO_DESCONHECIDO;
  }
  const desfazer = acao.tipo === TIPO_DESFAZER;
  if (acao.aplicada === true) return desfazer ? DESFECHO_REATIVADA : DESFECHO_PAUSADA_SUCESSO;
  if (acao.aplicada !== false) return DESFECHO_DESCONHECIDO;
  const status = acao.estado_posterior?.status;
  if (typeof status !== 'string' || status === '') return DESFECHO_DESCONHECIDO;
  if (desfazer) return status === 'ACTIVE' ? DESFECHO_JA_ESTAVA_ATIVA : DESFECHO_NAO_REATIVOU;
  return status === 'PAUSED' ? DESFECHO_JA_ESTAVA_PAUSADA : DESFECHO_NAO_PAUSOU;
}

// ---------------------------------------------------------------------------
// Veredito (issue 329): o que o Argo concluiu, dias depois, sobre cada ação.
// A linha vem de `argo.vereditos` (LEFT JOIN, colunas `v_*`); sem linha, a
// situação é derivada AQUI, com a mesma régua do monitor (`argo_veredito`,
// gestor-ae): a tela recebe rótulo e frase prontos e não interpreta nada.
// ---------------------------------------------------------------------------
export const TIPO_REATIVACAO = 'reativar_anuncio';
export const VEREDITO_ROTULO = Object.freeze({
  acertou: 'Acertou',
  errou: 'Errou',
  inconclusivo: 'Inconclusivo',
  aguardando: 'Aguardando',
  avaliando: 'Aguardando',
  sem_avaliacao: 'Sem avaliação',
});
export const MOTIVO_E_DESFAZER = 'é um desfazer';
export const MOTIVO_DESFEITA = 'desfeita antes da janela';
export const MOTIVO_NAO_APLICADA = 'não aplicada';
export const MOTIVO_DESCONHECIDO = 'desfecho desconhecido';
export const MOTIVO_AINDA_NAO_AVALIADA = 'ainda não avaliada';
export const JANELA_PADRAO_DIAS = 7;

// 'YYYY-MM-DD' + n dias, em calendário (sem fuso: a data já é a de Brasília).
function somarDias(ymd, n) {
  const [ano, mes, dia] = ymd.split('-').map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia + n)).toISOString().slice(0, 10);
}

const semAvaliacao = (motivo, janelaDias) => ({
  situacao: 'sem_avaliacao',
  situacao_rotulo: VEREDITO_ROTULO.sem_avaliacao,
  motivo,
  janela_dias: janelaDias,
  numeros: [],
});

export function classificarVeredito(acao, janelaDias = JANELA_PADRAO_DIAS, hoje = ymdBrt(Date.now() / 1000)) {
  const situacao = acao.v_situacao;
  if (typeof situacao === 'string' && situacao !== '') {
    if (situacao === 'avaliando') {
      return {
        situacao: 'avaliando',
        situacao_rotulo: VEREDITO_ROTULO.avaliando,
        // Só o TIPO do erro chega do monitor; a frase é montada aqui.
        motivo: acao.v_ultimo_erro ? `a última leitura falhou (${acao.v_ultimo_erro}); tenta de novo na próxima rodada` : null,
        janela_dias: acao.v_janela_dias ?? janelaDias,
        numeros: [],
      };
    }
    return {
      situacao,
      situacao_rotulo: VEREDITO_ROTULO[situacao] ?? situacao,
      motivo: acao.v_motivo ?? null,
      avaliada_em: acao.v_avaliada_em ?? null,
      janela_dias: acao.v_janela_dias ?? janelaDias,
      numeros: Array.isArray(acao.v_numeros) ? acao.v_numeros : [],
    };
  }
  const desfazer = acao.tipo === TIPO_DESFAZER || acao.tipo === TIPO_DESFAZER_ORCAMENTO;
  if (desfazer && acao.reativacao !== true) return semAvaliacao(MOTIVO_E_DESFAZER, janelaDias);
  if (acao.desfeita_em != null) return semAvaliacao(MOTIVO_DESFEITA, janelaDias);
  if (acao.aplicada !== true) return semAvaliacao(MOTIVO_NAO_APLICADA, janelaDias);
  if (acao.estado_posterior == null) return semAvaliacao(MOTIVO_DESCONHECIDO, janelaDias);
  const momento = new Date(acao.criada_em).getTime();
  const dia = Number.isFinite(momento) ? ymdBrt(momento / 1000) : null;
  if (!dia || !hoje) return semAvaliacao(MOTIVO_AINDA_NAO_AVALIADA, janelaDias);
  // Janela de dias COMPLETOS: fecha quando `dia + janela` já ficou para trás.
  if (somarDias(dia, janelaDias) >= hoje) {
    return {
      situacao: 'aguardando',
      situacao_rotulo: VEREDITO_ROTULO.aguardando,
      motivo: null,
      avalia_em: somarDias(dia, janelaDias + 1),
      janela_dias: janelaDias,
      numeros: [],
    };
  }
  // Janela fechada e nenhuma linha: o monitor ainda não passou por ela (ou
  // vai marcá-la como prazo vencido). Não se inventa veredito.
  return semAvaliacao(MOTIVO_AINDA_NAO_AVALIADA, janelaDias);
}

export function montarRegistro({ rodadas = [], acoes = [], janelaDias = JANELA_PADRAO_DIAS, hoje } = {}) {
  const hojeBrt = hoje ?? ymdBrt(Date.now() / 1000);
  const porRodada = new Map();
  for (const acao of acoes) {
    if (!porRodada.has(acao.rodada_id)) porRodada.set(acao.rodada_id, []);
    // O desfecho usa o tipo ORIGINAL (um desfazer de reativação continua
    // tendo desfecho de reativação); o `tipo` devolvido é o efetivo, para o
    // filtro e o placar da aba baterem com o monitor.
    const desfecho = desfechoDaAcao(acao);
    const veredito = classificarVeredito(acao, janelaDias, hojeBrt);
    const tipoEfetivo = acao.reativacao === true && acao.tipo === TIPO_DESFAZER ? TIPO_REATIVACAO : acao.tipo;
    const {
      v_situacao, v_motivo, v_numeros, v_janela_dias, v_avaliada_em, v_origem, v_ultimo_erro, reativacao, ...resto
    } = acao;
    porRodada.get(acao.rodada_id).push({
      ...resto,
      tipo: tipoEfetivo,
      tipo_original: acao.tipo,
      desfecho,
      origem: v_origem || 'argo',
      feita_por: null,
      veredito,
    });
  }

  const lista = rodadas.map((r) => ({
    id: r.id,
    executor: r.executor,
    iniciada_em: r.iniciada_em,
    ok: r.ok,
    // A mesma regra do cabeçalho, agora por rodada: `ok` nulo é rodada que
    // abriu e não fechou — falha, não sucesso. Antes a aba derivava isto de
    // `r.ok === true` por conta própria, e a regra existia em dois lugares.
    falhou: r.ok !== true,
    conclusao: r.conclusao ?? null,
    acoes: porRodada.get(r.id) ?? [],
  }));

  const ultima = lista[0] ?? null;

  return {
    rodadas: lista,
    cabecalho: {
      ultima_rodada_em: ultima ? ultima.iniciada_em : null,
      // `ok` nulo é rodada que abriu e não fechou: falha, não sucesso.
      ultima_falhou: ultima ? ultima.falhou : false,
      // `lista` não carrega `leitura`, então a origem sai da linha crua.
      origem_permissao: rodadas[0]?.leitura?.origem_permissao ?? null,
    },
  };
}
