import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checarAnalise, publicar, universoDoPacote } from '../functions/api/_argo-relatorio-checagem.js';
import { analisarPacote } from '../functions/api/_argo-relatorio-analise.js';
import { montarMensagem, VERSOES_INSTRUCOES } from '../functions/api/_argo-relatorio-instrucoes.js';
import { montarPacote } from '../functions/api/_argo-relatorio-pacote.js';
import { janelasDoRelatorio } from '../functions/api/_argo-relatorio-semana.js';

const bloco = (nome, investido, leads, mqls) => ({ nome, tipo: 'lead_mql', posicao: 1, investido, metricas: { novos_leads: leads, mqls } });
function pacoteBase(extra = {}) {
  return montarPacote({
    hoje: '2026-10-05',
    janelas: janelasDoRelatorio('2026-10-05'),
    resultados: {
      atual: { blocos: [bloco('SE', 2480, 74, 21), bloco('Aplicação', 410, 6, 4)] },
      anterior: { blocos: [bloco('SE', 2310, 62, 15), bloco('Aplicação', 380, 9, 5)] },
      media4: { blocos: [bloco('SE', 8890, 229, 58), bloco('Aplicação', 1540, 28, 16)] },
    },
    metas: [{ nome: 'SE', cpl_max_centavos: 3500, custo_mql_max_centavos: 13000, leads_novos: 310, mqls: 62, dias_no_mes: 31 }],
    piso: { multiplicador: 3 },
    argo: { propostas: [], vereditos: [{ acao_id: 10, situacao: 'acertou', motivo: 'CPL caiu', avaliada_em: '2026-10-04T12:00:00Z' }],
      acoes: [{ id: 10, tipo: 'realocar_verba', alvo_nome: 'SE | LAL', motivo: 'x', aplicada: true, criada_em: '2026-09-29T12:00:00Z' }] },
    anuncios: { insights: [], leadsPorNome: {}, totalLeadsPagos: 0 },
    anunciosNovos: [],
    testes: { testes: [{ id: 1, nome: 'Pergunta x número', tipo: 'criativo', situacao: 'rodando', hipotese: 'h', metrica: 'CPL', unidade: 'leads', inicio: '2026-09-25', controle: [], variante: [], numeros: null, leitura: { falta_dias: 5, falta_amostra: 18 } }] },
    contexto: { valendo: [{ id: 3, tipo: 'restricao', titulo: 'Não mexer no remarketing do workshop pago', texto: '', situacao: 'em_dia', dias_desde_revisao: 2 }], terminados: [], arquivados: [] },
    semanaAnterior: { reacoes: [], descartes: [] },
    temRelatorioAnterior: true,
    ...extra,
  });
}
const P = pacoteBase();
const id = (nome) => Object.values(P.fatos).find((f) => f.nome === nome).id;
const CPL_SE = id('CPL · SE');
const META_SE = id('Meta de CPL · SE');
const MQL_AP = id('MQLs · Aplicação');
const TESTE = Object.values(P.fatos).find((f) => f.nome.startsWith('Teste rodando')).id;
const VEREDITO = Object.values(P.fatos).find((f) => f.grupo === 'Vereditos').id;
const frase = (texto, citacoes, tipo = 'leitura') => ({ texto, citacoes, tipo });
const boa = () => ({
  resumo: [frase('O CPL da SE ficou em R$ 33,51, abaixo da meta de R$ 35,00.', [CPL_SE, META_SE], 'fato')],
  leitura_acoes: [frase('A realocação para o Lookalike deu certo segundo o veredito.', [VEREDITO])],
  leitura_testes: [frase('O teste de gancho ainda não tem volume para ser lido.', [TESTE], 'sem_conclusao')],
  pontos_atencao: [],
  sugestoes: [{ tipo: 'criativo', funil: 'SE', hipotese: 'Acreditamos que gancho de dor traz MQL mais barato.', mudar: 'Dois anúncios novos.', metrica: 'Custo por MQL', criterio: 'Dor com custo por MQL 15% menor', minimo: '14 dias e 60 leads', porque: frase('O CPL da SE está abaixo da meta.', [CPL_SE, META_SE]), parecido: 'nenhum' }],
  sem_sugestao_motivo: '',
});

test('análise boa passa sem violação e vai ao ar inteira', () => {
  assert.deepEqual(checarAnalise(boa(), P), []);
  const p = publicar(boa(), []);
  assert.equal(p.situacao, 'verificada');
  assert.deepEqual(p.blocos.map((b) => b.chave), ['resumo', 'acoes', 'testes', 'atencao', 'sug-1']);
});

