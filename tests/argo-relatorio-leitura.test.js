import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarReacao, validarDecisao, montarQualidade, montarRelatorio, montarHistorico } from '../functions/api/_argo-relatorio-leitura.js';
import { compararPacotes } from '../functions/api/_argo-relatorio-comparar.js';
import { textoSlack } from '../functions/api/_argo-relatorio-gerar.js';

test('reação: só blocos do relatório; errado exige comentário; limpar vale', () => {
  const blocos = ['resumo', 'acoes', 'sug-1'];
  assert.equal(validarReacao({ relatorio_id: 1, bloco: 'outro', tipo: 'util' }, blocos).erro, 'Este trecho não existe no relatório.');
  assert.equal(validarReacao({ relatorio_id: 1, bloco: 'resumo', tipo: 'errado' }, blocos).erro, 'Diga o que está errado para marcar este trecho.');
  assert.equal(validarReacao({ relatorio_id: 1, bloco: 'resumo', tipo: 'talvez' }, blocos).erro, 'Reação desconhecida.');
  assert.deepEqual(validarReacao({ relatorio_id: '1', bloco: 'resumo', tipo: null, comentario: ' ok ' }, blocos).valores, { relatorio_id: 1, bloco: 'resumo', tipo: null, comentario: 'ok' });
});

test('decisão: descarte exige motivo; aceite monta o teste planejado', () => {
  const analise = [{ chave: 'sug-1', tipo: 'sugestao', sugestao: { tipo: 'oferta', funil: 'Workshop gratuito', hipotese: 'Acreditamos que perguntar o faturamento melhora a taxa de MQL.', mudar: 'Pergunta nova', metrica: 'Taxa de MQL', criterio: '3 pontos' } }];
  assert.equal(validarDecisao({ relatorio_id: 1, chave: 'sug-9', decisao: 'aceita' }, analise).erro, 'Este teste proposto não existe no relatório.');
  assert.equal(validarDecisao({ relatorio_id: 1, chave: 'sug-1', decisao: 'descartada' }, analise).erro, 'Escreva o motivo do descarte.');
  const r = validarDecisao({ relatorio_id: 1, chave: 'sug-1', decisao: 'aceita' }, analise);
  assert.equal(r.teste.nome, 'Perguntar o faturamento melhora a taxa de MQL.');
  assert.equal(r.teste.tipo, 'oferta');
});

test('qualidade em ordem de semana; relatório e histórico normalizados', () => {
  const q = montarQualidade([{ id: 2, semana_inicio: '2026-09-28', util: '3', obvio: '1', errado: '0' }, { id: 1, semana_inicio: new Date('2026-09-21T00:00:00Z'), util: 1, obvio: 0, errado: 2 }]);
  assert.deepEqual(q.map((x) => x.relatorio_id), [1, 2]);
  assert.equal(q[1].util, 3);
  const rel = montarRelatorio({ id: '5', semana_inicio: '2026-09-28', semana_fim: '2026-10-04', situacao: 'parcial', pacote: {}, analise: null, gerado_em: '2026-10-05T10:00:00Z' }, [{ bloco: 'resumo', tipo: 'util', comentario: '' }], [{ sugestao_chave: 'sug-1', decisao: 'aceita', teste_id: '9' }]);
  assert.equal(rel.id, 5);
  assert.deepEqual(rel.semana, { inicio: '2026-09-28', fim: '2026-10-04' });
  assert.deepEqual(rel.analise, []);
  assert.equal(rel.decisoes[0].teste_id, 9);
  assert.equal(montarHistorico([{ id: 1, semana_inicio: '2026-09-28', semana_fim: '2026-10-04', situacao: 'falhou', atipica: true }])[0].atipica, true);
});

const pacote = (cpl, leads) => ({
  semana: { rotulo: 'x' },
  fatos: { F1: { valor: cpl, valor_texto: `R$ ${cpl}` }, F2: { valor: leads, valor_texto: String(leads) } },
  funis: [{ nome: 'SE', metricas: [{ metrica: 'cpl', nome: 'CPL', fato_id: 'F1' }, { metrica: 'leads', nome: 'Leads', fato_id: 'F2' }] }],
});

test('comparar: diferença e sinal pelo sentido da métrica', () => {
  const c = compararPacotes(pacote(4000, 50), pacote(3000, 60));
  const [cpl, leads] = c.funis[0].metricas;
  assert.equal(cpl.diferenca, -0.25);
  assert.equal(cpl.sinal, 'melhor');
  assert.equal(leads.sinal, 'melhor');
  assert.equal(compararPacotes(pacote(4000, 50), pacote(4100, 50)).funis[0].metricas[0].sinal, 'estavel');
});

test('mensagem do Slack: situação, destaques e link; falha diz o motivo', () => {
  const rel = { situacao: 'verificada', semana: { rotulo: '28/09 a 04/10' }, pacote: { fatos: { F1: { valor_texto: 'R$ 30,00' } }, funis: [{ nome: 'SE', metricas: [{ metrica: 'cpl', nome: 'CPL', fato_id: 'F1', sinal: { tipo: 'melhor', contra: 'meta' } }] }], testes: { itens: [{ situacao: 'pronto' }] }, fontes_com_problema: [] } };
  const t = textoSlack(rel, 'https://x/dash');
  assert.match(t, /análise verificada/);
  assert.match(t, /SE: CPL R\$ 30,00 \(melhor que a meta\)/);
  assert.match(t, /1 teste pronto para ler/);
  assert.ok(t.endsWith('https://x/dash'));
  assert.match(textoSlack({ situacao: 'falhou', semana: { rotulo: 'x' }, erro: 'Meta fora.' }, 'L'), /não foi gerado\. Meta fora\./);
});
