// Fluxos automáticos de e-mail (spec-email-proprio.md, módulo 9). PROTÓTIPO da issue 376.
//
// Quadro no estilo do construtor do ManyChat, feito em JS puro: cartões em HTML
// posicionados num "mundo" que recebe translate + scale, e as ligações em SVG
// por baixo, na mesma escala. Sem biblioteca: o visual segue o papel "Etiqueta"
// sem brigar com CSS de terceiros, e os gestos (arrastar a tela, mover cartão,
// ligar arrastando, pinça no celular) usam Pointer Events, que funcionam igual
// com mouse e com dedo.
//
// Nada é salvo: os fluxos vivem na memória da página, com dados de exemplo.
(() => {
  'use strict';

  const M = () => window.EmailMkt;
  const U = () => M().util;
  const D = () => M().dados;
  let ctx = null;

  const svg = (corpo) => `<svg viewBox="0 0 24 24" aria-hidden="true">${corpo}</svg>`;
  const IC = {
    inicio: svg('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>'),
    email: svg('<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M3 7l9 6 9-6"/>'),
    espera: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    desvio: svg('<path d="M5 4v4a4 4 0 0 0 4 4h10M15 8l4 4-4 4M5 12v8"/>'),
    objetivo: svg('<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>'),
    ir_fluxo: svg('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
    fim: svg('<rect x="6" y="6" width="12" height="12" rx="1"/>'),
    nota: svg('<path d="M5 4h14v11l-5 5H5zM14 20v-5h5"/>'),
    menos: svg('<path d="M5 12h14"/>'),
    mais: svg('<path d="M12 5v14M5 12h14"/>'),
    centro: svg('<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>'),
    organizar: svg('<rect x="3" y="4" width="6" height="5" rx="1"/><rect x="15" y="4" width="6" height="5" rx="1"/><rect x="15" y="15" width="6" height="5" rx="1"/><path d="M9 6.5h6M18 9v6"/>'),
    desfazer: svg('<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>'),
    refazer: svg('<path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>'),
    fechar: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
    voltar: svg('<path d="M15 6l-6 6 6 6"/>'),
    lixo: svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
    copiar: svg('<rect x="9" y="9" width="11" height="11" rx="1.5"/><path d="M5 15V5a1 1 0 0 1 1-1h9"/>'),
  };

  // ---------------------------------------------------------------------------
  // Catálogo: tipos de cartão, gatilhos e filtros (módulo 9)
  // ---------------------------------------------------------------------------
  const TIPOS = {
    inicio: { rotulo: 'Início', desc: 'O que coloca a pessoa no fluxo' },
    email: { rotulo: 'E-mail', desc: 'Manda um modelo de marketing' },
    espera: { rotulo: 'Espera', desc: 'Um tempo, um dia e hora ou até algo acontecer' },
    desvio: { rotulo: 'Desvio', desc: 'Divide em sim e não conforme condições' },
    objetivo: { rotulo: 'Objetivo', desc: 'Quem cumprir a condição pula para cá' },
    ir_fluxo: { rotulo: 'Ir para outro fluxo', desc: 'Tira daqui e coloca no início de outro' },
    fim: { rotulo: 'Fim', desc: 'A pessoa conclui o fluxo' },
  };
  const NOVOS = ['email', 'espera', 'desvio', 'objetivo', 'ir_fluxo', 'fim'];

  const FILTRO_VALORES = {
    funil: () => M().FUNIS,
    pagina: () => ['/workshop-gratuito', '/workshop-gratuito-v2', '/se-v2', '/aplicacao-mentoria', '/trafego-atacado'].map((p) => [p, p]),
    canal: () => M().ORIGENS.map((o) => [o, o]),
    utm_source: () => ['facebook', 'instagram', 'google', 'manychat'].map((p) => [p, p]),
    utm_campaign: () => ['wo-gratuito-perene', 'wo-gratuito-0810', 'se-conversao', 'remarketing-30d'].map((p) => [p, p]),
    utm_content: () => ['video-depoimento', 'carrossel-selos', 'stories-bastidor'].map((p) => [p, p]),
    formulario: () => [['plano-ao-vivo', 'Aplicação plano ao vivo 07/10'], ['mentoria', 'Aplicação mentoria']],
    material: () => [['icp', 'ICP do atacado'], ['catalogo', 'Catálogo da primeira compra'], ['sell-out', 'Sell-out'], ['black', 'Black do atacado']],
    produto: () => [['wo-pago', 'Workshop Black Exponencial'], ['mentoria', 'Mentoria'], ['plano', 'Plano ao vivo']],
    compra: () => [['aprovada', 'aprovada'], ['reembolsada', 'reembolsada'], ['cancelada', 'cancelada']],
    tipo: () => [['t1', 'Sessão estratégica'], ['t2', 'Diagnóstico de tráfego']],
    grupo: () => [['g1', 'Grupo do workshop 08/10'], ['g2', 'AVISOS Atacado Exponencial']],
    estagio: () => M().ESTAGIOS.map((e) => [e, e]),
    evento: () => [['clicou-cta', 'clicou no botão principal'], ['rolou-75', 'rolou 75% da página'], ['abriu-form', 'abriu o formulário']],
    segmento: () => D().segmentos.map((s) => [s.id, s.nome]),
    campanha: () => D().campanhas.filter((c) => ['enviada', 'enviando'].includes(c.situacao)).map((c) => [c.id, c.nome]),
    acao: () => [['abriu', 'abriu'], ['clicou', 'clicou']],
  };
  const FILTRO_ROTULO = {
    funil: 'Funil', pagina: 'Página', canal: 'Canal', utm_source: 'UTM origem', utm_campaign: 'UTM campanha', utm_content: 'UTM anúncio',
    formulario: 'Formulário', material: 'Material', produto: 'Produto', compra: 'Situação da compra', tipo: 'Tipo de reunião', grupo: 'Grupo',
    estagio: 'Estágio', evento: 'Evento', segmento: 'Segmento', campanha: 'Campanha', acao: 'Fez',
  };
  const EVENTOS = {
    formulario: { rotulo: 'Preencheu formulário (virou lead)', curto: 'Virou lead', filtros: ['funil', 'pagina', 'canal', 'utm_source', 'utm_campaign', 'utm_content'], base: 1300 },
    aplicacao: { rotulo: 'Enviou aplicação', curto: 'Enviou aplicação', filtros: ['formulario'], base: 140 },
    material: { rotulo: 'Baixou material (isca)', curto: 'Baixou material', filtros: ['material'], base: 420 },
    compra: { rotulo: 'Comprou na Greenn', curto: 'Comprou', filtros: ['produto', 'compra'], base: 96 },
    agendou: { rotulo: 'Agendou reunião', curto: 'Agendou reunião', filtros: ['tipo'], base: 180 },
    cancelou: { rotulo: 'Cancelou reunião', curto: 'Cancelou reunião', filtros: ['tipo'], base: 34 },
    faltou: { rotulo: 'Faltou à reunião', curto: 'Faltou', filtros: ['tipo'], base: 41 },
    compareceu: { rotulo: 'Compareceu à reunião', curto: 'Compareceu', filtros: ['tipo'], base: 102 },
    grupo_entrou: { rotulo: 'Entrou num grupo de WhatsApp', curto: 'Entrou no grupo', filtros: ['grupo'], base: 610 },
    grupo_saiu: { rotulo: 'Saiu de um grupo de WhatsApp', curto: 'Saiu do grupo', filtros: ['grupo'], base: 75 },
    crm: { rotulo: 'Mudou de estágio no CRM', curto: 'Mudou de estágio', filtros: ['estagio'], base: 260 },
    site: { rotulo: 'Visitou página ou clicou num botão', curto: 'No site', filtros: ['pagina', 'evento'], base: 3100 },
    segmento: { rotulo: 'Entrou num segmento', curto: 'Entrou no segmento', filtros: ['segmento'], base: 220 },
    campanha: { rotulo: 'Abriu ou clicou numa campanha', curto: 'Campanha', filtros: ['acao', 'campanha'], base: 700 },
  };
  const valorRot = (campo, v) => ((FILTRO_VALORES[campo] ? FILTRO_VALORES[campo]() : []).find((o) => o[0] === v) || [v, v])[1];

  const saidasDe = (n) => {
    if (n.tipo === 'inicio') return [['proximo', 'Quando entra']];
    if (n.tipo === 'email') return [['proximo', 'Depois de enviar']];
    if (n.tipo === 'espera') return n.dados.modo === 'evento' ? [['aconteceu', 'Aconteceu'], ['nao_aconteceu', 'Não aconteceu no prazo']] : [['proximo', 'Depois da espera']];
    if (n.tipo === 'desvio') return [['sim', 'Sim'], ['nao', 'Não']];
    if (n.tipo === 'objetivo') return [['proximo', 'Depois do objetivo']];
    return [];
  };

  // ---------------------------------------------------------------------------
  // Fluxos de exemplo
  // ---------------------------------------------------------------------------
  const DIAS = [['1', 'segunda'], ['2', 'terça'], ['3', 'quarta'], ['4', 'quinta'], ['5', 'sexta'], ['6', 'sábado'], ['0', 'domingo']];
  const janela = (ligada = true) => ({ ligada, de: '08:00', ate: '20:00' });
  const FLUXOS = [
    {
      id: 'f1', nome: 'Boas-vindas do workshop gratuito', situacao: 'ativo', dentro: 37, concluiram: 1102, clique: 14.6,
      nos: [
        { id: 'n1', tipo: 'inicio', x: 40, y: 150, dados: { gatilhos: [{ evento: 'formulario', filtros: [{ campo: 'funil', valor: 'workshop-gratuito' }] }] } },
        { id: 'n2', tipo: 'email', x: 360, y: 150, dados: { modelo: 'm7' } },
        { id: 'n3', tipo: 'espera', x: 680, y: 150, dados: { modo: 'tempo', qtd: 1, unidade: 'dias', janela: janela() } },
        { id: 'n4', tipo: 'desvio', x: 1000, y: 150, dados: { juncao: 'e', condicoes: [{ tipo: 'abriu', ref: 'n2' }] } },
        { id: 'n5', tipo: 'email', x: 1330, y: 20, dados: { modelo: 'm8' } },
        { id: 'n6', tipo: 'email', x: 1330, y: 330, dados: { modelo: 'm9' } },
        { id: 'n7', tipo: 'objetivo', x: 1660, y: 170, dados: { evento: 'agendou', filtro: 't1' } },
        { id: 'n8', tipo: 'fim', x: 1990, y: 200, dados: {} },
      ],
      arestas: [['n1', 'proximo', 'n2'], ['n2', 'proximo', 'n3'], ['n3', 'proximo', 'n4'], ['n4', 'sim', 'n5'], ['n4', 'nao', 'n6'], ['n5', 'proximo', 'n7'], ['n6', 'proximo', 'n7'], ['n7', 'proximo', 'n8']],
      notas: [{ id: 'o1', x: 660, y: 400, texto: 'Quem não abriu o primeiro e-mail recebe o mesmo convite com outro assunto. Quem agendar reunião em qualquer ponto pula direto para o objetivo.' }],
      stats: { n1: { entraram: 1284 }, n2: { receberam: 1284, abriram: 702, clicaram: 188 }, n3: { esperando: 37 }, n4: { sim: 655, nao: 592 }, n5: { receberam: 655, abriram: 401, clicaram: 97 }, n6: { receberam: 592, abriram: 141, clicaram: 22 }, n7: { chegaram: 74 }, n8: { concluiram: 1102 } },
    },
    {
      id: 'f2', nome: 'Pós-compra do workshop pago', situacao: 'pausado', dentro: 12, concluiram: 64, clique: 31.2,
      nos: [
        { id: 'n1', tipo: 'inicio', x: 40, y: 120, dados: { gatilhos: [{ evento: 'compra', filtros: [{ campo: 'produto', valor: 'wo-pago' }, { campo: 'compra', valor: 'aprovada' }] }] } },
        { id: 'n2', tipo: 'email', x: 360, y: 120, dados: { modelo: 'm7' } },
        { id: 'n3', tipo: 'espera', x: 680, y: 120, dados: { modo: 'dia', dia: '2', hora: '09:00', janela: janela(false) } },
        { id: 'n4', tipo: 'email', x: 1000, y: 120, dados: { modelo: 'm12' } },
        { id: 'n5', tipo: 'fim', x: 1320, y: 160, dados: {} },
      ],
      arestas: [['n1', 'proximo', 'n2'], ['n2', 'proximo', 'n3'], ['n3', 'proximo', 'n4'], ['n4', 'proximo', 'n5']],
      notas: [],
      stats: { n1: { entraram: 76 }, n2: { receberam: 76, abriram: 61, clicaram: 30 }, n3: { esperando: 12 }, n4: { receberam: 64, abriram: 44, clicaram: 18 }, n5: { concluiram: 64 } },
    },
    {
      id: 'f3', nome: 'Convite para sessão estratégica', situacao: 'ativo', mudancas: true, dentro: 58, concluiram: 233, clique: 9.8,
      nos: [
        { id: 'n1', tipo: 'inicio', x: 40, y: 140, dados: { gatilhos: [{ evento: 'crm', filtros: [{ campo: 'estagio', valor: 'MQL' }] }, { evento: 'aplicacao', filtros: [{ campo: 'formulario', valor: 'mentoria' }] }] } },
        { id: 'n2', tipo: 'email', x: 360, y: 140, dados: { modelo: 'm12' } },
        { id: 'n3', tipo: 'espera', x: 680, y: 140, dados: { modo: 'evento', evento: 'clicou', ref: 'n2', prazo: 3, unidade: 'dias', janela: janela() } },
        { id: 'n4', tipo: 'objetivo', x: 1010, y: 20, dados: { evento: 'agendou', filtro: 't1' } },
        { id: 'n5', tipo: 'ir_fluxo', x: 1010, y: 300, dados: { fluxo: 'f1' } },
        { id: 'n6', tipo: 'fim', x: 1330, y: 50, dados: {} },
      ],
      arestas: [['n1', 'proximo', 'n2'], ['n2', 'proximo', 'n3'], ['n3', 'aconteceu', 'n4'], ['n3', 'nao_aconteceu', 'n5'], ['n4', 'proximo', 'n6']],
      notas: [],
      stats: { n1: { entraram: 391 }, n2: { receberam: 391, abriram: 188, clicaram: 38 }, n3: { esperando: 58, aconteceu: 38, nao_aconteceu: 295 }, n4: { chegaram: 61 }, n5: { passaram: 272 }, n6: { concluiram: 233 } },
    },
    {
      id: 'f4', nome: 'Reengajar leads frios', situacao: 'rascunho', dentro: 0, concluiram: 0, clique: null,
      nos: [
        { id: 'n1', tipo: 'inicio', x: 40, y: 120, dados: { gatilhos: [] } },
        { id: 'n2', tipo: 'email', x: 360, y: 120, dados: { modelo: '' } },
        { id: 'n3', tipo: 'desvio', x: 680, y: 120, dados: { juncao: 'e', condicoes: [] } },
        { id: 'n4', tipo: 'espera', x: 360, y: 380, dados: { modo: 'tempo', qtd: 2, unidade: 'dias', janela: janela() } },
      ],
      arestas: [['n1', 'proximo', 'n2'], ['n2', 'proximo', 'n3']],
      notas: [{ id: 'o1', x: 700, y: 360, texto: 'Ideia: mandar o material de sell-out para quem não abriu nada em 60 dias.' }],
      stats: {},
    },
  ].map(prepararFluxo);

  let seq = 100;
  const novoId = (p) => p + (++seq);
  function prepararFluxo(f) {
    f.arestas = f.arestas.map((a, i) => (Array.isArray(a) ? { id: 'a' + i, de: a[0], saida: a[1], para: a[2] } : a));
    f.publicado = f.situacao === 'rascunho' ? null : instantaneo(f);
    if (f.mudancas) {
      // Exemplo de mudança não publicada: um e-mail novo antes de mandar para
      // outro fluxo. No ar, quem não clica ainda vai direto para o outro fluxo.
      f.nos.push({ id: 'n7', tipo: 'email', x: 1010, y: 300, dados: { modelo: 'm6' } });
      const ir = f.nos.find((n) => n.id === 'n5'); ir.x = 1330; ir.y = 330;
      f.arestas = f.arestas.filter((a) => !(a.de === 'n3' && a.saida === 'nao_aconteceu'));
      f.arestas.push({ id: 'a7', de: 'n3', saida: 'nao_aconteceu', para: 'n7' }, { id: 'a8', de: 'n7', saida: 'proximo', para: 'n5' });
    }
    f.salvoEm = '10:42';
    return f;
  }
  function instantaneo(f) { return JSON.stringify({ nos: f.nos, arestas: f.arestas, notas: f.notas }); }
  function restaurar(f, txt) { const o = JSON.parse(txt); f.nos = o.nos; f.arestas = o.arestas; f.notas = o.notas; }

  // ---------------------------------------------------------------------------
  // Estado do quadro
  // ---------------------------------------------------------------------------
  let F = null;                    // fluxo aberto
  let vis = { x: 40, y: 40, z: 1 }; // tela: deslocamento e zoom
  let sel = null;                   // cartão com o painel aberto
  let selAresta = null;
  let desfazer = [], refazer = [];
  let periodo = '30';
  const FATOR = { '7': 0.26, '30': 1, tudo: 2.7 };
  let el = null;                    // raiz da vista
  let opcoes = {};

  const $q = (s) => el.querySelector(s);
  const no = (id) => F.nos.find((n) => n.id === id);
  const esc = (s) => U().esc(s);
  const int = (n) => U().int(n);
  const modelo = (id) => D().modelos.find((m) => m.id === id);

  // ---------------------------------------------------------------------------
  // Entrada: lista de fluxos ou quadro
  // ---------------------------------------------------------------------------
  function render(raiz, c, op) {
    el = raiz; ctx = c; opcoes = op || {};
    if (F) return quadro();
    lista();
  }
  window.EmailFluxos = { render };

  function resumoGatilhos(f) {
    const g = f.nos.find((n) => n.tipo === 'inicio').dados.gatilhos;
    if (!g.length) return 'sem gatilho';
    return g.map((x) => EVENTOS[x.evento].curto + (x.filtros[0] ? ` (${valorRot(x.filtros[0].campo, x.filtros[0].valor)})` : '')).join(' ou ');
  }
  const SIT = { rascunho: ['Rascunho', 'neutro'], ativo: ['Ativo', 'alta'], pausado: ['Pausado', 'alerta'] };

  function lista() {
    const fluxos = opcoes.vazio ? FLUXOS.filter((f) => f.criadoAgora) : FLUXOS.filter((f) => !f.arquivado);
    el.innerHTML = `${U().seloProto(true)}
      <div class="em-barra"><p class="mini">Cada fluxo começa sozinho quando a pessoa faz algo (vira lead, compra, agenda). Sai pelo canal de marketing.</p>
        <button class="btn" type="button" data-novo>Novo fluxo</button></div>
      <div class="tabela-wrap" id="fx-lista"></div>`;
    $q('[data-novo]').onclick = () => {
      const f = prepararFluxo({ id: novoId('f'), nome: 'Fluxo sem nome', situacao: 'rascunho', dentro: 0, concluiram: 0, clique: null, criadoAgora: true,
        nos: [{ id: 'n1', tipo: 'inicio', x: 60, y: 140, dados: { gatilhos: [] } }], arestas: [], notas: [], stats: {} });
      FLUXOS.unshift(f);
      abrir(f, 'n1');
      U().avisar('Fluxo criado. Comece escolhendo o gatilho no cartão de início.');
    };
    const alvo = $q('#fx-lista');
    ctx.tabela(alvo, [
      { titulo: 'Fluxo', campo: 'nome', render: (f) => `<button type="button" class="ag-link-linha" data-acao="abrir" data-id="${f.id}">${esc(f.nome)}</button>${f.mudancas ? ' <span class="selo pago">mudanças não publicadas</span>' : ''}` },
      { titulo: 'Gatilhos', render: (f) => `<span class="mini">${esc(resumoGatilhos(f))}</span>` },
      { titulo: 'Situação', campo: 'situacao', render: (f) => U().carimbo(SIT, f.situacao) },
      { titulo: 'Dentro agora', num: true, campo: 'dentro', render: (f) => int(f.dentro) },
      { titulo: 'Concluíram', num: true, campo: 'concluiram', render: (f) => int(f.concluiram) },
      { titulo: 'Clique', num: true, campo: 'clique', render: (f) => (f.clique === null ? '' : U().pct(f.clique)) },
      { titulo: '', render: (f) => `<div class="ag-acoes ag-acoes--linha">${U().menuHtml(f.nome, [
        { acao: 'abrir', id: f.id, rotulo: 'Abrir quadro' },
        { acao: 'duplicar', id: f.id, rotulo: 'Duplicar' },
        f.situacao === 'ativo' && { acao: 'pausar', id: f.id, rotulo: 'Pausar' },
        f.situacao === 'pausado' && { acao: 'retomar', id: f.id, rotulo: 'Retomar' },
        { acao: 'arquivar', id: f.id, rotulo: 'Arquivar', perigo: true },
      ])}</div>` },
    ], fluxos, undefined, 'Nenhum fluxo ainda. Um fluxo junta gatilho, e-mails, esperas e desvios num quadro, como no ManyChat.');
    const achar = (id) => FLUXOS.find((f) => f.id === id);
    U().ligarAcoes(alvo, {
      abrir: (id) => abrir(achar(id)),
      duplicar: (id) => {
        const o = achar(id);
        const f = prepararFluxo({ ...JSON.parse(JSON.stringify(o)), id: novoId('f'), nome: o.nome + ' (cópia)', situacao: 'rascunho', mudancas: false, dentro: 0, concluiram: 0, clique: null, stats: {}, criadoAgora: true });
        FLUXOS.splice(FLUXOS.indexOf(o) + 1, 0, f);
        U().avisar('Fluxo duplicado como rascunho.'); lista();
      },
      pausar: (id) => { achar(id).situacao = 'pausado'; U().avisar('Fluxo pausado. Ninguém novo entra e quem está dentro parou onde estava.'); lista(); },
      retomar: (id) => { achar(id).situacao = 'ativo'; U().avisar('Fluxo retomado. Cada pessoa segue de onde parou, sem receber os e-mails acumulados.'); lista(); },
      arquivar: (id, b) => ctx.pedirConfirmacao(b, 'Arquivar o fluxo?', () => { const f = achar(id); f.arquivado = true; f.situacao = 'pausado'; U().avisar('Fluxo arquivado.'); lista(); }),
    });
  }

  function abrir(f, abrirNo) {
    F = f; sel = null; selAresta = null; desfazer = []; refazer = [];
    quadro();
    centralizar();
    if (abrirNo) selecionar(abrirNo);
    window.scrollTo(0, 0);
  }

  // ---------------------------------------------------------------------------
  // Quadro
  // ---------------------------------------------------------------------------
  function quadro() {
    el.innerHTML = `${U().seloProto(true)}
      <div class="fx-topo">
        <button class="btn sec em-voltar" type="button" data-voltar>${IC.voltar} Fluxos</button>
        <input class="fx-nome" type="text" value="${esc(F.nome)}" aria-label="Nome do fluxo">
        <div class="fx-situacao" id="fx-situacao"></div>
      </div>
      <div id="fx-problemas"></div>
      <div class="fx-area" id="fx-area">
        <div class="fx-quadro" id="fx-quadro" tabindex="0" aria-label="Quadro do fluxo. Arraste para mover a tela.">
          <div class="fx-mundo" id="fx-mundo">
            <svg class="fx-ligacoes" id="fx-ligacoes" width="1" height="1"></svg>
            <div class="fx-cartoes" id="fx-cartoes"></div>
          </div>
        </div>
        <div class="fx-ferramentas" role="toolbar" aria-label="Ferramentas do quadro">
          <button type="button" class="fx-ferr" data-f="menos" aria-label="Diminuir zoom" title="Diminuir zoom">${IC.menos}</button>
          <span class="fx-zoom" id="fx-zoom">100%</span>
          <button type="button" class="fx-ferr" data-f="mais" aria-label="Aumentar zoom" title="Aumentar zoom (Ctrl + rolar)">${IC.mais}</button>
          <button type="button" class="fx-ferr" data-f="centro" aria-label="Centralizar" title="Centralizar">${IC.centro}</button>
          <button type="button" class="fx-ferr" data-f="organizar" aria-label="Organizar automaticamente" title="Organizar automaticamente">${IC.organizar}</button>
          <span class="fx-sep"></span>
          <button type="button" class="fx-ferr" data-f="desfazer" aria-label="Desfazer" title="Desfazer (Ctrl+Z)">${IC.desfazer}</button>
          <button type="button" class="fx-ferr" data-f="refazer" aria-label="Refazer" title="Refazer (Ctrl+Y)">${IC.refazer}</button>
          <span class="fx-sep"></span>
          <button type="button" class="fx-ferr fx-ferr--txt" data-f="cartao">${IC.mais} Cartão</button>
          <button type="button" class="fx-ferr fx-ferr--txt" data-f="nota">${IC.nota} Nota</button>
          <select data-f="periodo" aria-label="Período dos números"><option value="7">7 dias</option><option value="30">30 dias</option><option value="tudo">Desde o início</option></select>
        </div>
        <div class="fx-mapa" id="fx-mapa" aria-label="Mapa em miniatura"><svg id="fx-mapa-svg"></svg></div>
        <aside class="fx-painel" id="fx-painel" hidden></aside>
        <div class="fx-escolha" id="fx-escolha" hidden></div>
      </div>
      <p class="mini fx-dica">Arraste o fundo para mover a tela · Ctrl + rolar ou pinça para zoom · arraste da bolinha de saída até outro cartão para ligar · clique no cartão para editar.</p>`;
    $q('[data-voltar]').onclick = () => { F = null; lista(); };
    $q('.fx-nome').onchange = (ev) => { mudar(() => { F.nome = ev.target.value.trim() || 'Fluxo sem nome'; }); };
    $q('[data-f="periodo"]').value = periodo;
    ligarFerramentas();
    ligarGestos();
    desenharTudo();
    aplicarVista();
  }

  function desenharTudo() {
    desenharCartoes();
    desenharArestas();
    desenharSituacao();
    desenharMapa();
    if (sel) desenharPainel();
  }

  // --- vista (zoom e deslocamento) ---
  function aplicarVista() {
    const mundo = $q('#fx-mundo'), q = $q('#fx-quadro');
    if (!mundo) return;
    mundo.style.transform = `translate(${vis.x}px, ${vis.y}px) scale(${vis.z})`;
    q.style.backgroundPosition = `${vis.x}px ${vis.y}px`;
    q.style.backgroundSize = `${22 * vis.z}px ${22 * vis.z}px`;
    $q('#fx-zoom').textContent = Math.round(vis.z * 100) + '%';
    desenharMapa();
  }
  function zoomEm(px, py, fator) {
    const z = Math.min(1.6, Math.max(0.3, vis.z * fator));
    vis.x = px - ((px - vis.x) * z) / vis.z;
    vis.y = py - ((py - vis.y) * z) / vis.z;
    vis.z = z;
    aplicarVista();
  }
  function limites() {
    const xs = [], ys = [];
    $q('#fx-cartoes').querySelectorAll('.fx-cartao, .fx-nota').forEach((c) => {
      const x = parseFloat(c.style.left), y = parseFloat(c.style.top);
      xs.push(x, x + c.offsetWidth); ys.push(y, y + c.offsetHeight);
    });
    if (!xs.length) return { x: 0, y: 0, w: 400, h: 300 };
    const x = Math.min(...xs), y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  }
  function centralizar() {
    const q = $q('#fx-quadro');
    const b = limites();
    const W = q.clientWidth, H = q.clientHeight;
    const pad = 40;
    // Cabe inteiro se der; senão, um zoom ainda legível começando pelo início.
    const caber = Math.min((W - pad * 2) / b.w, (H - pad * 2 - 40) / b.h);
    vis.z = Math.min(1, Math.max(W < 700 ? 0.55 : 0.68, caber));
    vis.x = b.w * vis.z > W - pad * 2 ? pad - b.x * vis.z : (W - b.w * vis.z) / 2 - b.x * vis.z;
    const topo = $q('.fx-ferramentas').offsetHeight + 24;
    const sobra = H - topo - pad;
    vis.y = b.h * vis.z > sobra || b.w * vis.z > W - pad * 2 ? topo - b.y * vis.z : topo + (sobra - b.h * vis.z) / 2 - b.y * vis.z;
    aplicarVista();
  }
  function focarNo(id) {
    const n = no(id), q = $q('#fx-quadro');
    if (!n) return;
    vis.z = Math.max(vis.z, 0.8);
    vis.x = q.clientWidth / 2 - (n.x + 120) * vis.z;
    vis.y = q.clientHeight / 2 - (n.y + 60) * vis.z;
    aplicarVista();
  }

  // --- mudanças, histórico e salvamento automático ---
  function mudar(fn, { redesenhar = true } = {}) {
    desfazer.push(instantaneo(F) + '\u0000' + F.nome);
    if (desfazer.length > 60) desfazer.shift();
    refazer = [];
    fn();
    marcarMudanca();
    if (redesenhar) desenharTudo();
  }
  function marcarMudanca() {
    if (F.situacao !== 'rascunho' && F.publicado) F.mudancas = instantaneo(F) !== F.publicado;
    F.salvoEm = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  function voltarEstado(de, para) {
    if (!de.length) return U().avisar('Nada para ' + (de === desfazer ? 'desfazer.' : 'refazer.'));
    para.push(instantaneo(F) + '\u0000' + F.nome);
    const [txt, nome] = de.pop().split('\u0000');
    restaurar(F, txt); F.nome = nome;
    $q('.fx-nome').value = nome;
    if (sel && !no(sel)) fecharPainel();
    marcarMudanca();
    desenharTudo();
  }

  // ---------------------------------------------------------------------------
  // Problemas (impedem publicar)
  // ---------------------------------------------------------------------------
  function problemas() {
    const lista = [];
    const ini = F.nos.find((n) => n.tipo === 'inicio');
    const alcance = new Set();
    const fila = [ini.id, ...F.nos.filter((n) => n.tipo === 'objetivo').map((n) => n.id)];
    while (fila.length) {
      const id = fila.shift();
      if (alcance.has(id)) continue;
      alcance.add(id);
      F.arestas.filter((a) => a.de === id).forEach((a) => fila.push(a.para));
    }
    F.nos.forEach((n) => {
      const p = [];
      if (n.tipo === 'inicio' && !n.dados.gatilhos.length) p.push('Sem gatilho');
      if (!alcance.has(n.id)) p.push('Solto');
      if (n.tipo === 'email' && !modelo(n.dados.modelo)) p.push('Sem modelo');
      if (n.tipo === 'desvio' && !n.dados.condicoes.length) p.push('Sem condição');
      if (n.tipo === 'ir_fluxo' && !n.dados.fluxo) p.push('Sem fluxo de destino');
      const soltas = saidasDe(n).filter(([s]) => !F.arestas.some((a) => a.de === n.id && a.saida === s));
      if (soltas.length) p.push(soltas.length > 1 ? 'Saídas sem destino' : 'Saída sem destino');
      if (p.length) lista.push({ no: n.id, textos: p });
    });
    return lista;
  }
  const EXPLICA_PROBLEMA = {
    'Sem gatilho': 'o início não tem gatilho', Solto: 'cartão solto, nada leva até ele', 'Sem modelo': 'e-mail sem modelo',
    'Sem condição': 'desvio sem condição', 'Sem fluxo de destino': 'falta escolher o fluxo de destino',
    'Saída sem destino': 'saída sem destino', 'Saídas sem destino': 'saídas sem destino',
  };

  function desenharSituacao() {
    const probs = problemas();
    const alvo = $q('#fx-situacao');
    const s = F.situacao;
    const pessoas = F.dentro ? `<button class="btn sec" type="button" data-s="pessoas">Pessoas no fluxo (${int(F.dentro)})</button>` : '';
    let estado = U().carimbo(SIT, s);
    let nota = '';
    let botoes = '';
    if (s === 'rascunho') {
      nota = `Rascunho salvo sozinho às ${F.salvoEm}. Ninguém entra até publicar.`;
      botoes = `<button class="btn sec" type="button" data-s="testar">Testar</button><button class="btn" type="button" data-s="publicar">Publicar</button>`;
    } else if (F.mudancas) {
      estado += ' <span class="carimbo alerta">Mudanças não publicadas</span>';
      nota = `Salvo às ${F.salvoEm}. O fluxo no ar segue a versão anterior até você publicar.`;
      botoes = `${pessoas}<button class="btn sec" type="button" data-s="testar">Testar</button><button class="btn perigo" type="button" data-s="descartar">Descartar mudanças</button><button class="btn" type="button" data-s="publicar">Publicar mudanças</button>`;
    } else if (s === 'ativo') {
      nota = 'No ar. Quem dispara o gatilho entra; quem já está dentro ou concluiu não entra de novo.';
      botoes = `${pessoas}<button class="btn sec" type="button" data-s="testar">Testar</button><button class="btn sec" type="button" data-s="pausar">Pausar</button>`;
    } else {
      nota = 'Pausado. Ninguém novo entra e quem está dentro parou onde estava.';
      botoes = `${pessoas}<button class="btn" type="button" data-s="retomar">Retomar</button>`;
    }
    if (probs.length) estado += ` <span class="carimbo queda">${probs.length} ${probs.length > 1 ? 'problemas' : 'problema'}</span>`;
    alvo.innerHTML = `<div class="fx-estado">${estado}<span class="mini">${nota}</span></div><div class="ag-acoes">${botoes}</div>`;
    const caixa = $q('#fx-problemas');
    caixa.innerHTML = probs.length ? `<div class="aviso alerta fx-probs"><b>Para publicar, falta resolver:</b> ${probs.map((p) => `<button type="button" class="argo-faixa-chamada" data-ir-no="${p.no}">${esc(rotuloNo(no(p.no)))}: ${p.textos.map((t) => EXPLICA_PROBLEMA[t]).join(', ')}</button>`).join(' · ')}</div>` : '';
    caixa.querySelectorAll('[data-ir-no]').forEach((b) => { b.onclick = () => { focarNo(b.dataset.irNo); selecionar(b.dataset.irNo); }; });
    alvo.querySelectorAll('[data-s]').forEach((b) => { b.onclick = () => acaoSituacao(b.dataset.s, b, probs); });
  }

  function rotuloNo(n) {
    if (!n) return '';
    if (n.tipo === 'email') { const m = modelo(n.dados.modelo); return m ? `E-mail "${m.nome}"` : 'E-mail'; }
    return TIPOS[n.tipo].rotulo;
  }

  function acaoSituacao(acao, b, probs) {
    if (acao === 'publicar') {
      if (probs.length) {
        U().avisar(`Não dá para publicar: ${probs.length} ${probs.length > 1 ? 'problemas marcados' : 'problema marcado'} no quadro.`, 'erro');
        focarNo(probs[0].no); selecionar(probs[0].no);
        return;
      }
      const eraRascunho = F.situacao === 'rascunho';
      F.situacao = 'ativo'; F.publicado = instantaneo(F); F.mudancas = false;
      U().avisar(eraRascunho ? 'Fluxo publicado. Quem disparar o gatilho a partir de agora entra; quem disparou antes fica de fora.' : 'Mudanças publicadas. Quem está dentro continua do cartão em que está.');
      desenharSituacao();
    } else if (acao === 'descartar') {
      ctx.pedirConfirmacao(b, 'Descartar tudo que não foi publicado?', () => {
        restaurar(F, F.publicado); F.mudancas = false; fecharPainel(); desenharTudo();
        U().avisar('Mudanças descartadas. O quadro voltou para a versão no ar.');
      });
    } else if (acao === 'pausar') {
      F.situacao = 'pausado'; desenharSituacao(); U().avisar('Fluxo pausado.');
    } else if (acao === 'retomar') {
      F.situacao = 'ativo'; desenharSituacao(); U().avisar('Fluxo retomado. Cada pessoa segue de onde parou, sem receber de uma vez os e-mails da pausa.');
    } else if (acao === 'testar') testar(probs);
    else if (acao === 'pessoas') pessoasNoFluxo();
  }

  // ---------------------------------------------------------------------------
  // Cartões
  // ---------------------------------------------------------------------------
  const fator = () => FATOR[periodo];
  const num = (v) => int(Math.round(v * fator()));
  function numerosHtml(n) {
    const s = (F.stats || {})[n.id];
    if (!s) return F.situacao === 'rascunho' ? '' : '<div class="fx-nums fx-nums--vazio">sem dados ainda</div>';
    const cel = (rot, v, extra = '') => `<div><span>${rot}</span><b>${v}</b>${extra ? `<small>${extra}</small>` : ''}</div>`;
    if (n.tipo === 'email') return `<div class="fx-nums">${cel('Receberam', num(s.receberam))}${cel('Abriram', num(s.abriram), U().pct((s.abriram / s.receberam) * 100, 0))}${cel('Clicaram', num(s.clicaram), U().pct((s.clicaram / s.receberam) * 100, 0))}</div>`;
    if (n.tipo === 'inicio') return `<div class="fx-nums">${cel('Entraram', num(s.entraram))}</div>`;
    if (n.tipo === 'espera') return `<div class="fx-nums"><button type="button" class="fx-esperando" data-esperando="${n.id}"><b>${int(s.esperando)}</b> esperando agora</button></div>`;
    if (n.tipo === 'objetivo') return `<div class="fx-nums">${cel('Chegaram', num(s.chegaram))}</div>`;
    if (n.tipo === 'fim') return `<div class="fx-nums">${cel('Concluíram', num(s.concluiram))}</div>`;
    if (n.tipo === 'ir_fluxo') return `<div class="fx-nums">${cel('Passaram', num(s.passaram))}</div>`;
    return '';
  }
  function corpoCartao(n) {
    const d = n.dados;
    if (n.tipo === 'inicio') {
      return d.gatilhos.length
        ? `<ul class="fx-gatilhos">${d.gatilhos.map((g) => `<li><b>${esc(EVENTOS[g.evento].rotulo)}</b>${g.filtros.length ? `<br><span class="mini">${g.filtros.map((f) => `${esc(FILTRO_ROTULO[f.campo].toLowerCase())}: ${esc(valorRot(f.campo, f.valor))}`).join(' · ')}</span>` : ''}</li>`).join('<li class="fx-ou">ou</li>')}</ul>`
        : '<p class="fx-vazio">Escolha o que coloca a pessoa neste fluxo.</p>';
    }
    if (n.tipo === 'email') {
      const m = modelo(d.modelo);
      return m ? `<p class="fx-assunto">${esc(m.assunto)}</p><p class="fx-previa">${esc(m.previa)}</p>` : '<p class="fx-vazio">Nenhum modelo escolhido.</p>';
    }
    if (n.tipo === 'espera') {
      let t = '';
      if (d.modo === 'tempo') t = `Espera <b>${d.qtd} ${d.unidade === 'dias' ? (d.qtd > 1 ? 'dias' : 'dia') : (d.qtd > 1 ? 'horas' : 'hora')}</b>`;
      else if (d.modo === 'dia') t = `Até a próxima <b>${DIAS.find((x) => x[0] === d.dia)[1]} às ${d.hora}</b>`;
      else t = `Até <b>${esc(rotuloEsperaEvento(d))}</b>, no máximo ${d.prazo} ${d.unidade}`;
      return `<p>${t}</p>${d.janela && d.janela.ligada ? `<p class="mini">só envia entre ${d.janela.de} e ${d.janela.ate}</p>` : ''}`;
    }
    if (n.tipo === 'desvio') {
      return d.condicoes.length
        ? `<ul class="fx-conds">${d.condicoes.map((c) => `<li>${esc(rotuloCondicao(c))}</li>`).join(`<li class="fx-ou">${d.juncao === 'ou' ? 'ou' : 'e'}</li>`)}</ul>`
        : '<p class="fx-vazio">Nenhuma condição.</p>';
    }
    if (n.tipo === 'objetivo') return `<p><b>${esc(EVENTOS[d.evento].rotulo)}</b>${d.filtro ? `<br><span class="mini">${esc(valorRot(EVENTOS[d.evento].filtros[0], d.filtro))}</span>` : ''}</p><p class="mini">Quem cumprir pula para cá, de onde estiver.</p>`;
    if (n.tipo === 'ir_fluxo') { const f = FLUXOS.find((x) => x.id === d.fluxo); return f ? `<p>Vai para <b>${esc(f.nome)}</b></p>` : '<p class="fx-vazio">Escolha o fluxo de destino.</p>'; }
    if (n.tipo === 'fim') return '<p class="mini">A pessoa conclui o fluxo.</p>';
    return '';
  }
  function rotuloEsperaEvento(d) {
    if (d.evento === 'abriu' || d.evento === 'clicou') { const r = no(d.ref); const m = r && modelo(r.dados.modelo); return `${d.evento === 'abriu' ? 'abrir' : 'clicar em'} ${m ? `"${m.nome}"` : 'um e-mail do fluxo'}`; }
    return (EVENTOS[d.evento] || { rotulo: d.evento }).rotulo.toLowerCase();
  }
  function rotuloCondicao(c) {
    if (c.tipo === 'abriu' || c.tipo === 'clicou') {
      const r = no(c.ref); const m = r && modelo(r.dados.modelo);
      return `${c.tipo === 'abriu' ? 'Abriu' : 'Clicou em'} ${m ? `"${m.nome}"` : 'um e-mail do fluxo'}${c.tipo === 'clicou' && c.link && c.link !== 'qualquer' ? ` (link ${c.link})` : ''}`;
    }
    if (c.tipo === 'segmento') return `Está no segmento "${valorRot('segmento', c.valor)}"`;
    const ev = EVENTOS[c.evento];
    return `${ev.rotulo}${c.valor ? ` (${valorRot(ev.filtros[0], c.valor)})` : ''}`;
  }

  function desenharCartoes() {
    const probs = Object.fromEntries(problemas().map((p) => [p.no, p.textos]));
    const html = F.nos.map((n) => {
      const sai = saidasDe(n);
      const st = (F.stats || {})[n.id] || {};
      const p = probs[n.id];
      const primeiro = p && p.find((t) => !t.startsWith('Saída'));
      return `<div class="fx-cartao fx-cartao--${n.tipo}${sel === n.id ? ' fx-sel' : ''}${primeiro ? ' fx-problema' : ''}" data-no="${n.id}" style="left:${n.x}px;top:${n.y}px">
        ${n.tipo === 'inicio' ? '' : '<span class="fx-entrada" aria-hidden="true"></span>'}
        ${primeiro ? `<span class="fx-selo-problema">${esc(primeiro)}</span>` : ''}
        <div class="fx-cabeca">${IC[n.tipo]}<span>${TIPOS[n.tipo].rotulo}</span></div>
        <div class="fx-corpo">${corpoCartao(n)}</div>
        ${numerosHtml(n)}
        ${sai.length ? `<div class="fx-saidas">${sai.map(([s, rot]) => {
          const ligada = F.arestas.some((a) => a.de === n.id && a.saida === s);
          const v = st[s];
          return `<div class="fx-saida"><span>${rot}${v !== undefined ? ` <b>${num(v)}</b>` : ''}</span>
            <span class="fx-porta${ligada ? ' fx-porta--ligada' : ''}" data-porta="${s}" title="Arraste até outro cartão para ligar"></span>
            ${ligada ? '' : `<button type="button" class="fx-mais" data-mais="${s}" aria-label="Adicionar cartão depois de ${esc(rot)}">${IC.mais}</button>`}</div>`;
        }).join('')}</div>` : ''}
      </div>`;
    }).join('') + F.notas.map((o) => `<div class="fx-nota" data-nota="${o.id}" style="left:${o.x}px;top:${o.y}px">
        <div class="fx-nota__cabeca">${IC.nota}<span>Nota</span><button type="button" class="fx-nota__tirar" data-tirar-nota="${o.id}" aria-label="Apagar nota">${IC.fechar}</button></div>
        <div class="fx-nota__texto" data-texto-nota="${o.id}">${esc(o.texto)}</div></div>`).join('');
    $q('#fx-cartoes').innerHTML = html + '<button type="button" class="fx-desligar" id="fx-desligar" hidden aria-label="Desligar">' + IC.fechar + '</button>';
  }

  // ---------------------------------------------------------------------------
  // Ligações (SVG)
  // ---------------------------------------------------------------------------
  function pontoTela(elm) {
    const r = elm.getBoundingClientRect(), m = $q('#fx-mundo').getBoundingClientRect();
    return { x: (r.left + r.width / 2 - m.left) / vis.z, y: (r.top + r.height / 2 - m.top) / vis.z };
  }
  function pontoSaida(id, saida) {
    const p = $q(`[data-no="${id}"] [data-porta="${saida}"]`);
    return p ? pontoTela(p) : null;
  }
  function pontoEntrada(id) { const n = no(id); return { x: n.x - 1, y: n.y + 22 }; }
  function curva(a, b) {
    const dx = Math.max(50, Math.abs(b.x - a.x) / 2);
    return `M${a.x} ${a.y} C${a.x + dx} ${a.y} ${b.x - dx} ${b.y} ${b.x} ${b.y}`;
  }
  function meio(a, b) {
    const dx = Math.max(50, Math.abs(b.x - a.x) / 2);
    const c1 = { x: a.x + dx, y: a.y }, c2 = { x: b.x - dx, y: b.y };
    return { x: 0.125 * a.x + 0.375 * c1.x + 0.375 * c2.x + 0.125 * b.x, y: 0.125 * a.y + 0.375 * c1.y + 0.375 * c2.y + 0.125 * b.y };
  }
  let linhaTemp = null;
  function desenharArestas() {
    let h = '<defs><marker id="fx-seta" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 1L9 5L0 9z" class="fx-seta"/></marker><marker id="fx-seta-sel" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 1L9 5L0 9z" class="fx-seta fx-seta--sel"/></marker></defs>';
    const botao = $q('#fx-desligar');
    if (botao) botao.hidden = true;
    F.arestas.forEach((a) => {
      if (!no(a.de) || !no(a.para)) return;
      const p1 = pontoSaida(a.de, a.saida);
      if (!p1) return;
      const p2 = pontoEntrada(a.para);
      const d = curva(p1, p2);
      const s = a.id === selAresta;
      h += `<path class="fx-aresta${s ? ' fx-aresta--sel' : ''}" d="${d}" marker-end="url(#${s ? 'fx-seta-sel' : 'fx-seta'})"/><path class="fx-aresta-alvo" data-aresta="${a.id}" d="${d}"/>`;
      if (s && botao) { const m = meio(p1, p2); botao.hidden = false; botao.style.left = m.x + 'px'; botao.style.top = m.y + 'px'; botao.dataset.aresta = a.id; }
    });
    if (linhaTemp) h += `<path class="fx-aresta fx-aresta--temp" d="${curva(linhaTemp.a, linhaTemp.b)}"/>`;
    $q('#fx-ligacoes').innerHTML = h;
  }
  function ligar(de, saida, para) {
    if (de === para) return U().avisar('Um cartão não pode ligar nele mesmo.', 'erro');
    if (no(para).tipo === 'inicio') return U().avisar('Nada pode levar de volta ao início.', 'erro');
    mudar(() => {
      F.arestas = F.arestas.filter((a) => !(a.de === de && a.saida === saida));
      F.arestas.push({ id: novoId('a'), de, saida, para });
    });
  }

  // ---------------------------------------------------------------------------
  // Mapa em miniatura
  // ---------------------------------------------------------------------------
  let mapaEscala = null;
  let teclado = null;
  function desenharMapa() {
    const s = $q('#fx-mapa-svg');
    if (!s) return;
    const b = limites();
    const q = $q('#fx-quadro');
    const view = { x: -vis.x / vis.z, y: -vis.y / vis.z, w: q.clientWidth / vis.z, h: q.clientHeight / vis.z };
    const x0 = Math.min(b.x, view.x) - 40, y0 = Math.min(b.y, view.y) - 40;
    const x1 = Math.max(b.x + b.w, view.x + view.w) + 40, y1 = Math.max(b.y + b.h, view.y + view.h) + 40;
    mapaEscala = { x0, y0, w: x1 - x0, h: y1 - y0 };
    s.setAttribute('viewBox', `${x0} ${y0} ${x1 - x0} ${y1 - y0}`);
    s.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    const probs = new Set(problemas().filter((p) => p.textos.some((t) => !t.startsWith('Saída'))).map((p) => p.no));
    s.innerHTML = $q('#fx-cartoes') ? [...$q('#fx-cartoes').querySelectorAll('.fx-cartao, .fx-nota')].map((c) => {
      const tipo = c.dataset.no ? no(c.dataset.no).tipo : 'nota';
      return `<rect x="${parseFloat(c.style.left)}" y="${parseFloat(c.style.top)}" width="${c.offsetWidth}" height="${c.offsetHeight}" class="fx-mapa-no fx-mapa-no--${tipo}${probs.has(c.dataset.no) ? ' fx-mapa-no--prob' : ''}"/>`;
    }).join('') + `<rect x="${view.x}" y="${view.y}" width="${view.w}" height="${view.h}" class="fx-mapa-vista"/>` : '';
  }
  function irPeloMapa(ev) {
    const s = $q('#fx-mapa-svg');
    const r = s.getBoundingClientRect();
    const k = Math.min(r.width / mapaEscala.w, r.height / mapaEscala.h);
    const ox = (r.width - mapaEscala.w * k) / 2, oy = (r.height - mapaEscala.h * k) / 2;
    const wx = mapaEscala.x0 + (ev.clientX - r.left - ox) / k, wy = mapaEscala.y0 + (ev.clientY - r.top - oy) / k;
    const q = $q('#fx-quadro');
    vis.x = q.clientWidth / 2 - wx * vis.z;
    vis.y = q.clientHeight / 2 - wy * vis.z;
    aplicarVista();
  }

  // ---------------------------------------------------------------------------
  // Gestos: arrastar a tela, mover cartão/nota, ligar, pinça
  // ---------------------------------------------------------------------------
  function ligarGestos() {
    const q = $q('#fx-quadro');
    const area = $q('#fx-area');
    const ponteiros = new Map();
    let acao = null;
    const local = (ev) => { const r = q.getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; };

    q.addEventListener('pointerdown', (ev) => {
      if (ev.pointerType === 'mouse' && ev.button !== 0) return;
      fecharEscolha();
      ponteiros.set(ev.pointerId, local(ev));
      if (ponteiros.size === 2) {
        const [a, b] = [...ponteiros.values()];
        acao = { tipo: 'pinca', dist: Math.hypot(a.x - b.x, a.y - b.y), z: vis.z };
        linhaTemp = null;
        return;
      }
      const porta = ev.target.closest('[data-porta]');
      if (porta) {
        const id = porta.closest('[data-no]').dataset.no;
        acao = { tipo: 'ligar', de: id, saida: porta.dataset.porta };
        linhaTemp = { a: pontoSaida(id, porta.dataset.porta), b: pontoSaida(id, porta.dataset.porta) };
        q.setPointerCapture(ev.pointerId);
        ev.preventDefault();
        return;
      }
      const aresta = ev.target.closest('[data-aresta]');
      if (aresta) { selAresta = aresta.dataset.aresta; desenharArestas(); return; }
      if (ev.target.closest('button, input, select, textarea, [contenteditable="true"]')) return;
      const item = ev.target.closest('.fx-cartao, .fx-nota');
      const p = local(ev);
      if (item) {
        const obj = item.dataset.no ? no(item.dataset.no) : F.notas.find((o) => o.id === item.dataset.nota);
        acao = { tipo: 'mover', item, obj, ini: p, orig: { x: obj.x, y: obj.y }, moveu: false, antes: instantaneo(F) + '\u0000' + F.nome };
      } else {
        acao = { tipo: 'tela', ini: p, orig: { x: vis.x, y: vis.y }, moveu: false };
      }
      q.setPointerCapture(ev.pointerId);
    });

    q.addEventListener('pointermove', (ev) => {
      if (!ponteiros.has(ev.pointerId)) return;
      const p = local(ev);
      ponteiros.set(ev.pointerId, p);
      if (!acao) return;
      if (acao.tipo === 'pinca' && ponteiros.size === 2) {
        const [a, b] = [...ponteiros.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        zoomEm((a.x + b.x) / 2, (a.y + b.y) / 2, (acao.z * dist) / acao.dist / vis.z);
        return;
      }
      if (acao.tipo === 'ligar') {
        const m = $q('#fx-mundo').getBoundingClientRect();
        linhaTemp.b = { x: (ev.clientX - m.left) / vis.z, y: (ev.clientY - m.top) / vis.z };
        const alvo = document.elementFromPoint(ev.clientX, ev.clientY);
        q.querySelectorAll('.fx-alvo').forEach((c) => c.classList.remove('fx-alvo'));
        const c = alvo && alvo.closest('.fx-cartao');
        if (c && c.dataset.no !== acao.de && no(c.dataset.no).tipo !== 'inicio') c.classList.add('fx-alvo');
        desenharArestas();
        return;
      }
      const dx = p.x - acao.ini.x, dy = p.y - acao.ini.y;
      if (!acao.moveu && Math.hypot(dx, dy) < 4) return;
      acao.moveu = true;
      if (acao.tipo === 'tela') { vis.x = acao.orig.x + dx; vis.y = acao.orig.y + dy; aplicarVista(); }
      if (acao.tipo === 'mover') {
        acao.obj.x = Math.round(acao.orig.x + dx / vis.z);
        acao.obj.y = Math.round(acao.orig.y + dy / vis.z);
        acao.item.style.left = acao.obj.x + 'px';
        acao.item.style.top = acao.obj.y + 'px';
        acao.item.classList.add('fx-arrastando');
        desenharArestas();
      }
    });

    const soltar = (ev) => {
      ponteiros.delete(ev.pointerId);
      if (!acao) return;
      const a = acao;
      if (a.tipo === 'pinca') { if (ponteiros.size === 0) acao = null; return; }
      acao = null;
      if (a.tipo === 'ligar') {
        linhaTemp = null;
        q.querySelectorAll('.fx-alvo').forEach((c) => c.classList.remove('fx-alvo'));
        const alvo = document.elementFromPoint(ev.clientX, ev.clientY);
        const c = alvo && alvo.closest('.fx-cartao');
        if (c && c.dataset.no !== a.de) { ligar(a.de, a.saida, c.dataset.no); return; }
        desenharArestas();
        // Soltou no vazio (longe da própria porta): abre a lista de tipos ali, como no ManyChat.
        if (!c && ev.type === 'pointerup') {
          const m = $q('#fx-mundo').getBoundingClientRect();
          const w = { x: (ev.clientX - m.left) / vis.z, y: (ev.clientY - m.top) / vis.z };
          const p0 = pontoSaida(a.de, a.saida);
          if (p0 && Math.hypot(w.x - p0.x, w.y - p0.y) > 30) abrirEscolha(ev, { de: a.de, saida: a.saida, x: w.x + 10, y: w.y - 22 });
        }
        return;
      }
      if (a.tipo === 'mover') {
        a.item.classList.remove('fx-arrastando');
        if (a.moveu) {
          desfazer.push(a.antes); refazer = []; marcarMudanca(); desenharSituacao(); desenharMapa();
        } else if (a.item.dataset.no) selecionar(a.item.dataset.no);
        else editarNota(a.item.dataset.nota);
        return;
      }
      if (a.tipo === 'tela' && !a.moveu) {
        selAresta = null; desenharArestas();
        if (sel) fecharPainel();
      }
    };
    q.addEventListener('pointerup', soltar);
    q.addEventListener('pointercancel', soltar);

    q.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      const p = local(ev);
      if (ev.ctrlKey || ev.metaKey) zoomEm(p.x, p.y, Math.exp(-ev.deltaY * 0.0022));
      else { vis.x -= ev.deltaX; vis.y -= ev.deltaY; aplicarVista(); }
    }, { passive: false });

    // Cliques em botões dentro do quadro.
    q.addEventListener('click', (ev) => {
      const mais = ev.target.closest('[data-mais]');
      if (mais) {
        const id = mais.closest('[data-no]').dataset.no;
        const n = no(id);
        const sai = saidasDe(n).map((s) => s[0]);
        const i = sai.indexOf(mais.dataset.mais);
        abrirEscolha(ev, { de: id, saida: mais.dataset.mais, x: n.x + 330, y: n.y + (sai.length > 1 ? (i === 0 ? -110 : 150) : 0) });
        return;
      }
      const des = ev.target.closest('#fx-desligar');
      if (des) { const id = des.dataset.aresta; selAresta = null; mudar(() => { F.arestas = F.arestas.filter((a) => a.id !== id); }); U().avisar('Ligação desfeita.'); return; }
      const tirar = ev.target.closest('[data-tirar-nota]');
      if (tirar) { mudar(() => { F.notas = F.notas.filter((o) => o.id !== tirar.dataset.tirarNota); }); U().avisar('Nota apagada.'); return; }
      const esp = ev.target.closest('[data-esperando]');
      if (esp) { pessoasNoFluxo(esp.dataset.esperando); }
    });

    // Mapa: clicar ou arrastar leva a tela até lá.
    const mapa = $q('#fx-mapa');
    let arrastandoMapa = false;
    mapa.addEventListener('pointerdown', (ev) => { arrastandoMapa = true; mapa.setPointerCapture(ev.pointerId); irPeloMapa(ev); });
    mapa.addEventListener('pointermove', (ev) => { if (arrastandoMapa) irPeloMapa(ev); });
    mapa.addEventListener('pointerup', () => { arrastandoMapa = false; });

    // Teclado: Delete apaga o selecionado; Ctrl+Z / Ctrl+Y. Ouvinte único no
    // documento, ativo só com o quadro na tela e sem gaveta aberta.
    if (teclado) document.removeEventListener('keydown', teclado);
    teclado = (ev) => {
      if (!area.isConnected || !area.offsetParent || document.querySelector('dialog[open]')) return;
      if (ev.target.closest && ev.target.closest('input, select, textarea, [contenteditable="true"]')) return;
      const k = ev.key.toLowerCase();
      if ((ev.ctrlKey || ev.metaKey) && k === 'z') { ev.preventDefault(); voltarEstado(ev.shiftKey ? refazer : desfazer, ev.shiftKey ? desfazer : refazer); }
      else if ((ev.ctrlKey || ev.metaKey) && k === 'y') { ev.preventDefault(); voltarEstado(refazer, desfazer); }
      else if (k === 'delete' || k === 'backspace') {
        if (selAresta) { const id = selAresta; selAresta = null; mudar(() => { F.arestas = F.arestas.filter((a) => a.id !== id); }); U().avisar('Ligação desfeita.'); }
      } else if (k === 'escape') { fecharEscolha(); if (sel) fecharPainel(); }
    };
    document.addEventListener('keydown', teclado);
  }

  function ligarFerramentas() {
    $q('.fx-ferramentas').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-f]');
      if (!b || b.tagName === 'SELECT') return;
      const q = $q('#fx-quadro');
      const centro = { x: q.clientWidth / 2, y: q.clientHeight / 2 };
      const mundoCentro = () => ({ x: Math.round((centro.x - vis.x) / vis.z - 120), y: Math.round((centro.y - vis.y) / vis.z - 60) });
      ({
        menos: () => zoomEm(centro.x, centro.y, 1 / 1.2),
        mais: () => zoomEm(centro.x, centro.y, 1.2),
        centro: () => centralizar(),
        organizar: () => { organizar(); U().avisar('Quadro organizado.'); },
        desfazer: () => voltarEstado(desfazer, refazer),
        refazer: () => voltarEstado(refazer, desfazer),
        cartao: () => { const p = mundoCentro(); abrirEscolha(ev, { x: p.x, y: p.y }); },
        nota: () => {
          const p = mundoCentro(); const id = novoId('o');
          mudar(() => { F.notas.push({ id, x: p.x, y: p.y, texto: 'Escreva aqui para explicar esta parte do fluxo.' }); });
          editarNota(id);
        },
      })[b.dataset.f]();
    });
    $q('[data-f="periodo"]').onchange = (ev) => { periodo = ev.target.value; desenharCartoes(); desenharArestas(); if (sel) desenharPainel(); U().avisar('Números do período: ' + ev.target.selectedOptions[0].text.toLowerCase() + '.'); };
  }

  function editarNota(id) {
    const t = $q(`[data-texto-nota="${id}"]`);
    if (!t) return;
    t.contentEditable = 'true';
    t.focus();
    const r = document.createRange(); r.selectNodeContents(t); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    t.onblur = () => {
      t.contentEditable = 'false';
      const o = F.notas.find((x) => x.id === id);
      const novo = t.innerText.trim();
      if (o && novo !== o.texto) mudar(() => { o.texto = novo || 'Nota vazia'; }, { redesenhar: false });
      desenharSituacao(); desenharMapa();
    };
  }

  // Organizar automaticamente: colunas pela distância até o início.
  function organizar() {
    mudar(() => {
      const ini = F.nos.find((n) => n.tipo === 'inicio');
      const nivel = { [ini.id]: 0 };
      for (let volta = 0; volta < F.nos.length; volta++) {
        F.arestas.forEach((a) => { if (nivel[a.de] !== undefined && (nivel[a.para] === undefined || nivel[a.para] < nivel[a.de] + 1) && nivel[a.de] + 1 < F.nos.length) nivel[a.para] = nivel[a.de] + 1; });
      }
      const max = Math.max(0, ...Object.values(nivel));
      const colunas = {};
      F.nos.forEach((n) => { const c = nivel[n.id] ?? max + 1; (colunas[c] = colunas[c] || []).push(n); });
      Object.entries(colunas).forEach(([c, nos]) => {
        nos.sort((a, b) => a.y - b.y);
        const alturas = nos.map((n) => ($q(`[data-no="${n.id}"]`) || { offsetHeight: 160 }).offsetHeight);
        const total = alturas.reduce((s, h) => s + h, 0) + (nos.length - 1) * 50;
        let y = 200 - total / 2;
        nos.forEach((n, i) => { n.x = 40 + Number(c) * 330; n.y = Math.round(y); y += alturas[i] + 50; });
      });
      const fundo = Math.max(...F.nos.map((n) => n.y + 220));
      F.notas.forEach((o, i) => { o.x = 40 + i * 300; o.y = fundo + 30; });
    });
    centralizar();
  }

  // ---------------------------------------------------------------------------
  // Lista de tipos (botão "+", soltar ligação no vazio, "+ Cartão")
  // ---------------------------------------------------------------------------
  function abrirEscolha(ev, onde) {
    const caixa = $q('#fx-escolha');
    const area = $q('#fx-area').getBoundingClientRect();
    caixa.innerHTML = `<p class="fx-escolha__titulo">Adicionar cartão</p>${NOVOS.map((t) => `<button type="button" data-tipo="${t}">${IC[t]}<span><b>${TIPOS[t].rotulo}</b><small>${TIPOS[t].desc}</small></span></button>`).join('')}`;
    caixa.hidden = false;
    const x = Math.min(Math.max(8, ev.clientX - area.left + 8), area.width - caixa.offsetWidth - 8);
    const y = Math.min(Math.max(8, ev.clientY - area.top + 8), area.height - caixa.offsetHeight - 8);
    caixa.style.left = x + 'px'; caixa.style.top = Math.max(8, y) + 'px';
    caixa.querySelector('button').focus();
    caixa.onclick = (e) => {
      const b = e.target.closest('[data-tipo]');
      if (!b) return;
      fecharEscolha();
      criarCartao(b.dataset.tipo, onde);
    };
  }
  function fecharEscolha() { const c = el && el.querySelector('#fx-escolha'); if (c) c.hidden = true; }

  function dadosPadrao(tipo) {
    if (tipo === 'email') return { modelo: '' };
    if (tipo === 'espera') return { modo: 'tempo', qtd: 1, unidade: 'dias', janela: janela() };
    if (tipo === 'desvio') return { juncao: 'e', condicoes: [] };
    if (tipo === 'objetivo') return { evento: 'agendou', filtro: '' };
    if (tipo === 'ir_fluxo') return { fluxo: '' };
    return {};
  }
  function posLivre(x, y) {
    let yy = y;
    for (let i = 0; i < 12 && F.nos.some((n) => Math.abs(n.x - x) < 250 && Math.abs(n.y - yy) < 150); i++) yy += 170;
    return { x: Math.round(x), y: Math.round(yy) };
  }
  function criarCartao(tipo, onde) {
    const id = novoId('n');
    const p = posLivre(onde.x, onde.y);
    mudar(() => {
      F.nos.push({ id, tipo, x: p.x, y: p.y, dados: dadosPadrao(tipo) });
      if (onde.de) {
        F.arestas = F.arestas.filter((a) => !(a.de === onde.de && a.saida === onde.saida));
        F.arestas.push({ id: novoId('a'), de: onde.de, saida: onde.saida, para: id });
      }
    });
    selecionar(id);
    U().avisar(`Cartão "${TIPOS[tipo].rotulo}" adicionado${onde.de ? ' e ligado' : '. Ligue arrastando da saída de outro cartão até ele'}.`);
  }

  // ---------------------------------------------------------------------------
  // Painel lateral de edição
  // ---------------------------------------------------------------------------
  function selecionar(id) {
    sel = id; selAresta = null;
    $q('#fx-cartoes').querySelectorAll('.fx-cartao').forEach((c) => c.classList.toggle('fx-sel', c.dataset.no === id));
    desenharArestas();
    desenharPainel();
  }
  function fecharPainel() {
    sel = null;
    const p = $q('#fx-painel'); if (p) p.hidden = true;
    $q('#fx-cartoes').querySelectorAll('.fx-sel').forEach((c) => c.classList.remove('fx-sel'));
  }
  const opts = (lista, atual, vazio) => (vazio ? `<option value="">${vazio}</option>` : '') + lista.map(([v, r]) => `<option value="${esc(v)}"${String(v) === String(atual) ? ' selected' : ''}>${esc(r)}</option>`).join('');
  const emailsDoFluxo = () => F.nos.filter((n) => n.tipo === 'email').map((n) => { const m = modelo(n.dados.modelo); return [n.id, m ? m.nome : 'E-mail sem modelo']; });
  function estimativa(g) {
    let h = 7;
    JSON.stringify(g).split('').forEach((c) => { h = (h * 31 + c.charCodeAt(0)) % 9973; });
    const base = EVENTOS[g.evento].base;
    return Math.max(0, Math.round((base / Math.pow(2.6, g.filtros.length)) * (0.7 + (h % 60) / 100)));
  }

  function desenharPainel() {
    const n = no(sel);
    const p = $q('#fx-painel');
    if (!n || !p) return;
    const d = n.dados;
    let corpo = '';
    if (n.tipo === 'inicio') {
      corpo = `<p class="mini">Basta um gatilho acontecer para a pessoa entrar. Quem já está dentro ou já concluiu não entra de novo, e publicar não puxa quem disparou antes.</p>
        ${d.gatilhos.map((g, i) => `<div class="fx-bloco" data-g="${i}">
          <div class="fx-bloco__topo"><b>Gatilho ${i + 1}</b><button type="button" class="ag-icone" data-tirar-g="${i}" aria-label="Tirar gatilho">${IC.fechar}</button></div>
          <select data-campo="evento" aria-label="Acontecimento">${opts(Object.entries(EVENTOS).map(([k, v]) => [k, v.rotulo]), g.evento)}</select>
          ${g.filtros.map((f, j) => `<div class="fx-filtro" data-f="${j}">
            <select data-campo="fcampo" aria-label="Filtro">${opts(EVENTOS[g.evento].filtros.map((c) => [c, FILTRO_ROTULO[c]]), f.campo)}</select>
            <select data-campo="fvalor" aria-label="Valor">${opts(FILTRO_VALORES[f.campo](), f.valor)}</select>
            <button type="button" class="ag-icone" data-tirar-f="${j}" aria-label="Tirar filtro">${IC.fechar}</button></div>`).join('')}
          <button type="button" class="btn sec fx-pequeno" data-add-f>+ Filtro</button>
          <p class="fx-estimativa">Nos últimos 30 dias, <b>${int(estimativa(g))} pessoas</b> teriam entrado com essa combinação.</p>
        </div>`).join('')}
        <button type="button" class="btn sec" data-add-g>+ Adicionar gatilho</button>`;
    } else if (n.tipo === 'email') {
      const mk = D().modelos.filter((m) => m.canal === 'marketing' && !m.arquivado);
      const m = modelo(d.modelo);
      corpo = `<label class="ag-campo"><span class="ag-campo__rotulo">Modelo</span><select data-campo="modelo">${opts(mk.map((x) => [x.id, x.nome]), d.modelo, 'Escolha um modelo')}</select></label>
        ${m ? `<div class="fx-previa-email"><span class="mini">${esc(D().config.marketing.nome)}</span><b>${esc(m.assunto)}</b><span class="mini">${esc(m.previa)}</span></div><p class="mini">Para mudar o texto, edite o modelo em Modelos.</p>` : ''}
        <details class="ag-mais" data-novo-modelo><summary>Criar modelo novo sem sair do fluxo</summary>
          <label class="ag-campo"><span class="ag-campo__rotulo">Nome</span><input type="text" data-nm="nome" placeholder="Ex.: Boas-vindas 3"></label>
          <label class="ag-campo"><span class="ag-campo__rotulo">Assunto</span><input type="text" data-nm="assunto" placeholder="Assunto do e-mail"></label>
          <button type="button" class="btn sec" data-criar-modelo>Criar e usar aqui</button></details>`;
    } else if (n.tipo === 'espera') {
      corpo = `<fieldset class="fx-modos"><legend class="ag-campo__rotulo">Esperar</legend>
          ${[['tempo', 'Por um tempo'], ['dia', 'Até um dia da semana e horário'], ['evento', 'Até algo acontecer']].map(([v, r]) => `<label class="marca"><input type="radio" name="fx-modo" data-campo="modo" value="${v}"${d.modo === v ? ' checked' : ''}> ${r}</label>`).join('')}</fieldset>
        ${d.modo === 'tempo' ? `<div class="fx-linha"><input type="number" min="1" data-campo="qtd" value="${d.qtd || 1}" aria-label="Quanto"><select data-campo="unidade" aria-label="Unidade">${opts([['horas', 'horas'], ['dias', 'dias']], d.unidade)}</select></div>` : ''}
        ${d.modo === 'dia' ? `<div class="fx-linha"><span class="mini">próxima</span><select data-campo="dia" aria-label="Dia">${opts(DIAS, d.dia || '2')}</select><input type="time" data-campo="hora" value="${d.hora || '09:00'}" aria-label="Horário"></div>` : ''}
        ${d.modo === 'evento' ? `<label class="ag-campo"><span class="ag-campo__rotulo">Até a pessoa</span><select data-campo="evento">${opts([['abriu', 'abrir um e-mail do fluxo'], ['clicou', 'clicar num e-mail do fluxo'], ...Object.entries(EVENTOS).map(([k, v]) => [k, v.rotulo.toLowerCase()])], d.evento || 'abriu')}</select></label>
          ${['abriu', 'clicou'].includes(d.evento || 'abriu') ? `<select data-campo="ref" aria-label="Qual e-mail">${opts(emailsDoFluxo(), d.ref, 'Escolha o e-mail')}</select>` : ''}
          <div class="fx-linha"><span class="mini">prazo máximo</span><input type="number" min="1" data-campo="prazo" value="${d.prazo || 3}" aria-label="Prazo"><select data-campo="unidade" aria-label="Unidade do prazo">${opts([['horas', 'horas'], ['dias', 'dias']], d.unidade || 'dias')}</select></div>
          <p class="mini">Quem bate o prazo sem acontecer segue pela saída "não aconteceu".</p>` : ''}
        <label class="marca fx-janela"><input type="checkbox" data-campo="janela"${d.janela && d.janela.ligada ? ' checked' : ''}> Só enviar dentro de uma janela</label>
        ${d.janela && d.janela.ligada ? `<div class="fx-linha"><span class="mini">entre</span><input type="time" data-campo="jde" value="${d.janela.de}" aria-label="Início da janela"><span class="mini">e</span><input type="time" data-campo="jate" value="${d.janela.ate}" aria-label="Fim da janela"></div>` : ''}`;
    } else if (n.tipo === 'desvio') {
      const TIPOS_C = [['abriu', 'Abriu um e-mail do fluxo'], ['clicou', 'Clicou num e-mail do fluxo'], ['evento', 'Algo aconteceu (gatilhos)'], ['segmento', 'Está num segmento']];
      corpo = `<p class="mini">Quem cumprir segue por "sim"; o resto, por "não".</p>
        <div class="argo-seg fx-seg" role="radiogroup" aria-label="Combinar condições">
          <label><input type="radio" name="fx-juncao" data-campo="juncao" value="e"${d.juncao !== 'ou' ? ' checked' : ''}><span>Todas (e)</span></label>
          <label><input type="radio" name="fx-juncao" data-campo="juncao" value="ou"${d.juncao === 'ou' ? ' checked' : ''}><span>Qualquer uma (ou)</span></label></div>
        ${d.condicoes.map((c, i) => `<div class="fx-bloco" data-c="${i}">
          <div class="fx-bloco__topo"><b>Condição ${i + 1}</b><button type="button" class="ag-icone" data-tirar-c="${i}" aria-label="Tirar condição">${IC.fechar}</button></div>
          <select data-campo="ctipo" aria-label="Tipo de condição">${opts(TIPOS_C, c.tipo)}</select>
          ${['abriu', 'clicou'].includes(c.tipo) ? `<select data-campo="cref" aria-label="Qual e-mail">${opts(emailsDoFluxo(), c.ref, 'Escolha o e-mail')}</select>` : ''}
          ${c.tipo === 'clicou' ? `<select data-campo="clink" aria-label="Link">${opts([['qualquer', 'em qualquer link'], ['/workshop-gratuito', 'no link /workshop-gratuito'], ['/grupo-workshop', 'no link /grupo-workshop']], c.link || 'qualquer')}</select>` : ''}
          ${c.tipo === 'evento' ? `<select data-campo="cevento" aria-label="Acontecimento">${opts(Object.entries(EVENTOS).filter(([k]) => k !== 'segmento').map(([k, v]) => [k, v.rotulo]), c.evento)}</select>
            <select data-campo="cvalor" aria-label="Filtro">${opts(FILTRO_VALORES[EVENTOS[c.evento].filtros[0]](), c.valor, 'qualquer ' + FILTRO_ROTULO[EVENTOS[c.evento].filtros[0]].toLowerCase())}</select>` : ''}
          ${c.tipo === 'segmento' ? `<select data-campo="cvalor" aria-label="Segmento">${opts(FILTRO_VALORES.segmento(), c.valor)}</select>` : ''}
        </div>`).join('')}
        <button type="button" class="btn sec" data-add-c>+ Adicionar condição</button>`;
    } else if (n.tipo === 'objetivo') {
      const campo = EVENTOS[d.evento].filtros[0];
      corpo = `<p class="mini">Quando a condição acontece, a pessoa pula direto para cá, de onde estiver no fluxo, e segue daqui.</p>
        <label class="ag-campo"><span class="ag-campo__rotulo">Condição</span><select data-campo="evento">${opts(Object.entries(EVENTOS).map(([k, v]) => [k, v.rotulo]), d.evento)}</select></label>
        <select data-campo="filtro" aria-label="Filtro">${opts(FILTRO_VALORES[campo](), d.filtro, 'qualquer ' + FILTRO_ROTULO[campo].toLowerCase())}</select>`;
    } else if (n.tipo === 'ir_fluxo') {
      corpo = `<label class="ag-campo"><span class="ag-campo__rotulo">Fluxo de destino</span><select data-campo="fluxo">${opts(FLUXOS.filter((f) => f.id !== F.id && !f.arquivado).map((f) => [f.id, f.nome]), d.fluxo, 'Escolha o fluxo')}</select></label>
        <p class="mini">A pessoa sai deste fluxo e entra no início do outro.</p>`;
    } else if (n.tipo === 'fim') {
      corpo = '<p class="mini">A pessoa conclui o fluxo aqui. Também saem sozinhos, sem precisar configurar, quem se descadastra, quem tem o e-mail voltando e quem denuncia spam.</p>';
    }
    const st = (F.stats || {})[n.id];
    p.innerHTML = `<header class="fx-painel__topo">${IC[n.tipo]}<div><b>${TIPOS[n.tipo].rotulo}</b><span class="mini">${TIPOS[n.tipo].desc}</span></div>
        <button type="button" class="ag-gaveta__fechar" data-fechar-painel aria-label="Fechar">${IC.fechar}</button></header>
      <div class="fx-painel__corpo ag-form">${corpo}
        ${st && n.tipo === 'espera' && st.esperando ? `<button type="button" class="argo-faixa-chamada" data-ver-esperando>Ver as ${int(st.esperando)} pessoas esperando aqui</button>` : ''}</div>
      <footer class="fx-painel__pe">${n.tipo === 'inicio' ? '<span class="mini">O início não pode ser excluído.</span>' : `<button type="button" class="btn sec" data-dup>${IC.copiar} Duplicar</button><button type="button" class="btn perigo" data-excluir>${IC.lixo} Excluir</button>`}</footer>`;
    p.hidden = false;
    ligarPainel(p, n);
  }

  function ligarPainel(p, n) {
    const d = n.dados;
    p.querySelector('[data-fechar-painel]').onclick = () => fecharPainel();
    const ve = p.querySelector('[data-ver-esperando]');
    if (ve) ve.onclick = () => pessoasNoFluxo(n.id);
    p.onchange = (ev) => {
      const c = ev.target.dataset.campo;
      if (!c) return;
      const v = ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value;
      const g = ev.target.closest('[data-g]'), f = ev.target.closest('[data-f]'), cc = ev.target.closest('[data-c]');
      mudar(() => {
        if (n.tipo === 'inicio') {
          const gat = d.gatilhos[Number(g.dataset.g)];
          if (c === 'evento') { gat.evento = v; gat.filtros = []; }
          if (c === 'fcampo') { const fi = gat.filtros[Number(f.dataset.f)]; fi.campo = v; fi.valor = FILTRO_VALORES[v]()[0][0]; }
          if (c === 'fvalor') gat.filtros[Number(f.dataset.f)].valor = v;
        } else if (n.tipo === 'desvio' && c !== 'juncao') {
          const co = d.condicoes[Number(cc.dataset.c)];
          if (c === 'ctipo') { Object.keys(co).forEach((k) => delete co[k]); co.tipo = v; if (v === 'evento') co.evento = 'agendou'; if (v === 'segmento') co.valor = FILTRO_VALORES.segmento()[0][0]; if (v === 'clicou') co.link = 'qualquer'; }
          if (c === 'cref') co.ref = v;
          if (c === 'clink') co.link = v;
          if (c === 'cevento') { co.evento = v; co.valor = ''; }
          if (c === 'cvalor') co.valor = v;
        } else if (c === 'juncao') d.juncao = v;
        else if (c === 'modo') {
          const antes = d.modo; d.modo = v;
          if (v === 'evento') { d.evento = d.evento || 'abriu'; d.prazo = d.prazo || 3; F.arestas.forEach((a) => { if (a.de === n.id && a.saida === 'proximo') a.saida = 'aconteceu'; }); }
          else if (antes === 'evento') { F.arestas = F.arestas.filter((a) => !(a.de === n.id && a.saida === 'nao_aconteceu')); F.arestas.forEach((a) => { if (a.de === n.id) a.saida = 'proximo'; }); }
        } else if (c === 'janela') d.janela = { ...(d.janela || janela(false)), ligada: v };
        else if (c === 'jde') d.janela.de = v;
        else if (c === 'jate') d.janela.ate = v;
        else if (c === 'qtd' || c === 'prazo') d[c] = Math.max(1, Number(v) || 1);
        else if (c === 'evento' && n.tipo === 'objetivo') { d.evento = v; d.filtro = ''; }
        else d[c] = v;
      });
    };
    const clique = (sel2, fn) => p.querySelectorAll(sel2).forEach((b) => { b.onclick = () => fn(b); });
    clique('[data-add-g]', () => mudar(() => d.gatilhos.push({ evento: 'formulario', filtros: [] })));
    clique('[data-tirar-g]', (b) => mudar(() => d.gatilhos.splice(Number(b.dataset.tirarG), 1)));
    clique('[data-add-f]', (b) => mudar(() => { const gat = d.gatilhos[Number(b.closest('[data-g]').dataset.g)]; const campo = EVENTOS[gat.evento].filtros.find((x) => !gat.filtros.some((f) => f.campo === x)) || EVENTOS[gat.evento].filtros[0]; gat.filtros.push({ campo, valor: FILTRO_VALORES[campo]()[0][0] }); }));
    clique('[data-tirar-f]', (b) => mudar(() => d.gatilhos[Number(b.closest('[data-g]').dataset.g)].filtros.splice(Number(b.dataset.tirarF), 1)));
    clique('[data-add-c]', () => mudar(() => d.condicoes.push({ tipo: 'abriu', ref: (emailsDoFluxo()[0] || [''])[0] })));
    clique('[data-tirar-c]', (b) => mudar(() => d.condicoes.splice(Number(b.dataset.tirarC), 1)));
    clique('[data-criar-modelo]', () => {
      const nome = p.querySelector('[data-nm="nome"]').value.trim(), assunto = p.querySelector('[data-nm="assunto"]').value.trim();
      if (!nome || !assunto) return U().avisar('Dê nome e assunto ao modelo novo.', 'erro');
      const m = { id: 'm' + Date.now(), nome, canal: 'marketing', assunto, previa: '', editado: '03/10', corpo: 'Oi, {{primeiro_nome}}!\n\n' };
      D().modelos.unshift(m);
      mudar(() => { d.modelo = m.id; });
      U().avisar(`Modelo "${nome}" criado e escolhido. O texto completo se edita em Modelos.`);
    });
    clique('[data-dup]', () => {
      const id = novoId('n');
      mudar(() => F.nos.push({ id, tipo: n.tipo, x: n.x + 40, y: n.y + 190, dados: JSON.parse(JSON.stringify(n.dados)) }));
      selecionar(id);
      U().avisar('Cartão duplicado. Ligue a cópia onde quiser.');
    });
    clique('[data-excluir]', (b) => ctx.pedirConfirmacao(b, 'Excluir este cartão?', () => {
      const tinhaSaida = F.arestas.some((a) => a.de === n.id);
      fecharPainel();
      mudar(() => { F.nos = F.nos.filter((x) => x.id !== n.id); F.arestas = F.arestas.filter((a) => a.de !== n.id && a.para !== n.id); });
      U().avisar(tinhaSaida ? 'Cartão excluído. Os cartões seguintes ficaram soltos e estão marcados.' : 'Cartão excluído.');
    }));
  }

  // ---------------------------------------------------------------------------
  // Pessoas no fluxo e teste
  // ---------------------------------------------------------------------------
  function pessoasNoFluxo(noId) {
    const pessoas = D().contatos.filter((c) => c.situacao === 'ativo' && c.funil === 'workshop-gratuito').slice(0, noId ? 9 : 14);
    const cartoes = F.nos.filter((n) => ['espera', 'email', 'desvio'].includes(n.tipo));
    const ondeEsta = (i) => (noId ? no(noId) : cartoes[i % cartoes.length]);
    const g = U().gaveta({
      titulo: noId ? 'Esperando neste cartão' : 'Pessoas no fluxo', sub: `${esc(F.nome)} · amostra de exemplo`,
      corpo: `<div class="tabela-wrap"><table><thead><tr><th>Pessoa</th><th>Cartão</th><th>Desde</th><th></th></tr></thead><tbody>
        ${pessoas.map((c, i) => `<tr data-p="${c.id}"><td><button type="button" class="ag-link-linha" data-contato="${c.id}">${esc(c.nome)}</button></td>
          <td><span class="mini">${esc(rotuloNo(ondeEsta(i)))}</span></td><td><span class="mini">${String(1 + (i % 3)).padStart(2, '0')}/10</span></td>
          <td><button type="button" class="btn sec fx-pequeno" data-tirar-pessoa>Tirar do fluxo</button></td></tr>`).join('')}
      </tbody></table></div>`,
    });
    g.addEventListener('click', (ev) => {
      const c = ev.target.closest('[data-contato]');
      if (c) { U().abrirContato(c.dataset.contato); return; }
      const t = ev.target.closest('[data-tirar-pessoa]');
      if (t) ctx.pedirConfirmacao(t, 'Tirar?', () => { const tr = t.closest('tr'); U().avisar(`${tr.querySelector('[data-contato]').textContent} saiu do fluxo. Fica registrado no histórico do contato.`); tr.remove(); });
    });
  }

  function testar(probs) {
    if (probs.length) { U().avisar('Resolva os problemas marcados antes de testar.', 'erro'); return; }
    const passos = [];
    let atual = F.nos.find((n) => n.tipo === 'inicio');
    const g = U().gaveta({
      titulo: 'Testar o fluxo', sub: 'a pessoa de teste percorre o fluxo pulando as esperas',
      corpo: `<label class="ag-campo"><span class="ag-campo__rotulo">Mandar os e-mails para</span><input type="email" value="felipe@seteads.com" id="fx-teste-email"></label>
        <ol class="ag-hist em-hist fx-teste" id="fx-teste"></ol><div id="fx-teste-acao"></div>`,
    });
    const lista = g.querySelector('#fx-teste'), acao = g.querySelector('#fx-teste-acao');
    const seguir = (saida) => {
      const a = F.arestas.find((x) => x.de === atual.id && x.saida === saida);
      atual = a ? no(a.para) : null;
      passo();
    };
    const passo = () => {
      if (!atual) { passos.push('<li><b>Fim do teste.</b></li>'); lista.innerHTML = passos.join(''); acao.innerHTML = ''; return; }
      const n = atual;
      if (n.tipo === 'inicio') { passos.push(`<li><b>Entrou</b> <span class="mini">como se tivesse disparado: ${esc(resumoGatilhos(F))}</span></li>`); }
      if (n.tipo === 'email') passos.push(`<li><b>E-mail enviado</b> <span class="mini">"${esc(modelo(n.dados.modelo).assunto)}" para ${esc(g.querySelector('#fx-teste-email').value)}</span></li>`);
      if (n.tipo === 'espera') passos.push('<li><b>Espera pulada</b> <span class="mini">no teste não se espera</span></li>');
      if (n.tipo === 'objetivo') passos.push('<li><b>Chegou ao objetivo</b></li>');
      if (n.tipo === 'ir_fluxo') passos.push(`<li><b>Iria para outro fluxo</b> <span class="mini">o teste para aqui</span></li>`);
      if (n.tipo === 'fim') passos.push('<li><b>Concluiu o fluxo</b></li>');
      lista.innerHTML = passos.join('');
      if (n.tipo === 'desvio' || (n.tipo === 'espera' && n.dados.modo === 'evento')) {
        const [s1, s2] = saidasDe(n);
        acao.innerHTML = `<p><b>${n.tipo === 'desvio' ? 'Desvio' : 'Espera por acontecimento'}:</b> ${esc(n.tipo === 'desvio' ? n.dados.condicoes.map(rotuloCondicao).join(n.dados.juncao === 'ou' ? ' ou ' : ' e ') : rotuloEsperaEvento(n.dados))}. Por onde seguir?</p>
          <div class="ag-acoes"><button class="btn sec" type="button" data-por="${s1[0]}">${s1[1]}</button><button class="btn sec" type="button" data-por="${s2[0]}">${s2[1]}</button></div>`;
        acao.querySelectorAll('[data-por]').forEach((b) => { b.onclick = () => { passos.push(`<li><span class="mini">seguiu por "${esc(b.textContent)}"</span></li>`); seguir(b.dataset.por); }; });
        return;
      }
      if (['fim', 'ir_fluxo'].includes(n.tipo)) { atual = null; acao.innerHTML = ''; passos.push('<li><b>Fim do teste.</b> <span class="mini">Os e-mails de teste não contam nos números.</span></li>'); lista.innerHTML = passos.join(''); return; }
      seguir(saidasDe(n)[0][0]);
    };
    passo();
  }
})();
