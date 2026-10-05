import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montarPacote, numerosDoBloco, sinalDaMetrica, precoEMix, textoDoValor } from '../functions/api/_argo-relatorio-pacote.js';
import { janelasDoRelatorio, limitesMs } from '../functions/api/_argo-relatorio-semana.js';

const HOJE = '2026-10-05';
const janelas = janelasDoRelatorio(HOJE);
const bloco = (nome, investido, leads, mqls, tipo = 'lead_mql') => ({ nome, tipo, posicao: 1, investido, metricas: { novos_leads: leads, mqls } });
const res = (blocos) => ({ blocos });

const fontesBase = () => ({
  hoje: HOJE,
  janelas,
  resultados: {
    atual: res([bloco('SE', 2480, 74, 21), bloco('Aplicação', 410, 6, 4)]),
    anterior: res([bloco('SE', 2310, 62, 15), bloco('Aplicação', 380, 9, 5)]),
    media4: res([bloco('SE', 8890, 229, 58), bloco('Aplicação', 1540, 28, 16)]),
  },
  metas: [{ nome: 'SE', cpl_max_centavos: 3500, custo_mql_max_centavos: 13000, leads_novos: 310, mqls: 62, dias_no_mes: 31 }],
  piso: { multiplicador: 3 },
  argo: { propostas: [], acoes: [], vereditos: [] },
  anuncios: { insights: [], leadsPorNome: {}, totalLeadsPagos: 0 },
  anunciosNovos: [],
  testes: { testes: [] },
  contexto: { valendo: [], terminados: [], arquivados: [] },
  semanaAnterior: { reacoes: [], descartes: [] },
  temRelatorioAnterior: true,
});

const acharFato = (p, nome) => Object.values(p.fatos).find((f) => f.nome === nome);

test('janelas: 7 dias até ontem, a anterior e as 4 anteriores', () => {
  assert.deepEqual(janelas.semana, { inicio: '2026-09-28', fim: '2026-10-04', rotulo: '28/09 a 04/10' });
  assert.equal(janelas.anterior.inicio, '2026-09-21');
  assert.equal(janelas.media4.inicio, '2026-08-31');
  assert.equal(janelas.media4.fim, '2026-09-27');
  const l = limitesMs(janelas.semana);
  assert.equal(new Date(l.desde).toISOString(), '2026-09-28T03:00:00.000Z');
  assert.equal(new Date(l.ate).toISOString(), '2026-10-05T03:00:00.000Z');
});

test('números do bloco: centavos, volumes divididos pelas semanas, custo soma antes de dividir', () => {
  assert.deepEqual(numerosDoBloco(bloco('SE', 8890, 229, 58), 4), { gasto: 222250, leads: 57, mqls: 15, compras: null, cpl: 3882, cpmql: 15328, cpa: null });
  assert.equal(numerosDoBloco(bloco('SE', 100, null, null)).leads, null);
});

test('sinal: contra a meta quando há, senão contra a média; estável abaixo de 5%', () => {
  assert.deepEqual(sinalDaMetrica({ valor: 3351, meta: 3500, media: 3882, menorMelhor: true }), { tipo: 'estavel', pct: (3351 - 3500) / 3500, contra: 'meta' });
  assert.equal(sinalDaMetrica({ valor: 3000, meta: 3500, menorMelhor: true }).tipo, 'melhor');
  assert.equal(sinalDaMetrica({ valor: 80, media: 57, menorMelhor: false }).tipo, 'melhor');
  assert.equal(sinalDaMetrica({ valor: 80, media: 57, menorMelhor: false, amostraPequena: true }).tipo, 'amostra');
  assert.equal(sinalDaMetrica({ valor: null, media: 57, menorMelhor: false }), null);
  assert.equal(sinalDaMetrica({ valor: 5, menorMelhor: null }), null);
});

test('pacote: cada métrica do funil tem fato atual, anterior, média e meta', () => {
  const p = montarPacote(fontesBase());
  const se = p.funis.find((f) => f.nome === 'SE');
  const cpl = se.metricas.find((m) => m.metrica === 'cpl');
  assert.equal(p.fatos[cpl.fato_id].valor, 3351);
  assert.equal(p.fatos[cpl.fato_id].valor_texto, 'R$ 33,51');
  assert.equal(p.fatos[cpl.ant_id].valor, 3726);
  assert.equal(p.fatos[cpl.media_id].valor, 3882);
  assert.equal(p.fatos[cpl.meta_id].valor, 3500);
  // Meta de volume é mensal: entra proporcional à semana.
  const leads = se.metricas.find((m) => m.metrica === 'leads');
  assert.equal(p.fatos[leads.meta_id].valor, 70);
  assert.ok(p.ordem.every((id) => p.fatos[id]));
});

