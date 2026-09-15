import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validarNome, normalizarNome, validarTipoEOrigem, campoAplica, CAMPOS_POR_TIPO,
  validarFunilTracking, validarOpcoesCrm, origensSobrepoem, validarTrecho, validarVendaGreennUnica,
  validarFunil, formularioPorTipo, precisaConfirmarEdicao, CONFIRMACAO_EDICAO,
  validarReativacao,
} from '../functions/api/_funis-relatorio-validacao.js';

const ativo = (id, nome, extra = {}) => ({ id, nome, situacao: 'ativo', ...extra });
const arquivado = (id, nome, extra = {}) => ({ id, nome, situacao: 'arquivado', posicao: null, ...extra });

// ---------- nome (issue 239) ----------

test('nome: vazio ou só espaços é recusado', () => {
  for (const v of [null, undefined, '', '   ', '\t\n']) {
    assert.deepEqual(validarNome(v, []), { erro: 'Informe o nome no relatório.' });
  }
});

test('nome: espaços nas pontas saem do valor gravado', () => {
  assert.deepEqual(validarNome('  WO PAGO  ', []), { valor: 'WO PAGO' });
});

test('nome: até 40 caracteres (acento conta como um)', () => {
  assert.deepEqual(validarNome('Ç'.repeat(40), []), { valor: 'Ç'.repeat(40) });
  assert.deepEqual(validarNome('a'.repeat(41), []), { erro: 'Nome no relatório deve ter até 40 caracteres.' });
});

test('nome: "sem funil" é reservado em qualquer grafia', () => {
  for (const v of ['sem funil', 'SEM FUNIL', ' Sem  Funil ', 'sem-funil', 'sem_funil', 'sém fúnil']) {
    assert.deepEqual(validarNome(v, []), { erro: 'Esse nome é reservado para o bloco do que não foi classificado.' });
  }
});

test('nome: igual a um ativo, sem diferenciar caixa e acento', () => {
  const outros = [ativo(1, 'AQUISIÇÃO')];
  for (const v of ['aquisicao', 'Aquisição', 'AQUISICAO']) {
    assert.deepEqual(validarNome(v, outros), { erro: 'Já existe um funil com esse nome.' });
  }
});

test('nome: igual a um arquivado pede para reativar', () => {
  assert.deepEqual(validarNome('live', [arquivado(2, 'LIVE')]), {
    erro: 'Existe um funil arquivado com esse nome — reative-o em vez de criar outro.',
  });
});

test('nome: ativo com o mesmo nome vence a mensagem do arquivado', () => {
  assert.deepEqual(validarNome('SE', [arquivado(1, 'SE'), ativo(2, 'se')]), { erro: 'Já existe um funil com esse nome.' });
});

test('nome: na reativação só os ativos contam', () => {
  assert.deepEqual(validarNome('LIVE', [arquivado(2, 'LIVE')], { contraArquivados: false }), { valor: 'LIVE' });
  assert.deepEqual(validarNome('LIVE', [ativo(3, 'live')], { contraArquivados: false }), { erro: 'Já existe um funil com esse nome.' });
});

test('nome: sem conflito passa; normalização colapsa espaços', () => {
  assert.deepEqual(validarNome('WO  PAGO', [ativo(1, 'SE')]), { valor: 'WO  PAGO' });
  assert.equal(normalizarNome('  WO   Págô '), 'wo pago');
  assert.deepEqual(validarNome('wo pago', [ativo(1, 'WO   PAGO')]), { erro: 'Já existe um funil com esse nome.' });
});

// ---------- tipo de medição e origem do lead (issue 240) ----------

test('tipo: ausente, vazio ou desconhecido é recusado', () => {
  for (const tipo of [undefined, null, '', '  ', 'venda', 'toString']) {
    assert.deepEqual(validarTipoEOrigem({ tipo, origem_lead: 'qualquer' }), { erro: 'Escolha o tipo de medição.' });
  }
  assert.deepEqual(validarTipoEOrigem(), { erro: 'Escolha o tipo de medição.' });
});

