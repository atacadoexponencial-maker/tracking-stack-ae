import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validarConfig,
  ACOES,
  ESTADOS,
  ACOES_COM_CONSUMIDOR,
  ESTADOS_COM_CONSUMIDOR,
  CONTRATO_GRADE,
  ERRO_SEM_GRADE,
  ERRO_GRADE_MUDOU,
} from '../functions/api/_argo-config.js';

function grade(overrides = {}) {
  return {
    pausar_anuncio: 'desligado',
    realocar_verba: 'desligado',
    pausar_conjunto: 'desligado',
    reduzir_orcamento: 'desligado',
    aumentar_orcamento: 'desligado',
    pausar_campanha_trafego: 'executar',
    ...overrides,
  };
}

test('grade completa e válida é aceita e normalizada', () => {
  const r = validarConfig({
    permissoes: grade(),
    teto_mensal_meta_centavos: 1000000,
    limite_por_acao_centavos: 5000,
    max_pausas_por_rodada: 3,
    parada_geral: false,
  });
  assert.equal(r.ok, true);
  assert.deepEqual(r.valores.permissoes, grade());
  assert.equal(r.valores.teto_mensal_meta_centavos, 1000000);
  assert.equal(r.valores.limite_por_acao_centavos, 5000);
  assert.equal(r.valores.max_pausas_por_rodada, 3);
  assert.equal(r.valores.parada_geral, false);
});

test('grade mínima (só permissoes) usa os defaults documentados', () => {
  const r = validarConfig({ permissoes: grade() });
  assert.equal(r.ok, true);
  assert.equal(r.valores.teto_mensal_meta_centavos, null);
  assert.equal(r.valores.limite_por_acao_centavos, null);
  assert.equal(r.valores.max_pausas_por_rodada, 3);
  assert.equal(r.valores.parada_geral, false);
});

// Crítico 1: permissoes ausente não pode virar {} e apagar a grade em produção.
test('permissoes ausente é recusado, não vira grade vazia', () => {
  const r = validarConfig({ parada_geral: false });
  assert.equal(r.ok, false);
  assert.ok(r.erros.some((e) => /permissoes/.test(e)));
});

test('permissoes nulo é recusado', () => {
  const r = validarConfig({ permissoes: null });
  assert.equal(r.ok, false);
  assert.ok(r.erros.some((e) => /permissoes/.test(e)));
});

test('permissoes vazio ({}) é recusado nomeando as seis ações ausentes', () => {
  const r = validarConfig({ permissoes: {} });
  assert.equal(r.ok, false);
  const erro = r.erros.find((e) => /ausente/.test(e));
  assert.ok(erro);
  for (const acao of ACOES) assert.ok(erro.includes(acao));
});

test('permissoes como array é recusado', () => {
  const r = validarConfig({ permissoes: [] });
  assert.equal(r.ok, false);
  assert.ok(r.erros.some((e) => /permissoes/.test(e)));
});

test('permissoes como string é recusado', () => {
  const r = validarConfig({ permissoes: 'executar tudo' });
  assert.equal(r.ok, false);
  assert.ok(r.erros.some((e) => /permissoes/.test(e)));
});

test('ação desconhecida é recusada nomeando a ação', () => {
  const r = validarConfig({ permissoes: grade({ acao_inexistente: 'executar' }) });
  assert.equal(r.ok, false);
  assert.ok(r.erros.some((e) => e.includes('acao_inexistente')));
});

test('estado inválido é recusado nomeando a ação e o valor', () => {
  const r = validarConfig({ permissoes: grade({ pausar_anuncio: 'turbo' }) });
  assert.equal(r.ok, false);
  assert.ok(r.erros.some((e) => e.includes('pausar_anuncio')));
});

test('falta de uma das seis ações é recusada nomeando qual falta', () => {
  const { pausar_campanha_trafego, ...semEssaAcao } = grade();
  const r = validarConfig({ permissoes: semEssaAcao });
  assert.equal(r.ok, false);
  assert.ok(r.erros.some((e) => e.includes('pausar_campanha_trafego')));
});

