// Aba Agenda do dash (spec-agenda-propria.md, issues 356–363).
//
// Quatro vistas: Agendamentos (módulo 8), Tipos de reunião (3), Grades de
// horário (2) e Agendas conectadas (1). Só coleta e exibe: toda regra,
// validação e cálculo de horário mora em /api/agenda/* (a mensagem de erro
// mostrada é sempre a do servidor).
//
// Padrões de navegação (crítica de UX de 02/10/2026):
// - Tudo que abre a partir de uma linha abre na GAVETA lateral, ao lado do
//   clique: detalhe da reunião, horários livres, edição de tipo e de grade.
//   Nada aparece no fim da página.
// - Toda ação responde com um aviso curto (toast).
// - Ações de cada linha ficam numa engrenagem, igual em todas as vistas.
// - Edição na gaveta pergunta salvar/descartar antes de fechar com alteração.
//
// Arquivo próprio para não crescer o index.html; o index.html entrega os
// utilitários do dash pela ponte em `R.agenda`.
(() => {
  'use strict';

  const VISTAS = ['agendamentos', 'tipos', 'grades', 'agendas'];
  const DIAS = [['1', 'Segunda'], ['2', 'Terça'], ['3', 'Quarta'], ['4', 'Quinta'], ['5', 'Sexta'], ['6', 'Sábado'], ['0', 'Domingo']];
  const SITUACAO = {
    marcada: ['Marcada', 'neutro'], remarcada: ['Remarcada', 'neutro'], cancelada: ['Cancelada', 'queda'],
    realizada: ['Realizada', 'alta'], faltou: ['Faltou', 'queda'], sem_info: ['Sem informação de presença', 'neutro'],
  };
  const FUSO = 'America/Sao_Paulo';
  const quando = (t) => new Date(t * 1000).toLocaleString('pt-BR', { timeZone: FUSO, weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const hora = (t) => new Date(t * 1000).toLocaleTimeString('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' });
  const diaCurto = (t) => new Date(t * 1000).toLocaleDateString('pt-BR', { timeZone: FUSO, weekday: 'short', day: '2-digit', month: '2-digit' });
  const diaLongo = (ymd) => new Date(ymd + 'T12:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC', weekday: 'long', day: '2-digit', month: '2-digit' });

  const svg = (corpo) => `<svg viewBox="0 0 24 24" aria-hidden="true">${corpo}</svg>`;
  const ICONE = {
    engrenagem: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
    fechar: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
    cima: svg('<path d="M12 19V5M6 11l6-6 6 6"/>'),
    baixo: svg('<path d="M12 5v14M6 13l6 6 6-6"/>'),
    copiar: svg('<rect x="9" y="9" width="11" height="11" rx="1.5"/><path d="M5 15V5a1 1 0 0 1 1-1h9"/>'),
  };

  let ctx = null;
  let filtroTipos = 'ativos';
  let vistaReunioes = 'hoje';
  let filtroReuniao = { tipo: '', situacao: '' };

  const api = {
    vista: 'agendamentos',
    lerVista(v) { api.vista = VISTAS.includes(v) ? v : 'agendamentos'; },
    render,
  };
  window.AgendaDash = api;

  function el() { return ctx.$('#agenda-conteudo'); }
  const msgErro = (e) => (e && (e.mensagemUsuario || e.message)) || 'Não foi possível concluir. Tente de novo.';
  function erroHtml(e) { return `<div class="aviso falha">${ctx.esc(msgErro(e))}</div>`; }

  // ---------------------------------------------------------------------------
  // Aviso curto (toast): toda ação responde.
  // ---------------------------------------------------------------------------
  let toastTempo = null;
  function avisar(texto, tipo = 'ok') {
    let t = document.getElementById('ag-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'ag-toast';
      t.className = 'ag-toast';
      t.setAttribute('role', 'status');
      t.setAttribute('aria-live', 'polite');
      document.body.appendChild(t);
    }
    // Com a gaveta aberta (modal), o aviso precisa morar dentro dela para
    // aparecer acima do fundo escurecido.
    const g = document.getElementById('ag-gaveta');
    (g && g.open ? g : document.body).appendChild(t);
    t.textContent = texto;
    t.dataset.tipo = tipo;
    t.classList.add('visivel');
    clearTimeout(toastTempo);
    toastTempo = setTimeout(() => t.classList.remove('visivel'), tipo === 'erro' ? 6000 : 3200);
  }
  const avisarErro = (e) => avisar(msgErro(e), 'erro');

  // ---------------------------------------------------------------------------
  // Menu da engrenagem (igual em todas as vistas)
  // ---------------------------------------------------------------------------
  function menuHtml(rotulo, itens) {
    return `<div class="ag-menu">
      <button class="ag-engrenagem" type="button" data-menu aria-haspopup="menu" aria-expanded="false" aria-label="Opções de ${ctx.esc(rotulo)}">${ICONE.engrenagem}</button>
      <div class="ag-menu__lista" role="menu" hidden>
        ${itens.filter(Boolean).map((i) => `<button type="button" role="menuitem"${i.perigo ? ' class="perigo"' : ''} data-acao="${i.acao}" data-id="${ctx.esc(i.id)}">${ctx.esc(i.rotulo)}</button>`).join('')}
      </div></div>`;
  }
  function fecharMenus() {
    document.querySelectorAll('.ag-menu__lista').forEach((m) => { m.hidden = true; });
    document.querySelectorAll('[data-menu]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
  }
  function alternarMenu(botao) {
    const lista = botao.nextElementSibling;
    const abrir = lista.hidden;
    fecharMenus();
    if (!abrir) return;
    lista.hidden = false;
    botao.setAttribute('aria-expanded', 'true');
    // Posição fixa na tela: a tabela rola na horizontal, e um menu absoluto
    // dentro dela seria cortado. Perto do fim da tela, abre para cima.
    const r = botao.getBoundingClientRect();
    const acima = window.innerHeight - r.bottom < lista.offsetHeight + 16;
    lista.style.top = (acima ? r.top - lista.offsetHeight - 4 : r.bottom + 4) + 'px';
    lista.style.left = Math.max(8, r.right - lista.offsetWidth) + 'px';
    lista.querySelector('button').focus();
  }
  document.addEventListener('click', (ev) => { if (!ev.target.closest('.ag-menu')) fecharMenus(); });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') fecharMenus();
    // Setas dentro do menu aberto.
    const lista = ev.target.closest && ev.target.closest('.ag-menu__lista');
    if (lista && (ev.key === 'ArrowDown' || ev.key === 'ArrowUp')) {
      ev.preventDefault();
      const itens = [...lista.querySelectorAll('button')];
      const i = itens.indexOf(ev.target);
      itens[(i + (ev.key === 'ArrowDown' ? 1 : -1) + itens.length) % itens.length].focus();
    }
  });
  window.addEventListener('scroll', fecharMenus, true);

  /** Liga os cliques de uma tabela: engrenagem abre o menu; item chama acoes[acao](id, botao). */
  function ligarMenus(container, acoes) {
    container.onclick = async (ev) => {
      const b = ev.target.closest('button');
      if (!b) return;
      if (b.hasAttribute('data-menu')) return alternarMenu(b);
      const acao = b.dataset.acao;
      if (!acao || !acoes[acao]) return;
      // Excluir pede confirmação dentro do próprio menu; o resto fecha o menu.
      if (!b.closest('.ag-menu__lista') || !b.classList.contains('perigo')) fecharMenus();
      try { await acoes[acao](b.dataset.id, b); } catch (e) { avisarErro(e); }
    };
  }

  // ---------------------------------------------------------------------------
  // Gaveta lateral
  // ---------------------------------------------------------------------------
  function abrirGaveta() {
    let g = document.getElementById('ag-gaveta');
    if (!g) {
      g = document.createElement('dialog');
      g.id = 'ag-gaveta';
      g.className = 'ag-gaveta';
      const pedir = () => (g.pedirFechar ? g.pedirFechar() : g.close());
      // Clique no fundo escurecido e Esc pedem para fechar: com alteração não
      // salva, a edição pergunta antes.
      g.addEventListener('click', (ev) => { if (ev.target === g) pedir(); });
      g.addEventListener('cancel', (ev) => { ev.preventDefault(); pedir(); });
      g.addEventListener('close', () => { g.pedirFechar = null; });
      document.body.appendChild(g);
    }
    g.pedirFechar = null;
    if (!g.open) g.showModal();
    return g;
  }

  /** Gaveta de leitura/ação (sem formulário). Devolve a gaveta. */
  function gavetaSimples({ titulo, sub = '', corpo, rodape = '' }) {
    const g = abrirGaveta();
    g.innerHTML = `<div class="ag-gaveta__form ag-gaveta__form--simples">
      <header class="ag-gaveta__topo">
        <div><h2>${titulo}</h2>${sub ? `<p class="mini">${sub}</p>` : ''}</div>
        <button class="ag-gaveta__fechar" type="button" data-fechar aria-label="Fechar">${ICONE.fechar}</button>
      </header>
      <div class="ag-gaveta__corpo" id="ag-g-corpo">${corpo}</div>
      ${rodape ? `<footer class="ag-gaveta__rodape" id="ag-g-rodape">${rodape}</footer>` : ''}
    </div>`;
    g.querySelector('[data-fechar]').onclick = () => g.close();
    return g;
  }

  /**
   * Proteção de saída da gaveta com formulário: compara o retrato atual com o
   * de quando abriu; com diferença, pergunta salvar/descartar/continuar.
   */
  function protegerSaida(g, form, retrato) {
    const inicial = retrato();
    const aviso = g.querySelector('.ag-sair');
    g.pedirFechar = () => {
      if (retrato() === inicial) return g.close();
      aviso.hidden = false;
      aviso.querySelector('[data-sair="salvar"]').focus();
    };
    aviso.onclick = (ev) => {
      const b = ev.target.closest('[data-sair]');
      if (!b) return;
      aviso.hidden = true;
      if (b.dataset.sair === 'descartar') g.close();
      if (b.dataset.sair === 'salvar') form.requestSubmit();
    };
    g.querySelectorAll('[data-fechar]').forEach((b) => { b.onclick = () => g.pedirFechar(); });
  }
  const SAIR_HTML = `<div class="ag-sair" role="alertdialog" aria-label="Alterações não salvas" hidden>
      <p><b>Você tem alterações não salvas.</b> O que quer fazer?</p>
      <div class="ag-acoes"><button class="btn" type="button" data-sair="salvar">Salvar</button>
        <button class="btn perigo" type="button" data-sair="descartar">Descartar</button>
        <button class="btn sec" type="button" data-sair="voltar">Continuar editando</button></div>
    </div>`;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  async function render(c) {
    ctx = c;
    const sec = ctx.$('#secao-agenda');
    sec.querySelectorAll('[data-agenda-vista]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.agendaVista === api.vista));
      b.onclick = () => { api.vista = b.dataset.agendaVista; ctx.escreverUrl(); ctx.rerender(); };
    });
    el().innerHTML = '<div class="aviso">Carregando…</div>';
    el().onclick = null;
    el().onchange = null;
    await ({ agendamentos, tipos, grades, agendas })[api.vista]();
  }

  // Só "Todas", em Agendamentos, usa o período do topo.
  function filtroDeDatas(mostrar, nota) {
    ['#preset'].forEach((s) => { ctx.$(s).hidden = !mostrar; });
    if (!mostrar) {
      ctx.$('#data-de').hidden = true;
      ctx.$('#data-ate').hidden = true;
      ctx.$('#subtitulo').textContent = nota;
      return;
    }
    // Volta a mostrar o período (outra vista pode ter trocado o subtítulo).
    const custom = ctx.$('#preset').value === 'custom';
    ctx.$('#data-de').hidden = !custom;
    ctx.$('#data-ate').hidden = !custom;
    const p = ctx.intervalo();
    const d = (t) => new Date(t * 1000).toLocaleDateString('pt-BR', { timeZone: FUSO });
    ctx.$('#subtitulo').textContent = `reuniões com data entre ${d(p.de)} e ${d(p.ate)}`;
  }

  // ---------------------------------------------------------------------------
  // Agendamentos
  // ---------------------------------------------------------------------------
  const VISTAS_REUNIOES = [
    ['hoje', 'Hoje'], ['proximas', 'Próximas'], ['pendentes', 'Aguardando presença'], ['todas', 'Todas do período'],
  ];

  async function agendamentos() {
    const p = ctx.intervalo();
    const qs = new URLSearchParams({ vista: vistaReunioes, from: p.de, to: p.ate });
    if (filtroReuniao.tipo) qs.set('tipo', filtroReuniao.tipo);
    if (vistaReunioes === 'todas' && filtroReuniao.situacao) qs.set('situacao', filtroReuniao.situacao);
    // `_`: o dash guarda respostas de período fechado (to anterior a hoje), e
    // esta lista muda a cada presença, cancelamento ou remarcação.
    qs.set('_', Date.now());
    const d = await ctx.fetchJson('/api/agenda/reunioes?' + qs);
    filtroDeDatas(vistaReunioes === 'todas', {
      hoje: 'reuniões de hoje · horário de Brasília',
      proximas: 'reuniões marcadas daqui para frente',
      pendentes: 'reuniões que já aconteceram e ainda não têm presença lida',
    }[vistaReunioes]);
    const cont = { hoje: d.contagens.hoje, proximas: d.contagens.proximas, pendentes: d.contagens.pendentes };
    el().innerHTML = `
      <div class="ag-subvistas" role="group" aria-label="Recorte das reuniões">
        ${VISTAS_REUNIOES.map(([v, r]) => `<button type="button" class="ag-subvista" data-subvista="${v}" aria-pressed="${v === vistaReunioes}">${r}${cont[v] !== undefined ? ` <span class="ag-cont${v === 'pendentes' && cont[v] ? ' alerta' : ''}">${cont[v]}</span>` : ''}</button>`).join('')}
        <select id="ag-f-tipo" aria-label="Tipo de reunião"><option value="">Todos os tipos</option>
          ${d.tipos.map((t) => `<option value="${t.id}">${ctx.esc(t.nome)}${t.ativo ? '' : ' (pausado)'}</option>`).join('')}</select>
        ${vistaReunioes === 'todas' ? `<select id="ag-f-sit" aria-label="Situação"><option value="">Todas as situações</option>
          ${Object.entries(SITUACAO).map(([k, [r]]) => `<option value="${k}">${r}</option>`).join('')}</select>` : ''}
      </div>
      ${d.numeros ? '<div class="grid-etiquetas" id="ag-num"></div>' : ''}
      <div class="tabela-wrap" id="ag-lista"></div>`;
    if (d.numeros) {
      const n = d.numeros;
      ctx.$('#ag-num').innerHTML = [
        { rotulo: 'Agendados', valor: ctx.fmtInt(n.agendados), nota: 'reuniões no período' },
        { rotulo: 'Cancelados', valor: ctx.fmtInt(n.cancelados) },
        { rotulo: 'Faltas', valor: ctx.fmtInt(n.faltas) },
        { rotulo: 'Comparecimento', valor: n.taxa_comparecimento === null ? null : ctx.fmtPct(n.taxa_comparecimento * 100, 0), nota: n.taxa_comparecimento === null ? 'nenhuma reunião com presença lida' : `${n.realizadas} de ${n.realizadas + n.faltas} com presença lida` },
      ].map((k) => ctx.tile(k)).join('');
    }
    el().querySelectorAll('[data-subvista]').forEach((b) => {
      b.onclick = () => { vistaReunioes = b.dataset.subvista; agendamentos(); };
    });
    ctx.$('#ag-f-tipo').value = filtroReuniao.tipo;
    ctx.$('#ag-f-tipo').onchange = (e) => { filtroReuniao.tipo = e.target.value; agendamentos(); };
    const sit = ctx.$('#ag-f-sit');
    if (sit) { sit.value = filtroReuniao.situacao; sit.onchange = (e) => { filtroReuniao.situacao = e.target.value; agendamentos(); }; }

    const VAZIO = {
      hoje: 'Nenhuma reunião hoje.',
      proximas: 'Nenhuma reunião marcada daqui para frente.',
      pendentes: 'Tudo em dia: nenhuma reunião esperando presença.',
      todas: 'Nenhuma reunião no período.',
    };
    ctx.tabela(ctx.$('#ag-lista'), [
      { titulo: 'Quando', campo: 'inicio', render: (r) => vistaReunioes === 'hoje' ? `<b>${hora(r.inicio)}</b>` : `<b>${diaCurto(r.inicio)}</b> ${hora(r.inicio)}` },
      { titulo: 'Pessoa', campo: 'nome', render: (r) => `<button type="button" class="ag-link-linha" data-abrir="${r.id}">${ctx.esc(r.nome)}</button>${r.is_teste ? ' <span class="carimbo neutro">teste</span>' : ''}<br><span class="mini">${ctx.esc(r.email)}</span>` },
      { titulo: 'WhatsApp', campo: 'telefone', render: (r) => r.telefone ? `<span class="mini">+${ctx.esc(r.telefone)}</span>` : '' },
      { titulo: 'Tipo', campo: 'tipo_nome', render: (r) => ctx.esc(r.tipo_nome) },
      { titulo: 'Situação', campo: 'situacao', render: (r) => r.aguardando_presenca ? '<span class="carimbo alerta">Aguardando presença</span>' : carimbo(r.situacao) },
      { titulo: '', campo: 'id', render: (r) => `<div class="ag-acoes ag-acoes--linha">
          ${r.aguardando_presenca ? `<button class="btn sec" type="button" data-presenca="realizada" data-id="${r.id}">Realizada</button>
            <button class="btn sec" type="button" data-presenca="faltou" data-id="${r.id}">Faltou</button>` : ''}
          <button class="btn sec" type="button" data-abrir="${r.id}">Abrir</button></div>` },
    ], d.rows, undefined, VAZIO[vistaReunioes]);
    ctx.$('#ag-lista').onclick = async (ev) => {
      const b = ev.target.closest('button');
      if (!b) return;
      if (b.dataset.abrir) return detalhe(b.dataset.abrir);
      if (b.dataset.presenca) {
        b.disabled = true;
        try {
          await ctx.postJson('/api/agenda/reunioes', { acao: 'presenca', id: b.dataset.id, situacao: b.dataset.presenca });
          avisar(b.dataset.presenca === 'realizada' ? 'Presença registrada: realizada.' : 'Presença registrada: faltou.');
          await agendamentos();
        } catch (e) { b.disabled = false; avisarErro(e); }
      }
    };
  }

  function carimbo(s) {
    const [r, c] = SITUACAO[s] || [s, 'neutro'];
    return `<span class="carimbo ${c}">${ctx.esc(r)}</span>`;
  }

  async function detalhe(id) {
    const g = gavetaSimples({ titulo: 'Carregando…', corpo: '<div class="aviso">Carregando…</div>' });
    let d;
    try { d = await ctx.fetchJson('/api/agenda/reunioes?id=' + encodeURIComponent(id)); }
    catch (e) { g.querySelector('#ag-g-corpo').innerHTML = erroHtml(e); return; }
    const r = d.reuniao;
    const agora = Math.floor(Date.now() / 1000);
    const ativa = ['marcada', 'remarcada'].includes(r.situacao);
    const passou = r.fim < agora;
    const ACOES = { agendou: 'Agendou', remarcou: 'Remarcou', cancelou: 'Cancelou', presenca: 'Presença' };
    const POR = { lead: 'pelo lead', equipe: 'pela equipe', sistema: 'pelo sistema', google: 'na agenda do Google' };
    const CRM = { sem_card: 'Card do lead não encontrado no ClickUp.', sem_credencial: 'ClickUp não configurado neste ambiente (prévia).' };
    const origem = r.origem && r.origem.utm_source
      ? `${ctx.esc(r.origem.utm_source)}${r.origem.utm_medium ? ' / ' + ctx.esc(r.origem.utm_medium) : ''}${r.origem.utm_campaign ? ' · ' + ctx.esc(r.origem.utm_campaign) : ''}`
      : 'Direto (sem UTM)';
    const corpoHtml = `
      <p>${ativa && passou ? '<span class="carimbo alerta">Aguardando presença</span>' : carimbo(r.situacao)}
        ${r.presenca_origem ? `<span class="mini">presença ${r.presenca_origem === 'meet' ? 'lida no Meet' : 'marcada à mão'}</span>` : ''}</p>
      <dl class="ag-dl">
        <dt>Quando</dt><dd>${quando(r.inicio)} às ${hora(r.fim)}${r.fuso_lead && r.fuso_lead !== FUSO ? `<br><span class="mini">o lead está no fuso ${ctx.esc(r.fuso_lead)}</span>` : ''}</dd>
        <dt>Contato</dt><dd>${ctx.esc(r.email)}${r.telefone ? '<br>+' + ctx.esc(r.telefone) : ''}</dd>
        ${r.meet_link ? `<dt>Meet</dt><dd><a href="${ctx.esc(r.meet_link)}" target="_blank" rel="noopener">${ctx.esc(r.meet_link.replace('https://', ''))}</a></dd>` : ''}
        ${r.comercial ? `<dt>Funil</dt><dd>${ctx.esc(r.funil || '')}</dd><dt>Origem</dt><dd>${origem}</dd>
          <dt>CRM</dt><dd>${r.crm_link ? `<a href="${ctx.esc(r.crm_link)}" target="_blank" rel="noopener">Abrir card no ClickUp</a>` : ctx.esc(CRM[r.crm_situacao] || r.crm_situacao || 'Registrando…')}</dd>` : '<dt>Tipo</dt><dd>Não comercial (fora do CRM e das conversões)</dd>'}
        ${r.motivo_cancel ? `<dt>Motivo</dt><dd>${ctx.esc(r.motivo_cancel)}</dd>` : ''}
      </dl>
      ${r.respostas.length ? `<h3 class="ag-h3">Respostas</h3><dl class="ag-dl">${r.respostas.map((x) => `<dt>${ctx.esc(x.pergunta)}</dt><dd>${x.resposta ? ctx.esc(x.resposta) : '<span class="mini">sem resposta</span>'}</dd>`).join('')}</dl>` : ''}
      <h3 class="ag-h3">Histórico</h3>
      <ol class="ag-hist">${d.historico.map((h) => `<li><span class="mini">${quando(h.criado_em)}</span> <b>${ACOES[h.acao] || ctx.esc(h.acao)}</b> ${POR[h.por] || ''}${h.detalhe ? `<br><span class="mini">${ctx.esc(h.detalhe)}</span>` : ''}</li>`).join('')}</ol>`;
    const rodape = `<div class="ag-acoes">
        ${passou && r.situacao !== 'cancelada' ? `<span class="mini">Presença:</span>
          <button class="btn sec" type="button" data-presenca="realizada">Realizada</button>
          <button class="btn sec" type="button" data-presenca="faltou">Faltou</button>
          <button class="btn sec" type="button" data-presenca="sem_info">Sem informação</button>` : ''}
        ${ativa && !passou ? `<button class="btn" type="button" id="ag-remarcar">Remarcar</button>
          <button class="btn perigo" type="button" id="ag-cancelar">Cancelar reunião</button>` : ''}
      </div>`;
    g.querySelector('h2').textContent = r.nome;
    g.querySelector('.ag-gaveta__topo div').insertAdjacentHTML('beforeend', `<p class="mini">${ctx.esc(r.tipo_nome || '')}</p>`);
    g.querySelector('#ag-g-corpo').innerHTML = corpoHtml;
    g.querySelector('.ag-gaveta__form').insertAdjacentHTML('beforeend', `<footer class="ag-gaveta__rodape">${rodape}</footer>`);

    const depois = async (msg) => { avisar(msg); await agendamentos(); await detalhe(id); };
    g.querySelectorAll('[data-presenca]').forEach((b) => {
      b.onclick = async () => {
        try { await ctx.postJson('/api/agenda/reunioes', { acao: 'presenca', id, situacao: b.dataset.presenca }); await depois('Presença atualizada.'); }
        catch (e) { avisarErro(e); }
      };
    });
    const bc = g.querySelector('#ag-cancelar');
    if (bc) bc.onclick = () => ctx.pedirConfirmacao(bc, 'Cancelar e avisar o lead pelo Google?', async () => {
      try { await ctx.postJson('/api/agenda/reunioes', { acao: 'cancelar', id }); await depois('Reunião cancelada. O lead foi avisado pelo Google.'); }
      catch (e) { avisarErro(e); return false; }
    });
    const br = g.querySelector('#ag-remarcar');
    if (br) br.onclick = () => remarcarNaGaveta(g, r, id);
  }

  /** Remarcar: escolhe o dia, depois o horário, e só então confirma. */
  async function remarcarNaGaveta(g, r, id) {
    const corpo = g.querySelector('#ag-g-corpo');
    const rodape = g.querySelector('.ag-gaveta__rodape');
    corpo.innerHTML = '<div class="aviso">Lendo os horários livres…</div>';
    rodape.innerHTML = '<div class="ag-acoes"><button class="btn sec" type="button" data-voltar>Voltar</button></div>';
    rodape.querySelector('[data-voltar]').onclick = () => detalhe(id);
    let h;
    try { h = await ctx.fetchJson(`/api/agenda/horarios?tipo=${r.tipo_id}&reuniao=${encodeURIComponent(id)}`); }
    catch (e) { corpo.innerHTML = erroHtml(e); return; }
    const dias = Object.keys(h.dias || {}).sort();
    if (!dias.length) { corpo.innerHTML = '<div class="aviso">Nenhum horário livre na janela deste tipo.</div>'; return; }
    let escolhido = null;
    corpo.innerHTML = `<p class="mini" style="margin:0">Agora: ${quando(r.inicio)}. O lead recebe a mudança pelo Google.</p>
      <label class="ag-campo"><span class="ag-campo__rotulo">Dia</span>
        <select id="ag-rm-dia">${dias.map((d) => `<option value="${d}">${diaLongo(d)} · ${h.dias[d].length} horário(s)</option>`).join('')}</select></label>
      <div class="ag-slots" id="ag-rm-slots" role="group" aria-label="Horários livres"></div>`;
    const desenharSlots = () => {
      const d = ctx.$('#ag-rm-dia').value;
      ctx.$('#ag-rm-slots').innerHTML = h.dias[d].map((t) => `<button type="button" class="ag-slot" data-slot="${t}" aria-pressed="${t === escolhido}">${hora(t)}</button>`).join('');
    };
    desenharSlots();
    ctx.$('#ag-rm-dia').onchange = () => { escolhido = null; desenharSlots(); atualizarRodape(); };
    const atualizarRodape = () => {
      rodape.innerHTML = `<div class="ag-acoes">
        <button class="btn" type="button" id="ag-rm-ok"${escolhido ? '' : ' disabled'}>${escolhido ? `Remarcar para ${ctx.esc(quando(escolhido))}` : 'Escolha um horário'}</button>
        <button class="btn sec" type="button" data-voltar>Voltar</button></div>`;
      rodape.querySelector('[data-voltar]').onclick = () => detalhe(id);
      const ok = rodape.querySelector('#ag-rm-ok');
      ok.onclick = async () => {
        ok.disabled = true;
        ok.textContent = 'Remarcando…';
        try {
          await ctx.postJson('/api/agenda/reunioes', { acao: 'remarcar', id, inicio: escolhido });
          avisar('Reunião remarcada. O lead foi avisado pelo Google.');
          await agendamentos();
          await detalhe(id);
        } catch (e) { avisarErro(e); atualizarRodape(); }
      };
    };
    atualizarRodape();
    ctx.$('#ag-rm-slots').onclick = (ev) => {
      const b = ev.target.closest('[data-slot]');
      if (!b) return;
      escolhido = Number(b.dataset.slot);
      desenharSlots();
      atualizarRodape();
    };
  }

  // ---------------------------------------------------------------------------
  // Tipos de reunião
  // ---------------------------------------------------------------------------
  async function tipos() {
    filtroDeDatas(false, 'configuração · não usa o filtro de datas');
    const d = await ctx.fetchJson('/api/agenda/tipos');
    const lista = d.tipos.filter((t) => filtroTipos === 'todos' || (filtroTipos === 'ativos' ? t.ativo : !t.ativo));
    const site = location.origin.includes('localhost') ? 'https://atacadoexponencial.com' : location.origin;
    el().innerHTML = `
      <div class="ag-subvistas">
        <select id="ag-ft" aria-label="Situação dos tipos">
          <option value="ativos">Ativos</option><option value="pausados">Pausados</option><option value="todos">Todos</option>
        </select>
        <button class="btn" type="button" id="ag-novo-tipo">Novo tipo de reunião</button>
      </div>
      ${!d.opcoes.agendas.length ? '<div class="aviso alerta">Conecte uma agenda (Agendas conectadas) antes de criar um tipo.</div>' : ''}
      ${!d.opcoes.grades.length ? '<div class="aviso alerta">Crie uma grade de horário antes de criar um tipo.</div>' : ''}
      <div class="tabela-wrap" id="ag-tipos"></div>`;
    ctx.$('#ag-ft').value = filtroTipos;
    ctx.$('#ag-ft').onchange = (e) => { filtroTipos = e.target.value; tipos(); };
    ctx.$('#ag-novo-tipo').onclick = () => formTipo(null, d.opcoes);
    ctx.tabela(ctx.$('#ag-tipos'), [
      { titulo: 'Nome', campo: 'nome', render: (t) => `<button type="button" class="ag-link-linha" data-acao="editar" data-id="${t.id}">${ctx.esc(t.nome)}</button><br><span class="mini">${t.comercial ? 'Comercial · ' + ctx.esc(t.funil) : 'Não comercial (RH, entrevistas)'}</span>` },
      { titulo: 'Duração', num: true, campo: 'duracao_min', render: (t) => `${t.duracao_min} min` },
      { titulo: 'Link', campo: 'slug', render: (t) => t.comercial
        ? `<span class="mini">/agendar/${ctx.esc(t.slug)}<br>abre depois do formulário da LP</span>`
        : `<span class="ag-copiavel"><span class="mini">/agendar/${ctx.esc(t.slug)}</span>
            <button type="button" class="ag-icone" data-acao="copiar" data-id="${ctx.esc(site + '/agendar/' + t.slug)}" aria-label="Copiar link de ${ctx.esc(t.nome)}" title="Copiar link">${ICONE.copiar}</button></span>` },
      { titulo: 'Situação', campo: 'ativo', render: (t) => t.ativo ? '<span class="carimbo alta">Ativo</span>' : '<span class="carimbo neutro">Pausado</span>' },
      { titulo: 'Futuras', num: true, campo: 'futuros', render: (t) => ctx.fmtInt(t.futuros) },
      { titulo: '', campo: 'id', render: (t) => menuHtml(t.nome, [
        { acao: 'editar', id: t.id, rotulo: 'Editar' },
        { acao: 'horarios', id: t.id, rotulo: 'Ver horários livres' },
        { acao: 'previa', id: t.id, rotulo: 'Pré-visualizar como o lead' },
        { acao: 'duplicar', id: t.id, rotulo: 'Duplicar' },
        { acao: t.ativo ? 'pausar' : 'reativar', id: t.id, rotulo: t.ativo ? 'Pausar' : 'Reativar' },
        { acao: 'excluir', id: t.id, rotulo: 'Excluir', perigo: true },
      ]) },
    ], lista, undefined, filtroTipos === 'ativos' ? 'Nenhum tipo ativo. Crie um tipo de reunião ou veja os pausados no filtro.' : 'Nenhum tipo nesta situação.');

    const tipoDe = (id) => d.tipos.find((t) => String(t.id) === String(id));
    ligarMenus(ctx.$('#ag-tipos'), {
      editar: (id) => formTipo(tipoDe(id), d.opcoes),
      copiar: async (url) => {
        try { await navigator.clipboard.writeText(url); avisar('Link copiado.'); }
        catch { avisar(`Não deu para copiar. O link é ${url}`, 'erro'); }
      },
      previa: async (id) => {
        const r = await ctx.postJson('/api/agenda/tipos', { acao: 'previa', id: Number(id) });
        window.open(r.url, '_blank', 'noopener');
        avisar('Prévia aberta em outra aba, com dados de teste.');
      },
      horarios: (id) => verHorarios(tipoDe(id)),
      duplicar: async (id) => { await ctx.postJson('/api/agenda/tipos', { acao: 'duplicar', id: Number(id) }); avisar('Tipo duplicado. A cópia nasce pausada.'); await tipos(); },
      pausar: async (id) => { await ctx.postJson('/api/agenda/tipos', { acao: 'pausar', id: Number(id) }); avisar('Tipo pausado: o link mostra "agenda indisponível".'); await tipos(); },
      reativar: async (id) => { await ctx.postJson('/api/agenda/tipos', { acao: 'reativar', id: Number(id) }); avisar('Tipo reativado.'); await tipos(); },
      excluir: (id, b) => ctx.pedirConfirmacao(b, 'Excluir este tipo?', async () => {
        try { await ctx.postJson('/api/agenda/tipos', { acao: 'excluir', id: Number(id) }); fecharMenus(); avisar('Tipo excluído.'); await tipos(); }
        catch (e) { avisarErro(e); return false; }
      }),
    });
  }

  async function verHorarios(tipo) {
    const g = gavetaSimples({
      titulo: ctx.esc(tipo.nome),
      sub: 'Horários livres dos próximos 7 dias, como o lead vê (horário de Brasília).',
      corpo: '<div class="aviso">Lendo a agenda…</div>',
    });
    const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: FUSO });
    const ate = new Date(Date.now() + 7 * 86400000).toLocaleDateString('sv-SE', { timeZone: FUSO });
    const corpo = g.querySelector('#ag-g-corpo');
    try {
      const h = await ctx.fetchJson(`/api/agenda/horarios?tipo=${tipo.id}&de=${hoje}&ate=${ate}`);
      const dias = Object.keys(h.dias || {}).sort();
      corpo.innerHTML = dias.length
        ? dias.map((d) => `<div class="ag-dia-livre"><b>${diaLongo(d)}</b><div class="ag-slots">${h.dias[d].map((t) => `<span class="ag-slot ag-slot--leitura">${hora(t)}</span>`).join('')}</div></div>`).join('')
        : '<div class="aviso">Nenhum horário livre nos próximos 7 dias. Confira a grade e a agenda.</div>';
    } catch (e) { corpo.innerHTML = erroHtml(e); }
  }

  function formTipo(t, opcoes) {
    const novo = !t;
    const v = t || {
      nome: '', slug: '', duracao_min: 45, destino_cal: (opcoes.agendas.find((a) => a.conflito) || opcoes.agendas[0] || {}).id,
      conflito_cals: opcoes.agendas.filter((a) => a.conflito).map((a) => a.id), grade_id: (opcoes.grades[0] || {}).id,
      folga_antes_min: 0, folga_depois_min: 0, antecedencia_min: 240, janela_dias: 30, limite_dia: '', intervalo_min: 30,
      perguntas: [], titulo_modelo: '{nome} e Atacado Exponencial', comercial: true, funil: 'sessao-estrategica',
      pagina_pos: '', contato_alternativo: '', descricao: '',
    };
    const perguntas = (v.perguntas || []).map((p) => ({ ...p }));
    const conflitos = [...(v.conflito_cals || [])];
    const opt = (lista, sel) => lista.map(([val, rot]) => `<option value="${ctx.esc(val)}"${String(val) === String(sel) ? ' selected' : ''}>${ctx.esc(rot)}</option>`).join('');
    // Antecedência é guardada em minutos, mas pensada em horas.
    const antecedenciaH = Math.round((v.antecedencia_min / 60) * 10) / 10;
    const g = abrirGaveta();
    g.innerHTML = `<form class="ag-gaveta__form" id="ag-tf" novalidate>
      <header class="ag-gaveta__topo">
        <div><h2>${novo ? 'Novo tipo de reunião' : ctx.esc(v.nome)}</h2>
          <p class="mini">${novo ? 'Preencha o básico. O resto já vem com um padrão.' : 'Mudanças valem para agendamentos novos.'}</p></div>
        <button class="ag-gaveta__fechar" type="button" data-fechar aria-label="Fechar">${ICONE.fechar}</button>
      </header>
      <nav class="ag-abas" role="tablist" aria-label="Partes do tipo">
        ${[['basico', 'Básico'], ['horarios', 'Horários'], ['comercial', 'Comercial'], ['perguntas', 'Perguntas']].map(([k, r], i) =>
          `<button type="button" role="tab" id="ag-aba-${k}" aria-controls="ag-pnl-${k}" data-aba="${k}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${r}</button>`).join('')}
      </nav>
      <div class="ag-gaveta__corpo ag-form">
        <section data-painel="basico" id="ag-pnl-basico" role="tabpanel" aria-labelledby="ag-aba-basico">
          <label>Nome <input type="text" name="nome" value="${ctx.esc(v.nome)}" required></label>
          <label>Endereço do link <span class="mini">atacadoexponencial.com/agendar/…</span><input type="text" name="slug" value="${ctx.esc(v.slug)}" placeholder="consultoria-individual" required></label>
          <div class="aviso alerta" id="ag-slug-aviso" hidden>Os links já divulgados com o endereço antigo vão parar de funcionar.</div>
          <label>Duração (min) <input type="number" name="duracao_min" value="${v.duracao_min}" min="5"></label>
          <label>Descrição <span class="mini">aparece ao lado do calendário</span>
            <textarea name="descricao" rows="7" maxlength="2000" placeholder="O que a pessoa está agendando, quanto tempo dura, o que vai receber.">${ctx.esc(v.descricao || '')}</textarea></label>
        </section>
        <section data-painel="horarios" id="ag-pnl-horarios" role="tabpanel" aria-labelledby="ag-aba-horarios" hidden>
          <label>Grade de disponibilidade <select name="grade_id">${opt(opcoes.grades.map((x) => [x.id, `${x.nome}: ${x.resumo}`]), v.grade_id)}</select></label>
          <div class="linha">
            <label>Antecedência mínima (horas) <input type="number" name="antecedencia_h" value="${antecedenciaH}" min="0" step="0.5"></label>
            <label>Até quantos dias à frente <input type="number" name="janela_dias" value="${v.janela_dias}" min="1"></label>
          </div>
          <label>Agenda onde a reunião é criada <select name="destino_cal">${opt(opcoes.agendas.map((a) => [a.id, `${a.nome} (${a.conta})`]), v.destino_cal)}</select></label>
          <div class="ag-campo">
            <span class="ag-campo__rotulo">Agendas que bloqueiam horário</span>
            <div class="ag-etiquetas" id="ag-conflitos"></div>
          </div>
          <details class="ag-mais"><summary>Mais opções</summary>
            <div class="linha">
              <label>Horários começam a cada (min) <input type="number" name="intervalo_min" value="${v.intervalo_min}" min="5"></label>
              <label>Limite de reuniões por dia <input type="number" name="limite_dia" value="${v.limite_dia ?? ''}" min="1" placeholder="sem limite"></label>
            </div>
            <div class="linha">
              <label>Folga antes (min) <input type="number" name="folga_antes_min" value="${v.folga_antes_min}" min="0"></label>
              <label>Folga depois (min) <input type="number" name="folga_depois_min" value="${v.folga_depois_min}" min="0"></label>
            </div>
          </details>
        </section>
        <section data-painel="comercial" id="ag-pnl-comercial" role="tabpanel" aria-labelledby="ag-aba-comercial" hidden>
          <label class="marca"><input type="checkbox" name="comercial"${v.comercial ? ' checked' : ''}> Reunião comercial</label>
          <p class="mini" style="margin:-0.3rem 0 0">Abre só depois do formulário da LP, conta em Reuniões agendadas, vai para o card do CRM e manda a conversão.</p>
          <label>Funil <select name="funil">${opt(opcoes.funis.map((f) => [f, f]), v.funil || '')}</select></label>
          <label>Título do evento na agenda <span class="mini">{nome} vira o nome do lead</span><input type="text" name="titulo_modelo" value="${ctx.esc(v.titulo_modelo)}"></label>
          <label>Página depois de confirmar <input type="text" name="pagina_pos" value="${ctx.esc(v.pagina_pos || '')}" placeholder="vazio = confirmação da própria agenda"></label>
          <label>Contato para agenda pausada ou em cima da hora <input type="text" name="contato_alternativo" value="${ctx.esc(v.contato_alternativo || '')}" placeholder="ex.: WhatsApp (11) 99999-9999"></label>
        </section>
        <section data-painel="perguntas" id="ag-pnl-perguntas" role="tabpanel" aria-labelledby="ag-aba-perguntas" hidden>
          <div id="ag-perg"></div>
          <div><button class="btn sec" type="button" id="ag-perg-add">Adicionar pergunta</button></div>
        </section>
      </div>
      <footer class="ag-gaveta__rodape">
        <div id="ag-tf-erro"></div>
        ${SAIR_HTML}
        <div class="ag-acoes"><button class="btn" type="submit">${novo ? 'Criar tipo' : 'Salvar'}</button>
          <button class="btn sec" type="button" data-fechar>Cancelar</button></div>
      </footer>
    </form>`;
    const form = ctx.$('#ag-tf');

    // Abas (clique e setas).
    const abas = [...form.querySelectorAll('[data-aba]')];
    const irAba = (b) => {
      abas.forEach((x) => { x.setAttribute('aria-selected', String(x === b)); x.tabIndex = x === b ? 0 : -1; });
      form.querySelectorAll('[data-painel]').forEach((x) => { x.hidden = x.dataset.painel !== b.dataset.aba; });
    };
    form.querySelector('.ag-abas').onclick = (ev) => { const b = ev.target.closest('[data-aba]'); if (b) irAba(b); };
    form.querySelector('.ag-abas').onkeydown = (ev) => {
      if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return;
      const i = abas.indexOf(document.activeElement);
      const prox = abas[(i + (ev.key === 'ArrowRight' ? 1 : -1) + abas.length) % abas.length];
      irAba(prox);
      prox.focus();
    };

    // Endereço mudou num tipo já publicado: avisa que links antigos quebram.
    if (!novo) {
      const slug = form.querySelector('[name="slug"]');
      slug.oninput = () => { ctx.$('#ag-slug-aviso').hidden = slug.value.trim() === v.slug; };
    }

    // Agendas de conflito como etiquetas, com menu para adicionar.
    const nomeAgenda = (id) => (opcoes.agendas.find((a) => a.id === id) || { nome: id }).nome;
    const desenharConflitos = () => {
      const resto = opcoes.agendas.filter((a) => !conflitos.includes(a.id));
      ctx.$('#ag-conflitos').innerHTML = conflitos.map((id) => `<span class="ag-etiqueta">${ctx.esc(nomeAgenda(id))}
          <button type="button" data-tirar="${ctx.esc(id)}" aria-label="Tirar ${ctx.esc(nomeAgenda(id))}">${ICONE.fechar}</button></span>`).join('')
        + (conflitos.length ? '' : '<span class="mini">Nenhuma além da agenda onde a reunião é criada, que sempre bloqueia.</span>')
        + (resto.length ? `<select data-adicionar aria-label="Adicionar agenda que bloqueia horário"><option value="">Adicionar agenda…</option>
            ${resto.map((a) => `<option value="${ctx.esc(a.id)}">${ctx.esc(a.nome)}</option>`).join('')}</select>` : '');
    };
    desenharConflitos();
    ctx.$('#ag-conflitos').onclick = (ev) => {
      const b = ev.target.closest('[data-tirar]');
      if (!b) return;
      conflitos.splice(conflitos.indexOf(b.dataset.tirar), 1);
      desenharConflitos();
    };
    ctx.$('#ag-conflitos').onchange = (ev) => {
      if (!ev.target.matches('[data-adicionar]') || !ev.target.value) return;
      conflitos.push(ev.target.value);
      desenharConflitos();
      const s = ctx.$('#ag-conflitos [data-adicionar]');
      if (s) s.focus();
    };

    const funilSel = form.querySelector('[name="funil"]');
    const comercialCb = form.querySelector('[name="comercial"]');
    const ajustarFunil = () => { funilSel.closest('label').hidden = !comercialCb.checked; };
    comercialCb.onchange = ajustarFunil;
    ajustarFunil();

    const desenharPerguntas = () => {
      ctx.$('#ag-perg').innerHTML = perguntas.map((p, i) => `<div class="ag-pergunta" data-i="${i}">
        <div class="ag-pergunta__ordem">
          <button class="ag-icone" type="button" data-sobe="${i}" ${i ? '' : 'disabled'} aria-label="Subir a pergunta ${i + 1}">${ICONE.cima}</button>
          <button class="ag-icone" type="button" data-desce="${i}" ${i < perguntas.length - 1 ? '' : 'disabled'} aria-label="Descer a pergunta ${i + 1}">${ICONE.baixo}</button>
        </div>
        <div class="ag-pergunta__campos">
          <input type="text" data-campo="texto" value="${ctx.esc(p.texto)}" placeholder="Texto da pergunta" aria-label="Texto da pergunta ${i + 1}">
          <div class="ag-acoes"><select data-campo="tipo" aria-label="Tipo de resposta da pergunta ${i + 1}">${opt([['texto', 'Texto livre'], ['escolha', 'Escolha única']], p.tipo)}</select>
            <label class="marca"><input type="checkbox" data-campo="obrigatoria"${p.obrigatoria ? ' checked' : ''}> Obrigatória</label>
            <button class="btn perigo" type="button" data-remove="${i}">Remover</button></div>
          ${p.tipo === 'escolha' ? `<textarea data-campo="opcoes" rows="3" placeholder="Uma opção por linha" aria-label="Opções da pergunta ${i + 1}, uma por linha">${ctx.esc((p.opcoes || []).join('\n'))}</textarea>` : ''}
        </div></div>`).join('') || '<p class="mini">Nenhuma pergunta extra.</p>';
    };
    const lerPerguntas = () => {
      ctx.$('#ag-perg').querySelectorAll('[data-i]').forEach((linha) => {
        const p = perguntas[Number(linha.dataset.i)];
        p.texto = linha.querySelector('[data-campo="texto"]').value;
        p.tipo = linha.querySelector('[data-campo="tipo"]').value;
        p.obrigatoria = linha.querySelector('[data-campo="obrigatoria"]').checked;
        const o = linha.querySelector('[data-campo="opcoes"]');
        p.opcoes = o ? o.value.split('\n').map((x) => x.trim()).filter(Boolean) : (p.opcoes || []);
      });
    };
    desenharPerguntas();
    ctx.$('#ag-perg-add').onclick = () => { lerPerguntas(); perguntas.push({ texto: '', tipo: 'texto', opcoes: [], obrigatoria: false }); desenharPerguntas(); };
    ctx.$('#ag-perg').onchange = (ev) => { if (ev.target.dataset.campo === 'tipo') { lerPerguntas(); desenharPerguntas(); } };
    ctx.$('#ag-perg').onclick = (ev) => {
      const b = ev.target.closest('button');
      if (!b) return;
      lerPerguntas();
      const i = Number(b.dataset.remove ?? b.dataset.sobe ?? b.dataset.desce);
      if (b.dataset.remove !== undefined) perguntas.splice(i, 1);
      if (b.dataset.sobe !== undefined) [perguntas[i - 1], perguntas[i]] = [perguntas[i], perguntas[i - 1]];
      if (b.dataset.desce !== undefined) [perguntas[i + 1], perguntas[i]] = [perguntas[i], perguntas[i + 1]];
      desenharPerguntas();
    };

    protegerSaida(g, form, () => {
      lerPerguntas();
      const campos = [...new FormData(form)].map(([k, x]) => [k, String(x)]);
      return JSON.stringify([campos, comercialCb.checked, perguntas, conflitos]);
    });

    form.onsubmit = async (ev) => {
      ev.preventDefault();
      lerPerguntas();
      // Campo obrigatório vazio numa aba escondida: volta para a aba dele.
      const invalido = form.querySelector(':invalid');
      if (invalido) {
        irAba(form.querySelector(`[data-aba="${invalido.closest('[data-painel]').dataset.painel}"]`));
        invalido.reportValidity();
        return;
      }
      const f = new FormData(form);
      const corpo = {
        acao: 'salvar', id: t ? t.id : undefined,
        nome: f.get('nome'), slug: f.get('slug'), duracao_min: f.get('duracao_min'), intervalo_min: f.get('intervalo_min'),
        antecedencia_min: Math.round(Number(f.get('antecedencia_h') || 0) * 60), janela_dias: f.get('janela_dias'),
        folga_antes_min: f.get('folga_antes_min'), folga_depois_min: f.get('folga_depois_min'), limite_dia: f.get('limite_dia'),
        destino_cal: f.get('destino_cal'), grade_id: f.get('grade_id'), conflito_cals: conflitos, comercial: comercialCb.checked,
        funil: comercialCb.checked ? f.get('funil') : '', titulo_modelo: f.get('titulo_modelo'),
        pagina_pos: f.get('pagina_pos'), contato_alternativo: f.get('contato_alternativo'), descricao: f.get('descricao'), perguntas,
      };
      const botao = form.querySelector('[type="submit"]');
      botao.disabled = true;
      try {
        await ctx.postJson('/api/agenda/tipos', corpo);
        g.close();
        avisar(novo ? 'Tipo criado.' : 'Alterações salvas.');
        await tipos();
      } catch (e) {
        ctx.$('#ag-tf-erro').innerHTML = erroHtml(e);
        botao.disabled = false;
      }
    };
  }

  // ---------------------------------------------------------------------------
  // Grades de horário
  // ---------------------------------------------------------------------------
  async function grades() {
    filtroDeDatas(false, 'configuração · horário de Brasília · não usa o filtro de datas');
    const d = await ctx.fetchJson('/api/agenda/grades');
    el().innerHTML = `<div class="ag-subvistas"><button class="btn" type="button" id="ag-nova-grade">Nova grade</button></div>
      <div class="tabela-wrap" id="ag-grades"></div>`;
    ctx.$('#ag-nova-grade').onclick = () => formGrade(null);
    ctx.tabela(ctx.$('#ag-grades'), [
      { titulo: 'Nome', campo: 'nome', render: (x) => `<button type="button" class="ag-link-linha" data-acao="editar" data-id="${x.id}">${ctx.esc(x.nome)}</button>` },
      { titulo: 'Horários', campo: 'resumo', render: (x) => `<span class="mini">${ctx.esc(x.resumo)}</span>${Object.keys(x.datas).length ? `<br><span class="mini">${Object.keys(x.datas).length} data(s) especial(is)</span>` : ''}` },
      { titulo: 'Tipos que usam', num: true, campo: 'tipos', render: (x) => ctx.fmtInt(x.tipos) },
      { titulo: '', campo: 'id', render: (x) => menuHtml(x.nome, [
        { acao: 'editar', id: x.id, rotulo: 'Editar' },
        { acao: 'duplicar', id: x.id, rotulo: 'Duplicar' },
        { acao: 'excluir', id: x.id, rotulo: 'Excluir', perigo: true },
      ]) },
    ], d.grades, undefined, 'Nenhuma grade ainda. Crie as grades de horário que os tipos de reunião vão usar.');
    ligarMenus(ctx.$('#ag-grades'), {
      editar: (id) => formGrade(d.grades.find((x) => String(x.id) === String(id))),
      duplicar: async (id) => { await ctx.postJson('/api/agenda/grades', { acao: 'duplicar', id: Number(id) }); avisar('Grade duplicada.'); await grades(); },
      excluir: (id, b) => ctx.pedirConfirmacao(b, 'Excluir esta grade?', async () => {
        try { await ctx.postJson('/api/agenda/grades', { acao: 'excluir', id: Number(id) }); fecharMenus(); avisar('Grade excluída.'); await grades(); }
        catch (e) { avisarErro(e); return false; }
      }),
    });
  }

  function formGrade(gr) {
    const faixas = JSON.parse(JSON.stringify((gr && gr.faixas) || {}));
    const datas = JSON.parse(JSON.stringify((gr && gr.datas) || {}));
    let nomeAtual = (gr && gr.nome) || '';
    const g = abrirGaveta();
    g.innerHTML = `<form class="ag-gaveta__form" id="ag-gf" novalidate>
      <header class="ag-gaveta__topo">
        <div><h2>${gr ? ctx.esc(gr.nome) : 'Nova grade'}</h2><p class="mini">Horário de Brasília. Mais de uma faixa por dia é permitido.</p></div>
        <button class="ag-gaveta__fechar" type="button" data-fechar aria-label="Fechar">${ICONE.fechar}</button>
      </header>
      <div class="ag-gaveta__corpo ag-form" id="ag-gf-corpo"></div>
      <footer class="ag-gaveta__rodape">
        <div id="ag-gf-erro"></div>
        ${SAIR_HTML}
        <div class="ag-acoes"><button class="btn" type="submit">${gr ? 'Salvar' : 'Criar grade'}</button>
          <button class="btn sec" type="button" data-fechar>Cancelar</button></div>
      </footer>
    </form>`;
    const form = ctx.$('#ag-gf');
    const corpo = ctx.$('#ag-gf-corpo');
    const faixasHtml = (lista, chave) => (lista || []).map((f, i) => `<span class="ag-faixa">
        <input type="time" value="${f[0]}" data-k="${chave}" data-i="${i}" data-p="0" aria-label="Início da faixa ${i + 1}"><span aria-hidden="true">até</span><input type="time" value="${f[1] === '24:00' ? '23:59' : f[1]}" data-k="${chave}" data-i="${i}" data-p="1" aria-label="Fim da faixa ${i + 1}">
        <button class="ag-icone" type="button" data-rm-k="${chave}" data-rm-i="${i}" aria-label="Remover faixa ${i + 1}">${ICONE.fechar}</button></span>`).join('');
    const desenhar = () => {
      corpo.innerHTML = `
        <label>Nome <input type="text" name="nome" value="${ctx.esc(nomeAtual)}" placeholder="Horários de mentoria" required></label>
        <div class="ag-campo"><span class="ag-campo__rotulo">Semana</span>
          ${DIAS.map(([k, nome]) => `<div class="ag-dia"><b>${nome}</b><div class="ag-faixas">
            ${(faixas[k] || []).length ? faixasHtml(faixas[k], 'd' + k) : '<span class="mini">Indisponível</span>'}
            <button class="btn sec" type="button" data-add="d${k}">Adicionar faixa</button>
            ${(faixas[k] || []).length ? `<button class="btn sec" type="button" data-copiar="${k}">Copiar para outros dias</button>` : ''}
          </div></div>`).join('')}
        </div>
        <div id="ag-copiar"></div>
        <div class="ag-campo"><span class="ag-campo__rotulo">Datas especiais (feriado, viagem, horário diferente)</span>
          ${Object.keys(datas).sort().map((ymd) => `<div class="ag-dia"><b>${ymd.split('-').reverse().join('/')}</b><div class="ag-faixas">
            ${datas[ymd].length ? faixasHtml(datas[ymd], 'x' + ymd) : '<span class="carimbo queda">Bloqueada</span>'}
            <button class="btn sec" type="button" data-add="x${ymd}">Adicionar faixa</button>
            <button class="btn perigo" type="button" data-rm-data="${ymd}">Remover data</button></div></div>`).join('') || '<p class="mini">Nenhuma data especial.</p>'}
          <div class="ag-acoes"><input type="date" id="ag-nova-data" aria-label="Data especial">
            <button class="btn sec" type="button" id="ag-bloquear">Bloquear o dia</button>
            <button class="btn sec" type="button" id="ag-excecao">Horário diferente no dia</button></div>
        </div>`;
    };
    const lista = (chave) => (chave[0] === 'd' ? (faixas[chave.slice(1)] = faixas[chave.slice(1)] || []) : (datas[chave.slice(1)] = datas[chave.slice(1)] || []));
    desenhar();
    corpo.oninput = (ev) => {
      const i = ev.target.dataset;
      if (ev.target.name === 'nome') nomeAtual = ev.target.value;
      if (i.k === undefined) return;
      let valor = ev.target.value;
      // O campo de hora não aceita 24:00; 23:59 no fim da faixa vale o dia todo.
      if (i.p === '1' && valor === '23:59') valor = '24:00';
      lista(i.k)[Number(i.i)][Number(i.p)] = valor;
    };
    corpo.onclick = (ev) => {
      const b = ev.target.closest('button');
      if (!b) return;
      if (b.dataset.add) { const l = lista(b.dataset.add); const ult = l[l.length - 1]; l.push(ult ? [ult[1] < '23:00' ? ult[1] : '09:00', '18:00'] : ['09:00', '18:00']); return desenhar(); }
      if (b.dataset.rmK) { lista(b.dataset.rmK).splice(Number(b.dataset.rmI), 1); return desenhar(); }
      if (b.dataset.rmData) { delete datas[b.dataset.rmData]; return desenhar(); }
      if (b.id === 'ag-bloquear' || b.id === 'ag-excecao') {
        const val = ctx.$('#ag-nova-data').value;
        if (!val) { avisar('Escolha a data primeiro.', 'erro'); return; }
        datas[val] = b.id === 'ag-bloquear' ? [] : [['09:00', '12:00']];
        desenhar();
        if (b.id === 'ag-excecao') avisar('Ajuste o horário dessa data na lista de datas especiais.');
        return;
      }
      if (b.dataset.copiar) {
        const de = b.dataset.copiar;
        ctx.$('#ag-copiar').innerHTML = `<div class="ag-campo ag-copiar"><span class="ag-campo__rotulo">Copiar as faixas de ${DIAS.find((x) => x[0] === de)[1]} para</span><div class="ag-acoes">
          ${DIAS.filter((x) => x[0] !== de).map(([k, n]) => `<label class="marca"><input type="checkbox" value="${k}"> ${n}</label>`).join('')}
          <button class="btn sec" type="button" id="ag-copiar-ok">Copiar</button></div></div>`;
        ctx.$('#ag-copiar-ok').onclick = () => {
          const alvos = [...ctx.$('#ag-copiar').querySelectorAll('input:checked')];
          alvos.forEach((cb) => { faixas[cb.value] = faixas[de].map((f) => [...f]); });
          desenhar();
          if (alvos.length) avisar(`Faixas copiadas para ${alvos.length} dia(s).`);
        };
      }
    };
    protegerSaida(g, form, () => JSON.stringify([nomeAtual, faixas, datas]));
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      for (const k of Object.keys(faixas)) if (!faixas[k].length) delete faixas[k];
      try {
        await ctx.postJson('/api/agenda/grades', { acao: 'salvar', id: gr ? gr.id : undefined, nome: nomeAtual, faixas, datas });
        g.close();
        avisar(gr ? 'Grade salva.' : 'Grade criada.');
        await grades();
      } catch (e) { ctx.$('#ag-gf-erro').innerHTML = erroHtml(e); }
    };
  }

  // ---------------------------------------------------------------------------
  // Agendas conectadas
  // ---------------------------------------------------------------------------
  async function agendas() {
    filtroDeDatas(false, 'configuração · contas do Workspace (@seteads.com)');
    const d = await ctx.fetchJson('/api/agenda/agendas');
    const saude = (a) => a.ultimo_erro
      ? `<span class="carimbo queda">Erro</span> <span class="mini">${ctx.esc(a.ultimo_erro)}</span>`
      : a.ultima_leitura_ok ? `<span class="carimbo alta">Ok</span> <span class="mini">lida em ${quando(a.ultima_leitura_ok)}</span>` : '<span class="mini">Ainda não lida</span>';
    el().innerHTML = `
      <form class="ag-subvistas" id="ag-conta-form">
        <input type="email" id="ag-conta-email" placeholder="felipe@seteads.com" aria-label="E-mail da conta do Workspace" style="min-width:240px">
        <button class="btn" type="submit">Adicionar conta</button>
      </form>
      ${d.contas.length ? '' : '<div class="aviso">Nenhuma conta conectada. Adicione a conta dona da agenda das reuniões (ex.: felipe@seteads.com).</div>'}
      ${d.contas.map((c) => `<div class="bloco"><h2>${ctx.esc(c.email)} <small>${menuHtml(c.email, [
        { acao: 'reler', id: c.email, rotulo: 'Ler as agendas de novo' },
        { acao: 'remover', id: c.email, rotulo: 'Remover conta', perigo: true },
      ])}</small></h2>
        <div class="tabela-wrap"><table><thead><tr><th>Agenda</th><th>Já vem marcada nos tipos novos</th><th>Usada por</th><th>Leitura</th></tr></thead><tbody>
        ${c.agendas.map((a) => `<tr><td><b>${ctx.esc(a.nome)}</b></td>
          <td><label class="marca"><input type="checkbox" data-conflito="${ctx.esc(a.id)}"${a.conflito ? ' checked' : ''} aria-label="${ctx.esc(a.nome)} já vem marcada como agenda que bloqueia horário"> Bloqueia horário</label></td>
          <td class="mini">${[...a.destino_de.map((n) => 'Destino: ' + ctx.esc(n)), ...a.conflito_de.map((n) => 'Bloqueia: ' + ctx.esc(n))].join('<br>') || 'Nenhum tipo'}</td>
          <td>${saude(a)}</td></tr>`).join('')}
        </tbody></table></div></div>`).join('')}`;
    ctx.$('#ag-conta-form').onsubmit = async (ev) => {
      ev.preventDefault();
      const b = ev.target.querySelector('button');
      b.disabled = true;
      b.textContent = 'Lendo agendas…';
      try { await ctx.postJson('/api/agenda/agendas', { acao: 'adicionar_conta', email: ctx.$('#ag-conta-email').value }); avisar('Conta conectada.'); await agendas(); }
      catch (e) { avisarErro(e); b.disabled = false; b.textContent = 'Adicionar conta'; }
    };
    el().onchange = async (ev) => {
      const id = ev.target.dataset.conflito;
      if (id === undefined) return;
      try {
        await ctx.postJson('/api/agenda/agendas', { acao: 'conflito', id, conflito: ev.target.checked });
        avisar(ev.target.checked ? 'Vai vir marcada nos tipos novos.' : 'Não vem mais marcada nos tipos novos.');
      } catch (e) { ev.target.checked = !ev.target.checked; avisarErro(e); }
    };
    ligarMenus(el(), {
      reler: async (email) => { await ctx.postJson('/api/agenda/agendas', { acao: 'reler', email }); avisar('Agendas lidas de novo.'); await agendas(); },
      remover: (email, b) => ctx.pedirConfirmacao(b, 'Remover a conta e as agendas dela?', async () => {
        try { await ctx.postJson('/api/agenda/agendas', { acao: 'remover_conta', email }); fecharMenus(); avisar('Conta removida.'); await agendas(); }
        catch (e) { avisarErro(e); return false; }
      }),
    });
  }
})();