test('tipo lead_mql exige origem válida', () => {
  for (const origem_lead of [undefined, null, '', 'organico']) {
    assert.deepEqual(validarTipoEOrigem({ tipo: 'lead_mql', origem_lead }), { erro: 'Escolha a origem do lead.' });
  }
  assert.deepEqual(validarTipoEOrigem({ tipo: ' lead_mql ', origem_lead: ' exceto_trafego_pago ' }), {
    valor: { tipo: 'lead_mql', origem_lead: 'exceto_trafego_pago' },
  });
});

test('manual e venda_greenn descartam a origem, mesmo inválida', () => {
  assert.deepEqual(validarTipoEOrigem({ tipo: 'manual', origem_lead: 'trafego_pago' }), { valor: { tipo: 'manual', origem_lead: null } });
  assert.deepEqual(validarTipoEOrigem({ tipo: 'venda_greenn', origem_lead: 'lixo' }), { valor: { tipo: 'venda_greenn', origem_lead: null } });
});

test('funil do tracking não se aplica ao venda_greenn', () => {
  assert.equal(campoAplica('lead_mql', 'funil_tracking'), true);
  assert.equal(campoAplica('manual', 'funil_tracking'), true);
  assert.equal(campoAplica('venda_greenn', 'funil_tracking'), false);
  assert.equal(campoAplica('lead_mql', 'origem_lead'), true);
  assert.equal(campoAplica('manual', 'origem_lead'), false);
  assert.equal(campoAplica('desconhecido', 'funil_tracking'), false);
  assert.deepEqual(Object.keys(CAMPOS_POR_TIPO).sort(), ['lead_mql', 'manual', 'venda_greenn']);
});

// ---------- funil do tracking (issue 241) ----------

const CONHECIDOS = ['diagnostico', 'lives-semanais-v1', 'sessao-estrategica'];

test('funil do tracking: venda_greenn não exige e descarta o valor', () => {
  assert.deepEqual(validarFunilTracking('venda_greenn', 'workshop', [], { funisConhecidos: CONHECIDOS }), { valor: null });
  assert.deepEqual(validarFunilTracking('venda_greenn', '', []), { valor: null });
});

test('funil do tracking: obrigatório em lead_mql e manual', () => {
  for (const tipo of ['lead_mql', 'manual']) {
    for (const v of [undefined, null, '', '   ']) {
      assert.deepEqual(validarFunilTracking(tipo, v, [], { funisConhecidos: CONHECIDOS }), { erro: 'Escolha o funil do tracking.' });
    }
  }
});

test('funil do tracking: fora da lista é desconhecido; aquisicao sempre vale', () => {
  assert.deepEqual(validarFunilTracking('lead_mql', 'workshop-pago', [], { funisConhecidos: CONHECIDOS }), { erro: 'Funil do tracking desconhecido.' });
  assert.deepEqual(validarFunilTracking('lead_mql', ' aquisicao ', [], { funisConhecidos: CONHECIDOS }), { valor: 'aquisicao' });
  assert.deepEqual(validarFunilTracking('manual', 'lives-semanais-v1', [], { funisConhecidos: CONHECIDOS }), { valor: 'lives-semanais-v1' });
  // Sem lista (reativação): não confere existência.
  assert.deepEqual(validarFunilTracking('manual', 'funil-antigo', []), { valor: 'funil-antigo' });
});

test('funil do tracking: já usado por outro ativo é recusado', () => {
  const outros = [ativo(1, 'SE', { funil_tracking: 'sessao-estrategica' })];
  assert.deepEqual(validarFunilTracking('manual', 'sessao-estrategica', outros, { funisConhecidos: CONHECIDOS }), {
    erro: 'Esse funil do tracking já pertence ao bloco SE.',
  });
});

