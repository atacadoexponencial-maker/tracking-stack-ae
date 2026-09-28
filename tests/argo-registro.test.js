import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  montarRegistro,
  DESFECHO_DESCONHECIDO,
  DESFECHO_PAUSADA_SUCESSO,
  DESFECHO_JA_ESTAVA_PAUSADA,
  DESFECHO_NAO_PAUSOU,
  DESFECHO_DESFEITA,
  CAMPOS_ACAO,
} from '../functions/api/_argo-registro.js';

function cenario(extra = {}) {
  return {
    rodadas: [
      { id: 2, executor: 'ae_trafego_monitor', iniciada_em: '2026-09-19T11:50:00Z', ok: true, conclusao: 'Nenhum candidato a pausa pelos critérios combinados.', leitura: { origem_permissao: 'neon' } },
      { id: 1, executor: 'ae_trafego_monitor', iniciada_em: '2026-09-18T11:50:00Z', ok: true, conclusao: 'Pausas aplicadas automaticamente', leitura: { origem_permissao: 'neon' } },
    ],
    acoes: [
      { id: 10, rodada_id: 1, tipo: 'pausar_campanha_trafego', alvo_nome: 'Post do Instagram: Atacado faz ou não faz na...', motivo: 'gasto 7d R$ 107,27 e CPV R$ 0,32 acima da referência R$ 0,30', estado_posterior: { status: 'PAUSED' }, aplicada: true, desfeita_em: null },
    ],
    ...extra,
  };
}

test('cada rodada recebe as ações dela', () => {
  const r = montarRegistro(cenario());
  assert.equal(r.rodadas.length, 2);
  assert.equal(r.rodadas[0].id, 2);
  assert.equal(r.rodadas[0].acoes.length, 0);
  assert.equal(r.rodadas[1].acoes.length, 1);
  assert.equal(r.rodadas[1].acoes[0].alvo_nome.startsWith('Post do Instagram'), true);
});

test('cabecalho mostra a ultima rodada e a origem da permissao', () => {
  const r = montarRegistro(cenario());
  assert.equal(r.cabecalho.ultima_rodada_em, '2026-09-19T11:50:00Z');
  assert.equal(r.cabecalho.origem_permissao, 'neon');
  assert.equal(r.cabecalho.ultima_falhou, false);
});

test('rodada aberta sem ok conta como falha', () => {
  const dados = cenario();
  dados.rodadas[0].ok = null;
  const r = montarRegistro(dados);
  assert.equal(r.cabecalho.ultima_falhou, true);
});

test('sem rodada nenhuma o cabecalho nao inventa data', () => {
  const r = montarRegistro({ rodadas: [], acoes: [] });
  assert.equal(r.cabecalho.ultima_rodada_em, null);
  assert.equal(r.rodadas.length, 0);
});

test('permissao vinda do markdown e sinalizada', () => {
  const dados = cenario();
  dados.rodadas[0].leitura = { origem_permissao: 'markdown' };
  const r = montarRegistro(dados);
  assert.equal(r.cabecalho.origem_permissao, 'markdown');
});

// `falhou` por rodada sai pronto daqui: antes a aba derivava "(nao concluiu)"
// de `r.ok === true` por conta propria, e a mesma regra vivia em dois lugares.
test('cada rodada carrega falhou, com a mesma regra do cabecalho', () => {
  const dados = cenario();
  dados.rodadas[0].ok = null;
  dados.rodadas[1].ok = false;
  const r = montarRegistro(dados);
  assert.equal(r.rodadas[0].falhou, true);
  assert.equal(r.rodadas[1].falhou, true);
  assert.equal(r.cabecalho.ultima_falhou, true);
  const ok = montarRegistro(cenario());
  assert.equal(ok.rodadas[0].falhou, false);
  assert.equal(ok.cabecalho.ultima_falhou, false);
});

