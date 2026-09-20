import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  montarRegistro,
  ERRO_SEM_GRADE,
  DESFECHO_DESCONHECIDO,
  DESFECHO_PAUSADA_SUCESSO,
  DESFECHO_JA_ESTAVA_PAUSADA,
  DESFECHO_NAO_PAUSOU,
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

test('constante de erro existe e e texto', () => {
  assert.equal(typeof ERRO_SEM_GRADE, 'string');
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