test('funil do tracking: arquivado e venda na Greenn (vazio) não conflitam', () => {
  const outros = [
    arquivado(1, 'SE antigo', { funil_tracking: 'sessao-estrategica' }),
    ativo(2, 'WO PAGO', { tipo: 'venda_greenn', funil_tracking: null }),
  ];
  assert.deepEqual(validarFunilTracking('lead_mql', 'sessao-estrategica', outros, { funisConhecidos: CONHECIDOS }), { valor: 'sessao-estrategica' });
});

// ---------- opção do CRM × origem do lead (issue 242) ----------

const SESSAO = { id: 'a158', nome: 'SESSÃO ESTRATÉGICA' };
const LIVES = { id: 'e689', nome: 'LIVES SEMANAIS' };
const WO = { id: '4208', nome: 'WO PAGO' };
const CRM = [SESSAO, LIVES, WO];
const comOpcoes = (...ops) => JSON.stringify(ops);

test('opção do CRM: ao menos uma', () => {
  for (const v of [undefined, null, [], [''], [{ id: '' }]]) {
    assert.deepEqual(validarOpcoesCrm({ tipo: 'manual' }, v, [], { opcoesCrm: CRM }), { erro: 'Escolha ao menos uma opção do campo Funil do CRM.' });
  }
});

test('opção do CRM: precisa existir no CRM; o nome gravado é o do CRM', () => {
  assert.deepEqual(validarOpcoesCrm({ tipo: 'manual' }, ['e689', 'sumiu'], [], { opcoesCrm: CRM }), { erro: 'Essa opção não existe no CRM.' });
  assert.deepEqual(validarOpcoesCrm({ tipo: 'manual' }, [{ id: 'e689', nome: 'inventado' }, 'e689', 'a158'], [], { opcoesCrm: CRM }), {
    valor: [LIVES, SESSAO],
  });
});

test('opção do CRM: sem opções do CRM (reativação) mantém o nome gravado', () => {
  assert.deepEqual(validarOpcoesCrm({ tipo: 'manual' }, [{ id: 'x1', nome: 'ANTIGA' }], []), { valor: [{ id: 'x1', nome: 'ANTIGA' }] });
});

test('origens: só tráfego pago × exceto tráfego pago são disjuntas', () => {
  assert.equal(origensSobrepoem('trafego_pago', 'exceto_trafego_pago'), false);
  assert.equal(origensSobrepoem('exceto_trafego_pago', 'trafego_pago'), false);
  assert.equal(origensSobrepoem('trafego_pago', 'trafego_pago'), true);
  assert.equal(origensSobrepoem('qualquer', 'trafego_pago'), true);
  assert.equal(origensSobrepoem('exceto_trafego_pago', 'qualquer'), true);
});

test('mesma opção em dois lead_mql com origens disjuntas é aceita (SE × AQUISIÇÃO)', () => {
  const outros = [ativo(1, 'SE', { tipo: 'lead_mql', origem_lead: 'trafego_pago', opcoes_crm: comOpcoes(SESSAO) })];
  assert.deepEqual(validarOpcoesCrm({ tipo: 'lead_mql', origem_lead: 'exceto_trafego_pago' }, ['a158'], outros, { opcoesCrm: CRM }), { valor: [SESSAO] });
});

test('mesma opção com origens que se sobrepõem é recusada', () => {
  const outros = [ativo(1, 'SE', { tipo: 'lead_mql', origem_lead: 'trafego_pago', opcoes_crm: comOpcoes(SESSAO) })];
  const msg = { erro: 'A opção SESSÃO ESTRATÉGICA com essa origem já pertence ao bloco SE.' };
  assert.deepEqual(validarOpcoesCrm({ tipo: 'lead_mql', origem_lead: 'trafego_pago' }, ['a158'], outros, { opcoesCrm: CRM }), msg);
  assert.deepEqual(validarOpcoesCrm({ tipo: 'lead_mql', origem_lead: 'qualquer' }, ['a158'], outros, { opcoesCrm: CRM }), msg);
  const outrosQualquer = [ativo(1, 'SE', { tipo: 'lead_mql', origem_lead: 'qualquer', opcoes_crm: comOpcoes(SESSAO) })];
  assert.deepEqual(validarOpcoesCrm({ tipo: 'lead_mql', origem_lead: 'exceto_trafego_pago' }, ['a158'], outrosQualquer, { opcoesCrm: CRM }), msg);
});