// Acao desfeita nao pode continuar escrita "pausada com sucesso": a campanha
// esta no ar de novo, e a tela estaria afirmando algo falso sobre dinheiro.
// `desfeita_em` vem antes de qualquer outra leitura do desfecho.
test('desfecho: desfeita_em preenchido vence "pausada com sucesso"', () => {
  const dados = cenario({
    acoes: [
      { id: 20, rodada_id: 1, tipo: 'pausar_campanha_trafego', alvo_nome: 'Campanha E', motivo: 'motivo', estado_posterior: { status: 'PAUSED' }, aplicada: true, desfeita_em: '2026-09-19T14:00:00Z' },
    ],
  });
  assert.equal(montarRegistro(dados).rodadas[1].acoes[0].desfecho, DESFECHO_DESFEITA);
});

test('desfecho: desfeita_em vence tambem os outros desfechos, inclusive o desconhecido', () => {
  const casos = [
    { estado_posterior: null, aplicada: false },
    { estado_posterior: { status: 'ACTIVE' }, aplicada: false },
    { estado_posterior: { status: 'PAUSED' }, aplicada: false },
    { estado_posterior: { status: 'PAUSED' }, aplicada: null },
  ];
  for (const caso of casos) {
    const dados = cenario({
      acoes: [{ id: 21, rodada_id: 1, tipo: 'pausar_campanha_trafego', alvo_nome: 'Campanha F', motivo: 'motivo', desfeita_em: '2026-09-19T14:00:00Z', ...caso }],
    });
    assert.equal(montarRegistro(dados).rodadas[1].acoes[0].desfecho, DESFECHO_DESFEITA, JSON.stringify(caso));
  }
});

test('desfecho: desfeita_em nulo ou ausente nao muda nada', () => {
  const comNulo = cenario();
  assert.equal(montarRegistro(comNulo).rodadas[1].acoes[0].desfecho, DESFECHO_PAUSADA_SUCESSO);
  const semCampo = cenario({
    acoes: [{ id: 22, rodada_id: 1, tipo: 'pausar_campanha_trafego', alvo_nome: 'Campanha G', motivo: 'motivo', estado_posterior: { status: 'PAUSED' }, aplicada: true }],
  });
  assert.equal(montarRegistro(semCampo).rodadas[1].acoes[0].desfecho, DESFECHO_PAUSADA_SUCESSO);
});

// Desfecho da ação: `estado_posterior` nulo é intenção registrada com
// desfecho desconhecido (o banco caiu entre agir e confirmar) — nunca deve
// ser lido como "não aplicada", que seria mentira.
test('desfecho: estado_posterior nulo vira desconhecido, nunca "não aplicada"', () => {
  const dados = cenario({
    acoes: [
      { id: 11, rodada_id: 1, tipo: 'pausar_campanha_trafego', alvo_nome: 'Campanha X', motivo: 'motivo', estado_posterior: null, aplicada: false, desfeita_em: null },
    ],
  });
  const r = montarRegistro(dados);
  assert.equal(r.rodadas[1].acoes[0].desfecho, DESFECHO_DESCONHECIDO);
});

test('desfecho: estado_posterior preenchido e aplicada true vira pausada com sucesso', () => {
  const dados = cenario({
    acoes: [
      { id: 12, rodada_id: 1, tipo: 'pausar_campanha_trafego', alvo_nome: 'Campanha Y', motivo: 'motivo', estado_posterior: { status: 'PAUSED' }, aplicada: true, desfeita_em: null },
    ],
  });
  const r = montarRegistro(dados);
  assert.equal(r.rodadas[1].acoes[0].desfecho, DESFECHO_PAUSADA_SUCESSO);
});

test('desfecho: aplicada false com status PAUSED em estado_posterior vira já estava pausada', () => {
  const dados = cenario({
    acoes: [
      { id: 13, rodada_id: 1, tipo: 'pausar_campanha_trafego', alvo_nome: 'Campanha Z', motivo: 'motivo', estado_posterior: { status: 'PAUSED' }, aplicada: false, desfeita_em: null },
    ],
  });
  const r = montarRegistro(dados);
  assert.equal(r.rodadas[1].acoes[0].desfecho, DESFECHO_JA_ESTAVA_PAUSADA);
});

