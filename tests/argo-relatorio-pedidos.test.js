import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montarConsulta, processarResposta, lerSaida } from '../functions/api/_argo-relatorio-pedidos.js';
import { montarPacote } from '../functions/api/_argo-relatorio-pacote.js';
import { janelasDoRelatorio } from '../functions/api/_argo-relatorio-semana.js';

const bloco = (nome, investido, leads, mqls) => ({ nome, tipo: 'lead_mql', posicao: 1, investido, metricas: { novos_leads: leads, mqls } });
const P = montarPacote({
  hoje: '2026-10-05', janelas: janelasDoRelatorio('2026-10-05'),
  resultados: { atual: { blocos: [bloco('SE', 2480, 74, 21)] }, anterior: { blocos: [bloco('SE', 2310, 62, 15)] }, media4: { blocos: [bloco('SE', 8890, 229, 58)] } },
  metas: [], piso: { multiplicador: 3 }, argo: { propostas: [], acoes: [], vereditos: [] }, anuncios: { insights: [], leadsPorNome: {}, totalLeadsPagos: 0 },
  anunciosNovos: [], testes: { testes: [] }, contexto: { valendo: [], terminados: [], arquivados: [] }, semanaAnterior: { reacoes: [], descartes: [] }, temRelatorioAnterior: false,
});
const CPL = Object.values(P.fatos).find((f) => f.nome === 'CPL · SE').id;
const boa = { resumo: [{ texto: 'O CPL da SE ficou em R$ 33,51.', citacoes: [CPL], tipo: 'fato' }], leitura_acoes: [], leitura_testes: [], pontos_atencao: [], sugestoes: [], sem_sugestao_motivo: 'Sem base nesta semana.' };
const ruim = { ...boa, resumo: [{ texto: 'O CPL caiu 42%.', citacoes: [CPL], tipo: 'leitura' }] };

test('consulta leva tarefa, instruções, esquema e os fatos; segunda leva as violações', () => {
  const c = montarConsulta('v1', P);
  assert.match(c, /Não use ferramentas/);
  assert.match(c, /APENAS com um objeto JSON/);
  assert.ok(c.includes('"sem_sugestao_motivo"'));
  assert.ok(c.includes(CPL));
  const c2 = montarConsulta('v1', P, { saida: ruim, violacoes: [{ regra: 'Números', bloco: 'resumo', trecho: 'O CPL caiu 42%.', motivo: 'O número "42%" não existe.' }] });
  assert.match(c2, /reprovada na checagem/);
  assert.match(c2, /42%/);
});

test('passou de primeira: final e verificada', () => {
  const x = processarResposta({ historico: [], pacote: P, saida: boa });
  assert.equal(x.final, true);
  assert.equal(x.publicado.situacao, 'verificada');
  assert.deepEqual(x.checagem.map((c) => c.resultado), ['passou']);
});

test('reprovou na primeira: não é final e devolve as violações para a próxima', () => {
  const x = processarResposta({ historico: [], pacote: P, saida: ruim });
  assert.equal(x.final, false);
  assert.equal(x.anterior.violacoes[0].regra, 'Números');
  const y = processarResposta({ historico: x.historico, pacote: P, saida: boa });
  assert.equal(y.final, true);
  assert.equal(y.publicado.situacao, 'verificada');
  assert.deepEqual(y.checagem.map((c) => c.resultado), ['reprovou', 'passou']);
});

test('reprovou duas vezes no resumo: não passou, nada publicado', () => {
  const x = processarResposta({ historico: [], pacote: P, saida: ruim });
  const y = processarResposta({ historico: x.historico, pacote: P, saida: ruim });
  assert.equal(y.final, true);
  assert.equal(y.publicado.situacao, 'nao_passou');
  assert.deepEqual(y.publicado.blocos, []);
});

test('resposta sem JSON conta como tentativa; segunda sem JSON e primeira válida usa a válida', () => {
  const x = processarResposta({ historico: [], pacote: P, saida: null, erro: 'O Argo não respondeu em JSON.' });
  assert.equal(x.final, false);
  assert.equal(x.historico[0].violacoes[0].motivo, 'O Argo não respondeu em JSON.');
  const y = processarResposta({ historico: x.historico, pacote: P, saida: null });
  assert.equal(y.publicado.situacao, 'nao_passou');
  const a = processarResposta({ historico: [], pacote: P, saida: ruim });
  const b = processarResposta({ historico: a.historico, pacote: P, saida: null });
  assert.equal(b.publicado.situacao, 'nao_passou'); // a válida tinha o resumo reprovado
  assert.equal(lerSaida([1]), null);
});
