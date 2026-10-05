// Registro de testes do Argo (spec-relatorio-semanal-argo.md, módulo 2; issues 401, 403 e 404).
//
// Mora na aba Argo, vista `#argo?v=testes`; o index.html chama
// `ArgoTestes.abrir(raiz, { argoApi })` quando a vista aparece.
//
// A aba NÃO decide nada: situação, dias rodando, números de cada lado, quanto
// falta para ler e a passagem para "pronto para ler" vêm prontos de
// /api/argo/testes (_argo-testes.js, _argo-testes-numeros.js). Os anúncios,
// conjuntos e A/Bs para escolher vêm de /api/argo/testes-alvos. Aqui só se
// desenha e se manda o que a gestora fez.
(() => {
  'use strict';

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const int = (n) => Number(n || 0).toLocaleString('pt-BR');
  const brl = (centavos) => (centavos == null ? 'sem dado' : (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
  const pct = (x) => (x == null ? 'sem dado' : `${(x * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`);
  const dataBR = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');
  const plural = (n, um, varios) => `${int(n)} ${Number(n) === 1 ? um : varios}`;

  // Só rótulos de tela; quais valores existem é validado no servidor.
  const TIPOS = {
    criativo: { rotulo: 'Criativo', exemplo: 'Gancho, formato ou copy do anúncio.' },
    publico: { rotulo: 'Público ou conjunto', exemplo: 'Segmentação, Advantage+, estrutura de campanha.' },
    pagina: { rotulo: 'Página', exemplo: 'Teste A/B de LP que já existe no dash.' },
    oferta: { rotulo: 'Oferta ou funil', exemplo: 'Isca, pergunta no formulário, corte de faturamento.' },
  };
  const SITUACOES = {
    planejado: ['Planejado', 'neutro'], rodando: ['Rodando', 'neutro'], pronto: ['Pronto para ler', 'alerta'],
    concluido: ['Concluído', 'alta'], abandonado: ['Abandonado', 'queda'],
  };
  const RESULTADOS = { variante: 'Variante ganhou', controle: 'Controle ganhou', empate: 'Empate', inconclusivo: 'Inconclusivo' };
  const FUNIS = ['Sessão estratégica', 'Workshop gratuito', 'Workshop pago', 'Aplicação mentoria'];

  let dados = null;
  let erroCarga = '';
  let alvos = null;
  const filtros = { situacao: 'todos', tipo: '', funil: '', periodo: 'tudo', busca: '' };
  let raizAtual = null;
  let ctx = null;

  const post = (corpo) => ctx.argoApi('/api/argo/testes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) });

  // ---------------------------------------------------------------------------
  // Aviso curto e gaveta
  // ---------------------------------------------------------------------------
  let toastTempo = null;
  function avisar(texto, tipo = 'ok') {
    let t = document.getElementById('at-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'at-toast';
      t.className = 'ag-toast';
      t.setAttribute('role', 'status');
      t.setAttribute('aria-live', 'polite');
    }
    const g = document.getElementById('at-gaveta');
    (g && g.open ? g : document.body).appendChild(t);
    t.textContent = texto;
    t.dataset.tipo = tipo;
    void t.offsetWidth;
    t.classList.add('visivel');
    clearTimeout(toastTempo);
    toastTempo = setTimeout(() => t.classList.remove('visivel'), 3200);
  }

  function gaveta(html) {
    let g = document.getElementById('at-gaveta');
    if (!g) {
      g = document.createElement('dialog');
      g.id = 'at-gaveta';
      g.className = 'ag-gaveta em-gaveta em-gaveta--larga';
      document.body.appendChild(g);
    }
    g.innerHTML = html;
    g.querySelectorAll('[data-fechar]').forEach((b) => { b.onclick = () => g.close(); });
    if (!g.open) g.showModal();
    return g;
  }
  const topo = (titulo, sub) => `<header class="ag-gaveta__topo"><div><h2>${titulo}</h2>${sub ? `<p class="mini">${sub}</p>` : ''}</div>
    <button class="ag-gaveta__fechar" type="button" data-fechar aria-label="Fechar">×</button></header>`;

  // ---------------------------------------------------------------------------
  // Ficha
  // ---------------------------------------------------------------------------
  function regua(rotulo, feito, total, unid) {
    const p = Math.min(100, Math.round((Math.min(feito, total) / total) * 100));
    return `<div class="at-regua"><span class="at-regua__rot">${rotulo}</span><span class="at-regua__barra"><i style="width:${p}%"></i></span><span class="at-regua__num">${int(Math.min(feito, total))} de ${int(total)} ${unid}</span></div>`;
  }
  function leitura(t) {
    if (!t.leitura) return '';
    const l = t.leitura;
    const reguaAmostra = l.amostra == null
      ? `<p class="mini">${esc((t.numeros && t.numeros.aviso) || 'Números indisponíveis agora: o teste não fica pronto sem eles.')}</p>`
      : regua(t.unidade === 'leads' ? 'Leads' : 'Visitas', l.amostra, t.min_amostra, t.unidade);
    let falta = '';
    if (t.situacao === 'pronto') falta = '<b>Atingiu os mínimos: dá para ler.</b>';
    else if (l.amostra != null) {
      const partes = [l.falta_dias ? `${l.falta_dias} ${l.falta_dias === 1 ? 'dia' : 'dias'}` : '', l.falta_amostra ? `${int(l.falta_amostra)} ${t.unidade}` : ''].filter(Boolean);
      falta = partes.length ? `Faltam ${partes.join(' e ')} para ler.` : '';
    }
    return `<div class="at-leitura">${regua('Dias', l.dias, t.min_dias, 'dias')}${reguaAmostra}${falta ? `<p class="mini">${falta}</p>` : ''}</div>`;
  }

  function lados(t) {
    const n = t.numeros && t.numeros.ok ? t.numeros.lados : null;
    if (t.tipo === 'pagina') {
      const ab = alvos && alvos.abs ? alvos.abs.find((x) => x.id === t.ab_test_id) : null;
      const lado = (rot, x) => `<div class="at-lado"><b>${rot}</b>${x ? `<span>${plural(x.visitas, 'visita', 'visitas')} · ${plural(x.leads, 'lead', 'leads')} · ${pct(x.taxa)} de conversão</span>` : '<span class="mini">sem números ainda</span>'}</div>`;
      return `<p class="mini">Ligado ao A/B <b>${esc(ab ? ab.nome : `#${t.ab_test_id}`)}</b> · <a class="ar-link" href="#ab">abrir no A/B</a></p>
        <div class="at-lados">${lado('A: controle', n && n.controle)}${lado('B: variante', n && n.variante)}</div>`;
    }
    const lado = (rot, itens, x) => `<div class="at-lado"><b>${rot}</b><span>${itens.map((i) => esc(i.nome)).join(', ')}</span>
      ${x ? `<span class="mini">${brl(x.gasto_centavos)} · ${plural(x.leads, 'lead', 'leads')} · ${plural(x.mqls, 'MQL', 'MQLs')} · CPL ${brl(x.cpl_centavos)} · custo por MQL ${brl(x.custo_mql_centavos)}</span>` : ''}</div>`;
    return `<div class="at-lados">${lado('Controle', t.controle, n && n.controle)}${lado('Variante', t.variante, n && n.variante)}</div>`;
  }

  function abrirFicha(t, modo = '') {
    const [rot, cls] = SITUACOES[t.situacao];
    const acoes = {
      planejado: [['iniciar', 'Iniciar', 'btn'], ['editar', 'Editar', 'btn sec'], ['abandonar', 'Abandonar', 'btn perigo']],
      rodando: [['concluir', 'Concluir', 'btn'], ['editar', 'Editar', 'btn sec'], ['abandonar', 'Abandonar', 'btn perigo']],
    };
    acoes.pronto = acoes.rodando;
    let rodape = (acoes[t.situacao] || []).map(([a, r, c]) => `<button type="button" class="${c}" data-at-acao="${a}">${r}</button>`).join('');
    if (modo === 'concluir') {
      rodape = `<form class="at-mini-form" data-at-concluir>
        <fieldset class="at-resultados"><legend class="ag-campo__rotulo">Resultado</legend>${Object.entries(RESULTADOS).map(([k, r], i) => `<label><input type="radio" name="resultado" value="${k}"${i === 0 ? ' checked' : ''}> ${r}</label>`).join('')}</fieldset>
        <label class="ag-campo"><span class="ag-campo__rotulo">O que aprendemos (obrigatório)</span><textarea name="aprendizado" rows="3" placeholder="Ex.: pergunta ganhou de número no Lookalike; repetir em interesses."></textarea></label>
        <p class="ac-erro" data-erro hidden></p>
        <div class="ac-rodape"><button type="submit" class="btn">Concluir teste</button><button type="button" class="btn sec" data-at-acao="voltar">Cancelar</button></div></form>`;
    } else if (modo === 'abandonar') {
      rodape = `<form class="at-mini-form" data-at-abandonar>
        <label class="ag-campo"><span class="ag-campo__rotulo">Por que abandonar? (obrigatório)</span><input type="text" name="motivo" maxlength="300" placeholder="Ex.: a verba do funil foi cortada"></label>
        <p class="ac-erro" data-erro hidden></p>
        <div class="ac-rodape"><button type="submit" class="btn perigo">Abandonar teste</button><button type="button" class="btn sec" data-at-acao="voltar">Cancelar</button></div></form>`;
    }
    const campo = (r, v) => (v ? `<dt>${r}</dt><dd>${v}</dd>` : '');
    const g = gaveta(`<div class="ag-gaveta__form ag-gaveta__form--simples">
      ${topo(esc(t.nome), `${TIPOS[t.tipo].rotulo} · ${esc(t.funil || 'sem funil')} · ${t.inicio ? `desde ${dataBR(t.inicio)}` : 'ainda não começou'}${t.fim ? ` até ${dataBR(t.fim)}` : ''}`)}
      <div class="ag-gaveta__corpo at-ficha">
        <div class="at-ficha__sit"><span class="carimbo ${cls}">${rot}</span>${t.origem === 'relatorio' ? '<span class="carimbo neutro">sugerido pelo relatório</span>' : ''}${t.resultado ? `<span class="carimbo alta">${RESULTADOS[t.resultado]}</span>` : ''}</div>
        ${leitura(t)}
        <p class="at-ficha__hip">${esc(t.hipotese)}</p>
        <dl class="ar-sug__ficha">
          ${campo('O que muda', esc(t.mudou))}
          ${campo('Métrica', esc(t.metrica))}
          ${campo('Sucesso', esc(t.criterio))}
          ${campo('Mínimos', `${t.min_dias} dias e ${int(t.min_amostra)} ${t.unidade}`)}
        </dl>
        <h3 class="argo-grupo-titulo">Os dois lados</h3>${lados(t)}
        ${t.aprendizado ? `<h3 class="argo-grupo-titulo">Aprendizado</h3><p class="at-ficha__aprend">${esc(t.aprendizado)}</p>` : ''}
        ${t.motivo_abandono ? `<h3 class="argo-grupo-titulo">Por que foi abandonado</h3><p>${esc(t.motivo_abandono)}</p>` : ''}
        <h3 class="argo-grupo-titulo">Histórico da ficha</h3>
        <ul class="at-hist">${t.historico.map((h) => `<li${h.destaque ? ' class="at-hist--destaque"' : ''}><span class="at-hist__data">${dataBR(new Date(h.em).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }))}</span>${esc(h.texto)}</li>`).join('')}</ul>
      </div>
      ${rodape ? `<footer class="ag-gaveta__rodape"><div class="ac-rodape">${rodape}</div></footer>` : ''}
    </div>`);
    const reabrir = (lista, msg) => {
      dados = lista;
      desenhar();
      const novo = dados.testes.find((x) => x.id === t.id);
      if (novo) abrirFicha(novo); else g.close();
      if (msg) avisar(msg);
    };
    g.onclick = async (ev) => {
      if (ev.target === g) { g.close(); return; }
      const b = ev.target.closest('[data-at-acao]');
      if (!b) return;
      const a = b.dataset.atAcao;
      if (a === 'iniciar') {
        b.disabled = true;
        try { reabrir(await post({ acao: 'iniciar', id: t.id }), 'O teste passou a rodar, com início hoje.'); } catch (e) { b.disabled = false; avisar(e.mensagemUsuario || 'Não foi possível iniciar agora.', 'erro'); }
      } else if (a === 'editar') abrirFormulario(t);
      else if (a === 'voltar') abrirFicha(t);
      else abrirFicha(t, a);
    };
    const enviarMini = (form, corpo, msg) => {
      form.onsubmit = async (ev) => {
        ev.preventDefault();
        const botao = form.querySelector('[type="submit"]');
        botao.disabled = true;
        try { reabrir(await post({ ...corpo(new FormData(form)), id: t.id }), msg); } catch (e) {
          const erro = form.querySelector('[data-erro]');
          erro.textContent = e.mensagemUsuario || 'Não foi possível gravar agora.';
          erro.hidden = false;
          botao.disabled = false;
        }
      };
    };
    const fc = g.querySelector('[data-at-concluir]');
    if (fc) enviarMini(fc, (fd) => ({ acao: 'concluir', resultado: fd.get('resultado'), aprendizado: fd.get('aprendizado') }), 'Teste concluído. O aprendizado entra no próximo relatório.');
    const fa = g.querySelector('[data-at-abandonar]');
    if (fa) enviarMini(fa, (fd) => ({ acao: 'abandonar', motivo: fd.get('motivo') }), 'Teste abandonado. O motivo fica na ficha.');
  }

  // ---------------------------------------------------------------------------
  // Formulário de registro e edição
  // ---------------------------------------------------------------------------
  async function carregarAlvos() {
    if (alvos) return alvos;
    try { alvos = await ctx.argoApi('/api/argo/testes-alvos'); } catch (e) { alvos = { anuncios: [], conjuntos: [], abs: [], avisos: [e.mensagemUsuario || 'Não foi possível ler a conta agora.'] }; }
    return alvos;
  }

  function listaEscolha(lado, nivel, sel) {
    const itens = nivel === 'conjunto'
      ? alvos.conjuntos.map((c) => ({ id: c.id, nome: c.nome, extra: c.campanha_nome, ativo: c.ativo }))
      : alvos.anuncios.map((a) => ({ id: a.id, nome: a.nome, extra: a.conjunto_nome, ativo: a.ativo }));
    const marcados = new Set((sel || []).filter((s) => s.nivel === nivel).map((s) => s.id));
    return `<fieldset class="at-escolha" data-lado="${lado}"><legend class="ag-campo__rotulo">${lado === 'controle' ? 'Controle' : 'Variante'}</legend>
      <input type="search" class="at-escolha__busca" data-busca-lado="${lado}" placeholder="Procurar ${nivel === 'conjunto' ? 'conjunto' : 'anúncio'}" aria-label="Procurar no lado ${lado}">
      <div class="at-escolha__lista">
        ${itens.map((i) => `<label class="at-escolha__item" data-nome="${esc(i.nome.toLowerCase())}"><input type="checkbox" name="${lado}" value="${esc(i.id)}" data-nome-alvo="${esc(i.nome)}"${marcados.has(i.id) ? ' checked' : ''}>
          <span>${esc(i.nome)} <span class="mini">${i.ativo ? '' : 'pausado · '}${esc(i.extra || '')}</span></span></label>`).join('') || '<p class="mini">Nada para escolher.</p>'}
      </div></fieldset>`;
  }

  async function abrirFormulario(t) {
    gaveta(`<div class="ag-gaveta__form ag-gaveta__form--simples">${topo(t ? 'Editar teste' : 'Registrar teste', 'Lendo os anúncios da conta…')}<div class="ag-gaveta__corpo"><div class="esq-tabela" role="status" aria-label="Carregando…"><span class="esq esq-linha"></span><span class="esq esq-linha"></span></div></div></div>`);
    await carregarAlvos();
    const v = t || { tipo: 'criativo', funil: FUNIS[0], nome: '', hipotese: '', mudou: '', metrica: '', criterio: '', min_dias: 14, min_amostra: 60, controle: [], variante: [], ab_test_id: null };
    const nivelInicial = (v.controle[0] && v.controle[0].nivel) || 'anuncio';
    const ladosConta = (nivel) => `${listaEscolha('controle', nivel, v.controle)}${listaEscolha('variante', nivel, v.variante)}`;
    const g = gaveta(`<form class="ag-gaveta__form ag-gaveta__form--simples" novalidate data-at-form>
      ${topo(t ? 'Editar teste' : 'Registrar teste', t && t.situacao !== 'planejado' ? 'O teste já começou: mudar hipótese, métrica ou critério fica registrado no histórico.' : 'Hipótese, os dois lados e como se mede.')}
      <div class="ag-gaveta__corpo">
        ${alvos.avisos && alvos.avisos.length ? `<p class="aviso alerta">${alvos.avisos.map(esc).join(' ')}</p>` : ''}
        <label class="ag-campo"><span class="ag-campo__rotulo">Nome</span><input type="text" name="nome" maxlength="120" value="${esc(v.nome)}" placeholder="Ex.: Gancho de dor x autoridade (SE)"></label>
        <fieldset class="ac-tipos"><legend class="ag-campo__rotulo">Tipo</legend>
          ${Object.entries(TIPOS).map(([k, x]) => `<label class="ac-tipo"><input type="radio" name="tipo" value="${k}"${k === v.tipo ? ' checked' : ''}${t ? ' disabled' : ''}><span><b>${x.rotulo}</b><span class="mini">${x.exemplo}</span></span></label>`).join('')}
        </fieldset>
        <label class="ag-campo"><span class="ag-campo__rotulo">Funil</span><select name="funil"><option value="">Sem funil</option>${FUNIS.map((f) => `<option${f === v.funil ? ' selected' : ''}>${f}</option>`).join('')}</select></label>
        <label class="ag-campo"><span class="ag-campo__rotulo">Hipótese</span><textarea name="hipotese" rows="3" placeholder="Acreditamos que X porque Y.">${esc(v.hipotese)}</textarea></label>
        <label class="ag-campo"><span class="ag-campo__rotulo">O que muda entre os lados</span><input type="text" name="mudou" value="${esc(v.mudou)}"></label>
        <div data-lados-conta${v.tipo === 'pagina' ? ' hidden' : ''}>
          <fieldset class="at-resultados"><legend class="ag-campo__rotulo">Os lados são</legend>
            <label><input type="radio" name="nivel" value="anuncio"${nivelInicial === 'anuncio' ? ' checked' : ''}> Anúncios</label>
            <label><input type="radio" name="nivel" value="conjunto"${nivelInicial === 'conjunto' ? ' checked' : ''}> Conjuntos</label></fieldset>
          <div class="at-lados-escolha" data-escolha>${ladosConta(nivelInicial)}</div>
        </div>
        <label class="ag-campo" data-lados-pagina${v.tipo === 'pagina' ? '' : ' hidden'}><span class="ag-campo__rotulo">Teste A/B ligado</span>
          <select name="ab_test_id"><option value="">Escolha um A/B do dash</option>${(alvos.abs || []).map((a) => `<option value="${a.id}"${a.id === v.ab_test_id ? ' selected' : ''}>${esc(a.nome)} (${esc(a.status)})</option>`).join('')}</select></label>
        <label class="ag-campo"><span class="ag-campo__rotulo">Métrica principal</span><input type="text" name="metrica" value="${esc(v.metrica)}" placeholder="Ex.: Custo por MQL"></label>
        <label class="ag-campo"><span class="ag-campo__rotulo">Critério de sucesso</span><input type="text" name="criterio" value="${esc(v.criterio)}" placeholder="Ex.: variante com custo por MQL 15% menor"></label>
        <div class="ac-datas">
          <label class="ag-campo"><span class="ag-campo__rotulo">Duração mínima (dias)</span><input type="number" name="min_dias" min="1" value="${v.min_dias}"></label>
          <label class="ag-campo"><span class="ag-campo__rotulo">Amostra mínima (<span data-unid>${v.tipo === 'pagina' ? 'visitas por lado' : 'leads'}</span>)</span><input type="number" name="min_amostra" min="1" value="${v.min_amostra}"></label>
          <p class="mini ac-datas__nota">O teste só fica "pronto para ler" quando atinge os dois mínimos. Parar no primeiro número bom engana.</p>
        </div>
        ${t ? '' : `<fieldset class="at-resultados"><legend class="ag-campo__rotulo">Começa</legend><label><input type="radio" name="comeca" value="planejado" checked> Planejado, começo depois</label><label><input type="radio" name="comeca" value="rodando"> Rodando, a partir de hoje</label></fieldset>`}
        <p class="ac-erro" data-erro hidden></p>
      </div>
      <footer class="ag-gaveta__rodape"><div class="ac-rodape"><button type="submit" class="btn">${t ? 'Salvar' : 'Registrar teste'}</button><button type="button" class="btn sec" data-fechar>Cancelar</button></div></footer>
    </form>`);
    const form = g.querySelector('[data-at-form]');
    g.onclick = (ev) => { if (ev.target === g) g.close(); };
    form.onchange = (ev) => {
      if (ev.target.name === 'tipo') {
        const pag = ev.target.value === 'pagina';
        form.querySelector('[data-lados-conta]').hidden = pag;
        form.querySelector('[data-lados-pagina]').hidden = !pag;
        form.querySelector('[data-unid]').textContent = pag ? 'visitas por lado' : 'leads';
      }
      if (ev.target.name === 'nivel') form.querySelector('[data-escolha]').innerHTML = ladosConta(ev.target.value);
    };
    form.oninput = (ev) => {
      const b = ev.target.closest('[data-busca-lado]');
      if (!b) return;
      const q = b.value.trim().toLowerCase();
      b.closest('.at-escolha').querySelectorAll('.at-escolha__item').forEach((el) => { el.hidden = q && !el.dataset.nome.includes(q); });
    };
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      const fd = new FormData(form);
      const nivel = fd.get('nivel') || 'anuncio';
      const ladoDe = (nome) => [...form.querySelectorAll(`input[name="${nome}"]:checked`)].map((c) => ({ nivel, id: c.value, nome: c.dataset.nomeAlvo }));
      const corpo = {
        acao: t ? 'editar' : 'criar', id: t ? t.id : undefined, tipo: t ? t.tipo : fd.get('tipo'),
        nome: fd.get('nome'), funil: fd.get('funil'), hipotese: fd.get('hipotese'), mudou: fd.get('mudou'),
        metrica: fd.get('metrica'), criterio: fd.get('criterio'), min_dias: Number(fd.get('min_dias')), min_amostra: Number(fd.get('min_amostra')),
        controle: ladoDe('controle'), variante: ladoDe('variante'), ab_test_id: fd.get('ab_test_id') ? Number(fd.get('ab_test_id')) : null,
        comeca: fd.get('comeca') || undefined,
      };
      const botao = form.querySelector('[type="submit"]');
      botao.disabled = true;
      try {
        dados = await post(corpo);
      } catch (e) {
        const erro = form.querySelector('[data-erro]');
        erro.textContent = e.mensagemUsuario || 'Não foi possível gravar agora.';
        erro.hidden = false;
        botao.disabled = false;
        return;
      }
      desenhar();
      if (t) { const novo = dados.testes.find((x) => x.id === t.id); if (novo) abrirFicha(novo); avisar('Ficha atualizada.'); }
      else { g.close(); avisar(corpo.comeca === 'rodando' ? 'Teste registrado e rodando desde hoje.' : 'Teste registrado como planejado.'); }
    };
    form.querySelector('[name="nome"]').focus();
  }

  // ---------------------------------------------------------------------------
  // Lista
  // ---------------------------------------------------------------------------
  function filtrados() {
    const q = filtros.busca.trim().toLowerCase();
    const limite = { 30: 30, 90: 90 }[filtros.periodo];
    const hoje = Date.parse(dados.hoje);
    return dados.testes.filter((t) => (filtros.situacao === 'todos' || t.situacao === filtros.situacao)
      && (!filtros.tipo || t.tipo === filtros.tipo) && (!filtros.funil || t.funil === filtros.funil)
      && (!limite || !t.inicio || (hoje - Date.parse(t.inicio)) / 86400000 <= limite)
      && (!q || [t.nome, t.hipotese, t.aprendizado || ''].join(' ').toLowerCase().includes(q)));
  }

  function cartao(t) {
    const [rot, cls] = SITUACOES[t.situacao];
    const ativo = t.situacao === 'rodando' || t.situacao === 'pronto';
    const quando = t.inicio ? `desde ${dataBR(t.inicio)}${ativo ? ` · ${t.dias_rodando} ${t.dias_rodando === 1 ? 'dia' : 'dias'} rodando` : ''}${t.fim ? ` até ${dataBR(t.fim)}` : ''}` : 'ainda não começou';
    return `<article class="at-cartao${t.situacao === 'pronto' ? ' at-cartao--pronto' : ''}" data-at-abrir="${t.id}">
      <span class="at-cartao__topo"><span class="mini">${TIPOS[t.tipo].rotulo} · ${esc(t.funil || 'sem funil')} · ${quando}</span><span class="carimbo ${cls}">${rot}</span></span>
      <button type="button" class="at-cartao__nome" data-at-abrir="${t.id}">${esc(t.nome)}</button>
      ${t.origem === 'relatorio' ? '<span class="mini">sugerido pelo relatório</span>' : ''}
      ${t.resultado ? `<span class="at-cartao__res">${RESULTADOS[t.resultado]}${t.aprendizado ? `: ${esc(t.aprendizado)}` : ''}</span>` : ''}
      ${t.situacao === 'abandonado' ? `<span class="mini">Abandonado: ${esc(t.motivo_abandono)}</span>` : ''}
      ${leitura(t)}
    </article>`;
  }

  function desenhar() {
    if (!raizAtual) return;
    const cabeca = (resumo) => `<div class="ac-topo"><div><h2 class="ac-topo__titulo">Testes</h2><p class="mini">${resumo}</p></div><button type="button" class="btn" data-at-novo>Registrar teste</button></div>`;
    if (erroCarga) { raizAtual.innerHTML = cabeca('') + `<p class="aviso falha">${esc(erroCarga)}</p>`; return; }
    if (!dados) { raizAtual.innerHTML = cabeca('Lendo o registro e os números dos testes…') + '<div class="esq-tabela" role="status" aria-label="Carregando…"><span class="esq esq-linha"></span><span class="esq esq-linha"></span><span class="esq esq-linha"></span></div>'; return; }
    if (!dados.testes.length) {
      raizAtual.innerHTML = cabeca('Nenhum teste registrado.') + `<div class="ac-vazio"><h3>O registro de testes está vazio</h3>
        <p>Aqui fica a memória do que já foi testado na conta e no funil: hipótese, os dois lados, o resultado e o que se aprendeu. É com isso que o relatório semanal diz "esse teste já pode ser lido" ou "isso já foi testado e perdeu", e evita sugerir de novo o que já deu errado.</p>
        <button type="button" class="btn" data-at-novo>Registrar o primeiro teste</button></div>`;
      return;
    }
    const r = dados.resumo;
    const resumo = [['rodando', 'rodando'], ['pronto', 'pronto para ler'], ['planejado', 'planejado'], ['concluido', 'concluídos']]
      .filter(([s]) => r[s]).map(([s, rot]) => `${r[s]} ${rot}`).join(' · ');
    const lista = filtrados();
    const pill = (k, rot) => `<button type="button" class="tipo-pill" data-at-sit="${k}" aria-pressed="${filtros.situacao === k}">${rot}</button>`;
    raizAtual.innerHTML = `${cabeca(resumo)}
      <div class="at-filtros">
        <input type="search" data-at-busca value="${esc(filtros.busca)}" placeholder="Procurar no nome, hipótese ou aprendizado" aria-label="Procurar testes">
        <select data-at-f="tipo" aria-label="Tipo"><option value="">Todos os tipos</option>${Object.entries(TIPOS).map(([k, x]) => `<option value="${k}"${filtros.tipo === k ? ' selected' : ''}>${x.rotulo}</option>`).join('')}</select>
        <select data-at-f="funil" aria-label="Funil"><option value="">Todos os funis</option>${FUNIS.map((f) => `<option${filtros.funil === f ? ' selected' : ''}>${f}</option>`).join('')}</select>
        <select data-at-f="periodo" aria-label="Período"><option value="tudo">Desde sempre</option><option value="30"${filtros.periodo === '30' ? ' selected' : ''}>Começaram nos últimos 30 dias</option><option value="90"${filtros.periodo === '90' ? ' selected' : ''}>Começaram nos últimos 90 dias</option></select>
      </div>
      <div class="ac-filtros" role="group" aria-label="Situação">${pill('todos', 'Todos')}${Object.entries(SITUACOES).map(([k, [rot]]) => pill(k, rot)).join('')}</div>
      ${lista.length ? `<div class="at-lista">${lista.map(cartao).join('')}</div>`
        : `<p class="aviso">Nenhum teste com esses filtros${filtros.busca ? ` e "${esc(filtros.busca)}"` : ''}. <button type="button" class="ar-link" data-at-limpar>Limpar filtros</button></p>`}`;
  }

  async function carregar() {
    try {
      dados = await ctx.argoApi('/api/argo/testes');
      erroCarga = '';
    } catch (e) {
      erroCarga = e.mensagemUsuario || 'Não foi possível ler o registro de testes agora.';
    }
    desenhar();
  }

  function ligar(raiz) {
    raiz.addEventListener('change', (ev) => {
      const t = ev.target;
      if (t.matches('[data-at-f]')) { filtros[t.dataset.atF] = t.value; desenhar(); }
    });
    let tempo = null;
    raiz.addEventListener('input', (ev) => {
      if (!ev.target.matches('[data-at-busca]')) return;
      filtros.busca = ev.target.value;
      clearTimeout(tempo);
      tempo = setTimeout(() => {
        const pos = ev.target.selectionStart;
        desenhar();
        const b = raiz.querySelector('[data-at-busca]');
        if (b) { b.focus(); b.setSelectionRange(pos, pos); }
      }, 200);
    });
    raiz.addEventListener('click', async (ev) => {
      // O cartão inteiro abre a ficha; o nome é o botão para teclado e leitor de tela.
      const b = ev.target.closest('button') || ev.target.closest('[data-at-abrir]');
      if (!b || !raiz.contains(b)) return;
      const d = b.dataset;
      if ('atNovo' in d) abrirFormulario(null);
      else if (d.atSit) { filtros.situacao = d.atSit; desenhar(); }
      else if (d.atAbrir) {
        const t = dados.testes.find((x) => x.id === Number(d.atAbrir));
        if (t && t.tipo === 'pagina') await carregarAlvos();
        if (t) abrirFicha(t);
      } else if ('atLimpar' in d) { Object.assign(filtros, { situacao: 'todos', tipo: '', funil: '', periodo: 'tudo', busca: '' }); desenhar(); }
    });
  }

  window.ArgoTestes = {
    abrir(raiz, contexto) {
      ctx = contexto;
      if (raizAtual !== raiz) { raizAtual = raiz; ligar(raiz); }
      desenhar();
      carregar();
    },
  };
})();