test('número inventado reprova; arredondamento passa; contagem pequena passa', () => {
  const s = boa();
  s.resumo.push(frase('O CPL caiu 9,8% na semana.', [CPL_SE]));
  s.pontos_atencao.push(frase('São 3 funis ativos e o CPL da SE é R$ 33,5.', [CPL_SE], 'fato'));
  const v = checarAnalise(s, P);
  assert.equal(v.length, 1);
  assert.equal(v[0].regra, 'Números');
  assert.match(v[0].motivo, /9,8%/);
});

test('etiqueta inexistente e afirmação sem etiqueta reprovam', () => {
  const s = boa();
  s.resumo.push(frase('A semana foi boa.', []));
  s.resumo.push(frase('O CPL está ótimo.', ['F999']));
  const regras = checarAnalise(s, P).map((x) => x.regra);
  assert.deepEqual(regras, ['Citações', 'Citações']);
});

test('conclusão em amostra pequena reprova; só descrever o número passa', () => {
  const s = boa();
  s.pontos_atencao.push(frase('A aplicação piorou em MQLs.', [MQL_AP]));
  assert.equal(checarAnalise(s, P)[0].regra, 'Amostra');
  const ok = boa();
  ok.pontos_atencao.push(frase('A aplicação trouxe 4 MQLs, abaixo do piso para concluir.', [MQL_AP], 'sem_conclusao'));
  assert.deepEqual(checarAnalise(ok, P), []);
});

test('vencedor declarado em teste não pronto reprova', () => {
  const s = boa();
  s.leitura_testes = [frase('O gancho com pergunta venceu o teste.', [TESTE])];
  assert.equal(checarAnalise(s, P)[0].regra, 'Leitura antecipada');
});

test('causa atribuída a ação sem veredito reprova; com veredito passa', () => {
  const s = boa();
  s.resumo.push(frase('O CPL da SE caiu por causa da pausa do ad13.', [CPL_SE]));
  assert.equal(checarAnalise(s, P)[0].regra, 'Causa sem veredito');
  const ok = boa();
  ok.resumo.push(frase('O CPL da SE melhorou graças à realocação de verba.', [CPL_SE, VEREDITO]));
  assert.deepEqual(checarAnalise(ok, P), []);
});

test('semana atípica: o resumo tem que citar o aviso', () => {
  const Pa = pacoteBase({ contexto: { valendo: [], arquivados: [], terminados: [{ id: 9, tipo: 'evento', titulo: 'Live', inicio: '2026-10-01', fim: '2026-10-01', situacao: 'terminado', dias_desde_revisao: 3 }] } });
  const cpl = Object.values(Pa.fatos).find((f) => f.nome === 'CPL · SE').id;
  const s = { ...boa(), resumo: [frase('O CPL da SE ficou em R$ 33,51.', [cpl], 'fato')], leitura_acoes: [], leitura_testes: [], sugestoes: [], sem_sugestao_motivo: 'Sem base.' };
  assert.equal(checarAnalise(s, Pa)[0].regra, 'Semana atípica');
  s.resumo.push(frase('A semana teve a live, então a comparação pede cuidado.', [Pa.marcas.atipica.fato_id]));
  assert.deepEqual(checarAnalise(s, Pa), []);
});

test('sugestão que mexe numa restrição reprova só aquele bloco: relatório parcial', () => {
  const s = boa();
  s.sugestoes.push({ ...boa().sugestoes[0], mudar: 'Trocar o público do remarketing do workshop pago.' });
  const v = checarAnalise(s, P);
  assert.deepEqual(v.map((x) => [x.regra, x.bloco]), [['Restrição', 'sug-2']]);
  const p = publicar(s, v);
  assert.equal(p.situacao, 'parcial');
  assert.deepEqual(p.removidos.map((r) => r.chave), ['sug-2']);
  assert.ok(p.blocos.every((b) => b.chave !== 'sug-2'));
});

test('resumo reprovado derruba toda a análise escrita', () => {
  const s = boa();
  s.resumo = [frase('O CPL caiu 42%.', [CPL_SE])];
  const p = publicar(s, checarAnalise(s, P));
  assert.equal(p.situacao, 'nao_passou');
  assert.deepEqual(p.blocos, []);
});

