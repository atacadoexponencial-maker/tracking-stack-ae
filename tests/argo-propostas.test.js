import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  montarPropostas,
  validarDecisao,
  motivoDaRecusa,
  ERRO_VERSAO_NOVA,
  ERRO_VENCIDA,
  ERRO_NAO_EXISTE,
  MAX_POR_QUE,
} from '../functions/api/_argo-propostas.js';

const TRAFEGO = {
  id: 7, versao: 2, tipo: 'pausar_campanha_trafego', alvo_id: '1202', alvo_nome: 'Post do Instagram: Me mandaram estudar antes de...',
  motivo: 'gasto 7d R$ 32,59 e CPV R$ 0,74 acima do corte',
  detalhe: { gasto_7d: 32.59, cpv: 0.7407, corte_cpv: 0.2517, visitas_7d: 44 },
  criada_em: '2026-09-22T11:50:00Z', atualizada_em: '2026-09-23T11:50:00Z', vence_em: '2026-09-24T13:00:00Z',
};
const ANUNCIO = {
  id: 6, versao: 1, tipo: 'pausar_anuncio', alvo_id: 'ad12', alvo_nome: 'ad12_depoimentos-jaque-322_vd',
  motivo: 'gastou R$ 171,11 e trouxe 1 lead maduro, nenhum qualificado',
  detalhe: { gasto: 171.11, leads_maduros: 1, qualificados: 0, ad_ids: ['a', 'b'] },
  criada_em: '2026-09-23T11:55:00Z', atualizada_em: null, vence_em: '2026-09-24T13:00:00Z',
};

test('pendente de tráfego sai com rótulo, números formatados e verificação', () => {
  const [p] = montarPropostas({ pendentes: [TRAFEGO] }).pendentes;
  assert.equal(p.id, '7');
  assert.equal(p.acao_rotulo, 'Pausar campanha');
  assert.equal(p.qtd_anuncios, null);
  assert.deepEqual(p.numeros.map((n) => n.rotulo), ['Gasto 7d', 'Custo por visita', 'Visitas 7d']);
  assert.equal(p.numeros[0].valor.replace(/\s/g, ' '), 'R$ 32,59');
  assert.match(p.numeros[1].referencia, /^corte R\$\s0,25$/);
  assert.match(p.verificacao, /campanha deve aparecer pausada/);
  // A versão atual é a data mostrada; a primeira aparição, a da criação.
  assert.equal(p.criada_em, TRAFEGO.atualizada_em);
  assert.equal(p.primeira_vez_em, TRAFEGO.criada_em);
  assert.equal(p.vezes_proposta, 2);
});

test('anúncio com nome repetido diz quantos serão pausados', () => {
  const [p] = montarPropostas({ pendentes: [ANUNCIO] }).pendentes;
  assert.equal(p.qtd_anuncios, 2);
  assert.match(p.verificacao, /Os 2 anúncios com este nome/);
  assert.equal(p.criada_em, ANUNCIO.criada_em);
});

test('número ausente some da lista em vez de virar zero', () => {
  const [p] = montarPropostas({ pendentes: [{ ...TRAFEGO, detalhe: { cpv: 0.5 } }] }).pendentes;
  assert.deepEqual(p.numeros.map((n) => n.rotulo), ['Custo por visita']);
});

test('situação de cada proposta resolvida', () => {
  const base = { ...TRAFEGO, decidida_em: '2026-09-23T12:00:00Z' };
  const { historico } = montarPropostas({
    historico: [
      { ...base, decisao: 'aprovada', decidida_por: 'painel' },
      { ...base, decisao: 'rejeitada', decidida_por: 'painel', por_que: 'deixa rodar' },
      { ...base, decisao: 'vencida', decidida_por: 'argo' },
      { ...base, decisao: 'vencida', decidida_por: 'migracao-0002' },
    ],
  });
  assert.deepEqual(historico.map((h) => h.situacao), ['aguardando_execucao', 'rejeitada', 'vencida', 'vencida']);
  assert.equal(historico[1].por_que, 'deixa rodar');
  assert.match(historico[1].situacao_detalhe, /a partir de 26\/09/);
  // Vencida não foi "decidida" por ninguém.
  assert.equal(historico[2].decidida_por, null);
  assert.match(historico[3].situacao_detalhe, /rodada de teste/);
});

