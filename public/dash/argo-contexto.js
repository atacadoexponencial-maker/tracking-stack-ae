// Contexto do negócio do Argo (spec-relatorio-semanal-argo.md, módulo 1). PROTÓTIPO da issue 400.
//
// Só front, com itens de exemplo gerados aqui: nada chama a API, nada é salvo.
// Mora na aba Argo, vista `#argo?v=contexto`; o index.html só chama
// `ArgoContexto.abrir(raiz)` quando a vista aparece.
//
// No sistema de verdade a situação (em dia, revisar) e a saída dos eventos
// terminados vêm prontas do servidor. Aqui são montadas no navegador só porque
// não existe servidor ainda.
//
// Padrões copiados do argo-relatorio.js: faixa "Protótipo" (CSS em-proto*),
// aviso curto (CSS ag-toast) e gaveta (CSS ag-gaveta, ag-campo).
(() => {
  'use strict';

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const TIPOS = {
    prioridade: { rotulo: 'Prioridade', exemplo: 'SE é o funil principal em outubro; workshop gratuito é apoio.' },
    oferta: { rotulo: 'Oferta', exemplo: 'Workshop pago a R$ 47; condição especial até dia 15.' },
    evento: { rotulo: 'Evento', exemplo: 'Workshop ao vivo em 07/10; Black Friday de 20 a 30/11.' },
    restricao: { rotulo: 'Restrição', exemplo: 'Não mexer no remarketing do workshop pago até 15/10.' },
    observacao: { rotulo: 'Observação', exemplo: 'O comercial mudou o roteiro de qualificação no dia 10.' },
  };
  const FUNIS = ['Sessão estratégica', 'Workshop gratuito', 'Workshop pago', 'Aplicação mentoria'];
  const HOJE = '2026-10-04';

  // O que o relatório lê sozinho (spec, módulo 3). Só texto de tela.
  const JA_SABE = [
    ['Resultados por funil e por anúncio', 'gasto, leads, MQLs, CPL e custo por MQL'],
    ['Metas de cada funil', 'as metas cadastradas no dash'],
    ['Funis e páginas ativos', 'o cadastro de funis e páginas do tracking'],
    ['Testes A/B de página', 'os testes da aba de A/B, com os resultados'],
    ['Tudo o que o Argo propôs', 'o que você aprovou, recusou (com o motivo) e o que foi desfeito'],
    ['Se cada ação deu certo', 'os vereditos do Argo'],
    ['Suas pausas manuais', 'o que foi pausado fora do Argo'],
    ['As semanas anteriores', 'os relatórios passados e as suas reações a eles'],
  ];

  const dias = (de, ate = HOJE) => Math.round((Date.parse(ate) - Date.parse(de)) / 86400000);
  const dataBR = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');

  const ITENS_EXEMPLO = () => [
    { id: 1, tipo: 'prioridade', titulo: 'SE é o funil principal em outubro', texto: 'Workshop gratuito segue como apoio. Verba nova vai primeiro para a SE.', funil: 'Sessão estratégica', revisado: '2026-09-30', validade: 30 },
    { id: 2, tipo: 'oferta', titulo: 'Workshop pago a R$ 47', texto: 'Preço do ingresso. Sem cupom ativo.', funil: 'Workshop pago', revisado: '2026-08-24', validade: 30 },
    { id: 3, tipo: 'restricao', titulo: 'Não mexer no remarketing do workshop pago até 15/10', texto: 'Teste de público da Meta em andamento.', funil: 'Workshop pago', revisado: '2026-09-25', validade: 30 },
    { id: 4, tipo: 'evento', titulo: 'Live de lançamento da SE', texto: 'Live no Instagram do Felipe com chamada para a SE.', funil: 'Sessão estratégica', inicio: '2026-10-01', fim: '2026-10-01', revisado: '2026-09-28', validade: 30 },
    { id: 5, tipo: 'evento', titulo: 'Workshop ao vivo', texto: 'Aula ao vivo do workshop gratuito.', funil: 'Workshop gratuito', inicio: '2026-10-07', fim: '2026-10-07', revisado: '2026-10-02', validade: 30 },
    { id: 6, tipo: 'observacao', titulo: 'Comercial mudou o roteiro de qualificação', texto: 'Desde 10/09 a pergunta de faturamento vem antes. Pode mexer na taxa de MQL.', funil: '', revisado: '2026-09-12', validade: 60 },
    { id: 7, tipo: 'evento', titulo: 'Workshop Black ao vivo', texto: 'Evento pago, com verba extra na semana.', funil: 'Workshop pago', inicio: '2026-09-23', fim: '2026-09-23', revisado: '2026-09-15', validade: 30 },
    { id: 8, tipo: 'oferta', titulo: 'Diagnóstico gratuito no lugar da SE', texto: 'Oferta antiga, substituída pela SE.', funil: 'Sessão estratégica', revisado: '2026-07-20', validade: 30, arquivado: '2026-08-01' },
  ];

  let itens = ITENS_EXEMPLO();
  let estado = 'itens';
  let filtro = 'valendo';
  let confirmando = null;
  let raizAtual = null;
  let proximoId = 100;

  const terminado = (i) => i.tipo === 'evento' && i.fim && i.fim < HOJE;
  const vencido = (i) => dias(i.revisado) > i.validade;
  const valendo = () => itens.filter((i) => !i.arquivado && !terminado(i));

  // ---------------------------------------------------------------------------
  // Aviso curto e gaveta (mesmo desenho do argo-relatorio.js)
  // ---------------------------------------------------------------------------
  let toastTempo = null;
  function avisar(texto) {
    let t = document.getElementById('ac-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'ac-toast';
      t.className = 'ag-toast';
      t.setAttribute('role', 'status');
      t.setAttribute('aria-live', 'polite');
    }
    const g = document.getElementById('ac-gaveta');
    (g && g.open ? g : document.body).appendChild(t);
    t.textContent = texto;
    void t.offsetWidth;
    t.classList.add('visivel');
    clearTimeout(toastTempo);
    toastTempo = setTimeout(() => t.classList.remove('visivel'), 3200);
  }
  const avisarProto = (texto) => avisar(`Protótipo: nada foi salvo. ${texto}`);

  function abrirGaveta(item) {
    let g = document.getElementById('ac-gaveta');
    if (!g) {
      g = document.createElement('dialog');
      g.id = 'ac-gaveta';
      g.className = 'ag-gaveta em-gaveta';
      g.addEventListener('click', (ev) => { if (ev.target === g) g.close(); });
      document.body.appendChild(g);
    }
    const i = item || { tipo: 'prioridade', titulo: '', texto: '', funil: '', validade: 30 };
    g.innerHTML = `<form class="ag-gaveta__form ag-gaveta__form--simples ac-form" novalidate>
      <header class="ag-gaveta__topo">
        <div><h2>${item ? 'Editar item' : 'Novo item de contexto'}</h2><p class="mini">Escreva o que explica um número e não está em nenhum sistema.</p></div>
        <button class="ag-gaveta__fechar" type="button" data-fechar aria-label="Fechar">×</button>
      </header>
      <div class="ag-gaveta__corpo">
        <fieldset class="ac-tipos"><legend class="ag-campo__rotulo">Tipo</legend>
          ${Object.entries(TIPOS).map(([k, t]) => `<label class="ac-tipo"><input type="radio" name="tipo" value="${k}"${k === i.tipo ? ' checked' : ''}>
            <span><b>${t.rotulo}</b><span class="mini">${esc(t.exemplo)}</span></span></label>`).join('')}
        </fieldset>
        <label class="ag-campo"><span class="ag-campo__rotulo">Título</span><input type="text" name="titulo" maxlength="120" value="${esc(i.titulo)}" placeholder="Ex.: SE é o funil principal em outubro"><span class="ac-erro" data-erro="titulo" hidden>Escreva um título.</span></label>
        <label class="ag-campo"><span class="ag-campo__rotulo">Texto <span class="mini">(opcional)</span></span><textarea name="texto" rows="3" maxlength="500">${esc(i.texto)}</textarea></label>
        <label class="ag-campo"><span class="ag-campo__rotulo">Funil <span class="mini">(opcional)</span></span>
          <select name="funil"><option value="">Vale para a conta toda</option>${FUNIS.map((f) => `<option${f === i.funil ? ' selected' : ''}>${f}</option>`).join('')}</select></label>
        <div class="ac-datas" data-datas${i.tipo === 'evento' ? '' : ' hidden'}>
          <label class="ag-campo"><span class="ag-campo__rotulo">Começa</span><input type="date" name="inicio" value="${esc(i.inicio || '')}"></label>
          <label class="ag-campo"><span class="ag-campo__rotulo">Termina</span><input type="date" name="fim" value="${esc(i.fim || '')}"></label>
          <span class="ac-erro" data-erro="datas" hidden></span>
          <p class="mini ac-datas__nota">A semana em que o evento acontece fica marcada como atípica no relatório. Depois do fim, o item sai sozinho do contexto atual.</p>
        </div>
        <label class="ag-campo"><span class="ag-campo__rotulo">Validade</span>
          <select name="validade">${[15, 30, 60, 90].map((d) => `<option value="${d}"${d === i.validade ? ' selected' : ''}>${d} dias sem revisão</option>`).join('')}</select>
          <span class="mini">Passado o prazo, o item aparece como "revisar" e o relatório avisa que está usando contexto velho.</span></label>
      </div>
      <footer class="ag-gaveta__rodape"><div class="ac-rodape"><button type="submit" class="btn">${item ? 'Salvar' : 'Criar item'}</button><button type="button" class="btn sec" data-fechar>Cancelar</button></div></footer>
    </form>`;
    const form = g.querySelector('form');
    g.querySelectorAll('[data-fechar]').forEach((b) => { b.onclick = () => g.close(); });
    form.addEventListener('change', (ev) => {
      if (ev.target.name === 'tipo') form.querySelector('[data-datas]').hidden = ev.target.value !== 'evento';
    });
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const d = Object.fromEntries(new FormData(form));
      const erroTitulo = form.querySelector('[data-erro="titulo"]');
      const erroDatas = form.querySelector('[data-erro="datas"]');
      erroTitulo.hidden = !!d.titulo.trim();
      let msgDatas = '';
      if (d.tipo === 'evento') {
        if (!d.inicio || !d.fim) msgDatas = 'Evento precisa de data de início e de fim.';
        else if (d.fim < d.inicio) msgDatas = 'A data de fim é antes do início.';
      }
      erroDatas.textContent = msgDatas; erroDatas.hidden = !msgDatas;
      if (!erroTitulo.hidden || msgDatas) return;
      const novo = { tipo: d.tipo, titulo: d.titulo.trim(), texto: d.texto.trim(), funil: d.funil, validade: Number(d.validade), revisado: HOJE,
        inicio: d.tipo === 'evento' ? d.inicio : undefined, fim: d.tipo === 'evento' ? d.fim : undefined };
      if (item) Object.assign(item, novo); else itens.unshift({ id: ++proximoId, ...novo });
      g.close();
      if (!item) estado = 'itens';
      filtro = 'valendo';
      desenhar();
      avisarProto(item ? 'A data de revisão passou a ser hoje.' : 'O item entrou como "em dia".');
    });
    if (!g.open) g.showModal();
    form.querySelector('[name="titulo"]').focus();
  }

  // ---------------------------------------------------------------------------
  // Desenho
  // ---------------------------------------------------------------------------
  function seloProto() {
    return `<div class="em-proto" role="note">
      <span class="em-proto__selo">Protótipo</span>
      <span>Itens de exemplo. Nada aqui é salvo.</span>
      <label class="em-proto__cen">Ver estado
        <select data-ac-estado aria-label="Estado de exemplo">
          <option value="itens"${estado === 'itens' ? ' selected' : ''}>Com itens</option>
          <option value="vazio"${estado === 'vazio' ? ' selected' : ''}>Vazio</option>
        </select></label>
    </div>`;
  }

  function quadroJaSabe() {
    const lista = `<ul class="ac-sabe__lista">${JA_SABE.map(([t, d]) => `<li><b>${t}</b><span class="mini">${d}</span></li>`).join('')}</ul>
      <p class="ac-sabe__regra"><b>Regra prática:</b> vai no contexto o que explica um número e não está em nenhum sistema.</p>`;
    return `<aside class="ac-sabe" aria-label="O que o relatório já sabe sozinho">
      <details class="ac-sabe__dobra" data-sabe>
        <summary>Ver o que o relatório já sabe sozinho</summary>${lista}
      </details>
      <div class="ac-sabe__fixo"><h3 class="argo-grupo-titulo">O que o relatório já sabe sozinho</h3><p class="mini">Isto ele lê sem você escrever nada:</p>${lista}</div>
    </aside>`;
  }

  function situacao(i) {
    if (i.arquivado) return `<span class="carimbo neutro">arquivado em ${dataBR(i.arquivado)}</span>`;
    if (terminado(i)) return '<span class="carimbo neutro">terminou</span>';
    return vencido(i) ? '<span class="carimbo alerta">revisar</span>' : '<span class="carimbo alta">em dia</span>';
  }

  function cartao(i) {
    const datas = i.tipo === 'evento' ? `${dataBR(i.inicio)}${i.fim !== i.inicio ? ` a ${dataBR(i.fim)}` : ''}` : '';
    const meta = [TIPOS[i.tipo].rotulo, i.funil || 'conta toda', datas, `revisado há ${dias(i.revisado)} dias`].filter(Boolean).join(' · ');
    const nota = i.arquivado ? 'Fora do contexto usado pelo relatório. Continua no histórico.'
      : terminado(i) ? 'Saiu sozinho do contexto atual. A semana em que aconteceu continua marcada como atípica.'
      : vencido(i) ? `Passou de ${i.validade} dias sem revisão: o relatório usa, mas avisa que está velho.` : '';
    const acoes = i.arquivado || terminado(i) ? ''
      : confirmando === i.id
        ? `<span class="confirma">Arquivar este item? <button type="button" class="btn perigo" data-ac-arquivar-sim="${i.id}">Arquivar</button><button type="button" class="btn sec" data-ac-arquivar-nao>Cancelar</button></span>`
        : `<button type="button" class="btn sec" data-ac-revisado="${i.id}">Marcar como revisado</button>
           <button type="button" class="btn sec" data-ac-editar="${i.id}">Editar</button>
           <button type="button" class="ar-link" data-ac-arquivar="${i.id}">Arquivar</button>`;
    return `<article class="ac-item${vencido(i) && !i.arquivado && !terminado(i) ? ' ac-item--revisar' : ''}">
      <div class="ac-item__topo"><span class="ac-item__meta">${esc(meta)}</span>${situacao(i)}</div>
      <h3 class="ac-item__titulo">${esc(i.titulo)}</h3>
      ${i.texto ? `<p class="ac-item__texto">${esc(i.texto)}</p>` : ''}
      ${nota ? `<p class="mini ac-item__nota">${nota}</p>` : ''}
      ${acoes ? `<div class="ac-item__acoes">${acoes}</div>` : ''}
    </article>`;
  }

  function lista() {
    const vale = valendo();
    if (estado === 'vazio' && filtro === 'valendo') {
      return `<div class="ac-vazio">
        <h3>Nenhum item de contexto ainda</h3>
        <p>O relatório funciona sem contexto: ele gera mesmo assim e avisa que está sem saber o momento do negócio. Com contexto, ele entende por que um número mudou (um evento, uma oferta nova, uma restrição) e não sugere teste que contrarie o que você decidiu.</p>
        <button type="button" class="btn" data-ac-novo>Criar o primeiro item</button>
      </div>`;
    }
    const base = estado === 'vazio' ? [] : itens;
    let mostrar = filtro === 'arquivados' ? base.filter((i) => i.arquivado)
      : filtro === 'terminados' ? base.filter((i) => !i.arquivado && terminado(i))
      : vale.slice().sort((a, b) => Number(vencido(b)) - Number(vencido(a)));
    if (!mostrar.length) return `<p class="aviso">${filtro === 'arquivados' ? 'Nenhum item arquivado.' : 'Nenhum evento terminado.'}</p>`;
    return `<div class="ac-lista">${mostrar.map(cartao).join('')}</div>`;
  }

  function desenhar() {
    if (!raizAtual) return;
    const base = estado === 'vazio' ? [] : itens;
    const vale = estado === 'vazio' ? [] : valendo();
    const revisar = vale.filter(vencido).length;
    const term = base.filter((i) => !i.arquivado && terminado(i)).length;
    const resumo = vale.length
      ? `${vale.length} ${vale.length === 1 ? 'item valendo' : 'itens valendo'}${revisar ? ` · <b>${revisar} para revisar</b>` : ''}${term ? ` · ${term} ${term === 1 ? 'evento terminado' : 'eventos terminados'}` : ''}`
      : 'Sem contexto: o relatório avisa que está sem saber o momento do negócio.';
    const f = (k, r) => `<button type="button" class="tipo-pill" data-ac-filtro="${k}" aria-pressed="${filtro === k}">${r}</button>`;
    raizAtual.innerHTML = `${seloProto()}
      <div class="ac-topo">
        <div><h2 class="ac-topo__titulo">Contexto do negócio</h2><p class="mini">${resumo}</p></div>
        <button type="button" class="btn" data-ac-novo>Novo item</button>
      </div>
      <div class="ac-grade">
        <div class="ac-col">
          <div class="ac-filtros" role="group" aria-label="Quais itens mostrar">${f('valendo', 'Valendo')}${f('arquivados', 'Arquivados')}${f('terminados', 'Eventos terminados')}</div>
          ${lista()}
        </div>
        ${quadroJaSabe()}
      </div>`;
  }

  function ligar(raiz) {
    raiz.addEventListener('change', (ev) => {
      if (!ev.target.matches('[data-ac-estado]')) return;
      estado = ev.target.value;
      itens = ITENS_EXEMPLO();
      if (estado === 'vazio') itens = [];
      filtro = 'valendo'; confirmando = null;
      desenhar();
      avisar(`Mostrando: ${estado === 'vazio' ? 'contexto vazio' : 'com itens'}.`);
    });
    raiz.addEventListener('click', (ev) => {
      const t = ev.target.closest('button');
      if (!t || !raiz.contains(t)) return;
      const d = t.dataset;
      const achar = (id) => itens.find((i) => i.id === Number(id));
      if ('acNovo' in d) abrirGaveta(null);
      else if (d.acFiltro) { filtro = d.acFiltro; confirmando = null; desenhar(); }
      else if (d.acEditar) abrirGaveta(achar(d.acEditar));
      else if (d.acRevisado) { achar(d.acRevisado).revisado = HOJE; desenhar(); avisarProto('A data de revisão passou a ser hoje.'); }
      else if (d.acArquivar) { confirmando = Number(d.acArquivar); desenhar(); }
      else if ('acArquivarNao' in d) { confirmando = null; desenhar(); }
      else if (d.acArquivarSim) { achar(d.acArquivarSim).arquivado = HOJE; confirmando = null; desenhar(); avisarProto('O item saiu do contexto e continua em Arquivados.'); }
    });
  }

  window.ArgoContexto = {
    abrir(raiz) {
      if (raizAtual === raiz) return;
      raizAtual = raiz;
      ligar(raiz);
      desenhar();
    },
  };
})();