test('amostra pequena: funil com menos de 10 leads marca leads, MQLs e custos', () => {
  const p = montarPacote(fontesBase());
  const ap = p.funis.find((f) => f.nome === 'Aplicação');
  assert.equal(ap.amostra_pequena, true);
  const cpl = ap.metricas.find((m) => m.metrica === 'cpl');
  assert.deepEqual(p.fatos[cpl.fato_id].marcas, ['amostra_pequena']);
  assert.deepEqual(cpl.sinal, { tipo: 'amostra' });
  const gasto = ap.metricas.find((m) => m.metrica === 'gasto');
  assert.deepEqual(p.fatos[gasto.fato_id].marcas, []);
});

test('CRM fora: leads e MQLs indisponíveis, nunca zero, e a fonte aparece com problema', () => {
  const f = fontesBase();
  f.resultados.atual = res([bloco('SE', 2480, null, null)]);
  const p = montarPacote(f);
  const se = p.funis[0];
  const mqls = se.metricas.find((m) => m.metrica === 'mqls');
  assert.equal(p.fatos[mqls.fato_id].valor, null);
  assert.equal(p.fatos[mqls.fato_id].valor_texto, 'indisponível');
  assert.ok(p.fatos[mqls.fato_id].marcas.includes('indisponivel'));
  assert.ok(p.fontes_com_problema.some((x) => x.fonte === 'CRM (ClickUp)'));
});

test('resultados fora: nenhum funil e o problema registrado', () => {
  const f = fontesBase();
  f.resultados.atual = { erro: 'Relatório de marketing fora.' };
  const p = montarPacote(f);
  assert.deepEqual(p.funis, []);
  assert.equal(p.fontes_com_problema[0].aviso, 'Relatório de marketing fora.');
});

test('semana atípica: por evento do contexto e por gasto 30% fora da média', () => {
  const f = fontesBase();
  f.contexto = { valendo: [], arquivados: [], terminados: [{ id: 1, tipo: 'evento', titulo: 'Live da SE', inicio: '2026-10-01', fim: '2026-10-01', situacao: 'terminado', dias_desde_revisao: 3 }] };
  const p = montarPacote(f);
  assert.match(p.marcas.atipica.motivos[0], /Live da SE \(01\/10\)/);
  const f2 = fontesBase();
  f2.resultados.atual = res([bloco('SE', 6000, 150, 30), bloco('Aplicação', 410, 6, 4)]);
  assert.match(montarPacote(f2).marcas.atipica.motivos[0], /gasto total acima da média/);
  assert.equal(montarPacote(fontesBase()).marcas.atipica, null);
});

test('preço e mix: soma dos efeitos fecha com a mudança do CPL geral', () => {
  const m = precoEMix([{ nome: 'A', gasto: 2000, leads: 100 }, { nome: 'B', gasto: 3000, leads: 30 }], [{ nome: 'A', gasto: 2000, leads: 80 }, { nome: 'B', gasto: 1000, leads: 10 }]);
  assert.equal(m.cpl_atual - m.cpl_anterior, m.efeito_preco + m.efeito_mix);
  assert.equal(precoEMix([{ nome: 'A', gasto: 10, leads: 0 }], [{ nome: 'A', gasto: 10, leads: 1 }]), null);
});

test('ações: recusada com motivo, veredito ligado à ação, contagem de decisões', () => {
  const f = fontesBase();
  f.argo = {
    propostas: [{ id: 1, tipo: 'pausar_anuncio', alvo_nome: 'ad13', decisao: 'aprovada', acao_id: 10 }, { id: 2, tipo: 'pausar_campanha_trafego', alvo_nome: 'Reels', decisao: 'rejeitada', por_que: 'campanha de marca', decidida_em: '2026-09-30T12:00:00Z' }],
    acoes: [{ id: 10, tipo: 'pausar_anuncio', alvo_nome: 'ad13', motivo: 'Gastou sem MQL', aplicada: true, criada_em: '2026-09-29T12:00:00Z' }],
    vereditos: [{ acao_id: 10, situacao: 'acertou', motivo: 'CPL caiu', avaliada_em: '2026-10-04T12:00:00Z' }],
  };
  const p = montarPacote(f);
  assert.equal(p.acoes.aprovadas, 1);
  assert.equal(p.acoes.recusadas, 1);
  const pausa = p.acoes.itens.find((i) => i.alvo === 'ad13');
  assert.equal(pausa.veredito.situacao, 'acertou');
  assert.equal(pausa.proposta_id, 1);
  assert.match(p.fatos[pausa.veredito_fato_id].valor_texto, /acertou/);
  const recusa = p.acoes.itens.find((i) => i.grupo === 'Recusadas');
  assert.match(p.fatos[recusa.fato_id].valor_texto, /campanha de marca/);
});