test('aprovada mostra o desfecho da execução', () => {
  const agora = new Date('2026-09-23T15:00:00Z').getTime();
  const base = { ...TRAFEGO, decisao: 'aprovada', decidida_por: 'painel', decidida_em: '2026-09-23T14:00:00Z' };
  const objetos = [{ objeto: 'c1', antes: 'ACTIVE', depois: 'PAUSED', resultado: 'pausou' }];
  const { historico } = montarPropostas({
    agora,
    historico: [
      { ...base, execucao_estado: 'conferida', execucao_em: '2026-09-23T14:05:00Z', execucao_detalhe: { frase: 'pausada e conferida no Meta', objetos } },
      { ...base, execucao_estado: 'nao_conferida', execucao_em: '2026-09-23T14:05:00Z', execucao_detalhe: { frase: 'o Meta não confirmou', objetos } },
      { ...base, execucao_estado: 'nao_executou', execucao_em: '2026-09-23T14:05:00Z', execucao_detalhe: { frase: 'já estava pausada quando o Argo foi agir', objetos } },
      { ...base, execucao_estado: 'executando', execucao_em: '2026-09-23T14:58:00Z' },
      { ...base, execucao_estado: 'executando', execucao_em: '2026-09-23T14:00:00Z' },
      { ...base, execucao_estado: null },
    ],
  });
  assert.deepEqual(historico.map((h) => h.situacao), [
    'executada_conferida', 'executada_nao_conferida', 'nao_executou',
    'aguardando_execucao', 'executada_nao_conferida', 'aguardando_execucao',
  ]);
  assert.deepEqual(historico[0].execucao, { antes: 'ACTIVE', depois: 'PAUSED', conferencia: 'conferido' });
  assert.match(historico[2].situacao_detalhe, /já estava pausada/);
  assert.match(historico[4].situacao_detalhe, /parou no meio/);
  assert.equal(historico[5].execucao, null);
});

test('aprovada com parada geral ligada diz por que não executa', () => {
  const { historico } = montarPropostas({
    parada_geral: true,
    historico: [{ ...TRAFEGO, decisao: 'aprovada', decidida_por: 'painel', decidida_em: '2026-09-23T14:00:00Z', execucao_estado: null }],
  });
  assert.match(historico[0].situacao_detalhe, /parada geral está ligada/);
});

test('parada geral atravessa para a tela', () => {
  assert.equal(montarPropostas({ parada_geral: true }).parada_geral, true);
  assert.equal(montarPropostas({}).parada_geral, false);
});

test('decisão válida', () => {
  assert.deepEqual(validarDecisao({ id: '7', versao: 2, decisao: 'aprovar' }),
    { ok: true, valores: { id: 7, versao: 2, decisao: 'aprovada', por_que: null } });
  assert.deepEqual(validarDecisao({ id: 7, versao: 1, decisao: 'rejeitar', por_que: '  novo  ' }).valores.por_que, 'novo');
});

test('aprovar descarta o "por quê"', () => {
  assert.equal(validarDecisao({ id: 7, versao: 1, decisao: 'aprovar', por_que: 'x' }).valores.por_que, null);
});

test('decisão inválida é recusada, nunca corrigida', () => {
  for (const corpo of [null, [], {}, { id: 7, versao: 1, decisao: 'talvez' }, { id: 7, decisao: 'aprovar' },
    { id: -1, versao: 1, decisao: 'aprovar' }, { id: 7, versao: 1, decisao: 'rejeitar', por_que: 5 },
    { id: 7, versao: 1, decisao: 'rejeitar', por_que: 'x'.repeat(MAX_POR_QUE + 1) }]) {
    assert.equal(validarDecisao(corpo).ok, false, JSON.stringify(corpo));
  }
});

test('recusa explica o motivo certo', () => {
  const agora = new Date('2026-09-23T15:00:00Z');
  assert.equal(motivoDaRecusa(null, 1, agora).status, 404);
  assert.equal(motivoDaRecusa(null, 1, agora).erro, ERRO_NAO_EXISTE);
  assert.match(motivoDaRecusa({ decisao: 'aprovada', decidida_por: 'painel', decidida_em: '2026-09-23T14:00:00Z' }, 1, agora).erro, /já foi aprovada por painel/);
  assert.equal(motivoDaRecusa({ decisao: 'vencida' }, 1, agora).erro, ERRO_VENCIDA);
  assert.equal(motivoDaRecusa({ decisao: null, vence_em: '2026-09-23T14:00:00Z', versao: 1 }, 1, agora).erro, ERRO_VENCIDA);
  assert.equal(motivoDaRecusa({ decisao: null, vence_em: '2026-09-24T13:00:00Z', versao: 3 }, 2, agora).erro, ERRO_VERSAO_NOVA);
});