test('sem sugestão exige o motivo; mais de 3 reprova', () => {
  const s = { ...boa(), sugestoes: [], sem_sugestao_motivo: '' };
  assert.equal(checarAnalise(s, P)[0].regra, 'Formato');
  const muitas = { ...boa(), sugestoes: [1, 2, 3, 4].map(() => boa().sugestoes[0]) };
  assert.ok(checarAnalise(muitas, P).some((x) => x.motivo.includes('máximo é 3')));
});

test('universo inclui datas dos fatos e do rótulo da semana', () => {
  const u = universoDoPacote(P);
  assert.ok(u.datas.has('28/09'));
  assert.ok(u.numeros.some((n) => n.tipo === 'moeda' && Math.abs(n.valor - 33.51) < 1e-9));
});

// ---------------------------------------------------------------- analisarPacote
function clienteFalso(respostas) {
  const chamadas = [];
  return {
    chamadas,
    beta: { messages: { stream: (params) => {
      chamadas.push(params);
      const r = respostas[chamadas.length - 1];
      return { finalMessage: async () => {
        if (r instanceof Error) throw r;
        return { stop_reason: r.stop_reason || 'end_turn', model: 'claude-opus-5-5', usage: { input_tokens: 100, output_tokens: 50 }, content: [{ type: 'text', text: typeof r === 'string' ? r : JSON.stringify(r.saida) }] };
      } };
    } } },
  };
}
const sqlFalso = async () => [];

test('sem chave: só a parte calculada, com o motivo', async () => {
  const r = await analisarPacote({}, sqlFalso, P);
  assert.equal(r.situacao, 'sem_analise');
  assert.match(r.erro, /chave da API/);
});

test('primeira tentativa boa: verificada, uma chamada, parâmetros certos', async () => {
  const c = clienteFalso([{ saida: boa() }]);
  const r = await analisarPacote({}, sqlFalso, P, { cliente: c });
  assert.equal(r.situacao, 'verificada');
  assert.equal(c.chamadas.length, 1);
  const p = c.chamadas[0];
  assert.equal(p.model, 'claude-opus-5-5');
  assert.equal(p.fallbacks, 'default');
  assert.deepEqual(p.betas, ['server-side-fallback-2026-07-01']);
  assert.equal(p.output_config.format.type, 'json_schema');
  assert.equal(p.thinking.type, 'adaptive');
  assert.equal(r.checagem[0].resultado, 'passou');
  assert.equal(r.uso.output_tokens, 50);
});

test('reprovou e corrigiu: a segunda chamada recebe as violações', async () => {
  const ruim = boa();
  ruim.resumo.push(frase('O CPL caiu 9,8%.', [CPL_SE]));
  const c = clienteFalso([{ saida: ruim }, { saida: boa() }]);
  const r = await analisarPacote({}, sqlFalso, P, { cliente: c });
  assert.equal(r.situacao, 'verificada');
  assert.equal(c.chamadas.length, 2);
  assert.match(c.chamadas[1].messages[0].content, /9,8%/);
  assert.deepEqual(r.checagem.map((x) => x.resultado), ['reprovou', 'passou']);
});

test('reprovou duas vezes no resumo: não passou, nenhum texto publicado', async () => {
  const ruim = boa();
  ruim.resumo = [frase('O CPL caiu 42%.', [CPL_SE])];
  const r = await analisarPacote({}, sqlFalso, P, { cliente: clienteFalso([{ saida: ruim }, { saida: ruim }]) });
  assert.equal(r.situacao, 'nao_passou');
  assert.deepEqual(r.blocos, []);
  assert.equal(r.checagem.length, 2);
});

test('recusa e JSON inválido contam como reprovação de formato; API fora vira sem análise', async () => {
  const r = await analisarPacote({}, sqlFalso, P, { cliente: clienteFalso([{ stop_reason: 'refusal', saida: {} }, 'não é json']) });
  assert.equal(r.situacao, 'nao_passou');
  assert.deepEqual(r.checagem.map((x) => x.violacoes[0].motivo), ['O modelo recusou escrever a análise.', 'A resposta do modelo não veio em JSON válido.']);
  const fora = await analisarPacote({}, sqlFalso, P, { cliente: clienteFalso([new Error('ECONNRESET')]) });
  assert.equal(fora.situacao, 'sem_analise');
  assert.match(fora.erro, /não respondeu/);
});

test('mensagem leva só os fatos; instruções têm versão padrão', () => {
  const m = montarMensagem(P);
  assert.ok(m.includes(CPL_SE));
  assert.ok(!m.includes('fato_id'));
  assert.ok(VERSOES_INSTRUCOES.v1.sistema.includes('não faça contas'));
});
