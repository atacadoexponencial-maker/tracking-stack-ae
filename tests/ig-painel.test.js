import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  periodoDaRequisicao, diasEntre, organico, montarResumo, montarCrescimento, montarConteudo, linhaDoPost, montarStories, montarPublico,
} from '../functions/api/_ig-painel.js';

const dia = (d, extra = {}) => ({
  dia: d, alcance_total: 1000, alcance_por_tipo: { AD: 900, REEL: 80, STORY: 20 },
  views_por_tipo: { AD: 1500, REEL: 300 }, interacoes_por_tipo: { AD: 40, REEL: 10 },
  visitas_perfil: 50, toques_link: 1, curtidas: 30, comentarios: 2, compartilhamentos: 3, salvamentos: 4,
  respostas: 0, reposts: 1, seguidores_ganhos: 20, seguidores_perdidos: 5, seguidores_total: null, total_reconstruido: null,
  ...extra,
});

test('período da requisição: valida e converte para dias de Brasília', () => {
  const ymd = (u) => new Date(u * 1000 - 3 * 3600000).toISOString().slice(0, 10);
  const url = (qs) => new URL('https://x/api?' + qs);
  const p = periodoDaRequisicao(url('from=1788922800&to=1791514799&antFrom=1786330800&antTo=1788922799'), ymd, { comAnterior: true });
  assert.equal(p.de, '2026-09-09');
  assert.equal(p.ate, '2026-10-08');
  assert.equal(p.antAte, '2026-09-08');
  assert.equal(periodoDaRequisicao(url('from=abc&to=1'), ymd), null);
  assert.equal(periodoDaRequisicao(url('from=2&to=1'), ymd), null);
  assert.equal(periodoDaRequisicao(url('from=1&to=99999999'), ymd), null);
  assert.equal(periodoDaRequisicao(url('from=1788922800&to=1791514799'), ymd, { comAnterior: true }), null);
});

test('diasEntre inclui as duas pontas', () => {
  assert.deepEqual(diasEntre('2026-09-28', '2026-09-30'), ['2026-09-28', '2026-09-29', '2026-09-30']);
});

test('orgânico é tudo menos anúncio; sem quebra é null', () => {
  assert.equal(organico({ AD: 900, REEL: 80, STORY: 20 }), 100);
  assert.equal(organico({}), null);
  assert.equal(organico(null), null);
});

test('resumo: última coleta ok, atraso e falha', () => {
  const agora = Date.parse('2026-09-30T12:00:00Z');
  const r = montarResumo({
    agoraMs: agora,
    perfil: { seguidores_total: 25637, posts_total: 299 },
    execucoes: [
      { coleta: 'diaria', ok: true, iniciada_em: '2026-09-30T09:30:00Z', concluida_em: '2026-09-30T09:34:00Z' },
      { coleta: 'stories', ok: true, iniciada_em: '2026-09-30T05:17:00Z', concluida_em: '2026-09-30T05:17:30Z' },
      { coleta: 'stories', ok: false, erro: 'token recusado', iniciada_em: '2026-09-30T11:17:00Z' },
    ],
  });
  assert.equal(r.perfil.seguidores, 25637);
  assert.equal(r.coletas.diaria.atrasada, false);
  assert.equal(r.coletas.stories.atrasada, true);
  assert.equal(r.coletas.stories.ultima_falha.motivo, 'token recusado');
  assert.equal(r.coletas.posts.atrasada, true);
  assert.equal(r.atualizado_em, '2026-09-30T09:34:00.000Z');
  assert.equal(r.nunca_coletou, false);
});

test('resumo sem nenhuma coleta', () => {
  assert.equal(montarResumo({}).nunca_coletou, true);
});

test('crescimento: alcance é média por dia, views e interações somam, orgânico separado', () => {
  const r = montarCrescimento({
    de: '2026-09-28', ate: '2026-09-29', antDe: '2026-09-26', antAte: '2026-09-27',
    linhas: [dia('2026-09-28'), dia('2026-09-29', { alcance_por_tipo: { AD: 800, REEL: 200 } })],
    linhasAnteriores: [dia('2026-09-26'), dia('2026-09-27')],
  });
  assert.equal(r.kpis.alcance_medio.organico, 150);
  assert.equal(r.kpis.alcance_medio.anuncios, 850);
  assert.equal(r.kpis.visualizacoes.organico, 600);
  assert.equal(r.kpis.interacoes.organico, 20);
  assert.equal(r.kpis.interacoes.quebra.curtidas, 60);
  assert.equal(r.kpis.alcance_medio.delta, 50);
  assert.equal(r.kpis.seguidores.saldo, 30);
  assert.equal(r.kpis.visitas_perfil.inclui_anuncios, true);
});

