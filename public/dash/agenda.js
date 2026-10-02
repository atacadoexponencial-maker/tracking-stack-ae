// Aba Agenda do dash (spec-agenda-propria.md, issues 356–363).
//
// Quatro vistas: Agendamentos (módulo 8), Tipos de reunião (3), Grades de
// horário (2) e Agendas conectadas (1). Só coleta e exibe: toda regra,
// validação e cálculo de horário mora em /api/agenda/* (a mensagem de erro
// mostrada é sempre a do servidor).
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
  const diaLongo = (ymd) => new Date(ymd + 'T12:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC', weekday: 'long', day: '2-digit', month: '2-digit' });

  let ctx = null;
  let filtroTipos = 'ativos';
  let filtroReuniao = { tipo: '', situacao: '' };

  const api = {
    vista: 'agendamentos',
    lerVista(v) { api.vista = VISTAS.includes(v) ? v : 'agendamentos'; },
    render,
  };
  window.AgendaDash = api;

  function el() { return ctx.$('#agenda-conteudo'); }
  function erroHtml(e) { return `<div class="aviso falha">${ctx.esc((e && (e.mensagemUsuario || e.message)) || 'Erro.')}</div>`; }

  async function render(c) {
    ctx = c;
    const sec = ctx.$('#secao-agenda');
    sec.querySelectorAll('[data-agenda-vista]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.agendaVista === api.vista));
      b.onclick = () => { api.vista = b.dataset.agendaVista; ctx.escreverUrl(); ctx.rerender(); };
    });
    // Só Agendamentos segue o período do topo; as outras vistas são cadastro.
    if (api.vista !== 'agendamentos') {
      ['#preset', '#data-de', '#data-ate'].forEach((s) => { ctx.$(s).hidden = true; });
      ctx.$('#subtitulo').textContent = 'cadastro · não usa o filtro de datas';
    }
    el().innerHTML = '<div class="aviso">Carregando…</div>';
    el().onclick = null;
    el().onchange = null;
    await ({ agendamentos, tipos, grades, agendas })[api.vista]();
  }

  // -------------------------------------------------------------------------
  // Agendamentos
  // -------------------------------------------------------------------------
  async function agendamentos() {
    const p = ctx.intervalo();
    // O período vale para a DATA DA REUNIÃO. "Últimos N dias" esconderia as
    // futuras; por isso a lista vai do início do período até 60 dias à frente.
    const ate = Math.max(p.ate, Math.floor(Date.now() / 1000) + 60 * 86400);
    const qs = `from=${p.de}&to=${ate}` + (filtroReuniao.tipo ? `&tipo=${filtroReuniao.tipo}` : '') + (filtroReuniao.situacao ? `&situacao=${filtroReuniao.situacao}` : '');
    const d = await ctx.fetchJson('/api/agenda/reunioes?' + qs);
    const n = d.numeros;
    el().innerHTML = `
      <div class="grid-etiquetas" id="ag-num"></div>
      <div class="bloco">
        <h2>Reuniões <small>do início do período até 60 dias à frente · horário de Brasília</small></h2>
        <div class="ag-acoes" style="margin-bottom:0.8rem">
          <select id="ag-f-tipo" aria-label="Tipo de reunião"><option value="">Todos os tipos</option>
            ${d.tipos.map((t) => `<option value="${t.id}">${ctx.esc(t.nome)}${t.ativo ? '' : ' (pausado)'}</option>`).join('')}</select>
          <select id="ag-f-sit" aria-label="Situação"><option value="">Todas as situações</option>
            ${Object.entries(SITUACAO).map(([k, [r]]) => `<option value="${k}">${r}</option>`).join('')}</select>
        </div>
        <div class="tabela-wrap" id="ag-lista"></div>
      </div>
      <div id="ag-detalhe"></div>`;
    ctx.$('#ag-num').innerHTML = [
      { rotulo: 'Agendados', valor: ctx.fmtInt(n.agendados), nota: 'no recorte abaixo' },
      { rotulo: 'Cancelados', valor: ctx.fmtInt(n.cancelados) },
      { rotulo: 'Faltas', valor: ctx.fmtInt(n.faltas) },
      { rotulo: 'Comparecimento', valor: n.taxa_comparecimento === null ? null : ctx.fmtPct(n.taxa_comparecimento * 100, 0), nota: n.taxa_comparecimento === null ? 'nenhuma reunião com presença lida' : `${n.realizadas} de ${n.realizadas + n.faltas} com presença lida` },
    ].map((k) => ctx.tile(k)).join('');
    ctx.$('#ag-f-tipo').value = filtroReuniao.tipo;
    ctx.$('#ag-f-sit').value = filtroReuniao.situacao;
    ctx.$('#ag-f-tipo').onchange = (e) => { filtroReuniao.tipo = e.target.value; agendamentos(); };
    ctx.$('#ag-f-sit').onchange = (e) => { filtroReuniao.situacao = e.target.value; agendamentos(); };
    const agora = Math.floor(Date.now() / 1000);
    ctx.tabela(ctx.$('#ag-lista'), [
      { titulo: 'Quando', campo: 'inicio', render: (r) => `<b>${quando(r.inicio)}</b>${r.inicio < agora && ['marcada', 'remarcada'].includes(r.situacao) ? ' <span class="mini">(aguardando presença)</span>' : ''}` },
      { titulo: 'Nome', campo: 'nome', render: (r) => `${ctx.esc(r.nome)}${r.is_teste ? ' <span class="carimbo neutro">teste</span>' : ''}<br><span class="mini">${ctx.esc(r.email)}</span>` },
      { titulo: 'WhatsApp', campo: 'telefone', render: (r) => r.telefone ? `<span class="mini">+${ctx.esc(r.telefone)}</span>` : '' },
      { titulo: 'Tipo', campo: 'tipo_nome', render: (r) => ctx.esc(r.tipo_nome) },
      { titulo: 'Funil', campo: 'funil', render: (r) => r.comercial ? ctx.esc(r.funil || '') : '<span class="mini">não comercial</span>' },
      { titulo: 'Origem', campo: 'utm_source', render: (r) => r.utm_source ? `<span class="mini">${ctx.esc(r.utm_source)}${r.utm_medium ? ' / ' + ctx.esc(r.utm_medium) : ''}${r.utm_campaign ? '<br>' + ctx.esc(r.utm_campaign) : ''}</span>` : '<span class="mini">direto</span>' },
      { titulo: 'Situação', campo: 'situacao', render: (r) => carimbo(r.situacao) },
      { titulo: '', campo: 'id', render: (r) => `<button class="btn sec" type="button" data-abrir="${r.id}">detalhe</button>` },
    ], d.rows, undefined, 'Nenhuma reunião neste recorte. Assim que alguém agendar, a reunião aparece aqui.');
    ctx.$('#ag-lista').onclick = (ev) => {
      const b = ev.target.closest('[data-abrir]');
      if (b) detalhe(b.dataset.abrir);
    };
  }

  function carimbo(s) {
    const [r, c] = SITUACAO[s] || [s, 'neutro'];
    return `<span class="carimbo ${c}">${ctx.esc(r)}</span>`;
  }

  async function detalhe(id) {
    const alvo = ctx.$('#ag-detalhe');
    alvo.innerHTML = '<div class="aviso">Carregando…</div>';
    let d;
    try { d = await ctx.fetchJson('/api/agenda/reunioes?id=' + encodeURIComponent(id)); }
    catch (e) { alvo.innerHTML = erroHtml(e); return; }
    const r = d.reuniao;
    const agora = Math.floor(Date.now() / 1000);
    const ativa = ['marcada', 'remarcada'].includes(r.situacao);
    const ACOES = { agendou: 'Agendou', remarcou: 'Remarcou', cancelou: 'Cancelou', presenca: 'Presença' };
    const POR = { lead: 'lead', equipe: 'equipe', sistema: 'sistema', google: 'agenda do Google' };
    alvo.innerHTML = `<div class="bloco"><h2>${ctx.esc(r.nome)} <small>${ctx.esc(r.tipo_nome || '')} · ${quando(r.inicio)} às ${hora(r.fim)}</small></h2>
      <p>${carimbo(r.situacao)} ${r.presenca_origem ? `<span class="mini">presença ${r.presenca_origem === 'meet' ? 'lida no Meet' : 'marcada à mão'}</span>` : ''}</p>
      <p class="mini">${ctx.esc(r.email)}${r.telefone ? ' · +' + ctx.esc(r.telefone) : ''}${r.fuso_lead && r.fuso_lead !== FUSO ? ' · fuso do lead: ' + ctx.esc(r.fuso_lead) : ''}</p>
      ${r.meet_link ? `<p class="mini">Meet: <a href="${ctx.esc(r.meet_link)}" target="_blank" rel="noopener">${ctx.esc(r.meet_link)}</a></p>` : ''}
      ${r.crm_link ? `<p><a class="btn sec" href="${ctx.esc(r.crm_link)}" target="_blank" rel="noopener">Abrir card no CRM</a></p>`
        : r.comercial ? `<p class="mini">CRM: ${ctx.esc({ sem_card: 'card do lead não encontrado no ClickUp', sem_credencial: 'ClickUp não configurado neste ambiente' }[r.crm_situacao] || r.crm_situacao || 'aguardando')}</p>` : ''}
      ${r.respostas.length ? `<h3 class="mini" style="margin-top:1rem">Respostas</h3><ul class="ag-hist">${r.respostas.map((x) => `<li><b>${ctx.esc(x.pergunta)}</b> ${ctx.esc(x.resposta || '—')}</li>`).join('')}</ul>` : ''}
      ${r.motivo_cancel ? `<p class="mini">Motivo do cancelamento: ${ctx.esc(r.motivo_cancel)}</p>` : ''}
      <h3 class="mini" style="margin-top:1rem">Histórico</h3>
      <ul class="ag-hist">${d.historico.map((h) => `<li>${quando(h.criado_em)} · <b>${ACOES[h.acao] || ctx.esc(h.acao)}</b> por ${POR[h.por] || ctx.esc(h.por)}${h.detalhe ? ' · ' + ctx.esc(h.detalhe) : ''}</li>`).join('')}</ul>
      <div class="ag-acoes" style="margin-top:1rem">
        ${ativa ? '<button class="btn sec" type="button" id="ag-remarcar">Remarcar</button><button class="btn perigo" type="button" id="ag-cancelar">Cancelar reunião</button>' : ''}
        ${r.inicio < agora && r.situacao !== 'cancelada' ? `<span class="mini">Presença:</span>
          <button class="btn sec" type="button" data-presenca="realizada">Realizada</button>
          <button class="btn sec" type="button" data-presenca="faltou">Faltou</button>
          <button class="btn sec" type="button" data-presenca="sem_info">Sem informação</button>` : ''}
      </div>
      <div id="ag-remarcar-slots"></div>
      <div id="ag-det-erro"></div></div>`;
    alvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const erro = (e) => { ctx.$('#ag-det-erro').innerHTML = erroHtml(e); };
    const depois = async () => { await agendamentos(); await detalhe(id); };
    const bc = ctx.$('#ag-cancelar');
    if (bc) bc.onclick = () => ctx.pedirConfirmacao(bc, 'Cancelar e avisar o lead pelo Google?', async () => {
      try { await ctx.postJson('/api/agenda/reunioes', { acao: 'cancelar', id }); await depois(); } catch (e) { erro(e); return false; }
    });
    const br = ctx.$('#ag-remarcar');
    if (br) br.onclick = async () => {
      const caixa = ctx.$('#ag-remarcar-slots');
      caixa.innerHTML = '<div class="aviso">Carregando horários livres…</div>';
      try {
        const h = await ctx.fetchJson(`/api/agenda/horarios?tipo=${r.tipo_id}&reuniao=${encodeURIComponent(id)}`);
        caixa.innerHTML = slotsHtml(h.dias, 'Escolha o novo horário (o lead recebe a atualização pelo Google):');
        caixa.onclick = async (ev) => {
          const b = ev.target.closest('[data-slot]');
          if (!b) return;
          b.disabled = true;
          try { await ctx.postJson('/api/agenda/reunioes', { acao: 'remarcar', id, inicio: Number(b.dataset.slot) }); await depois(); }
          catch (e) { erro(e); b.disabled = false; }
        };
      } catch (e) { caixa.innerHTML = erroHtml(e); }
    };
    alvo.querySelectorAll('[data-presenca]').forEach((b) => {
      b.onclick = async () => {
        try { await ctx.postJson('/api/agenda/reunioes', { acao: 'presenca', id, situacao: b.dataset.presenca }); await depois(); } catch (e) { erro(e); }
      };
    });
  }

  function slotsHtml(dias, titulo) {
    const chaves = Object.keys(dias || {}).sort();
    if (!chaves.length) return '<div class="aviso">Nenhum horário livre na janela do tipo.</div>';
    return `<p class="mini" style="margin-top:1rem">${ctx.esc(titulo)}</p>` + chaves.map((d) => `<div class="ag-dia"><b class="mini">${diaLongo(d)}</b>
      <div class="ag-slots">${dias[d].map((t) => `<button class="btn sec" type="button" data-slot="${t}">${hora(t)}</button>`).join('')}</div></div>`).join('');
  }

  // -------------------------------------------------------------------------
  // Tipos de reunião
  // -------------------------------------------------------------------------
  async function tipos(editarId) {
    const d = await ctx.fetchJson('/api/agenda/tipos');
    const lista = d.tipos.filter((t) => filtroTipos === 'todos' || (filtroTipos === 'ativos' ? t.ativo : !t.ativo));
    const site = location.origin.includes('localhost') ? 'https://atacadoexponencial.com' : location.origin;
    el().innerHTML = `
      <div class="bloco">
        <h2>Tipos de reunião <small>cada tipo tem o próprio link de agendamento</small></h2>
        <div class="ag-acoes" style="margin-bottom:0.8rem">
          <select id="ag-ft" aria-label="Situação dos tipos">
            <option value="ativos">Ativos</option><option value="pausados">Pausados</option><option value="todos">Todos</option>
          </select>
          <button class="btn" type="button" id="ag-novo-tipo">Novo tipo de reunião</button>
        </div>
        ${!d.opcoes.agendas.length ? '<div class="aviso alerta">Conecte uma agenda (Agendas conectadas) antes de criar um tipo.</div>' : ''}
        ${!d.opcoes.grades.length ? '<div class="aviso alerta">Crie uma grade de horário antes de criar um tipo.</div>' : ''}
        <div class="tabela-wrap" id="ag-tipos"></div>
      </div>
      <div id="ag-tipo-form"></div>`;
    ctx.$('#ag-ft').value = filtroTipos;
    ctx.$('#ag-ft').onchange = (e) => { filtroTipos = e.target.value; tipos(); };
    ctx.$('#ag-novo-tipo').onclick = () => formTipo(null, d.opcoes);
    ctx.tabela(ctx.$('#ag-tipos'), [
      { titulo: 'Nome', campo: 'nome', render: (t) => `<b>${ctx.esc(t.nome)}</b><br><span class="mini">${t.comercial ? 'comercial · ' + ctx.esc(t.funil) : 'não comercial (RH, entrevistas)'}</span>` },
      { titulo: 'Duração', num: true, campo: 'duracao_min', render: (t) => `${t.duracao_min} min` },
      { titulo: 'Link', campo: 'slug', render: (t) => `<span class="mini">/agendar/${ctx.esc(t.slug)}</span>${t.comercial ? '<br><span class="mini">abre depois do formulário da LP</span>' : ''}` },
      { titulo: 'Situação', campo: 'ativo', render: (t) => t.ativo ? '<span class="carimbo alta">Ativo</span>' : '<span class="carimbo neutro">Pausado</span>' },
      { titulo: 'Futuras', num: true, campo: 'futuros', render: (t) => ctx.fmtInt(t.futuros) },
      { titulo: '', campo: 'id', render: (t) => `<div class="ag-acoes">
          <button class="btn sec" type="button" data-t-editar="${t.id}">editar</button>
          <button class="btn sec" type="button" data-t-horarios="${t.id}">ver horários livres</button>
          <button class="btn sec" type="button" data-t-previa="${t.id}">pré-visualizar</button>
          ${t.comercial ? '' : `<button class="btn sec" type="button" data-t-copiar="${site}/agendar/${ctx.esc(t.slug)}">copiar link</button>`}
          <button class="btn sec" type="button" data-t-duplicar="${t.id}">duplicar</button>
          <button class="btn sec" type="button" data-t-${t.ativo ? 'pausar' : 'reativar'}="${t.id}">${t.ativo ? 'pausar' : 'reativar'}</button>
          <button class="btn perigo" type="button" data-t-excluir="${t.id}">excluir</button></div>` },
    ], lista, undefined, filtroTipos === 'ativos' ? 'Nenhum tipo ativo. Crie um tipo de reunião ou veja os pausados no filtro.' : 'Nenhum tipo nesta situação.');

    const erro = (e) => { ctx.$('#ag-tipo-form').innerHTML = erroHtml(e); };
    ctx.$('#ag-tipos').onclick = async (ev) => {
      const alvo = ev.target.closest('button');
      if (!alvo) return;
      const ds = alvo.dataset;
      const id = Number(ds.tEditar || ds.tHorarios || ds.tPrevia || ds.tDuplicar || ds.tPausar || ds.tReativar || ds.tExcluir);
      const tipo = d.tipos.find((t) => t.id === id);
      try {
        if (ds.tEditar) return formTipo(tipo, d.opcoes);
        if (ds.tCopiar) { await navigator.clipboard.writeText(ds.tCopiar).catch(() => {}); alvo.textContent = 'copiado!'; return; }
        if (ds.tPrevia) { const r = await ctx.postJson('/api/agenda/tipos', { acao: 'previa', id }); window.open(r.url, '_blank', 'noopener'); return; }
        if (ds.tHorarios) {
          const caixa = ctx.$('#ag-tipo-form');
          caixa.innerHTML = '<div class="aviso">Lendo a agenda…</div>';
          const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: FUSO });
          const ate = new Date(Date.now() + 7 * 86400000).toLocaleDateString('sv-SE', { timeZone: FUSO });
          const h = await ctx.fetchJson(`/api/agenda/horarios?tipo=${id}&de=${hoje}&ate=${ate}`);
          caixa.innerHTML = `<div class="bloco"><h2>${ctx.esc(tipo.nome)} <small>horários livres dos próximos 7 dias, como o lead vê (Brasília)</small></h2>${slotsHtml(h.dias, '')}</div>`;
          caixa.querySelectorAll('[data-slot]').forEach((b) => { b.disabled = true; });
          return;
        }
        if (ds.tDuplicar) { await ctx.postJson('/api/agenda/tipos', { acao: 'duplicar', id }); return tipos(); }
        if (ds.tPausar) { await ctx.postJson('/api/agenda/tipos', { acao: 'pausar', id }); return tipos(); }
        if (ds.tReativar) { await ctx.postJson('/api/agenda/tipos', { acao: 'reativar', id }); return tipos(); }
        if (ds.tExcluir) {
          ctx.pedirConfirmacao(alvo, 'Excluir este tipo?', async () => {
            try { await ctx.postJson('/api/agenda/tipos', { acao: 'excluir', id }); await tipos(); } catch (e) { erro(e); return false; }
          });
        }
      } catch (e) { erro(e); }
    };
    if (editarId) formTipo(d.tipos.find((t) => t.id === editarId), d.opcoes);
  }

  function formTipo(t, opcoes) {
    const novo = !t;
    const v = t || {
      nome: '', slug: '', duracao_min: 45, destino_cal: (opcoes.agendas.find((a) => a.conflito) || opcoes.agendas[0] || {}).id,
      conflito_cals: opcoes.agendas.filter((a) => a.conflito).map((a) => a.id), grade_id: (opcoes.grades[0] || {}).id,
      folga_antes_min: 0, folga_depois_min: 0, antecedencia_min: 240, janela_dias: 30, limite_dia: '', intervalo_min: 45,
      perguntas: [], titulo_modelo: '{nome} e Atacado Exponencial', comercial: true, funil: 'sessao-estrategica',
      pagina_pos: '', contato_alternativo: '',
    };
    let perguntas = (v.perguntas || []).map((p) => ({ ...p }));
    const opt = (lista, sel) => lista.map(([val, rot]) => `<option value="${ctx.esc(val)}"${String(val) === String(sel) ? ' selected' : ''}>${ctx.esc(rot)}</option>`).join('');
    const caixa = ctx.$('#ag-tipo-form');
    caixa.innerHTML = `<div class="bloco"><h2>${novo ? 'Novo tipo de reunião' : 'Editar ' + ctx.esc(v.nome)} <small>mudanças valem para agendamentos novos</small></h2>
      <form class="ag-form" id="ag-tf">
        <div class="linha">
          <label>Nome <input type="text" name="nome" value="${ctx.esc(v.nome)}" required></label>
          <label>Endereço do link <input type="text" name="slug" value="${ctx.esc(v.slug)}" placeholder="consultoria-individual" required></label>
        </div>
        <div class="linha">
          <label>Duração (min) <input type="number" name="duracao_min" value="${v.duracao_min}" min="5"></label>
          <label>Horários começam a cada (min) <input type="number" name="intervalo_min" value="${v.intervalo_min}" min="5"></label>
          <label>Antecedência mínima (min) <input type="number" name="antecedencia_min" value="${v.antecedencia_min}" min="0"></label>
          <label>Até quantos dias à frente <input type="number" name="janela_dias" value="${v.janela_dias}" min="1"></label>
        </div>
        <div class="linha">
          <label>Folga antes (min) <input type="number" name="folga_antes_min" value="${v.folga_antes_min}" min="0"></label>
          <label>Folga depois (min) <input type="number" name="folga_depois_min" value="${v.folga_depois_min}" min="0"></label>
          <label>Limite de reuniões por dia <input type="number" name="limite_dia" value="${v.limite_dia ?? ''}" min="1" placeholder="sem limite"></label>
        </div>
        <div class="linha">
          <label>Agenda de destino (onde a reunião é criada) <select name="destino_cal">${opt(opcoes.agendas.map((a) => [a.id, `${a.nome} (${a.conta})`]), v.destino_cal)}</select></label>
          <label>Grade de disponibilidade <select name="grade_id">${opt(opcoes.grades.map((g) => [g.id, `${g.nome}: ${g.resumo}`]), v.grade_id)}</select></label>
        </div>
        <fieldset><legend>Agendas que bloqueiam horário (conflito)</legend>
          ${opcoes.agendas.map((a) => `<label class="marca"><input type="checkbox" name="conflito" value="${ctx.esc(a.id)}"${v.conflito_cals.includes(a.id) ? ' checked' : ''}> ${ctx.esc(a.nome)} <span class="mini">${ctx.esc(a.conta)}</span></label>`).join('')}
        </fieldset>
        <fieldset><legend>Comercial</legend>
          <label class="marca"><input type="checkbox" name="comercial"${v.comercial ? ' checked' : ''}> Reunião comercial (abre só depois do formulário da LP, conta em Reuniões agendadas, vai para o card do CRM e manda a conversão)</label>
          <label>Funil <select name="funil">${opt(opcoes.funis.map((f) => [f, f]), v.funil || '')}</select></label>
        </fieldset>
        <div class="linha">
          <label>Título do evento na agenda <input type="text" name="titulo_modelo" value="${ctx.esc(v.titulo_modelo)}"></label>
          <label>Página depois de confirmar <input type="text" name="pagina_pos" value="${ctx.esc(v.pagina_pos || '')}" placeholder="vazio = confirmação da própria agenda"></label>
        </div>
        <label>Contato para quando a agenda estiver pausada ou for em cima da hora <input type="text" name="contato_alternativo" value="${ctx.esc(v.contato_alternativo || '')}" placeholder="ex.: WhatsApp (11) 99999-9999"></label>
        <fieldset><legend>Perguntas extras</legend><div id="ag-perg"></div>
          <div><button class="btn sec" type="button" id="ag-perg-add">Adicionar pergunta</button></div></fieldset>
        <div id="ag-tf-erro"></div>
        <div class="ag-acoes"><button class="btn" type="submit">${novo ? 'Criar tipo' : 'Salvar'}</button>
          <button class="btn sec" type="button" id="ag-tf-cancelar">Cancelar</button></div>
      </form></div>`;
    caixa.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const form = ctx.$('#ag-tf');
    const funilSel = form.querySelector('[name="funil"]');
    const comercialCb = form.querySelector('[name="comercial"]');
    const ajustarFunil = () => { funilSel.closest('label').hidden = !comercialCb.checked; };
    comercialCb.onchange = ajustarFunil;
    ajustarFunil();

    const desenharPerguntas = () => {
      ctx.$('#ag-perg').innerHTML = perguntas.map((p, i) => `<div class="ag-dia" data-i="${i}">
        <div class="ag-acoes"><button class="btn sec" type="button" data-sobe="${i}" ${i ? '' : 'disabled'} aria-label="Subir">↑</button><button class="btn sec" type="button" data-desce="${i}" ${i < perguntas.length - 1 ? '' : 'disabled'} aria-label="Descer">↓</button></div>
        <div style="display:grid;gap:0.4rem">
          <input type="text" data-campo="texto" value="${ctx.esc(p.texto)}" placeholder="Texto da pergunta">
          <div class="ag-acoes"><select data-campo="tipo">${opt([['texto', 'Texto livre'], ['escolha', 'Escolha única']], p.tipo)}</select>
            <label class="marca"><input type="checkbox" data-campo="obrigatoria"${p.obrigatoria ? ' checked' : ''}> obrigatória</label>
            <button class="btn perigo" type="button" data-remove="${i}">remover</button></div>
          ${p.tipo === 'escolha' ? `<textarea data-campo="opcoes" rows="3" placeholder="Uma opção por linha">${ctx.esc((p.opcoes || []).join('\n'))}</textarea>` : ''}
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
    ctx.$('#ag-tf-cancelar').onclick = () => { caixa.innerHTML = ''; };
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      lerPerguntas();
      const f = new FormData(form);
      const corpo = {
        acao: 'salvar', id: t ? t.id : undefined,
        nome: f.get('nome'), slug: f.get('slug'), duracao_min: f.get('duracao_min'), intervalo_min: f.get('intervalo_min'),
        antecedencia_min: f.get('antecedencia_min'), janela_dias: f.get('janela_dias'), folga_antes_min: f.get('folga_antes_min'),
        folga_depois_min: f.get('folga_depois_min'), limite_dia: f.get('limite_dia'), destino_cal: f.get('destino_cal'),
        grade_id: f.get('grade_id'), conflito_cals: f.getAll('conflito'), comercial: comercialCb.checked,
        funil: comercialCb.checked ? f.get('funil') : '', titulo_modelo: f.get('titulo_modelo'),
        pagina_pos: f.get('pagina_pos'), contato_alternativo: f.get('contato_alternativo'), perguntas,
      };
      try { await ctx.postJson('/api/agenda/tipos', corpo); await tipos(); }
      catch (e) { ctx.$('#ag-tf-erro').innerHTML = erroHtml(e); }
    };
  }

  // -------------------------------------------------------------------------
  // Grades de horário
  // -------------------------------------------------------------------------
  async function grades() {
    const d = await ctx.fetchJson('/api/agenda/grades');
    el().innerHTML = `<div class="bloco"><h2>Grades de horário <small>horário de Brasília · reaproveitadas pelos tipos de reunião</small></h2>
      <div class="ag-acoes" style="margin-bottom:0.8rem"><button class="btn" type="button" id="ag-nova-grade">Nova grade</button></div>
      <div class="tabela-wrap" id="ag-grades"></div></div><div id="ag-grade-form"></div>`;
    ctx.$('#ag-nova-grade').onclick = () => formGrade(null);
    ctx.tabela(ctx.$('#ag-grades'), [
      { titulo: 'Nome', campo: 'nome', render: (g) => `<b>${ctx.esc(g.nome)}</b>` },
      { titulo: 'Horários', campo: 'resumo', render: (g) => `<span class="mini">${ctx.esc(g.resumo)}</span>${Object.keys(g.datas).length ? `<br><span class="mini">${Object.keys(g.datas).length} data(s) especial(is)</span>` : ''}` },
      { titulo: 'Tipos que usam', num: true, campo: 'tipos', render: (g) => ctx.fmtInt(g.tipos) },
      { titulo: '', campo: 'id', render: (g) => `<div class="ag-acoes"><button class="btn sec" type="button" data-g-editar="${g.id}">editar</button>
          <button class="btn sec" type="button" data-g-duplicar="${g.id}">duplicar</button>
          <button class="btn perigo" type="button" data-g-excluir="${g.id}">excluir</button></div>` },
    ], d.grades, undefined, 'Nenhuma grade ainda. Crie as grades de horário que os tipos de reunião vão usar.');
    const erro = (e) => { ctx.$('#ag-grade-form').innerHTML = erroHtml(e); };
    ctx.$('#ag-grades').onclick = async (ev) => {
      const b = ev.target.closest('button');
      if (!b) return;
      const id = Number(b.dataset.gEditar || b.dataset.gDuplicar || b.dataset.gExcluir);
      try {
        if (b.dataset.gEditar) return formGrade(d.grades.find((g) => g.id === id));
        if (b.dataset.gDuplicar) { await ctx.postJson('/api/agenda/grades', { acao: 'duplicar', id }); return grades(); }
        if (b.dataset.gExcluir) {
          ctx.pedirConfirmacao(b, 'Excluir esta grade?', async () => {
            try { await ctx.postJson('/api/agenda/grades', { acao: 'excluir', id }); await grades(); } catch (e) { erro(e); return false; }
          });
        }
      } catch (e) { erro(e); }
    };
  }

  function formGrade(g) {
    const faixas = JSON.parse(JSON.stringify((g && g.faixas) || {}));
    const datas = JSON.parse(JSON.stringify((g && g.datas) || {}));
    const caixa = ctx.$('#ag-grade-form');
    const faixasHtml = (lista, chave) => (lista || []).map((f, i) => `<span class="ag-faixa">
        <input type="time" value="${f[0]}" data-k="${chave}" data-i="${i}" data-p="0" aria-label="Início">–<input type="time" value="${f[1] === '24:00' ? '23:59' : f[1]}" data-k="${chave}" data-i="${i}" data-p="1" aria-label="Fim">
        <button class="btn perigo" type="button" data-rm-k="${chave}" data-rm-i="${i}" aria-label="Remover faixa">×</button></span>`).join('');
    const desenhar = () => {
      caixa.innerHTML = `<div class="bloco"><h2>${g ? 'Editar ' + ctx.esc(g.nome) : 'Nova grade'} <small>mais de uma faixa por dia é permitido</small></h2>
        <form class="ag-form" id="ag-gf">
          <label>Nome <input type="text" name="nome" value="${ctx.esc((g && g.nome) || '')}" placeholder="Horários de mentoria" required></label>
          <fieldset><legend>Semana</legend>
            ${DIAS.map(([k, nome]) => `<div class="ag-dia"><b>${nome}</b><div class="ag-faixas">
              ${(faixas[k] || []).length ? faixasHtml(faixas[k], 'd' + k) : '<span class="mini">indisponível</span>'}
              <button class="btn sec" type="button" data-add="d${k}">+ faixa</button>
              ${(faixas[k] || []).length ? `<button class="btn sec" type="button" data-copiar="${k}">copiar para…</button>` : ''}
            </div></div>`).join('')}
          </fieldset>
          <div id="ag-copiar"></div>
          <fieldset><legend>Datas especiais (feriado, viagem, horário diferente)</legend>
            ${Object.keys(datas).sort().map((ymd) => `<div class="ag-dia"><b class="mini">${ymd.split('-').reverse().join('/')}</b><div class="ag-faixas">
              ${datas[ymd].length ? faixasHtml(datas[ymd], 'x' + ymd) : '<span class="carimbo queda">bloqueada</span>'}
              <button class="btn sec" type="button" data-add="x${ymd}">+ faixa</button>
              <button class="btn perigo" type="button" data-rm-data="${ymd}">remover data</button></div></div>`).join('') || '<p class="mini">Nenhuma data especial.</p>'}
            <div class="ag-acoes"><input type="date" id="ag-nova-data" aria-label="Data">
              <button class="btn sec" type="button" id="ag-bloquear">Bloquear a data</button>
              <button class="btn sec" type="button" id="ag-excecao">Horário diferente na data</button></div>
          </fieldset>
          <div id="ag-gf-erro"></div>
          <div class="ag-acoes"><button class="btn" type="submit">${g ? 'Salvar' : 'Criar grade'}</button>
            <button class="btn sec" type="button" id="ag-gf-cancelar">Cancelar</button></div>
        </form></div>`;
    };
    const lista = (chave) => (chave[0] === 'd' ? (faixas[chave.slice(1)] = faixas[chave.slice(1)] || []) : (datas[chave.slice(1)] = datas[chave.slice(1)] || []));
    const nome = () => (ctx.$('#ag-gf [name="nome"]') || {}).value || (g && g.nome) || '';
    let nomeAtual = (g && g.nome) || '';
    desenhar();
    caixa.scrollIntoView({ behavior: 'smooth', block: 'start' });
    caixa.oninput = (ev) => {
      const i = ev.target.dataset;
      if (ev.target.name === 'nome') nomeAtual = ev.target.value;
      if (i.k === undefined) return;
      let valor = ev.target.value;
      if (i.p === '1' && valor === '23:59') valor = '24:00';
      lista(i.k)[Number(i.i)][Number(i.p)] = valor;
    };
    caixa.onclick = (ev) => {
      const b = ev.target.closest('button');
      if (!b) return;
      const redesenhar = () => { desenhar(); ctx.$('#ag-gf [name="nome"]').value = nomeAtual; };
      if (b.dataset.add) { const l = lista(b.dataset.add); const ult = l[l.length - 1]; l.push(ult ? [ult[1] < '23:00' ? ult[1] : '09:00', '18:00'] : ['09:00', '18:00']); return redesenhar(); }
      if (b.dataset.rmK) { lista(b.dataset.rmK).splice(Number(b.dataset.rmI), 1); return redesenhar(); }
      if (b.dataset.rmData) { delete datas[b.dataset.rmData]; return redesenhar(); }
      if (b.id === 'ag-bloquear' || b.id === 'ag-excecao') {
        const v = ctx.$('#ag-nova-data').value;
        if (!v) return;
        datas[v] = b.id === 'ag-bloquear' ? [] : [['09:00', '12:00']];
        return redesenhar();
      }
      if (b.dataset.copiar) {
        const de = b.dataset.copiar;
        ctx.$('#ag-copiar').innerHTML = `<fieldset><legend>Copiar as faixas de ${DIAS.find((x) => x[0] === de)[1]} para</legend><div class="ag-acoes">
          ${DIAS.filter((x) => x[0] !== de).map(([k, n]) => `<label class="marca"><input type="checkbox" value="${k}"> ${n}</label>`).join('')}
          <button class="btn sec" type="button" id="ag-copiar-ok">Copiar</button></div></fieldset>`;
        ctx.$('#ag-copiar-ok').onclick = () => {
          ctx.$('#ag-copiar').querySelectorAll('input:checked').forEach((cb) => { faixas[cb.value] = faixas[de].map((f) => [...f]); });
          redesenhar();
        };
        return;
      }
      if (b.id === 'ag-gf-cancelar') { caixa.innerHTML = ''; caixa.onclick = null; caixa.oninput = null; }
    };
    caixa.onsubmit = async (ev) => {
      ev.preventDefault();
      for (const k of Object.keys(faixas)) if (!faixas[k].length) delete faixas[k];
      try { await ctx.postJson('/api/agenda/grades', { acao: 'salvar', id: g ? g.id : undefined, nome: nome(), faixas, datas }); await grades(); }
      catch (e) { ctx.$('#ag-gf-erro').innerHTML = erroHtml(e); }
    };
  }

  // -------------------------------------------------------------------------
  // Agendas conectadas
  // -------------------------------------------------------------------------
  async function agendas() {
    const d = await ctx.fetchJson('/api/agenda/agendas');
    const saude = (a) => a.ultimo_erro
      ? `<span class="ag-saude-erro">● erro: ${ctx.esc(a.ultimo_erro)}</span>`
      : a.ultima_leitura_ok ? `<span class="ag-saude-ok">●</span> <span class="mini">lida em ${quando(a.ultima_leitura_ok)}</span>` : '<span class="mini">ainda não lida</span>';
    el().innerHTML = `<div class="bloco"><h2>Agendas conectadas <small>contas do Workspace (@seteads.com)</small></h2>
        <form class="ag-acoes" id="ag-conta-form" style="margin-bottom:1rem">
          <input type="email" id="ag-conta-email" placeholder="felipe@seteads.com" aria-label="E-mail da conta" style="min-width:240px">
          <button class="btn" type="submit">Adicionar conta</button></form>
        <div id="ag-conta-erro"></div>
        ${d.contas.length ? '' : '<div class="aviso">Nenhuma conta conectada. Adicione a conta dona da agenda das reuniões (ex.: felipe@seteads.com).</div>'}
      </div>
      ${d.contas.map((c) => `<div class="bloco"><h2>${ctx.esc(c.email)} <small><button class="btn sec" type="button" data-reler="${ctx.esc(c.email)}">ler de novo</button>
        <button class="btn perigo" type="button" data-remover="${ctx.esc(c.email)}">remover conta</button></small></h2>
        <div class="tabela-wrap"><table><thead><tr><th>Agenda</th><th>Bloqueia horário?</th><th>Usada por</th><th>Leitura</th></tr></thead><tbody>
        ${c.agendas.map((a) => `<tr><td><b>${ctx.esc(a.nome)}</b></td>
          <td><label class="marca"><input type="checkbox" data-conflito="${ctx.esc(a.id)}"${a.conflito ? ' checked' : ''}> marcada por padrão nos tipos novos</label></td>
          <td class="mini">${[...a.destino_de.map((n) => 'destino: ' + ctx.esc(n)), ...a.conflito_de.map((n) => 'conflito: ' + ctx.esc(n))].join('<br>') || '—'}</td>
          <td>${saude(a)}</td></tr>`).join('')}
        </tbody></table></div></div>`).join('')}`;
    const erro = (e) => { ctx.$('#ag-conta-erro').innerHTML = erroHtml(e); };
    ctx.$('#ag-conta-form').onsubmit = async (ev) => {
      ev.preventDefault();
      try { await ctx.postJson('/api/agenda/agendas', { acao: 'adicionar_conta', email: ctx.$('#ag-conta-email').value }); await agendas(); }
      catch (e) { erro(e); }
    };
    el().onchange = async (ev) => {
      const id = ev.target.dataset.conflito;
      if (id === undefined) return;
      try { await ctx.postJson('/api/agenda/agendas', { acao: 'conflito', id, conflito: ev.target.checked }); } catch (e) { erro(e); }
    };
    el().onclick = async (ev) => {
      const b = ev.target.closest('button');
      if (!b) return;
      if (b.dataset.reler) {
        try { await ctx.postJson('/api/agenda/agendas', { acao: 'reler', email: b.dataset.reler }); await agendas(); } catch (e) { erro(e); }
      }
      if (b.dataset.remover) {
        ctx.pedirConfirmacao(b, 'Remover a conta e as agendas dela?', async () => {
          try { await ctx.postJson('/api/agenda/agendas', { acao: 'remover_conta', email: b.dataset.remover }); await agendas(); } catch (e) { erro(e); return false; }
        });
      }
    };
  }
})();