// Crítico 2 e Importante 3: campos numéricos e booleano sem coerção silenciosa.
test('teto negativo é recusado', () => {
  const r = validarConfig({ permissoes: grade(), teto_mensal_meta_centavos: -500 });
  assert.equal(r.ok, false);
  assert.ok(r.erros.some((e) => /teto_mensal_meta_centavos/.test(e)));
});

test('teto zero é válido (diferente de ausente)', () => {
  const r = validarConfig({ permissoes: grade(), teto_mensal_meta_centavos: 0 });
  assert.equal(r.ok, true);
  assert.equal(r.valores.teto_mensal_meta_centavos, 0);
});

test('teto fracionário é recusado', () => {
  const r = validarConfig({ permissoes: grade(), teto_mensal_meta_centavos: 10.5 });
  assert.equal(r.ok, false);
  assert.ok(r.erros.some((e) => /teto_mensal_meta_centavos/.test(e)));
});

test('teto como texto é recusado', () => {
  const r = validarConfig({ permissoes: grade(), teto_mensal_meta_centavos: '1000000' });
  assert.equal(r.ok, false);
  assert.ok(r.erros.some((e) => /teto_mensal_meta_centavos/.test(e)));
});

test('teto nulo é válido (sem dado, não é apagado)', () => {
  const r = validarConfig({ permissoes: grade(), teto_mensal_meta_centavos: null });
  assert.equal(r.ok, true);
  assert.equal(r.valores.teto_mensal_meta_centavos, null);
});

test('limite_por_acao_centavos segue a mesma regra do teto', () => {
  assert.equal(validarConfig({ permissoes: grade(), limite_por_acao_centavos: -1 }).ok, false);
  assert.equal(validarConfig({ permissoes: grade(), limite_por_acao_centavos: 0 }).ok, true);
});

test('max_pausas_por_rodada fracionário é recusado, não truncado', () => {
  const r = validarConfig({ permissoes: grade(), max_pausas_por_rodada: 3.7 });
  assert.equal(r.ok, false);
  assert.ok(r.erros.some((e) => /max_pausas_por_rodada/.test(e)));
});

test('max_pausas_por_rodada negativo é recusado', () => {
  const r = validarConfig({ permissoes: grade(), max_pausas_por_rodada: -1 });
  assert.equal(r.ok, false);
  assert.ok(r.erros.some((e) => /max_pausas_por_rodada/.test(e)));
});

test('max_pausas_por_rodada como texto é recusado', () => {
  const r = validarConfig({ permissoes: grade(), max_pausas_por_rodada: '3' });
  assert.equal(r.ok, false);
  assert.ok(r.erros.some((e) => /max_pausas_por_rodada/.test(e)));
});

test('max_pausas_por_rodada ausente usa o default 3', () => {
  const r = validarConfig({ permissoes: grade() });
  assert.equal(r.ok, true);
  assert.equal(r.valores.max_pausas_por_rodada, 3);
});

test('parada_geral como string "false" é recusado, não vira true', () => {
  const r = validarConfig({ permissoes: grade(), parada_geral: 'false' });
  assert.equal(r.ok, false);
  assert.ok(r.erros.some((e) => /parada_geral/.test(e)));
});

test('parada_geral como número é recusado', () => {
  const r = validarConfig({ permissoes: grade(), parada_geral: 1 });
  assert.equal(r.ok, false);
  assert.ok(r.erros.some((e) => /parada_geral/.test(e)));
});

test('parada_geral ausente usa o default false', () => {
  const r = validarConfig({ permissoes: grade() });
  assert.equal(r.ok, true);
  assert.equal(r.valores.parada_geral, false);
});

test('corpo que não é objeto (nulo, array, string) é recusado', () => {
  assert.equal(validarConfig(null).ok, false);
  assert.equal(validarConfig([]).ok, false);
  assert.equal(validarConfig('x').ok, false);
});

test('lista todos os erros de uma vez, não só o primeiro', () => {
  const r = validarConfig({ permissoes: {}, teto_mensal_meta_centavos: -1, max_pausas_por_rodada: 'x' });
  assert.equal(r.ok, false);
  assert.ok(r.erros.length >= 3);
});