test('testes: ativo não pronto ganha a marca, anúncio novo sem teste é perguntado', () => {
  const f = fontesBase();
  f.testes = { testes: [
    { id: 1, nome: 'Pergunta x número', tipo: 'criativo', situacao: 'rodando', hipotese: 'h', metrica: 'CPL', criterio: '', unidade: 'leads', inicio: '2026-09-25',
      controle: [{ id: '1' }], variante: [{ id: '2' }], numeros: { ok: true, lados: { controle: { gasto_centavos: 100, leads: 3, mqls: 1 }, variante: { gasto_centavos: 100, leads: 4, mqls: 2 } } },
      leitura: { falta_dias: 5, falta_amostra: 18 } },
  ] };
  f.anunciosNovos = [{ id: '1', nome: 'ad09', criado_em: '2026-09-30', conjunto_nome: 'x' }, { id: '3', nome: 'ad20', criado_em: '2026-09-30', conjunto_nome: 'x' }, { id: '4', nome: 'velho', criado_em: '2026-08-01', conjunto_nome: 'x' }];
  const p = montarPacote(f);
  assert.deepEqual(p.fatos[p.testes.itens[0].fato_id].marcas, ['nao_pronto']);
  assert.match(p.fatos[p.testes.itens[0].fato_id].valor_texto, /faltam 5 dias e 18 leads/);
  assert.deepEqual(p.anuncios_sem_teste.map((a) => a.nome), ['ad20']);
});

test('contexto vencido marcado; comentários da semana anterior entram como fatos', () => {
  const f = fontesBase();
  f.contexto = { valendo: [{ id: 2, tipo: 'oferta', titulo: 'Workshop a R$ 47', texto: '', situacao: 'revisar', dias_desde_revisao: 41 }], terminados: [], arquivados: [] };
  f.semanaAnterior = { reacoes: [{ bloco: 'resumo', tipo: 'errado', comentario: 'A live foi dia 02' }], descartes: [{ titulo: 'Gancho de dor', motivo: 'já testamos em julho' }] };
  const p = montarPacote(f);
  assert.deepEqual(p.fatos[p.contexto.vencidos[0].fato_id].marcas, ['vencido']);
  assert.match(p.fatos[p.semana_anterior.reacoes[0].fato_id].valor_texto, /A live foi dia 02/);
  assert.match(p.fatos[p.semana_anterior.descartes[0].fato_id].valor_texto, /já testamos em julho/);
});

test('anúncios: taxa de junção e lista por gasto', () => {
  const f = fontesBase();
  f.anuncios = {
    insights: [{ anuncio_nome: 'ad09', conjunto_nome: 'LAL', gasto_centavos: 30000, impressoes: 1 }, { anuncio_nome: 'ad11', conjunto_nome: 'LAL', gasto_centavos: 50000, impressoes: 1 }],
    leadsPorNome: { ad09: { leads: 12, mqls: 3 }, perdido: { leads: 4, mqls: 0 } },
    totalLeadsPagos: 16,
  };
  const p = montarPacote(f);
  assert.equal(p.anuncios.juncao.taxa, 0.75);
  assert.deepEqual(p.anuncios.itens.map((a) => a.nome), ['ad11', 'ad09']);
  assert.equal(p.anuncios.itens[1].cpl, 2500);
});

test('custo com denominador zero diz "sem leads", não "indisponível"', () => {
  const f = fontesBase();
  f.resultados.atual = res([bloco('SE', 2480, 74, 21), bloco('Aquisição', 657, 0, 0)]);
  const p = montarPacote(f);
  const aq = p.funis.find((x) => x.nome === 'Aquisição');
  const cpl = aq.metricas.find((m) => m.metrica === 'cpl');
  assert.equal(p.fatos[cpl.fato_id].valor_texto, 'sem leads');
  assert.deepEqual(p.fatos[cpl.fato_id].marcas.filter((m) => m === 'indisponivel'), []);
});

test('tentativa não aplicada não entra no que foi feito', () => {
  const f = fontesBase();
  f.argo = { propostas: [], vereditos: [], acoes: [
    { id: 15, tipo: 'pausar_anuncio', alvo_nome: 'ad06', aplicada: true, criada_em: '2026-09-28T12:00:00Z' },
    { id: 31, tipo: 'pausar_anuncio', alvo_nome: 'ad06', aplicada: false, criada_em: '2026-10-01T12:00:00Z' },
  ] };
  assert.equal(montarPacote(f).acoes.itens.length, 1);
});

test('texto do valor', () => {
  assert.equal(textoDoValor(123456, 'centavos'), 'R$ 1.234,56');
  assert.equal(textoDoValor(0.214, 'fracao'), '21,4%');
  assert.equal(textoDoValor(null, 'int'), 'indisponível');
});

test('custo de funil sem gasto fica "sem gasto", nunca R$ 0,00 melhor que a média', () => {
  const f = fontesBase();
  f.resultados.atual = res([bloco('SE', 2480, 74, 21), bloco('WO PAGO', 0, 3, 0)]);
  const p = montarPacote(f);
  const wo = p.funis.find((x) => x.nome === 'WO PAGO');
  const cpl = wo.metricas.find((m) => m.metrica === 'cpl');
  assert.equal(p.fatos[cpl.fato_id].valor_texto, 'sem gasto');
  assert.equal(cpl.sinal, null);
});