test('manual e venda na Greenn ocupam a opção inteira, dos dois lados', () => {
  const live = [ativo(2, 'LIVE', { tipo: 'manual', origem_lead: null, opcoes_crm: comOpcoes(LIVES) })];
  assert.deepEqual(validarOpcoesCrm({ tipo: 'lead_mql', origem_lead: 'trafego_pago' }, ['e689'], live, { opcoesCrm: CRM }), {
    erro: 'A opção LIVES SEMANAIS com essa origem já pertence ao bloco LIVE.',
  });
  const se = [ativo(1, 'SE', { tipo: 'lead_mql', origem_lead: 'trafego_pago', opcoes_crm: comOpcoes(SESSAO) })];
  assert.deepEqual(validarOpcoesCrm({ tipo: 'venda_greenn', origem_lead: null }, ['4208', 'a158'], se, { opcoesCrm: CRM }), {
    erro: 'A opção SESSÃO ESTRATÉGICA com essa origem já pertence ao bloco SE.',
  });
});

test('opção de funil arquivado ou linha ilegível não conflita', () => {
  const outros = [
    arquivado(1, 'WO antigo', { tipo: 'venda_greenn', opcoes_crm: comOpcoes(WO) }),
    ativo(2, 'Quebrado', { tipo: 'manual', opcoes_crm: '{' }),
  ];
  assert.deepEqual(validarOpcoesCrm({ tipo: 'venda_greenn', origem_lead: null }, ['4208'], outros, { opcoesCrm: CRM }), { valor: [WO] });
});

// ---------- trecho do nome da campanha (issue 243) ----------

test('trecho: vazio é aceito como null', () => {
  for (const v of [undefined, null, '', '   ']) {
    assert.deepEqual(validarTrecho(v, []), { valor: null });
  }
});

test('trecho: ao menos 4 caracteres sem contar espaços', () => {
  const msg = { erro: 'O trecho precisa ter ao menos 4 caracteres.' };
  assert.deepEqual(validarTrecho('ws', []), msg);
  assert.deepEqual(validarTrecho(' a b c ', []), msg);
  assert.deepEqual(validarTrecho('  live ', []), { valor: 'live' });
  assert.deepEqual(validarTrecho('açãó', []), { valor: 'açãó' });
});

test('trecho: igual, contido ou que contém o de outro ativo (sem caixa)', () => {
  const outros = [ativo(3, 'WO PAGO', { trecho_campanha: 'workshop-pago' })];
  const msg = { erro: 'Esse trecho se sobrepõe ao do bloco WO PAGO.' };
  assert.deepEqual(validarTrecho('WORKSHOP-PAGO', outros), msg);
  assert.deepEqual(validarTrecho('shop-pa', outros), msg);
  assert.deepEqual(validarTrecho('vendas-workshop-pago-23-09', outros), msg);
});

test('trecho: arquivado ou ativo sem trecho não conflita', () => {
  const outros = [
    arquivado(3, 'WO antigo', { trecho_campanha: 'workshop-pago' }),
    ativo(1, 'SE', { trecho_campanha: null }),
  ];
  assert.deepEqual(validarTrecho('workshop-pago', outros), { valor: 'workshop-pago' });
});

// ---------- venda na Greenn única (issue 244) ----------

test('venda na Greenn: segundo funil ativo do tipo é recusado', () => {
  const outros = [ativo(3, 'WO PAGO', { tipo: 'venda_greenn' })];
  assert.deepEqual(validarVendaGreennUnica('venda_greenn', outros), {
    erro: 'Já existe um funil de venda na Greenn (WO PAGO). Hoje as vendas da Greenn não são separadas por produto.',
  });
});