test('desfecho: aplicada false com status diferente de PAUSED vira não pausou', () => {
  const dados = cenario({
    acoes: [
      { id: 14, rodada_id: 1, tipo: 'pausar_campanha_trafego', alvo_nome: 'Campanha W', motivo: 'motivo', estado_posterior: { status: 'ACTIVE' }, aplicada: false, desfeita_em: null },
    ],
  });
  const r = montarRegistro(dados);
  assert.equal(r.rodadas[1].acoes[0].desfecho, DESFECHO_NAO_PAUSOU);
});

// Dado incompleto nunca vira categoria confiante: `aplicada` só é lido como
// sucesso quando === true e como "nada mudou" quando === false. Qualquer
// outro valor (null, ausente) é desfecho desconhecido — mesma regra do
// `estado_posterior` nulo.
test('desfecho: aplicada nula (mesmo com estado_posterior preenchido) vira desconhecido', () => {
  const dados = cenario({
    acoes: [
      { id: 15, rodada_id: 1, tipo: 'pausar_campanha_trafego', alvo_nome: 'Campanha A', motivo: 'motivo', estado_posterior: { status: 'PAUSED' }, aplicada: null, desfeita_em: null },
    ],
  });
  const r = montarRegistro(dados);
  assert.equal(r.rodadas[1].acoes[0].desfecho, DESFECHO_DESCONHECIDO);
});

test('desfecho: aplicada ausente vira desconhecido', () => {
  const dados = cenario({
    acoes: [
      { id: 16, rodada_id: 1, tipo: 'pausar_campanha_trafego', alvo_nome: 'Campanha B', motivo: 'motivo', estado_posterior: { status: 'PAUSED' }, desfeita_em: null },
    ],
  });
  const r = montarRegistro(dados);
  assert.equal(r.rodadas[1].acoes[0].desfecho, DESFECHO_DESCONHECIDO);
});

test('desfecho: estado_posterior sem chave status vira desconhecido, mesmo com aplicada false', () => {
  const dados = cenario({
    acoes: [
      { id: 17, rodada_id: 1, tipo: 'pausar_campanha_trafego', alvo_nome: 'Campanha C', motivo: 'motivo', estado_posterior: {}, aplicada: false, desfeita_em: null },
    ],
  });
  const r = montarRegistro(dados);
  assert.equal(r.rodadas[1].acoes[0].desfecho, DESFECHO_DESCONHECIDO);
});

test('desfecho: estado_posterior sem status utilizavel (undefined explicito) vira desconhecido', () => {
  const dados = cenario({
    acoes: [
      { id: 18, rodada_id: 1, tipo: 'pausar_campanha_trafego', alvo_nome: 'Campanha D', motivo: 'motivo', estado_posterior: { status: undefined }, aplicada: false, desfeita_em: null },
    ],
  });
  const r = montarRegistro(dados);
  assert.equal(r.rodadas[1].acoes[0].desfecho, DESFECHO_DESCONHECIDO);
});