// Issue 312 — desfazer.
test('desfazer: só a pausa conferida e ainda não pedida oferece o botão', () => {
  const base = { ...TRAFEGO, decisao: 'aprovada', decidida_por: 'painel', decidida_em: '2026-09-23T14:00:00Z' };
  const { historico } = montarPropostas({
    historico: [
      { ...base, execucao_estado: 'conferida', execucao_em: '2026-09-23T14:05:00Z' },
      { ...base, execucao_estado: 'nao_conferida' },
      { ...base, execucao_estado: 'conferida', desfazer_pedido_em: '2026-09-23T15:00:00Z' },
      { ...base, decisao: 'rejeitada' },
    ],
  });
  assert.deepEqual(historico.map((h) => h.pode_desfazer), [true, false, false, false]);
});

test('desfazer: situação acompanha o pedido e o resultado', () => {
  const agora = new Date('2026-09-23T15:10:00Z').getTime();
  const base = { ...TRAFEGO, decisao: 'aprovada', decidida_por: 'painel', decidida_em: '2026-09-23T14:00:00Z',
    execucao_estado: 'conferida', desfazer_pedido_em: '2026-09-23T15:00:00Z', desfazer_pedido_por: 'painel' };
  const { historico } = montarPropostas({
    agora,
    historico: [
      { ...base },
      { ...base, desfazer_estado: 'conferida', desfazer_em: '2026-09-23T15:05:00Z', desfazer_detalhe: { frase: 'reativada e conferida no Meta' } },
      { ...base, desfazer_estado: 'nao_executou', desfazer_detalhe: { frase: 'já estava ativa quando o Argo foi desfazer' } },
      { ...base, desfazer_estado: 'nao_conferida' },
    ],
  });
  assert.deepEqual(historico.map((h) => h.situacao), ['aguardando_execucao', 'desfeita', 'desfeita', 'executada_nao_conferida']);
  assert.equal(historico[0].situacao_rotulo, 'Desfazer pedido');
  assert.deepEqual(historico[1].desfeita, { por: 'painel', em: '2026-09-23T15:00:00Z' });
  assert.match(historico[2].situacao_detalhe, /já estava ativa/);
});

test('desfazer: corpo só precisa do id', () => {
  assert.deepEqual(validarDecisao({ id: 7, decisao: 'desfazer' }), { ok: true, valores: { id: 7, decisao: 'desfazer' } });
  assert.equal(validarDecisao({ decisao: 'desfazer' }).ok, false);
});

// Issue 317 — reduzir orçamento.
test('proposta de redução mostra o orçamento atual e o novo', () => {
  const [p] = montarPropostas({ pendentes: [{ ...TRAFEGO, tipo: 'reduzir_orcamento',
    detalhe: { cpv: 0.5, corte_cpv: 0.3, gasto_7d: 40, orcamento: { centavos: 2000, novo_centavos: 1400 } } }] }).pendentes;
  assert.equal(p.acao_rotulo, 'Reduzir orçamento');
  assert.match(p.numeros[0].valor, /20,00/);
  assert.match(p.numeros[0].referencia, /vai para R\$\s14,00/);
  assert.match(p.verificacao, /14,00 no Gerenciador/);
});

test('redução executada mostra orçamentos e não oferece desfazer', () => {
  const { historico } = montarPropostas({ historico: [{ ...TRAFEGO, tipo: 'reduzir_orcamento', decisao: 'aprovada',
    decidida_por: 'painel', decidida_em: '2026-09-23T14:00:00Z', execucao_estado: 'conferida', execucao_em: '2026-09-23T14:05:00Z',
    execucao_detalhe: { frase: 'orçamento reduzido', objetos: [{ antes: 2000, depois: 1400, resultado: 'reduziu' }] } }] });
  assert.match(historico[0].execucao.antes, /20,00/);
  assert.match(historico[0].execucao.depois, /14,00/);
  assert.equal(historico[0].pode_desfazer, false);
});

// Issue 318 — reativar.
test('proposta de reativar tem rótulo e verificação próprios e não oferece desfazer', () => {
  const [p] = montarPropostas({ pendentes: [{ ...ANUNCIO, tipo: 'reativar_anuncio' }] }).pendentes;
  assert.equal(p.acao_rotulo, 'Reativar anúncio');
  assert.match(p.verificacao, /voltar a aparecer ativo/);
  const { historico } = montarPropostas({ historico: [{ ...ANUNCIO, tipo: 'reativar_anuncio', decisao: 'aprovada',
    decidida_por: 'painel', decidida_em: '2026-09-23T14:00:00Z', execucao_estado: 'conferida', execucao_em: '2026-09-23T14:05:00Z' }] });
  assert.equal(historico[0].pode_desfazer, false);
});