test('venda na Greenn: arquivado não conta; outros tipos passam', () => {
  assert.deepEqual(validarVendaGreennUnica('venda_greenn', [arquivado(3, 'WO PAGO', { tipo: 'venda_greenn' })]), { valor: 'venda_greenn' });
  assert.deepEqual(validarVendaGreennUnica('venda_greenn', []), { valor: 'venda_greenn' });
  assert.deepEqual(validarVendaGreennUnica('manual', [ativo(3, 'WO PAGO', { tipo: 'venda_greenn' })]), { valor: 'manual' });
});

// ---------- funil inteiro (issue 245) ----------

const CTX = { funisConhecidos: CONHECIDOS, opcoesCrm: CRM };
const gravada = (id, v) => ({ id, situacao: 'ativo', posicao: id, ...v, opcoes_crm: JSON.stringify(v.opcoes_crm) });

test('funil: o cadastro inicial passa, um de cada vez, na ordem', () => {
  const entradas = [
    { nome: 'SE', tipo: 'lead_mql', funil_tracking: 'sessao-estrategica', opcoes_crm: ['a158'], origem_lead: 'trafego_pago', trecho_campanha: '' },
    { nome: 'LIVE', tipo: 'manual', funil_tracking: 'lives-semanais-v1', opcoes_crm: ['e689'], origem_lead: 'qualquer', trecho_campanha: null },
    { nome: 'WO PAGO', tipo: 'venda_greenn', funil_tracking: 'sessao-estrategica', opcoes_crm: ['4208'], trecho_campanha: ' workshop-pago ' },
    { nome: 'AQUISIÇÃO', tipo: 'lead_mql', funil_tracking: 'aquisicao', opcoes_crm: ['a158'], origem_lead: 'exceto_trafego_pago' },
  ];
  const linhas = [];
  for (const e of entradas) {
    const r = validarFunil(e, { ...CTX, outros: linhas });
    assert.ok(r.valor, `${e.nome}: ${r.erro}`);
    linhas.push(gravada(linhas.length + 1, r.valor));
  }
  assert.deepEqual(validarFunil(entradas[1], { ...CTX, outros: [] }).valor, {
    nome: 'LIVE', tipo: 'manual', funil_tracking: 'lives-semanais-v1', opcoes_crm: [LIVES], origem_lead: null, trecho_campanha: null,
  });
  // WO PAGO: funil do tracking e origem descartados; trecho aparado.
  assert.deepEqual(validarFunil(entradas[2], { ...CTX, outros: [] }).valor, {
    nome: 'WO PAGO', tipo: 'venda_greenn', funil_tracking: null, opcoes_crm: [WO], origem_lead: null, trecho_campanha: 'workshop-pago',
  });
});

test('funil: devolve a primeira recusa, na ordem do formulário', () => {
  assert.deepEqual(validarFunil({}, CTX), { erro: 'Informe o nome no relatório.' });
  assert.deepEqual(validarFunil({ nome: 'X' }, CTX), { erro: 'Escolha o tipo de medição.' });
  assert.deepEqual(validarFunil({ nome: 'X', tipo: 'lead_mql' }, CTX), { erro: 'Escolha a origem do lead.' });
  assert.deepEqual(validarFunil({ nome: 'X', tipo: 'manual' }, CTX), { erro: 'Escolha o funil do tracking.' });
  assert.deepEqual(validarFunil({ nome: 'X', tipo: 'manual', funil_tracking: 'diagnostico' }, CTX), { erro: 'Escolha ao menos uma opção do campo Funil do CRM.' });
  assert.deepEqual(validarFunil({ nome: 'X', tipo: 'manual', funil_tracking: 'diagnostico', opcoes_crm: ['e689'], trecho_campanha: 'ab' }, CTX), {
    erro: 'O trecho precisa ter ao menos 4 caracteres.',
  });
  assert.deepEqual(validarFunil(null, CTX), { erro: 'Informe o nome no relatório.' });
});