// Guarda contra a classe de defeito de 2026-09-20: o SELECT de
// functions/api/argo/registro.js é MONTADO a partir de CAMPOS_ACAO (não
// mais uma lista solta e independente), então os dois não têm como
// divergir. O risco que sobra é este módulo mudar CAMPOS_ACAO sem querer
// — tanto removendo um campo que `desfechoDaAcao` precisa (estado_posterior,
// aplicada, rodada_id) quanto um campo que só é repassado à aba via
// `{...acao}` (alvo_nome, motivo, tipo, alvo_tipo, alvo_id, desfeita_em,
// criada_em, id), que sumiria da API em silêncio do mesmo jeito. Por isso a
// comparação é com a lista INTEIRA esperada, escrita aqui de propósito:
// tirar ou acrescentar qualquer campo sem atualizar este teste quebra a
// suíte — o lembrete certo para uma mudança que é, às vezes, intencional.
// Já pegou uma vez: `estado_posterior` ficou fora do SELECT porque não
// existia lista compartilhada; com CAMPOS_ACAO, removê-lo daqui quebra
// este teste imediatamente, em vez de silenciosamente virar "desfecho
// desconhecido" em produção.
test('CAMPOS_ACAO é exatamente a lista esperada, para o SELECT do endpoint nunca divergir nem perder campo em silêncio', () => {
  assert.deepEqual(CAMPOS_ACAO, [
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
});

// Issue 312: o desfazer é ação nova e tem desfechos próprios; a pausa
// original continua dizendo "pausada com sucesso".
test('desfazer tem desfecho de reativação e não reescreve a pausa original', async () => {
  const { TIPO_DESFAZER, DESFECHO_REATIVADA, DESFECHO_JA_ESTAVA_ATIVA, DESFECHO_NAO_REATIVOU } =
    await import('../functions/api/_argo-registro.js');
  const r = montarRegistro({
    rodadas: [{ id: 1, executor: 'argo_executor', iniciada_em: '2026-09-24T12:00:00Z', ok: true }],
    acoes: [
      { id: 1, rodada_id: 1, tipo: 'pausar_campanha_trafego', estado_posterior: { status: 'PAUSED' }, aplicada: true, desfeita_em: null },
      { id: 2, rodada_id: 1, tipo: TIPO_DESFAZER, estado_posterior: { status: 'ACTIVE' }, aplicada: true, desfeita_em: null },
      { id: 3, rodada_id: 1, tipo: TIPO_DESFAZER, estado_posterior: { status: 'ACTIVE' }, aplicada: false, desfeita_em: null },
      { id: 4, rodada_id: 1, tipo: TIPO_DESFAZER, estado_posterior: { status: 'PAUSED' }, aplicada: false, desfeita_em: null },
      { id: 5, rodada_id: 1, tipo: TIPO_DESFAZER, estado_posterior: null, aplicada: false, desfeita_em: null },
    ],
  });
  assert.deepEqual(r.rodadas[0].acoes.map((a) => a.desfecho), [
    DESFECHO_PAUSADA_SUCESSO, DESFECHO_REATIVADA, DESFECHO_JA_ESTAVA_ATIVA, DESFECHO_NAO_REATIVOU, DESFECHO_DESCONHECIDO,
  ]);
});

// Plano 3 — ação de orçamento não é pausa.
test('ação de orçamento tem desfecho de orçamento, não de pausa', () => {
  const acao = (tipo, aplicada) => ({ id: 1, rodada_id: 2, tipo, estado_posterior: { daily_budget: 2400 }, aplicada, desfeita_em: null });
  const r = montarRegistro(cenario({ acoes: [
    acao('reduzir_orcamento', true), acao('aumentar_orcamento', false), acao('realocar_verba', true),
    acao('desfazer_orcamento', true), acao('desfazer_orcamento', false),
    { ...acao('aumentar_orcamento', null) },
  ] }));
  assert.deepEqual(r.rodadas[0].acoes.map((a) => a.desfecho), [
    'orçamento alterado', 'orçamento não mudou', 'orçamento alterado',
    'orçamento devolvido', 'orçamento não voltou', DESFECHO_DESCONHECIDO,
  ]);
});

// ---------------------------------------------------------------------------
// Veredito por ação (issue 329).
// ---------------------------------------------------------------------------
test('veredito: linha do banco sai como está, com rótulo pronto', async () => {
  const { classificarVeredito } = await import('../functions/api/_argo-registro.js');
  const base = { tipo: 'pausar_campanha_trafego', aplicada: true, estado_posterior: { status: 'PAUSED' }, criada_em: '2026-09-26T11:52:00Z' };
  const v = classificarVeredito({ ...base, v_situacao: 'acertou', v_motivo: 'ficou em R$ 0,21', v_avaliada_em: '2026-10-04T11:50:00Z',
    v_janela_dias: 7, v_numeros: [{ rotulo: 'Custo por visita', antes: 'R$ 0,74', depois: 'R$ 0,21' }] }, 7, '2026-10-05');
  assert.equal(v.situacao, 'acertou');
  assert.equal(v.situacao_rotulo, 'Acertou');
  assert.equal(v.motivo, 'ficou em R$ 0,21');
  assert.equal(v.numeros[0].depois, 'R$ 0,21');
  assert.equal(classificarVeredito({ ...base, v_situacao: 'errou' }, 7, '2026-10-05').situacao_rotulo, 'Errou');
  assert.equal(classificarVeredito({ ...base, v_situacao: 'inconclusivo' }, 7, '2026-10-05').situacao_rotulo, 'Inconclusivo');
  assert.equal(classificarVeredito({ ...base, v_situacao: 'sem_avaliacao', v_motivo: 'x' }, 7, '2026-10-05').situacao_rotulo, 'Sem avaliação');
});

test('veredito: avaliando vira "Aguardando" e o tipo do erro vira frase', async () => {
  const { classificarVeredito } = await import('../functions/api/_argo-registro.js');
  const v = classificarVeredito({ tipo: 'pausar_anuncio', v_situacao: 'avaliando', v_ultimo_erro: 'ErroDoMeta', v_janela_dias: 7 }, 7, '2026-10-05');
  assert.equal(v.situacao, 'avaliando');
  assert.equal(v.situacao_rotulo, 'Aguardando');
  assert.match(v.motivo, /ErroDoMeta/);
  assert.equal(classificarVeredito({ tipo: 'pausar_anuncio', v_situacao: 'avaliando' }, 7, '2026-10-05').motivo, null);
});

test('veredito: sem linha, a situação é derivada — desfazer, desfeita, não aplicada, desconhecida', async () => {
  const m = await import('../functions/api/_argo-registro.js');
  const ok = { aplicada: true, estado_posterior: { status: 'PAUSED' }, criada_em: '2026-09-20T11:52:00Z', desfeita_em: null };
  const casos = [
    [{ ...ok, tipo: m.TIPO_DESFAZER }, m.MOTIVO_E_DESFAZER],
    [{ ...ok, tipo: m.TIPO_DESFAZER_ORCAMENTO }, m.MOTIVO_E_DESFAZER],
    [{ ...ok, tipo: 'pausar_anuncio', desfeita_em: '2026-09-21T10:00:00Z' }, m.MOTIVO_DESFEITA],
    [{ ...ok, tipo: 'pausar_anuncio', aplicada: false }, m.MOTIVO_NAO_APLICADA],
    [{ ...ok, tipo: 'pausar_anuncio', aplicada: null }, m.MOTIVO_NAO_APLICADA],
    [{ ...ok, tipo: 'pausar_anuncio', estado_posterior: null }, m.MOTIVO_DESCONHECIDO],
    [{ ...ok, tipo: 'pausar_anuncio' }, m.MOTIVO_AINDA_NAO_AVALIADA], // janela fechou em 27/09, hoje 05/10
  ];
  for (const [acao, motivo] of casos) {
    const v = m.classificarVeredito(acao, 7, '2026-10-05');
    assert.equal(v.situacao, 'sem_avaliacao', motivo);
    assert.equal(v.motivo, motivo);
  }
});

test('veredito: dentro da janela é aguardando, com a data em que avalia', async () => {
  const { classificarVeredito } = await import('../functions/api/_argo-registro.js');
  const acao = { tipo: 'pausar_campanha_trafego', aplicada: true, estado_posterior: { status: 'PAUSED' },
    criada_em: '2026-09-26T11:52:00Z', desfeita_em: null };
  // 26/09 + 7 = 03/10: em 03/10 a janela ainda não fechou; avalia em 04/10.
  const v = classificarVeredito(acao, 7, '2026-10-03');
  assert.equal(v.situacao, 'aguardando');
  assert.equal(v.situacao_rotulo, 'Aguardando');
  assert.equal(v.avalia_em, '2026-10-04');
  assert.equal(v.janela_dias, 7);
  // Em 04/10 a janela fechou: sem linha ainda, "ainda não avaliada".
  assert.equal(classificarVeredito(acao, 7, '2026-10-04').situacao, 'sem_avaliacao');
  // A data da ação é a de Brasília: 26/09 23:30 UTC ainda é 26/09 em BRT.
  assert.equal(classificarVeredito({ ...acao, criada_em: '2026-09-26T23:30:00Z' }, 7, '2026-10-03').avalia_em, '2026-10-04');
  // Janela maior empurra a data.
  assert.equal(classificarVeredito(acao, 10, '2026-10-03').avalia_em, '2026-10-07');
});

test('montarRegistro: cada ação carrega veredito, origem, feita_por e o tipo efetivo da reativação', async () => {
  const m = await import('../functions/api/_argo-registro.js');
  const r = m.montarRegistro({
    rodadas: [{ id: 1, executor: 'ae_anuncios_monitor', iniciada_em: '2026-09-24T12:00:00Z', ok: true }],
    acoes: [
      { id: 1, rodada_id: 1, tipo: 'pausar_anuncio', estado_posterior: { status: 'PAUSED' }, aplicada: true, desfeita_em: null,
        criada_em: '2026-09-24T12:00:00Z', v_situacao: 'errou', v_motivo: 'piorou', v_numeros: [], v_origem: 'argo', reativacao: false },
      { id: 2, rodada_id: 1, tipo: m.TIPO_DESFAZER, estado_posterior: { status: 'ACTIVE' }, aplicada: true, desfeita_em: null,
        criada_em: '2026-09-24T12:05:00Z', reativacao: true },
      { id: 3, rodada_id: 1, tipo: m.TIPO_DESFAZER, estado_posterior: { status: 'ACTIVE' }, aplicada: true, desfeita_em: null,
        criada_em: '2026-09-24T12:06:00Z', reativacao: false },
    ],
    janelaDias: 7,
    hoje: '2026-09-26',
  });
  const [a, reativacao, desfazer] = r.rodadas[0].acoes;
  assert.equal(a.veredito.situacao, 'errou');
  assert.equal(a.origem, 'argo');
  assert.equal(a.feita_por, null);
  assert.equal(a.tipo, 'pausar_anuncio');
  // Reativação: tipo efetivo para a aba, desfecho ainda de reativação.
  assert.equal(reativacao.tipo, m.TIPO_REATIVACAO);
  assert.equal(reativacao.tipo_original, m.TIPO_DESFAZER);
  assert.equal(reativacao.desfecho, m.DESFECHO_REATIVADA);
  assert.equal(reativacao.veredito.situacao, 'aguardando');
  // Desfazer da gestora: continua desfazer e não ganha veredito.
  assert.equal(desfazer.tipo, m.TIPO_DESFAZER);
  assert.equal(desfazer.veredito.motivo, m.MOTIVO_E_DESFAZER);
  // As colunas cruas do JOIN não vazam para a resposta.
  assert.equal('v_situacao' in a, false);
  assert.equal('reativacao' in a, false);
});

test('montarRegistro: sem janela nem hoje, usa o padrão e a data de Brasília de agora', async () => {
  const m = await import('../functions/api/_argo-registro.js');
  const r = m.montarRegistro({
    rodadas: [{ id: 1, executor: 'x', iniciada_em: new Date().toISOString(), ok: true }],
    acoes: [{ id: 1, rodada_id: 1, tipo: 'pausar_anuncio', estado_posterior: { status: 'PAUSED' }, aplicada: true,
      desfeita_em: null, criada_em: new Date().toISOString() }],
  });
  const v = r.rodadas[0].acoes[0].veredito;
  assert.equal(v.situacao, 'aguardando');
  assert.equal(v.janela_dias, m.JANELA_PADRAO_DIAS);
});