test('crescimento: sem comparação quando o período anterior não está completo', () => {
  const r = montarCrescimento({
    de: '2026-09-28', ate: '2026-09-29', antDe: '2026-09-26', antAte: '2026-09-27',
    linhas: [dia('2026-09-28'), dia('2026-09-29')], linhasAnteriores: [dia('2026-09-27')],
  });
  assert.equal(r.comparacao_disponivel, false);
  assert.equal(r.kpis.alcance_medio.delta, null);
});

test('crescimento: variação de seguidores só com os dois períodos completos', () => {
  const base = { de: '2026-09-28', ate: '2026-09-29', antDe: '2026-09-26', antAte: '2026-09-27' };
  const completo = montarCrescimento({ ...base, linhas: [dia('2026-09-28'), dia('2026-09-29')], linhasAnteriores: [dia('2026-09-26'), dia('2026-09-27', { seguidores_ganhos: 10 })] });
  assert.equal(completo.kpis.seguidores.delta, 50); // saldo 30 contra 20
  // Período anterior fora da janela de 30 dias da Meta: alcance existe, seguidores não.
  const semJanela = montarCrescimento({ ...base, linhas: [dia('2026-09-28'), dia('2026-09-29')],
    linhasAnteriores: [dia('2026-09-26', { seguidores_ganhos: null, seguidores_perdidos: null }), dia('2026-09-27')] });
  assert.equal(semJanela.comparacao_disponivel, true);
  assert.equal(semJanela.kpis.seguidores.delta, null);
});

test('crescimento: dia sem coleta é lacuna, seguidores recentes estão chegando', () => {
  const r = montarCrescimento({
    de: '2026-09-27', ate: '2026-09-29', antDe: '2026-09-24', antAte: '2026-09-26',
    linhas: [dia('2026-09-27'), dia('2026-09-29', { seguidores_ganhos: null, seguidores_perdidos: null, seguidores_total: 25637 })],
    publicacoes: [{ dia: '2026-09-29', formato: 'Reel' }, { dia: '2026-09-29', formato: 'Carrossel' }],
    ultimoDiaColetado: '2026-09-29', historicoSeguidoresDesde: '2026-08-30',
  });
  const [d27, d28, d29] = r.serie;
  assert.equal(d27.coletado, true);
  assert.equal(d28.coletado, false);
  assert.equal(d28.alcance_org, null);
  assert.equal(d29.seguidores_chegando, true);
  assert.equal(d29.ganhos, null);
  assert.deepEqual(d29.publicacoes, ['Reel', 'Carrossel']);
  assert.equal(r.kpis.seguidores.total, 25637);
  assert.equal(r.seguidores.historico_desde, '2026-08-30');
  assert.equal(r.periodo.dias_com_dado, 2);
});

const post = (id, formato, extra = {}) => ({
  media_id: id, formato, publicado_em: '2026-09-25T12:00:00Z', legenda: 'x', link: 'https://instagram.com/p/' + id,
  miniatura: 'data:image/jpeg;base64,x', alcance: 100, views: 150, curtidas: 5, comentarios: 1, compartilhamentos: 0,
  salvamentos: 1, interacoes: 7, tempo_medio_ms: null, visitas_perfil: null, seguidores: null,
  pago_campanhas: null, atualizado_em: '2026-09-30T09:45:00Z', ...extra,
});

test('post: engajamento, tempo em segundos, impulsionado em veiculação', () => {
  const l = linhaDoPost(post('r1', 'Reel', {
    tempo_medio_ms: 7703, pago_campanhas: ['Post A'], pago_alcance: 3455, pago_views: 1276,
    pago_investimento: '75.62', pago_inicio: '2026-09-26', pago_fim: null,
  }));
  assert.ok(Math.abs(l.engajamento - 7) < 1e-9);
  assert.equal(l.tempo_medio_s, 7.703);
  assert.equal(l.impulsionado.investimento, 75.62);
  assert.equal(l.impulsionado.em_veiculacao, true);
  assert.equal(linhaDoPost(post('c1', 'Carrossel')).impulsionado, null);
});