test('funil: segundo venda na Greenn é recusado mesmo com o resto válido', () => {
  const outros = [gravada(3, { nome: 'WO PAGO', tipo: 'venda_greenn', funil_tracking: null, opcoes_crm: [WO], origem_lead: null, trecho_campanha: 'workshop-pago' })];
  assert.deepEqual(validarFunil({ nome: 'WO 2', tipo: 'venda_greenn', opcoes_crm: ['e689'], trecho_campanha: 'mentoria-paga' }, { ...CTX, outros }), {
    erro: 'Já existe um funil de venda na Greenn (WO PAGO). Hoje as vendas da Greenn não são separadas por produto.',
  });
});

// ---------- campos do formulário por tipo (issue 246) ----------

test('formulário por tipo: campos e textos prontos para a tela', () => {
  assert.deepEqual(formularioPorTipo(), {
    lead_mql: { rotulo: 'Lead do formulário + MQL', funil_tracking: true, origem_lead: true, nota: null, aviso_sem_trecho: null },
    manual: {
      rotulo: 'Manual', funil_tracking: true, origem_lead: false,
      nota: 'O relatório vai trazer só o investimento deste funil; leads e custo aparecem como contagem manual.',
      aviso_sem_trecho: null,
    },
    venda_greenn: {
      rotulo: 'Venda na Greenn', funil_tracking: false, origem_lead: false, nota: null,
      aviso_sem_trecho: "Sem trecho, as campanhas deste produto podem cair em 'sem funil'.",
    },
  });
});

// ---------- edição (issue 247) ----------

test('edição: a própria linha fica fora de outros e não conflita consigo mesma', () => {
  const wo = gravada(3, { nome: 'WO PAGO', tipo: 'venda_greenn', funil_tracking: null, opcoes_crm: [WO], origem_lead: null, trecho_campanha: 'workshop-pago' });
  const se = gravada(1, { nome: 'SE', tipo: 'lead_mql', funil_tracking: 'sessao-estrategica', opcoes_crm: [SESSAO], origem_lead: 'trafego_pago', trecho_campanha: null });
  const linhas = [se, wo];
  const outros = linhas.filter((l) => l.id !== wo.id);
  const entrada = { nome: 'wo pago', tipo: 'venda_greenn', opcoes_crm: ['4208'], trecho_campanha: 'workshop-pago-23' };
  assert.equal(validarFunil(entrada, { ...CTX, outros }).valor.trecho_campanha, 'workshop-pago-23');
  // Renomear para o nome de outro ativo continua recusado.
  assert.deepEqual(validarFunil({ ...entrada, nome: 'Se' }, { ...CTX, outros }), { erro: 'Já existe um funil com esse nome.' });
});

// ---------- confirmação de edição que altera relatórios passados (issue 248) ----------

test('confirmação: só o nome (ou nada) mudou não pede confirmação', () => {
  const atual = gravada(1, { nome: 'SE', tipo: 'lead_mql', funil_tracking: 'sessao-estrategica', opcoes_crm: [SESSAO, LIVES], origem_lead: 'trafego_pago', trecho_campanha: 'workshop-pago' });
  const novo = { nome: 'SE 2', tipo: 'lead_mql', funil_tracking: 'sessao-estrategica', opcoes_crm: [LIVES, SESSAO], origem_lead: 'trafego_pago', trecho_campanha: 'Workshop-Pago' };
  assert.equal(precisaConfirmarEdicao(atual, novo), false);
  assert.equal(precisaConfirmarEdicao(atual, { ...novo, nome: 'SE' }), false);
});

