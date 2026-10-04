// Fluxos automáticos de e-mail (spec-email-proprio.md, módulo 9). Quadro do
// protótipo aprovado (376), ligado ao backend na 385: GET/POST /api/email/fluxos.
//
// Quadro no estilo do construtor do ManyChat, feito em JS puro: cartões em HTML
// posicionados num "mundo" que recebe translate + scale, e as ligações em SVG
// por baixo, na mesma escala. Sem biblioteca: o visual segue o papel "Etiqueta"
// sem brigar com CSS de terceiros, e os gestos (arrastar a tela, mover cartão,
// ligar arrastando, pinça no celular) usam Pointer Events, que funcionam igual
// com mouse e com dedo.
//
// O rascunho é salvo sozinho a cada mudança (com versão, para duas abas não se
// atropelarem) e os problemas que impedem publicar vêm do servidor. Publicar,
// pausar e retomar (386), descartar e publicar mudanças e o teste passo a passo
// (387), e os números nos cartões com quem está dentro (388) também.
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

  // Valores reais de cada filtro, vindos do servidor ao abrir o fluxo.
  let OPC = {};
  // Funis aparecem pelo nome de leitura (o valor guardado continua o técnico).
  const FILTRO_VALORES = new Proxy({}, {
    get: (_, campo) => () => (['funil', 'formulario'].includes(campo) ? (OPC[campo] || []).map(([v]) => [v, U().nomeFunil(v)]) : OPC[campo] || []),
  });
  const primeiroValor = (campo) => (FILTRO_VALORES[campo]()[0] || [''])[0];
  const FILTRO_ROTULO = {
    funil: 'Funil', pagina: 'Página', canal: 'Canal', utm_source: 'UTM origem', utm_campaign: 'UTM campanha', utm_content: 'UTM anúncio',
    formulario: 'Formulário', material: 'Material', produto: 'Produto', compra: 'Situação da compra', tipo: 'Tipo de reunião', grupo: 'Grupo',
    estagio: 'Estágio', evento: 'Evento', segmento: 'Segmento', campanha: 'Campanha', acao: 'Fez',
  };
  const EVENTOS = {
    formulario: { rotulo: 'Preencheu formulário (virou lead)', curto: 'Virou lead', filtros: ['funil', 'pagina', 'canal', 'utm_source', 'utm_campaign', 'utm_content'] },
    aplicacao: { rotulo: 'Enviou aplicação', curto: 'Enviou aplicação', filtros: ['formulario'] },
    material: { rotulo: 'Baixou material (isca)', curto: 'Baixou material', filtros: ['material'] },
    compra: { rotulo: 'Comprou na Greenn', curto: 'Comprou', filtros: ['produto', 'compra'] },
    agendou: { rotulo: 'Agendou reunião', curto: 'Agendou reunião', filtros: ['tipo'] },
    cancelou: { rotulo: 'Cancelou reunião', curto: 'Cancelou reunião', filtros: ['tipo'] },
    faltou: { rotulo: 'Faltou à reunião', curto: 'Faltou', filtros: ['tipo'] },
    compareceu: { rotulo: 'Compareceu à reunião', curto: 'Compareceu', filtros: ['tipo'] },
    grupo_entrou: { rotulo: 'Entrou num grupo de WhatsApp', curto: 'Entrou no grupo', filtros: ['grupo'] },
    grupo_saiu: { rotulo: 'Saiu de um grupo de WhatsApp', curto: 'Saiu do grupo', filtros: ['grupo'] },
    crm: { rotulo: 'Mudou de estágio no CRM', curto: 'Mudou de estágio', filtros: ['estagio'] },
    site: { rotulo: 'Visitou página ou clicou num botão', curto: 'No site', filtros: ['pagina', 'evento'] },
    segmento: { rotulo: 'Entrou num segmento', curto: 'Entrou no segmento', filtros: ['segmento'] },
    campanha: { rotulo: 'Abriu ou clicou numa campanha', curto: 'Campanha', filtros: ['acao', 'campanha'] },
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
  // Ids novos não repetem os que já estão no quadro salvo.
  const novoId = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
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
  let el = null;                    // raiz da vista
  let MODELOS = [];                 // modelos de e-mail (GET /api/email/modelos)
  let verArquivados = false;
  let marcados = new Set();         // cartões marcados com Shift + clique
  let areaCopia = null;             // cartões copiados (vale para outro fluxo)
  let salvar = { timer: null, rodando: false, pendente: false, erro: null };
  let NUM = null;                   // números por cartão da versão no ar (388)
  let periodo = '30';

  const $q = (s) => el.querySelector(s);
  const no = (id) => F.nos.find((n) => n.id === id);
  const esc = (s) => U().esc(s);
  const int = (n) => U().int(n);
  const modelo = (id) => (id === '' || id == null ? null : MODELOS.find((m) => String(m.id) === String(id)));

  // ---------------------------------------------------------------------------
  // Entrada: lista de fluxos ou quadro
  // ---------------------------------------------------------------------------
  function render(raiz, c) {
    el = raiz; ctx = c;
    if (F) return quadro();
    lista();
  }
  window.EmailFluxos = { render };

  function resumoGatilhos(f) {
    const g = f.grafo.nos.find((n) => n.tipo === 'inicio').dados.gatilhos;
    if (!g.length) return 'sem gatilho';
    return g.map((x) => (EVENTOS[x.evento] || { curto: x.evento }).curto + (x.filtros[0] ? ` (${x.filtros[0].valor})` : '')).join(' ou ');
  }
  const SIT = { rascunho: ['Rascunho', 'neutro'], ativo: ['Ativo', 'alta'], pausado: ['Pausado', 'alerta'] };

  const postFluxos = (corpo) => ctx.postJson('/api/email/fluxos', corpo);
  const quandoCurto = (t) => new Date(t * 1000).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '');

  async function lista() {
    el.innerHTML = '<p class="aviso">Carregando os fluxos…</p>';
    let d;
    try { d = await ctx.fetchJson(`/api/email/fluxos?${verArquivados ? 'arquivados=1&' : ''}_=${Date.now()}`); }
    catch (e) { el.innerHTML = `<div class="aviso falha">Não foi possível carregar os fluxos (${esc(e.message)}). Tente de novo em instantes.</div>`; return; }
    if (F) return;
    el.innerHTML = `<div class="em-barra"><p class="mini">Cada fluxo começa sozinho quando a pessoa faz algo (vira lead, compra, agenda). Sai pelo canal de marketing.</p>
        <div class="ag-acoes"><button class="btn sec" type="button" data-arquivados aria-pressed="${verArquivados}">${verArquivados ? 'Ver fluxos em uso' : `Arquivados (${int(d.arquivados)})`}</button><button class="btn" type="button" data-novo>Novo fluxo</button></div></div>
      <div class="tabela-wrap" id="fx-lista"></div>`;
    $q('[data-arquivados]').onclick = () => { verArquivados = !verArquivados; lista(); };
    const bn = $q('[data-novo]');
    bn.onclick = () => U().ocupado(bn, async () => {
      try {
        const r = await postFluxos({ acao: 'criar', nome: 'Fluxo sem nome' });
        verArquivados = false;
        await abrir(r.fluxo.id, 'n1');
        U().avisar('Fluxo criado. Comece escolhendo o gatilho no cartão de início.');
      } catch (e) { U().avisar(U().msgErro(e), 'erro'); }
    });
    const alvo = $q('#fx-lista');
    ctx.tabela(alvo, [
      { titulo: 'Fluxo', campo: 'nome', render: (f) => `<button type="button" class="ag-link-linha" data-acao="abrir" data-id="${f.id}">${esc(f.nome)}</button>` },
      { titulo: 'Gatilhos', render: (f) => `<span class="mini">${esc(resumoGatilhos(f))}</span>` },
      { titulo: 'Situação', campo: 'situacao', render: (f) => U().carimbo(SIT, f.situacao) },
      { titulo: 'Dentro agora', num: true, render: (f) => (f.situacao === 'rascunho' ? '–' : int(f.totais.dentro)) },
      { titulo: 'Concluíram', num: true, render: (f) => (f.situacao === 'rascunho' ? '–' : int(f.totais.concluiram)) },
      { titulo: 'Clique', num: true, render: (f) => (f.totais.clique == null ? '–' : U().pct(f.totais.clique * 100)) },
      { titulo: 'Editado', render: (f) => esc(quandoCurto(f.atualizado_em)) },
      { titulo: '', render: (f) => `<div class="ag-acoes ag-acoes--linha">${U().menuHtml(f.nome, f.arquivado ? [
        { acao: 'desarquivar', id: f.id, rotulo: 'Tirar do arquivo' }, { acao: 'duplicar', id: f.id, rotulo: 'Duplicar' },
      ] : [
        { acao: 'abrir', id: f.id, rotulo: 'Abrir quadro' },
        { acao: 'duplicar', id: f.id, rotulo: 'Duplicar' },
        f.situacao === 'ativo' && { acao: 'pausar', id: f.id, rotulo: 'Pausar' },
        f.situacao === 'pausado' && { acao: 'retomar', id: f.id, rotulo: 'Retomar' },
        { acao: 'arquivar', id: f.id, rotulo: 'Arquivar', perigo: true },
      ])}</div>` },
    ], d.fluxos, undefined, verArquivados ? 'Nenhum fluxo arquivado.' : 'Nenhum fluxo ainda. Um fluxo junta gatilho, e-mails, esperas e desvios num quadro, como no ManyChat.');
    const acao = (corpo, aviso) => async () => {
      try { await postFluxos(corpo); U().avisar(aviso); lista(); } catch (e) { U().avisar(U().msgErro(e), 'erro'); }
    };
    U().ligarAcoes(alvo, {
      abrir: (id) => abrir(Number(id)),
      duplicar: (id) => acao({ acao: 'duplicar', id: Number(id) }, 'Fluxo duplicado como rascunho.')(),
      desarquivar: (id) => acao({ acao: 'desarquivar', id: Number(id) }, 'Fluxo de volta na lista.')(),
      pausar: (id) => acao({ acao: 'pausar', id: Number(id) }, 'Fluxo pausado. Ninguém novo entra e quem está dentro parou onde estava.')(),
      retomar: (id) => acao({ acao: 'retomar', id: Number(id) }, 'Fluxo retomado. Cada pessoa segue de onde parou.')(),
      arquivar: (id, b) => ctx.pedirConfirmacao(b, 'Arquivar o fluxo?', () => { U().fecharMenus(); acao({ acao: 'arquivar', id: Number(id) }, 'Fluxo arquivado.')(); }),
    });
  }

  async function abrir(id, abrirNo) {
    el.innerHTML = '<p class="aviso">Abrindo o quadro…</p>';
    let d, m;
    try {
      [d, m] = await Promise.all([ctx.fetchJson(`/api/email/fluxos?id=${id}&_=${Date.now()}`), ctx.fetchJson(`/api/email/modelos?_=${Date.now()}`)]);
    } catch (e) { el.innerHTML = `<div class="aviso falha">Não foi possível abrir o fluxo (${esc(e.message)}).</div>`; return; }
    OPC = d.opcoes;
    MODELOS = m.modelos;
    const f = d.fluxo;
    F = { id: f.id, nome: f.nome, situacao: f.situacao, versao: f.versao, nos: f.grafo.nos, arestas: f.grafo.arestas, notas: f.grafo.notas, problemas: f.problemas, salvoEm: quandoCurto(f.atualizado_em).slice(-5), mudancas: f.mudancas, saem: f.saem_ao_publicar, arquivado: !!f.arquivado };
    sel = null; selAresta = null; desfazer = []; refazer = []; marcados = new Set();
    salvar = { timer: null, rodando: false, pendente: false, erro: null };
    NUM = null;
    quadro();
    centralizar();
    // Cartões um em cima do outro (ex.: colados antes desta correção) escondem o
    // que está embaixo: organiza sozinho ao abrir.
    const sobrepostos = F.nos.some((a, i) => F.nos.some((b, j) => j > i && Math.abs(a.x - b.x) < 120 && Math.abs(a.y - b.y) < 60));
    if (sobrepostos) { organizar(); U().avisar('Havia cartões um em cima do outro: o quadro foi organizado.'); }
    if (abrirNo) selecionar(abrirNo);
    window.scrollTo(0, 0);
    carregarNumeros();
  }

  // Números da versão no ar, no período da barra (388). Falha não atrapalha o quadro.
  async function carregarNumeros() {
    if (!F || F.situacao === 'rascunho') return;
    const fluxo = F;
    try {
      const r = await ctx.fetchJson(`/api/email/fluxos?id=${fluxo.id}&numeros=${periodo}&_=${Date.now()}`);
      if (F !== fluxo) return;
      NUM = r.cartoes;
    } catch { if (F === fluxo) NUM = { erro: true }; }
    desenharCartoes(); desenharArestas(); desenharSituacao();
  }

  // Salvamento sozinho: 1 s depois da última mudança; uma chamada por vez.
  function agendarSalvar() {
    clearTimeout(salvar.timer);
    salvar.timer = setTimeout(salvarAgora, 1000);
    desenharSituacao();
  }
  async function salvarAgora() {
    clearTimeout(salvar.timer);
    salvar.timer = null;
    if (!F) return;
    if (salvar.rodando) { salvar.pendente = true; return; }
    salvar.rodando = true;
    const fluxo = F;
    try {
      const r = await postFluxos({ acao: 'salvar', id: fluxo.id, nome: fluxo.nome, versao: fluxo.versao, grafo: { nos: fluxo.nos, arestas: fluxo.arestas, notas: fluxo.notas } });
      fluxo.versao = r.versao;
      fluxo.problemas = r.problemas;
      fluxo.mudancas = r.mudancas;
      fluxo.saem = r.saem_ao_publicar;
      fluxo.salvoEm = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      salvar.erro = null;
    } catch (e) {
      salvar.erro = U().msgErro(e);
      // Conflito entre abas não se resolve tentando de novo.
      if (!(e.mensagemUsuario && /outra aba/.test(e.mensagemUsuario))) salvar.timer = setTimeout(salvarAgora, 10000);
    } finally {
      salvar.rodando = false;
    }
    if (F !== fluxo) return;
    if (salvar.pendente) { salvar.pendente = false; return salvarAgora(); }
    desenharCartoes(); desenharArestas(); desenharSituacao();
  }

  // ---------------------------------------------------------------------------
  // Quadro
  // ---------------------------------------------------------------------------
  function quadro() {
    el.innerHTML = `<div class="fx-topo">
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
          <button type="button" class="fx-ferr fx-ferr--txt" data-f="copiar" title="Copiar os cartões marcados (Shift + clique marca vários; Ctrl+C)">${IC.copiar} Copiar</button>
          <button type="button" class="fx-ferr fx-ferr--txt" data-f="colar" title="Colar (Ctrl+V), também em outro fluxo">${IC.copiar} Colar</button>
          ${F.situacao === 'rascunho' ? '' : `<select data-periodo aria-label="Período dos números">${[['7', '7 dias'], ['30', '30 dias'], ['tudo', 'Desde o início']].map(([v, r]) => `<option value="${v}"${v === periodo ? ' selected' : ''}>${r}</option>`).join('')}</select>`}
        </div>
        <div class="fx-mapa" id="fx-mapa" aria-label="Mapa em miniatura"><svg id="fx-mapa-svg"></svg></div>
        <aside class="fx-painel" id="fx-painel" hidden></aside>
        <div class="fx-escolha" id="fx-escolha" hidden></div>
      </div>
      <p class="mini fx-dica">Arraste o fundo para mover a tela · Ctrl + rolar ou pinça para zoom · arraste da bolinha de saída até outro cartão para ligar · clique no cartão para editar · Shift + clique marca vários para copiar.</p>`;
    $q('[data-voltar]').onclick = async () => {
      clearTimeout(salvar.timer);
      if (salvar.rodando || salvar.pendente || salvar.erro) await salvarAgora();
      F = null; lista();
    };
    $q('.fx-nome').onchange = (ev) => { mudar(() => { F.nome = ev.target.value.trim() || 'Fluxo sem nome'; }); };
    ligarFerramentas();
    ligarGestos();
    const sp = $q('[data-periodo]');
    if (sp) sp.onchange = () => { periodo = sp.value; carregarNumeros(); };
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
    agendarSalvar();
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
  // Os problemas que impedem publicar são calculados no servidor a cada
  // salvamento (GET/POST /api/email/fluxos).
  function problemas() {
    const ids = new Set(F.nos.map((n) => n.id));
    return (F.problemas || []).filter((p) => ids.has(p.no));
  }
  const EXPLICA_PROBLEMA = {
    'Sem gatilho': 'o início não tem gatilho', Solto: 'cartão solto, nada leva até ele', 'Sem modelo': 'e-mail sem modelo',
    'Sem condição': 'desvio sem condição', 'Sem fluxo de destino': 'falta escolher o fluxo de destino',
    'Saída sem destino': 'saída sem destino', 'Saídas sem destino': 'saídas sem destino',
    'Modelo arquivado': 'o modelo está arquivado', 'Modelo incompleto': 'o modelo está sem assunto ou sem texto',
    'Sem e-mail de referência': 'falta escolher o e-mail do fluxo',
  };

  function desenharSituacao() {
    const probs = problemas();
    const alvo = $q('#fx-situacao');
    let estado = U().carimbo(SIT, F.situacao);
    if (probs.length) estado += ` <span class="carimbo queda">${probs.length} ${probs.length > 1 ? 'problemas' : 'problema'}</span>`;
    const nota = salvar.erro ? `Não foi possível salvar (${esc(salvar.erro)}). Tentando de novo…`
      : salvar.rodando || salvar.timer ? 'Salvando…'
      : `Rascunho salvo às ${esc(F.salvoEm)}. Ninguém entra até publicar.`;
    const s = F.situacao;
    if (s !== 'rascunho' && F.mudancas) estado += ' <span class="carimbo alerta">Mudanças não publicadas</span>';
    const notaSit = s !== 'rascunho' && F.mudancas ? `Rascunho salvo às ${esc(F.salvoEm)}. O fluxo no ar segue a versão anterior até você publicar.`
      : s === 'ativo' ? 'No ar. Quem dispara o gatilho entra; quem já esteve não entra de novo.'
      : s === 'pausado' ? 'Pausado. Ninguém novo entra e quem está dentro parou onde estava.' : nota;
    const testar = `${s !== 'rascunho' ? '<button class="btn sec" type="button" data-s="pessoas">Pessoas no fluxo</button>' : ''}<button class="btn sec" type="button" data-s="testar">Testar</button>`;
    const botoes = s === 'rascunho' ? `${testar}<button class="btn" type="button" data-s="publicar">Publicar</button>`
      : `${testar}${F.mudancas ? '<button class="btn perigo" type="button" data-s="descartar">Descartar mudanças</button><button class="btn" type="button" data-s="publicar">Publicar mudanças</button>' : ''}${s === 'ativo' ? '<button class="btn sec" type="button" data-s="pausar">Pausar</button>' : '<button class="btn" type="button" data-s="retomar">Retomar</button>'}`;
    // Arquivado: não roda e não se publica; a única ação é tirar do arquivo.
    alvo.innerHTML = F.arquivado
      ? `<div class="fx-estado"><span class="carimbo neutro">Arquivado</span><span class="mini">Fora da lista e parado. Tire do arquivo para editar, testar ou publicar.</span></div><div class="ag-acoes"><button class="btn" type="button" data-s="desarquivar">Tirar do arquivo</button></div>`
      : `<div class="fx-estado">${estado}<span class="mini">${s === 'rascunho' ? nota : `${notaSit}${salvar.erro ? ` ${nota}` : ''}`}</span></div><div class="ag-acoes">${botoes}</div>`;
    alvo.querySelectorAll('[data-s]').forEach((b) => { b.onclick = () => acaoSituacao(b.dataset.s, b); });
    const caixa = $q('#fx-problemas');
    caixa.innerHTML = probs.length ? `<div class="aviso alerta fx-probs"><b>Para publicar, falta resolver:</b> ${probs.map((p) => `<button type="button" class="argo-faixa-chamada" data-ir-no="${p.no}">${esc(rotuloNo(no(p.no)))}: ${p.textos.map((t) => EXPLICA_PROBLEMA[t] || t).join(', ')}</button>`).join(' · ')}</div>` : '';
    caixa.querySelectorAll('[data-ir-no]').forEach((b) => { b.onclick = () => { focarNo(b.dataset.irNo); selecionar(b.dataset.irNo); }; });
  }

  // Publicar (só rascunho sem problemas), pausar e retomar: o servidor decide.
  function acaoSituacao(acao, b) {
    if (acao === 'testar') return testarFluxo();
    if (acao === 'pessoas') return pessoasNoFluxo();
    if (acao === 'desarquivar') {
      return U().ocupado(b, async () => {
        try { await postFluxos({ acao: 'desarquivar', id: F.id }); F.arquivado = false; desenharSituacao(); U().avisar('Fluxo de volta na lista.'); }
        catch (e) { U().avisar(U().msgErro(e), 'erro'); }
      });
    }
    const mudancas = F.situacao !== 'rascunho';
    const PERGUNTA = {
      publicar: mudancas
        ? `Publicar mudanças? Quem está dentro continua do cartão em que está. ${F.saem ? `${F.saem} ${F.saem > 1 ? 'pessoas estão em cartões excluídos e vão sair' : 'pessoa está num cartão excluído e vai sair'} do fluxo.` : 'Ninguém sai.'}`
        : 'Publicar? Quem disparar o gatilho a partir de agora entra; quem disparou antes fica de fora.',
      descartar: 'Descartar tudo que não foi publicado? O quadro volta para a versão no ar.',
      pausar: 'Pausar? Ninguém novo entra e quem está dentro para onde está.',
      retomar: 'Retomar? Cada pessoa segue de onde parou, sem receber de uma vez o que acumulou.',
    };
    const AVISO = { publicar: mudancas ? 'Mudanças publicadas.' : 'Fluxo publicado.', descartar: 'Mudanças descartadas. O quadro voltou para a versão no ar.', pausar: 'Fluxo pausado.', retomar: 'Fluxo retomado.' };
    ctx.pedirConfirmacao(b, PERGUNTA[acao], async () => {
      try {
        clearTimeout(salvar.timer);
        if (salvar.rodando || salvar.pendente || salvar.erro || salvar.timer) await salvarAgora();
        const r = await postFluxos({ acao, id: F.id, versao: F.versao });
        Object.assign(F, { situacao: r.fluxo.situacao, problemas: r.fluxo.problemas, versao: r.fluxo.versao, mudancas: r.fluxo.mudancas, saem: r.fluxo.saem_ao_publicar });
        if (acao === 'descartar') {
          Object.assign(F, { nos: r.fluxo.grafo.nos, arestas: r.fluxo.grafo.arestas, notas: r.fluxo.grafo.notas });
          desfazer = []; refazer = []; fecharPainel(); desenharTudo();
        }
        desenharSituacao();
        U().avisar(acao === 'publicar' && r.fluxo.sairam ? `${AVISO.publicar} ${r.fluxo.sairam} ${r.fluxo.sairam > 1 ? 'pessoas saíram' : 'pessoa saiu'} por estar em cartão excluído.` : AVISO[acao]);
      } catch (e) {
        U().avisar(U().msgErro(e), 'erro');
        const p = problemas();
        if (acao === 'publicar' && p.length) { focarNo(p[0].no); selecionar(p[0].no); }
        return false;
      }
    }, [{ valor: true, rotulo: { publicar: mudancas ? 'Publicar mudanças' : 'Publicar', descartar: 'Descartar', pausar: 'Pausar', retomar: 'Retomar' }[acao] }]);
  }

  // --- Quem está dentro (388): do fluxo todo ou de um cartão ---
  async function pessoasNoFluxo(noId) {
    const fluxo = F;
    const g = U().gaveta({
      titulo: noId ? 'Esperando neste cartão' : 'Pessoas no fluxo', sub: esc(fluxo.nome),
      corpo: '<div class="tabela-wrap" id="fx-pessoas"><p class="aviso">Carregando…</p></div><div class="paginacao" id="fx-pessoas-mais"></div>',
    });
    let pagina = 1, linhas = [];
    const carregar = async (p) => {
      let d;
      try { d = await ctx.fetchJson(`/api/email/fluxos?id=${fluxo.id}&pessoas=1${noId ? `&no=${encodeURIComponent(noId)}` : ''}&pagina=${p}&_=${Date.now()}`); }
      catch (e) { g.querySelector('#fx-pessoas').innerHTML = `<div class="aviso falha">${esc(U().msgErro(e))}</div>`; return; }
      pagina = p;
      linhas = p === 1 ? d.pessoas : linhas.concat(d.pessoas);
      const cartao = (id) => { const n = fluxo.nos.find((x) => x.id === id); return n ? rotuloNo(n) : 'cartão excluído no rascunho'; };
      g.querySelector('#fx-pessoas').innerHTML = linhas.length ? `<table><thead><tr><th>Pessoa</th><th>Cartão</th><th>Desde</th><th></th></tr></thead><tbody>
        ${linhas.map((c) => `<tr><td>${c.email ? `<button type="button" class="ag-link-linha" data-contato="${c.contato_id}">${esc(c.nome || c.email)}</button>` : '<span class="mini">contato removido</span>'}</td>
          <td><span class="mini">${esc(cartao(c.no_atual))}${c.situacao === 'esperando' ? ' · esperando' : ''}</span></td><td><span class="mini">${esc(quandoCurto(c.atualizado_em))}</span></td>
          <td><button type="button" class="btn sec fx-pequeno" data-tirar-pessoa="${c.contato_id}">Tirar do fluxo</button></td></tr>`).join('')}</tbody></table>`
        : '<p class="aviso">Ninguém aqui agora.</p>';
      const mais = g.querySelector('#fx-pessoas-mais');
      mais.innerHTML = d.total > linhas.length ? `<span class="mini">mostrando ${int(linhas.length)} de ${int(d.total)}</span><button class="btn sec" type="button">Mostrar mais ${d.por_pagina}</button>` : '';
      const b = mais.querySelector('button');
      if (b) b.onclick = () => carregar(pagina + 1);
    };
    g.addEventListener('click', (ev) => {
      const c = ev.target.closest('[data-contato]');
      if (c) { U().abrirContato(c.dataset.contato); return; }
      const t = ev.target.closest('[data-tirar-pessoa]');
      if (t) ctx.pedirConfirmacao(t, 'Tirar do fluxo?', async () => {
        try {
          await postFluxos({ acao: 'tirar', id: fluxo.id, contato_id: Number(t.dataset.tirarPessoa) });
          U().avisar('Tirado do fluxo. Fica registrado no histórico do contato.');
          carregar(1);
          carregarNumeros();
        } catch (e) { U().avisar(U().msgErro(e), 'erro'); return false; }
      });
    });
    carregar(1);
  }

  // --- Teste passo a passo (387): o servidor anda um cartão do rascunho por vez ---
  let paraTesteFluxo = '';
  async function testarFluxo() {
    clearTimeout(salvar.timer);
    if (salvar.rodando || salvar.pendente || salvar.erro || salvar.timer) await salvarAgora();
    if (problemas().length) return U().avisar('Resolva os problemas marcados no quadro antes de testar.', 'erro');
    const g = U().gaveta({
      titulo: 'Testar o fluxo', sub: 'a pessoa de teste percorre o rascunho pulando as esperas; ninguém entra no fluxo',
      corpo: `<form class="ag-form" data-teste-form novalidate><label class="ag-campo"><span class="ag-campo__rotulo">Mandar os e-mails para</span>
          <input type="email" name="para" value="${esc(paraTesteFluxo)}" placeholder="e-mail da equipe" autocomplete="email"></label></form>
        <ol class="ag-hist em-hist fx-teste" id="fx-teste"></ol><div class="ag-acoes" id="fx-teste-acao"><button class="btn" type="button" data-comecar>Começar o teste</button></div>`,
    });
    const lista = g.querySelector('#fx-teste'), acao = g.querySelector('#fx-teste-acao'), f = g.querySelector('[data-teste-form]');
    const linha = (html) => { lista.insertAdjacentHTML('beforeend', `<li>${html}</li>`); };
    const passo = async (no, saida) => {
      acao.innerHTML = '<span class="mini">Andando…</span>';
      let r;
      try { r = await postFluxos({ acao: 'testar', id: F.id, para: f.para.value, no, saida }); }
      catch (e) { acao.innerHTML = ''; linha(`<span class="queda">${esc(U().msgErro(e))}</span>`); return; }
      const n = no ? F.nos.find((x) => x.id === r.no) : null;
      linha(`<b>${esc(n ? rotuloNo(n) : TIPOS[r.tipo].rotulo)}</b> <span class="mini">${esc(r.texto)}</span>`);
      if (r.escolhas) {
        acao.innerHTML = r.escolhas.map(([k, rot]) => `<button class="btn sec" type="button" data-escolha="${k}">${esc(rot)}</button>`).join('');
        acao.querySelectorAll('[data-escolha]').forEach((b) => { b.onclick = () => passo(r.no, b.dataset.escolha); });
        return;
      }
      if (r.repetir) { acao.innerHTML = '<button class="btn sec" type="button" data-de-novo>Tentar este cartão de novo</button>'; acao.querySelector('[data-de-novo]').onclick = () => passo(r.no); return; }
      if (r.fim || !r.proximo) { acao.innerHTML = '<span class="mini">Fim do teste. Os e-mails aparecem em Configuração › Últimos testes.</span>'; return; }
      passo(r.proximo);
    };
    g.querySelector('[data-comecar]').onclick = () => {
      paraTesteFluxo = f.para.value.trim();
      lista.innerHTML = '';
      passo(undefined);
    };
  }

  // "E-mail 2" quando há mais de um cartão do mesmo tipo: o mesmo nome no
  // cartão, no painel e na lista de problemas.
  function rotuloTipo(n) {
    const iguais = F.nos.filter((x) => x.tipo === n.tipo);
    return iguais.length > 1 ? `${TIPOS[n.tipo].rotulo} ${iguais.indexOf(n) + 1}` : TIPOS[n.tipo].rotulo;
  }
  function rotuloNo(n) {
    if (!n) return '';
    if (n.tipo === 'email') { const m = modelo(n.dados.modelo); return m ? `${rotuloTipo(n)} "${m.nome}"` : rotuloTipo(n); }
    return rotuloTipo(n);
  }

  // ---------------------------------------------------------------------------
  // Cartões
  // ---------------------------------------------------------------------------
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
    if (n.tipo === 'objetivo') return EVENTOS[d.evento] ? `<p><b>${esc(EVENTOS[d.evento].rotulo)}</b>${d.filtro ? `<br><span class="mini">${esc(valorRot(EVENTOS[d.evento].filtros[0], d.filtro))}</span>` : ''}</p><p class="mini">Quem cumprir pula para cá, de onde estiver.</p>` : '<p class="fx-vazio">Escolha a condição.</p>';
    if (n.tipo === 'ir_fluxo') { const f = (OPC.fluxos || []).find((x) => String(x[0]) === String(d.fluxo)); return f ? `<p>Vai para <b>${esc(f[1])}</b></p>` : '<p class="fx-vazio">Escolha o fluxo de destino.</p>'; }
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

  // Números no cartão (388).
  function numerosHtml(n) {
    if (!F || F.situacao === 'rascunho' || !NUM) return '';
    if (NUM.erro) return '<div class="fx-nums fx-nums--vazio">sem números agora</div>';
    const s = NUM[n.id];
    if (!s) return '<div class="fx-nums fx-nums--vazio">só no rascunho</div>';
    const tx = (a, b) => (b ? U().pct((a / b) * 100, 0) : '–');
    const cel = (rot, v, extra = '') => `<div><span>${rot}</span><b>${int(v)}</b>${extra ? `<small>${extra}</small>` : ''}</div>`;
    if (n.tipo === 'email') return `<div class="fx-nums">${cel('Receberam', s.receberam)}${cel('Abriram', s.abriram, tx(s.abriram, s.receberam))}${cel('Clicaram', s.clicaram, tx(s.clicaram, s.receberam))}</div>`;
    if (n.tipo === 'inicio') return `<div class="fx-nums">${cel('Entraram', s.entraram)}</div>`;
    if (n.tipo === 'espera') return `<div class="fx-nums"><button type="button" class="fx-esperando" data-esperando="${n.id}"><b>${int(s.esperando)}</b> esperando agora</button></div>`;
    if (n.tipo === 'objetivo') return `<div class="fx-nums">${cel('Chegaram', s.chegaram)}</div>`;
    if (n.tipo === 'fim') return `<div class="fx-nums">${cel('Concluíram', s.concluiram)}</div>`;
    if (n.tipo === 'ir_fluxo') return `<div class="fx-nums">${cel('Passaram', s.passaram)}</div>`;
    return '';
  }
  const numeroDaSaida = (n, saida) => {
    const s = NUM && !NUM.erro && F.situacao !== 'rascunho' ? NUM[n.id] : null;
    return s && s[saida] !== undefined ? ` <b>${int(s[saida])}</b>` : '';
  };

  function desenharCartoes() {
    const probs = Object.fromEntries(problemas().map((p) => [p.no, p.textos]));
    const html = F.nos.map((n) => {
      const sai = saidasDe(n);
      const p = probs[n.id];
      const primeiro = p && p.find((t) => !t.startsWith('Saída'));
      const nome = `${rotuloNo(n)}${p ? `, problema: ${p.map((t) => EXPLICA_PROBLEMA[t] || t).join(', ')}` : ''}`;
      return `<div class="fx-cartao fx-cartao--${n.tipo}${sel === n.id || marcados.has(n.id) ? ' fx-sel' : ''}${primeiro ? ' fx-problema' : ''}" data-no="${n.id}" style="left:${n.x}px;top:${n.y}px"
        tabindex="0" role="button" aria-label="${esc(nome)}. Enter abre para editar."${sel === n.id ? ' aria-pressed="true"' : ''}>
        ${n.tipo === 'inicio' ? '' : '<span class="fx-entrada" aria-hidden="true"></span>'}
        ${primeiro ? `<span class="fx-selo-problema">${esc(primeiro)}</span>` : ''}
        <div class="fx-cabeca">${IC[n.tipo]}<span>${esc(rotuloTipo(n))}</span></div>
        <div class="fx-corpo">${corpoCartao(n)}</div>
        ${numerosHtml(n)}
        ${sai.length ? `<div class="fx-saidas">${sai.map(([s, rot]) => {
          const ligada = F.arestas.some((a) => a.de === n.id && a.saida === s);
          return `<div class="fx-saida"><span>${rot}${numeroDaSaida(n, s)}</span>
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
        acao = { tipo: 'mover', item, obj, ini: p, orig: { x: obj.x, y: obj.y }, moveu: false, shift: ev.shiftKey, antes: instantaneo(F) + '\u0000' + F.nome };
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
        } else if (a.item.dataset.no && a.shift) marcar(a.item.dataset.no);
        else if (a.item.dataset.no) { marcados = new Set(); selecionar(a.item.dataset.no); }
        else editarNota(a.item.dataset.nota);
        return;
      }
      if (a.tipo === 'tela' && !a.moveu) {
        selAresta = null; desenharArestas();
        if (marcados.size) { marcados = new Set(); desenharCartoes(); desenharArestas(); }
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
      if (esp) pessoasNoFluxo(esp.dataset.esperando);
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
      else if ((ev.ctrlKey || ev.metaKey) && k === 'c') { ev.preventDefault(); copiar(); }
      else if ((ev.ctrlKey || ev.metaKey) && k === 'v') { ev.preventDefault(); colar(); }
      else if (k === 'delete' || k === 'backspace') {
        if (selAresta) { const id = selAresta; selAresta = null; mudar(() => { F.arestas = F.arestas.filter((a) => a.id !== id); }); U().avisar('Ligação desfeita.'); }
      } else if (k === 'escape') { fecharEscolha(); if (sel) fecharPainel(); }
      else if ((k === 'enter' || k === ' ') && ev.target.closest && ev.target.closest('.fx-cartao')) {
        // Cartão com foco do teclado: Enter ou espaço abre o painel (Shift marca para copiar).
        ev.preventDefault();
        const id = ev.target.closest('.fx-cartao').dataset.no;
        if (ev.shiftKey) marcar(id); else { marcados = new Set(); selecionar(id); }
      }
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
        copiar: () => copiar(),
        colar: () => colar(),
      })[b.dataset.f]();
    });
  }

  // --- Copiar e colar (Shift + clique marca vários; Ctrl+C / Ctrl+V) ---
  // A cópia fica na memória da página: dá para abrir outro fluxo e colar lá.
  function marcar(id) {
    if (no(id).tipo === 'inicio') return U().avisar('O cartão de início não é copiado.');
    if (marcados.has(id)) marcados.delete(id); else marcados.add(id);
    if (sel) fecharPainel();
    desenharCartoes(); desenharArestas();
  }
  function copiar() {
    const ids = new Set(marcados.size ? marcados : sel ? [sel] : []);
    const nos = F.nos.filter((n) => ids.has(n.id) && n.tipo !== 'inicio');
    if (!nos.length) return U().avisar('Marque os cartões com Shift + clique (ou abra um) antes de copiar.', 'erro');
    const dentro = new Set(nos.map((n) => n.id));
    areaCopia = JSON.parse(JSON.stringify({ nos, arestas: F.arestas.filter((a) => dentro.has(a.de) && dentro.has(a.para)) }));
    U().avisar(`${nos.length} ${nos.length > 1 ? 'cartões copiados' : 'cartão copiado'}. Cole aqui ou em outro fluxo com Ctrl+V.`);
  }
  function colar() {
    if (!areaCopia) return U().avisar('Nada copiado ainda.', 'erro');
    const novo = {};
    areaCopia.nos.forEach((n) => { novo[n.id] = novoId('n'); });
    const minX = Math.min(...areaCopia.nos.map((n) => n.x)), minY = Math.min(...areaCopia.nos.map((n) => n.y));
    const q = $q('#fx-quadro');
    const ox = Math.round((q.clientWidth / 2 - vis.x) / vis.z - 120);
    let oy = Math.round((q.clientHeight / 2 - vis.y) / vis.z - 60);
    const bate = (y0) => areaCopia.nos.some((c) => F.nos.some((n) => Math.abs(n.x - (ox + c.x - minX)) < 260 && Math.abs(n.y - (y0 + c.y - minY)) < 160));
    for (let i = 0; i < 30 && bate(oy); i++) oy += 170;
    const ref = (r) => novo[r] || (no(r) && no(r).tipo === 'email' ? r : '');
    mudar(() => {
      areaCopia.nos.forEach((n) => {
        const dados = JSON.parse(JSON.stringify(n.dados));
        // E-mail de referência que não veio junto (nem existe aqui) fica vazio e é apontado.
        if ('ref' in dados) dados.ref = ref(dados.ref);
        (dados.condicoes || []).forEach((c) => { if ('ref' in c) c.ref = ref(c.ref); });
        F.nos.push({ id: novo[n.id], tipo: n.tipo, x: ox + (n.x - minX), y: oy + (n.y - minY), dados });
      });
      areaCopia.arestas.forEach((a) => F.arestas.push({ id: novoId('a'), de: novo[a.de], saida: a.saida, para: novo[a.para] }));
    });
    marcados = new Set(Object.values(novo));
    desenharCartoes(); desenharArestas();
    U().avisar(`${areaCopia.nos.length} ${areaCopia.nos.length > 1 ? 'cartões colados' : 'cartão colado'}. Ligue onde quiser.`);
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
          <p class="fx-estimativa" data-estimativa="${i}">Contando quantas pessoas teriam entrado nos últimos 30 dias…</p>
        </div>`).join('')}
        <button type="button" class="btn sec" data-add-g>+ Adicionar gatilho</button>`;
    } else if (n.tipo === 'email') {
      const mk = MODELOS.filter((x) => x.canal === 'marketing' && (!x.arquivado || String(x.id) === String(d.modelo)));
      const m = modelo(d.modelo);
      corpo = `<label class="ag-campo"><span class="ag-campo__rotulo">Modelo</span><select data-campo="modelo">${opts(mk.map((x) => [x.id, x.nome]), d.modelo, 'Escolha um modelo')}</select></label>
        ${m ? `<div class="fx-previa-email"><span class="mini">${esc(D().config.marketing.nome)}</span><b>${esc(m.assunto)}</b><span class="mini">${esc(m.previa)}</span></div><p class="mini">Para mudar o texto, edite o modelo em Modelos.</p>` : ''}
        <details class="ag-mais" data-novo-modelo><summary>Criar modelo novo sem sair do fluxo</summary>
          <label class="ag-campo"><span class="ag-campo__rotulo">Nome</span><input type="text" data-nm="nome" maxlength="100" placeholder="Ex.: Boas-vindas 3"></label>
          <p class="mini">O modelo nasce vazio e já fica escolhido aqui. Escreva o assunto e o texto em Modelos; até lá o cartão fica marcado.</p>
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
          ${c.tipo === 'clicou' ? `<input type="text" data-campo="clink" value="${esc(c.link && c.link !== 'qualquer' ? c.link : '')}" placeholder="em qualquer link (ou cole o link)" aria-label="Link">` : ''}
          ${c.tipo === 'evento' ? `<select data-campo="cevento" aria-label="Acontecimento">${opts(Object.entries(EVENTOS).filter(([k]) => k !== 'segmento').map(([k, v]) => [k, v.rotulo]), c.evento)}</select>
            ${EVENTOS[c.evento] ? `<select data-campo="cvalor" aria-label="Filtro">${opts(FILTRO_VALORES[EVENTOS[c.evento].filtros[0]](), c.valor, 'qualquer ' + FILTRO_ROTULO[EVENTOS[c.evento].filtros[0]].toLowerCase())}</select>` : ''}` : ''}
          ${c.tipo === 'segmento' ? `<select data-campo="cvalor" aria-label="Segmento">${opts(FILTRO_VALORES.segmento(), c.valor)}</select>` : ''}
        </div>`).join('')}
        <button type="button" class="btn sec" data-add-c>+ Adicionar condição</button>`;
    } else if (n.tipo === 'objetivo') {
      const campo = EVENTOS[d.evento] ? EVENTOS[d.evento].filtros[0] : null;
      corpo = `<p class="mini">Quando a condição acontece, a pessoa pula direto para cá, de onde estiver no fluxo, e segue daqui.</p>
        <label class="ag-campo"><span class="ag-campo__rotulo">Condição</span><select data-campo="evento">${opts(Object.entries(EVENTOS).map(([k, v]) => [k, v.rotulo]), d.evento, 'Escolha a condição')}</select></label>
        ${campo ? `<select data-campo="filtro" aria-label="Filtro">${opts(FILTRO_VALORES[campo](), d.filtro, 'qualquer ' + FILTRO_ROTULO[campo].toLowerCase())}</select>` : ''}`;
    } else if (n.tipo === 'ir_fluxo') {
      corpo = `<label class="ag-campo"><span class="ag-campo__rotulo">Fluxo de destino</span><select data-campo="fluxo">${opts((OPC.fluxos || []).filter(([id]) => String(id) !== String(F.id)), d.fluxo, 'Escolha o fluxo')}</select></label>
        <p class="mini">A pessoa sai deste fluxo e entra no início do outro.</p>`;
    } else if (n.tipo === 'fim') {
      corpo = '<p class="mini">A pessoa conclui o fluxo aqui. Também saem sozinhos, sem precisar configurar, quem se descadastra, quem tem o e-mail voltando e quem denuncia spam.</p>';
    }
    p.innerHTML = `<header class="fx-painel__topo">${IC[n.tipo]}<div><b>${TIPOS[n.tipo].rotulo}</b><span class="mini">${TIPOS[n.tipo].desc}</span></div>
        <button type="button" class="ag-gaveta__fechar" data-fechar-painel aria-label="Fechar">${IC.fechar}</button></header>
      <div class="fx-painel__corpo ag-form">${corpo}</div>
      <footer class="fx-painel__pe">${n.tipo === 'inicio' ? '<span class="mini">O início não pode ser excluído.</span>' : `<button type="button" class="btn sec" data-dup>${IC.copiar} Duplicar</button><button type="button" class="btn perigo" data-excluir>${IC.lixo} Excluir</button>`}</footer>`;
    p.hidden = false;
    ligarPainel(p, n);
    if (n.tipo === 'inicio') estimar(p, d.gatilhos);
  }

  // Contagem do gatilho (contatos ativos nos últimos 30 dias), feita no servidor.
  let estimativaTimer = null;
  function estimar(p, gatilhos) {
    clearTimeout(estimativaTimer);
    estimativaTimer = setTimeout(() => gatilhos.forEach(async (g, i) => {
      const alvo = p.querySelector(`[data-estimativa="${i}"]`);
      if (!alvo) return;
      try {
        const r = await postFluxos({ acao: 'estimar', gatilho: g });
        if (alvo.isConnected) alvo.innerHTML = `Nos últimos 30 dias, <b>${int(r.pessoas)} ${r.pessoas === 1 ? 'pessoa' : 'pessoas'}</b> teriam entrado com essa combinação.`;
      } catch { if (alvo.isConnected) alvo.textContent = 'Não foi possível contar agora.'; }
    }), 400);
  }

  function ligarPainel(p, n) {
    const d = n.dados;
    p.querySelector('[data-fechar-painel]').onclick = () => fecharPainel();
    p.onchange = (ev) => {
      const c = ev.target.dataset.campo;
      if (!c) return;
      const v = ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value;
      const g = ev.target.closest('[data-g]'), f = ev.target.closest('[data-f]'), cc = ev.target.closest('[data-c]');
      mudar(() => {
        if (n.tipo === 'inicio') {
          const gat = d.gatilhos[Number(g.dataset.g)];
          if (c === 'evento') { gat.evento = v; gat.filtros = []; }
          if (c === 'fcampo') { const fi = gat.filtros[Number(f.dataset.f)]; fi.campo = v; fi.valor = primeiroValor(v); }
          if (c === 'fvalor') gat.filtros[Number(f.dataset.f)].valor = v;
        } else if (n.tipo === 'desvio' && c !== 'juncao') {
          const co = d.condicoes[Number(cc.dataset.c)];
          if (c === 'ctipo') { Object.keys(co).forEach((k) => delete co[k]); co.tipo = v; if (v === 'evento') co.evento = 'agendou'; if (v === 'segmento') co.valor = primeiroValor('segmento'); if (v === 'clicou') co.link = ''; }
          if (c === 'cref') co.ref = v;
          if (c === 'clink') co.link = v.trim();
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
    clique('[data-add-f]', (b) => mudar(() => { const gat = d.gatilhos[Number(b.closest('[data-g]').dataset.g)]; const campo = EVENTOS[gat.evento].filtros.find((x) => !gat.filtros.some((f) => f.campo === x)) || EVENTOS[gat.evento].filtros[0]; gat.filtros.push({ campo, valor: primeiroValor(campo) }); }));
    clique('[data-tirar-f]', (b) => mudar(() => d.gatilhos[Number(b.closest('[data-g]').dataset.g)].filtros.splice(Number(b.dataset.tirarF), 1)));
    clique('[data-add-c]', () => mudar(() => d.condicoes.push({ tipo: 'abriu', ref: (emailsDoFluxo()[0] || [''])[0] })));
    clique('[data-tirar-c]', (b) => mudar(() => d.condicoes.splice(Number(b.dataset.tirarC), 1)));
    clique('[data-criar-modelo]', (b) => {
      const nome = p.querySelector('[data-nm="nome"]').value.trim();
      if (!nome) return U().avisar('Dê um nome ao modelo novo.', 'erro');
      U().ocupado(b, async () => {
        try {
          const r = await ctx.postJson('/api/email/modelos', { acao: 'salvar', modelo: { nome, canal: 'marketing' } });
          MODELOS.unshift(r.modelo);
          mudar(() => { d.modelo = r.modelo.id; });
          U().avisar(`Modelo "${nome}" criado e escolhido. Escreva o assunto e o texto em Modelos.`);
        } catch (e) { U().avisar(U().msgErro(e), 'erro'); }
      });
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

})();