// --- Contrato devolvido no GET: a aba desenha a grade a partir DISTO ---
// Uma sétima ação no backend precisa aparecer na tela sozinha. Enquanto a aba
// mantinha a própria cópia da lista, ela mandaria seis, o POST recusaria e a
// única tela de controle do agente travaria.
test('o contrato exposto é exatamente ACOES/ESTADOS, sem segunda cópia', () => {
  assert.deepEqual(CONTRATO_GRADE.acoes, ACOES);
  assert.deepEqual(CONTRATO_GRADE.estados, ESTADOS);
  assert.deepEqual(CONTRATO_GRADE.acoes_com_consumidor, ACOES_COM_CONSUMIDOR);
  assert.deepEqual(CONTRATO_GRADE.estados_com_consumidor, ESTADOS_COM_CONSUMIDOR);
});

test('o contrato é congelado: ninguém edita a lista canônica em tempo de execução', () => {
  assert.equal(Object.isFrozen(CONTRATO_GRADE), true);
  assert.equal(Object.isFrozen(ACOES), true);
  assert.equal(Object.isFrozen(ESTADOS), true);
});

// A legenda da aba sai daqui: ação/estado sem consumidor tem que ser um
// subconjunto do que existe, senão a tela legenda uma linha que não desenha.
test('ações e estados com consumidor são subconjuntos do que existe', () => {
  for (const acao of ACOES_COM_CONSUMIDOR) assert.ok(ACOES.includes(acao), acao);
  for (const estado of ESTADOS_COM_CONSUMIDOR) assert.ok(ESTADOS.includes(estado), estado);
  // Hoje as duas pausas têm consumidor (monitores de tráfego e de anúncios),
  // e `propor` vira proposta na aba. Se isto mudar, a legenda da aba muda
  // junto — este teste é o lembrete.
  assert.deepEqual([...ACOES_COM_CONSUMIDOR], ['pausar_campanha_trafego', 'pausar_anuncio']);
  assert.deepEqual([...ESTADOS_COM_CONSUMIDOR], ['desligado', 'propor', 'executar']);
});

// "Pausar anúncio" em Executar ainda só propõe (até a issue 314): a faixa da
// aba não pode dizer que ele executa sozinho.
test('executar-que-ainda-propõe está no contrato e só contém ações com consumidor', () => {
  assert.deepEqual([...CONTRATO_GRADE.executar_ainda_propoe], ['pausar_anuncio']);
  for (const acao of CONTRATO_GRADE.executar_ainda_propoe) assert.ok(ACOES_COM_CONSUMIDOR.includes(acao), acao);
});

test('as mensagens da grade moram aqui, junto de quem as usa', () => {
  assert.equal(typeof ERRO_SEM_GRADE, 'string');
  assert.ok(ERRO_SEM_GRADE.length > 0);
  assert.equal(typeof ERRO_GRADE_MUDOU, 'string');
  assert.ok(/recarregue/i.test(ERRO_GRADE_MUDOU));
});

// --- atualizada_em: controle de concorrência otimista ---
test('atualizada_em válido é repassado tal e qual', () => {
  const r = validarConfig({ permissoes: grade(), atualizada_em: '2026-09-20T11:50:00.123Z' });
  assert.equal(r.ok, true);
  assert.equal(r.valores.atualizada_em, '2026-09-20T11:50:00.123Z');
});

test('atualizada_em ausente ou nulo vira null (grava sem comparar versão)', () => {
  assert.equal(validarConfig({ permissoes: grade() }).valores.atualizada_em, null);
  assert.equal(validarConfig({ permissoes: grade(), atualizada_em: null }).valores.atualizada_em, null);
});

test('atualizada_em ilegível é recusado, nunca ignorado em silêncio', () => {
  for (const v of ['', '   ', 'ontem', 42, {}, true]) {
    const r = validarConfig({ permissoes: grade(), atualizada_em: v });
    assert.equal(r.ok, false, JSON.stringify(v));
    assert.ok(r.erros.some((e) => /atualizada_em/.test(e)), JSON.stringify(v));
  }
});