test('confirmação: tipo, funil do tracking, opções, origem ou trecho pedem confirmação', () => {
  const atual = gravada(1, { nome: 'SE', tipo: 'lead_mql', funil_tracking: 'sessao-estrategica', opcoes_crm: [SESSAO], origem_lead: 'trafego_pago', trecho_campanha: null });
  const base = { nome: 'SE', tipo: 'lead_mql', funil_tracking: 'sessao-estrategica', opcoes_crm: [SESSAO], origem_lead: 'trafego_pago', trecho_campanha: null };
  for (const mudanca of [
    { tipo: 'manual', origem_lead: null },
    { funil_tracking: 'aquisicao' },
    { opcoes_crm: [SESSAO, LIVES] },
    { opcoes_crm: [LIVES] },
    { origem_lead: 'qualquer' },
    { trecho_campanha: 'sessao-paga' },
  ]) {
    assert.equal(precisaConfirmarEdicao(atual, { ...base, ...mudanca }), true, JSON.stringify(mudanca));
  }
  assert.equal(CONFIRMACAO_EDICAO, 'Esta mudança também altera os números de relatórios passados, se forem consultados de novo.');
});

// ---------- reativação (issue 251) ----------

const linhaWo = (id, extra = {}) => gravada(id, {
  nome: 'WO PAGO', tipo: 'venda_greenn', funil_tracking: null, opcoes_crm: [WO], origem_lead: null, trecho_campanha: 'workshop-pago', ...extra,
});

test('reativação: sem conflito com os ativos passa; arquivado homônimo não impede', () => {
  const arquivadoWo = { ...linhaWo(3), situacao: 'arquivado', posicao: null };
  const outros = [
    { ...linhaWo(9), situacao: 'arquivado', posicao: null },
    gravada(1, { nome: 'SE', tipo: 'lead_mql', funil_tracking: 'sessao-estrategica', opcoes_crm: [SESSAO], origem_lead: 'trafego_pago', trecho_campanha: null }),
  ];
  assert.deepEqual(validarReativacao(arquivadoWo, outros), { valor: true });
});

test('reativação: cada conflito com um ativo devolve a mensagem da criação', () => {
  const alvo = { ...linhaWo(3), situacao: 'arquivado', posicao: null };
  const casos = [
    [linhaWo(5, { opcoes_crm: [LIVES], trecho_campanha: 'mentoria-paga', tipo: 'manual', funil_tracking: 'x' }), 'Já existe um funil com esse nome.'],
    [linhaWo(5, { nome: 'Outro', tipo: 'manual', funil_tracking: 'x', trecho_campanha: null }), 'A opção WO PAGO com essa origem já pertence ao bloco Outro.'],
    [linhaWo(5, { nome: 'Outro', tipo: 'manual', funil_tracking: 'x', opcoes_crm: [LIVES], trecho_campanha: 'WORKSHOP' }), 'Esse trecho se sobrepõe ao do bloco Outro.'],
    [linhaWo(5, { nome: 'Outro', opcoes_crm: [LIVES], trecho_campanha: 'mentoria-paga' }), 'Já existe um funil de venda na Greenn (Outro). Hoje as vendas da Greenn não são separadas por produto.'],
  ];
  for (const [ativoConflitante, msg] of casos) {
    assert.deepEqual(validarReativacao(alvo, [ativoConflitante]), { erro: msg });
  }
  const live = { ...gravada(2, { nome: 'LIVE', tipo: 'manual', funil_tracking: 'lives-semanais-v1', opcoes_crm: [LIVES], origem_lead: null, trecho_campanha: null }), situacao: 'arquivado', posicao: null };
  const liveNova = gravada(6, { nome: 'LIVE 2', tipo: 'manual', funil_tracking: 'lives-semanais-v1', opcoes_crm: [SESSAO], origem_lead: null, trecho_campanha: null });
  assert.deepEqual(validarReativacao(live, [liveNova]), { erro: 'Esse funil do tracking já pertence ao bloco LIVE 2.' });
});

test('reativação: não confere existência do funil do tracking nem da opção no CRM', () => {
  const antigo = { ...gravada(7, { nome: 'Antigo', tipo: 'manual', funil_tracking: 'funil-sem-lead', opcoes_crm: [{ id: 'sumiu', nome: 'SUMIU' }], origem_lead: null, trecho_campanha: null }), situacao: 'arquivado', posicao: null };
  assert.deepEqual(validarReativacao(antigo, []), { valor: true });
});