test('post antigo sem alcance: engajamento null, não zero', () => {
  assert.equal(linhaDoPost(post('o1', 'Foto', { alcance: null, interacoes: null })).engajamento, null);
});

test('conteúdo: médias por formato, líderes e melhor de cada formato', () => {
  const r = montarConteudo({
    posts: [post('r1', 'Reel', { alcance: 900, interacoes: 9 }), post('r2', 'Reel', { alcance: 100, interacoes: 10 }),
      post('c1', 'Carrossel', { alcance: 300, interacoes: 30, seguidores: 2 })],
    stories: [{ story_id: 's1', publicado_em: '2026-09-29T19:00:00Z', alcance: 150, views: 200, interacoes: 3, seguidores: 0 }],
  });
  const reel = r.formatos.find((f) => f.formato === 'Reel');
  assert.equal(reel.quantidade, 2);
  assert.equal(reel.alcance_medio, 500);
  assert.equal(reel.melhor.id, 'r1');
  assert.equal(r.formatos.find((f) => f.formato === 'Foto').quantidade, 0);
  assert.equal(r.formatos.find((f) => f.formato === 'Carrossel').seguidores, 2);
  assert.equal(r.lider_alcance, 'Reel');
  assert.equal(r.lider_engajamento, 'Carrossel');
  assert.deepEqual(r.posts.map((p) => p.id), ['r1', 'c1', 'r2']);
});

test('stories: no ar, captura parcial, navegação e taxa de saída', () => {
  const agora = Date.parse('2026-09-30T12:00:00Z');
  const r = montarStories({
    agoraMs: agora, registroDesde: '2026-09-29T21:38:00Z', de: '2026-09-01',
    stories: [
      { story_id: 'a', publicado_em: '2026-09-30T10:00:00Z', ultima_captura_em: '2026-09-30T11:17:00Z', alcance: 100,
        navegacao: { tap_forward: 50, tap_exit: 10 } },
      { story_id: 'b', publicado_em: '2026-09-28T21:46:00Z', ultima_captura_em: '2026-09-29T15:00:00Z', alcance: 100,
        navegacao: { tap_exit: 30, swipe_forward: 5 } },
      { story_id: 'c', publicado_em: '2026-09-29T00:00:00Z', ultima_captura_em: '2026-09-29T23:17:00Z', alcance: 200, navegacao: {} },
    ],
  });
  const [a, c, b] = r.stories;
  assert.equal(a.no_ar, true);
  assert.equal(b.captura_parcial, true);
  assert.equal(c.captura_parcial, false);
  assert.equal(b.navegacao.proximo, 5);
  assert.equal(r.totais.taxa_saida, 10);
  assert.equal(r.periodo_antes_do_registro, true);
});

test('público: distribuição, top 10 cidades, engajados vazio e horário de pico', () => {
  const por_hora = Array.from({ length: 24 }, (_, h) => (h === 17 ? 13300 : 1000));
  const r = montarPublico({
    online: { dia: '2026-09-28', por_hora },
    linhas: [
      { dia: '2026-09-30', publico: 'seguidores', dimensao: 'idade', valores: { '35-44': 60, '25-34': 40 }, vazio: false },
      { dia: '2026-09-30', publico: 'seguidores', dimensao: 'genero', valores: { F: 75, M: 20, U: 5 }, vazio: false },
      { dia: '2026-09-30', publico: 'seguidores', dimensao: 'cidade',
        valores: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`Cidade ${i}, Estado (state)`, 100 - i])), vazio: false },
      { dia: '2026-09-30', publico: 'seguidores', dimensao: 'pais', valores: { BR: 99, US: 1 }, vazio: false },
      { dia: '2026-09-30', publico: 'engajados', dimensao: 'idade', valores: {}, vazio: true },
    ],
  });
  assert.equal(r.retrato_dia, '2026-09-30');
  assert.deepEqual(r.seguidores.idade.map((i) => i.chave), ['25-34', '35-44']);
  assert.equal(r.seguidores.genero[0].rotulo, 'Mulheres');
  assert.equal(r.seguidores.genero[0].pct, 75);
  assert.equal(r.seguidores.cidades.length, 10);
  assert.equal(r.seguidores.cidades[0].rotulo, 'Cidade 0 · Estado');
  assert.equal(r.seguidores.paises[0].rotulo, 'Brasil');
  assert.equal(r.engajados.vazio, true);
  assert.equal(r.online.pico, 17);
});
