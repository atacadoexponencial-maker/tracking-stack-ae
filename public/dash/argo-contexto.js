// Contexto do negócio do Argo (spec-relatorio-semanal-argo.md, módulo 1; issues 400 e 402).
//
// Mora na aba Argo, vista `#argo?v=contexto`; o index.html chama
// `ArgoContexto.abrir(raiz, { argoApi })` quando a vista aparece.
//
// A aba NÃO decide nada: situação (em dia, revisar), dias desde a revisão,
// eventos terminados e a validação vêm prontos de /api/argo/contexto
// (_argo-contexto.js). Aqui só se desenha e se manda o que a gestora fez.
//
// Desenho aprovado no protótipo 400: aviso curto (CSS ag-toast), gaveta (CSS
// ag-gaveta, ag-campo) e o quadro "o que o relatório já sabe sozinho".
(() => {
  'use strict';

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Só rótulos e exemplos de tela; quais tipos existem é validado no servidor.
  const TIPOS = {
    prioridade: { rotulo: 'Prioridade', exemplo: 'SE é o funil principal em outubro; workshop gratuito é apoio.' },
    oferta: { rotulo: 'Oferta', exemplo: 'Workshop pago a R$ 47; condição especial até dia 15.' },
    evento: { rotulo: 'Evento', exemplo: 'Workshop ao vivo em 07/10; Black Friday de 20 a 30/11.' },
    restricao: { rotulo: 'Restrição', exemplo: 'Não mexer no remarketing do workshop pago até 15/10.' },
    observacao: { rotulo: 'Observação', exemplo: 'O comercial mudou o roteiro de qualificação no dia 10.' },
  };
  const FUNIS = ['Sessão estratégica', 'Workshop gratuito', 'Workshop pago', 'Aplicação mentoria'];

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

  const dataBR = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');

  let dados = null;
  let erroCarga = '';
  let filtro = 'valendo';
  let confirmando = null;
  let raizAtual = null;
  let ctx = null;

  // ---------------------------------------------------------------------------
  // Aviso curto e gaveta
  // ---------------------------------------------------------------------------
  let toastTempo = null;
  function avisar(texto, tipo = 'ok') {
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
    t.dataset.tipo = tipo;
    void t.offsetWidth;
    t.classList.add('visivel');
    clearTimeout(toastTempo);
    toastTempo = setTimeout(() => t.classList.remove('visivel'), 3200);
  }

  async function enviar(corpo, botao) {
    if (botao) botao.disabled = true;
    try {
      dados = await ctx.argoApi('/api/argo/contexto', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) });
      erroCarga = '';
      return true;
    } catch (e) {
      avisar(e.mensagemUsuario || 'Não foi possível gravar agora. Tente de novo.', 'erro');
      return false;
    } finally {
      if (botao) botao.disabled = false;
    }
  }

  function abrirGaveta(item) {
    let g = document.getElementById('ac-gaveta');
    if (!g) {
      g = document.createElement('dialog');
      g.id = 'ac-gaveta';
      g.className = 'ag-gaveta em-gaveta';
      g.addEventListener('click', (ev) => { if (ev.target === g) g.close(); });
      document.body.appendChild(g);
    }
    const i = item || { tipo: 'prioridade', titulo: '', texto: '', funil: '', validade_dias: 30 };
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
        <label class="ag-campo"><span class="ag-campo__rotulo">Título</span><input type="text" name="titulo" maxlength="120" value="${esc(i.titulo)}" placeholder="Ex.: SE é o funil principal em outubro"></label>
        <label class="ag-campo"><span class="ag-campo__rotulo">Texto <span class="mini">(opcional)</span></span><textarea name="texto" rows="3" maxlength="500">${esc(i.texto)}</textarea></label>
        <label class="ag-campo"><span class="ag-campo__rotulo">Funil <span class="mini">(opcional)</span></span>
          <select name="funil"><option value="">Vale para a conta toda</option>${FUNIS.map((f) => `<option${f === i.funil ? ' selected' : ''}>${f}</option>`).join('')}</select></label>
        <div class="ac-datas" data-datas${i.tipo === 'evento' ? '' : ' hidden'}>
          <label class="ag-campo"><span class="ag-campo__rotulo">Começa</span><input type="date" name="inicio" value="${esc(i.inicio || '')}"></label>
          <label class="ag-campo"><span class="ag-campo__rotulo">Termina</span><input type="date" name="fim" value="${esc(i.fim || '')}"></label>
          <p class="mini ac-datas__nota">A semana em que o evento acontece fica marcada como atípica no relatório. Depois do fim, o item sai sozinho do contexto atual.</p>
        </div>
        <label class="ag-campo"><span class="ag-campo__rotulo">Validade</span>
          <select name="validade_dias">${[15, 30, 60, 90].map((d) => `<option value="${d}"${d === i.validade_dias ? ' selected' : ''}>${d} dias sem revisão</option>`).join('')}</select>
          <span class="mini">Passado o prazo, o item aparece como "revisar" e o relatório avisa que está usando contexto velho.</span></label>
        <p class="ac-erro" data-erro hidden></p>
      </div>
      <footer class="ag-gaveta__rodape"><div class="ac-rodape"><button type="submit" class="btn">${item ? 'Salvar' : 'Criar item'}</button><button type="button" class="btn sec" data-fechar>Cancelar</button></div></footer>
    </form>`;
    const form = g.querySelector('form');
    g.querySelectorAll('[data-fechar]').forEach((b) => { b.onclick = () => g.close(); });
    form.addEventListener('change', (ev) => {
      if (ev.target.name === 'tipo') form.querySelector('[data-datas]').hidden = ev.target.value !== 'evento';
    });
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const d = Object.fromEntries(new FormData(form));
      const corpo = { acao: item ? 'editar' : 'criar', id: item ? item.id : undefined, tipo: d.tipo, titulo: d.titulo, texto: d.texto,
        funil: d.funil, validade_dias: Number(d.validade_dias), inicio: d.inicio || null, fim: d.fim || null };
      const botao = form.querySelector('[type="submit"]');
      botao.disabled = true;
      try {
        dados = await ctx.argoApi('/api/argo/contexto', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) });
      } catch (e) {
        // O servidor diz o que está errado; a gaveta fica aberta com o que foi digitado.
        const erro = form.querySelector('[data-erro]');
        erro.textContent = e.mensagemUsuario || 'Não foi possível gravar agora. Tente de novo.';
        erro.hidden = false;
        botao.disabled = false;
        return;
      }
      g.close();
      filtro = 'valendo';
      desenhar();
      avisar(item ? 'Item salvo. A data de revisão passou a ser hoje.' : 'Item criado.');
    });
    if (!g.open) g.showModal();
    form.querySelector('[name="titulo"]').focus();
  }

  // ---------------------------------------------------------------------------
  // Desenho
  // ---------------------------------------------------------------------------
  function quadroJaSabe() {
    const lista = `<ul class="ac-sabe__lista">${JA_SABE.map(([t, d]) => `<li><b>${t}</b><span class="mini">${d}</span></li>`).join('')}</ul>
      <p class="ac-sabe__regra"><b>Regra prática:</b> vai no contexto o que explica um número e não está em nenhum sistema.</p>`;
    return `<aside class="ac-sabe" aria-label="O que o relatório já sabe sozinho">
      <details class="ac-sabe__dobra">
        <summary>Ver o que o relatório já sabe sozinho</summary>${lista}
      </details>
      <div class="ac-sabe__fixo"><h3 class="argo-grupo-titulo">O que o relatório já sabe sozinho</h3><p class="mini">Isto ele lê sem você escrever nada:</p>${lista}</div>
    </aside>`;
  }

  function situacao(i) {
    if (i.situacao === 'arquivado') return `<span class="carimbo neutro">arquivado em ${dataBR(i.arquivado_em)}</span>`;
    if (i.situacao === 'terminado') return '<span class="carimbo neutro">terminou</span>';
    return i.situacao === 'revisar' ? '<span class="carimbo alerta">revisar</span>' : '<span class="carimbo alta">em dia</span>';
  }

  function cartao(i) {
    const datas = i.tipo === 'evento' ? `${dataBR(i.inicio)}${i.fim !== i.inicio ? ` a ${dataBR(i.fim)}` : ''}` : '';
    const dias = i.dias_desde_revisao === 0 ? 'revisado hoje' : `revisado há ${i.dias_desde_revisao} ${i.dias_desde_revisao === 1 ? 'dia' : 'dias'}`;
    const meta = [TIPOS[i.tipo] ? TIPOS[i.tipo].rotulo : i.tipo, i.funil || 'conta toda', datas, dias].filter(Boolean).join(' · ');
    const nota = i.situacao === 'arquivado' ? 'Fora do contexto usado pelo relatório. Continua no histórico.'
      : i.situacao === 'terminado' ? 'Saiu sozinho do contexto atual. A semana em que aconteceu continua marcada como atípica.'
      : i.situacao === 'revisar' ? `Passou de ${i.validade_dias} dias sem revisão: o relatório usa, mas avisa que está velho.` : '';
    const ativo = i.situacao === 'em_dia' || i.situacao === 'revisar';
    const acoes = !ativo ? ''
      : confirmando === i.id
        ? `<span class="confirma">Arquivar este item? <button type="button" class="btn perigo" data-ac-arquivar-sim="${i.id}">Arquivar</button><button type="button" class="btn sec" data-ac-arquivar-nao>Cancelar</button></span>`
        : `<button type="button" class="btn sec" data-ac-revisado="${i.id}">Marcar como revisado</button>
           <button type="button" class="btn sec" data-ac-editar="${i.id}">Editar</button>
           <button type="button" class="ar-link" data-ac-arquivar="${i.id}">Arquivar</button>`;
    return `<article class="ac-item${i.situacao === 'revisar' ? ' ac-item--revisar' : ''}">
      <div class="ac-item__topo"><span class="ac-item__meta">${esc(meta)}</span>${situacao(i)}</div>
      <h3 class="ac-item__titulo">${esc(i.titulo)}</h3>
      ${i.texto ? `<p class="ac-item__texto">${esc(i.texto)}</p>` : ''}
      ${nota ? `<p class="mini ac-item__nota">${nota}</p>` : ''}
      ${acoes ? `<div class="ac-item__acoes">${acoes}</div>` : ''}
    </article>`;
  }

  function lista() {
    if (erroCarga) return `<p class="aviso falha">${esc(erroCarga)}</p>`;
    if (!dados) return '<div class="esq-tabela" role="status" aria-label="Carregando…"><span class="esq esq-linha"></span><span class="esq esq-linha"></span><span class="esq esq-linha"></span></div>';
    if (filtro === 'valendo' && !dados.valendo.length && !dados.arquivados.length && !dados.terminados.length) {
      return `<div class="ac-vazio">
        <h3>Nenhum item de contexto ainda</h3>
        <p>O relatório funciona sem contexto: ele gera mesmo assim e avisa que está sem saber o momento do negócio. Com contexto, ele entende por que um número mudou (um evento, uma oferta nova, uma restrição) e não sugere teste que contrarie o que você decidiu.</p>
        <button type="button" class="btn" data-ac-novo>Criar o primeiro item</button>
      </div>`;
    }
    const mostrar = dados[filtro] || [];
    if (!mostrar.length) {
      return `<p class="aviso">${{ valendo: 'Nenhum item valendo agora.', arquivados: 'Nenhum item arquivado.', terminados: 'Nenhum evento terminado.' }[filtro]}</p>`;
    }
    return `<div class="ac-lista">${mostrar.map(cartao).join('')}</div>`;
  }

  function desenhar() {
    if (!raizAtual) return;
    const r = dados && dados.resumo;
    const resumo = !r ? '' : r.valendo
      ? `${r.valendo} ${r.valendo === 1 ? 'item valendo' : 'itens valendo'}${r.revisar ? ` · <b>${r.revisar} para revisar</b>` : ''}${r.terminados ? ` · ${r.terminados} ${r.terminados === 1 ? 'evento terminado' : 'eventos terminados'}` : ''}`
      : 'Sem contexto: o relatório avisa que está sem saber o momento do negócio.';
    const f = (k, rot) => `<button type="button" class="tipo-pill" data-ac-filtro="${k}" aria-pressed="${filtro === k}">${rot}</button>`;
    raizAtual.innerHTML = `
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

  async function carregar() {
    try {
      dados = await ctx.argoApi('/api/argo/contexto');
      erroCarga = '';
    } catch (e) {
      erroCarga = e.mensagemUsuario || 'Não foi possível ler o contexto agora.';
    }
    desenhar();
  }

  function ligar(raiz) {
    raiz.addEventListener('click', async (ev) => {
      const t = ev.target.closest('button');
      if (!t || !raiz.contains(t)) return;
      const d = t.dataset;
      const achar = (id) => dados && dados.valendo.find((i) => i.id === Number(id));
      if ('acNovo' in d) abrirGaveta(null);
      else if (d.acFiltro) { filtro = d.acFiltro; confirmando = null; desenhar(); }
      else if (d.acEditar) abrirGaveta(achar(d.acEditar));
      else if (d.acRevisado) { if (await enviar({ acao: 'revisar', id: Number(d.acRevisado) }, t)) { desenhar(); avisar('Marcado como revisado hoje.'); } }
      else if (d.acArquivar) { confirmando = Number(d.acArquivar); desenhar(); }
      else if ('acArquivarNao' in d) { confirmando = null; desenhar(); }
      else if (d.acArquivarSim) {
        if (await enviar({ acao: 'arquivar', id: Number(d.acArquivarSim) }, t)) { confirmando = null; desenhar(); avisar('Item arquivado. Continua em Arquivados.'); }
      }
    });
  }

  window.ArgoContexto = {
    abrir(raiz, contexto) {
      ctx = contexto;
      if (raizAtual !== raiz) { raizAtual = raiz; ligar(raiz); }
      desenhar();
      carregar();
    },
  };
})();
