/* Dashboard do painel — thin client: lê o slug da URL, pede dados prontos às
   APIs /api/painel/* e só formata/renderiza. Toda a matemática é do backend. */
(() => {
  'use strict';

  // ---------- utilidades ----------
  const $ = (s) => document.querySelector(s);
  const fmtBRL = (cents) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtInt = (n) => Number(n || 0).toLocaleString('pt-BR');
  const fmtPct = (n, casas = 2) => `${Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: casas, minimumFractionDigits: casas })}%`;
  const fmtNum = (n, casas = 2) => Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: casas });
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dataISO = (d) => d.toISOString().slice(0, 10);
  const dataBR = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

  function valorFmt(v, tipo) {
    if (v === null || v === undefined) return '<span class="semdado">sem dados</span>';
    if (tipo === 'moeda') return fmtBRL(v);
    if (tipo === 'pct') return fmtPct(v);
    if (tipo === 'num') return fmtNum(v);
    return fmtInt(v);
  }

  // Delta ▲/▼: seta + cor (nunca só cor). invertido=true para métricas de custo.
  function deltaChip(pct, invertido = false) {
    if (pct === null || pct === undefined || !isFinite(pct)) return '';
    const up = pct >= 0;
    const bom = invertido ? !up : up;
    const cls = pct === 0 ? 'neutro' : (bom ? 'up' : 'down');
    const seta = pct === 0 ? '•' : (up ? '▲' : '▼');
    return `<span class="delta ${cls}">${seta} ${fmtNum(Math.abs(pct), 1)}%</span>`;
  }

  const kpiTile = (k) => `
    <div class="kpi">
      <div class="rotulo">${esc(k.rotulo)}</div>
      <div class="valor">${valorFmt(k.valor, k.tipo)}</div>
      ${deltaChip(k.delta_pct, k.invertido)}
    </div>`;

  // Tabela ordenável: clique no cabeçalho ordena pela coluna (asc/desc, ↑↓).
  // `campo` define o valor bruto usado na ordenação; coluna sem campo não ordena.
  function tabela(el, colunas, linhas) {
    if (!linhas.length) { el.innerHTML = '<div class="aviso">Sem dados no período.</div>'; return; }
    const ordem = { campo: null, asc: false };

    const desenhar = () => {
      let dados = linhas;
      if (ordem.campo) {
        dados = [...linhas].sort((a, b) => {
          const va = a[ordem.campo], vb = b[ordem.campo];
          if (va == null && vb == null) return 0;
          if (va == null) return 1;   // nulos sempre por último
          if (vb == null) return -1;
          const cmp = (typeof va === 'number' && typeof vb === 'number')
            ? va - vb
            : String(va).localeCompare(String(vb), 'pt-BR');
          return ordem.asc ? cmp : -cmp;
        });
      }
      const ths = colunas.map((c, i) =>
        `<th class="${c.num ? 'num' : ''}${c.campo ? ' ordenavel' : ''}" data-i="${i}">` +
        `${esc(c.titulo)}${c.campo === ordem.campo ? (ordem.asc ? ' ↑' : ' ↓') : ''}</th>`).join('');
      const trs = dados.map((l) => `<tr>${colunas.map((c) => `<td class="${c.num ? 'num' : ''}">${c.render(l)}</td>`).join('')}</tr>`).join('');
      el.innerHTML = `<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
    };

    // Delegação: sobrevive aos re-renders; onclick evita handler duplicado.
    el.onclick = (ev) => {
      const th = ev.target.closest('th.ordenavel');
      if (!th) return;
      const campo = colunas[Number(th.dataset.i)].campo;
      if (ordem.campo === campo) ordem.asc = !ordem.asc;
      else { ordem.campo = campo; ordem.asc = false; }
      desenhar();
    };
    desenhar();
  }

  // ---------- estado ----------
  const slug = (location.pathname.match(/^\/c\/([a-z0-9-]+)/) || [])[1] || '';
  let fontes = { meta: true, google: true, ga4: true };
  let secaoAtiva = 'home';

  function periodo() {
    const preset = $('#preset').value;
    const hoje = new Date();
    const ontem = new Date(hoje); ontem.setDate(hoje.getDate() - 1);
    let de, ate = dataISO(ontem);
    if (preset === 'custom') {
      de = $('#data-de').value || dataISO(ontem);
      ate = $('#data-ate').value || dataISO(ontem);
    } else if (preset === 'mes') {
      de = dataISO(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
    } else if (preset === 'mes-passado') {
      de = dataISO(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1));
      ate = dataISO(new Date(hoje.getFullYear(), hoje.getMonth(), 0));
    } else {
      const d = new Date(ontem); d.setDate(ontem.getDate() - (Number(preset) - 1));
      de = dataISO(d);
    }
    return { de, ate };
  }

  // ---------- camada de dados ----------
  async function api(secao) {
    const { de, ate } = periodo();
    const r = await fetch(`/api/painel/${secao}?slug=${encodeURIComponent(slug)}&de=${de}&ate=${ate}`);
    if (!r.ok) throw new Error(`api ${secao} ${r.status}`);
    return r.json();
  }

  // ---------- renderizadores ----------
  const R = {};

  R.home = (d) => {
    $('#home-kpis').innerHTML = d.kpis.map(kpiTile).join('');
    tabela($('#home-canais'), [
      { titulo: 'Canal', campo: 'canal', render: (l) => esc(l.canal) },
      { titulo: 'Receita', num: true, campo: 'receita_cents', render: (l) => fmtBRL(l.receita_cents) },
      { titulo: 'Tx conv.', num: true, campo: 'tx_conversao', render: (l) => fmtPct(l.tx_conversao) },
      { titulo: 'Δ', num: true, campo: 'delta_pct', render: (l) => deltaChip(l.delta_pct) },
    ], d.canais);
    tabela($('#home-produtos'), [
      { titulo: 'Produto', campo: 'produto', render: (l) => esc(l.produto) },
      { titulo: 'Receita', num: true, campo: 'receita_cents', render: (l) => fmtBRL(l.receita_cents) },
    ], d.produtos);
  };

  R.funil = (d) => {
    // Silhueta fixa: 100% na primeira etapa, afunilando por igual até 40% na
    // última — o desenho não muda com os dados (pedido da usuária).
    const n = d.etapas.length;
    const largura = (i) => 100 - (n > 1 ? (i * 60) / (n - 1) : 0);
    $('#funil-etapas').innerHTML = d.etapas.map((e, i) => {
      const taxa = i === 0 ? '' :
        `<div class="f-taxa">▼ <b>${fmtNum((e.valor / (d.etapas[i - 1].valor || 1)) * 100)}%</b> da etapa anterior</div>`;
      return `
      <div class="f-etapa">
        ${taxa}
        <div class="f-barra" style="width:${largura(i)}%">
          <span class="f-nome">${esc(e.nome)}</span>
          <span class="f-valor">${fmtInt(e.valor)}</span>
        </div>
      </div>`;
    }).join('');
    $('#funil-kpis').innerHTML = d.kpis.map(kpiTile).join('');
  };

  R.receita = (d) => {
    grafico($('#receita-grafico'), d.por_dia);
    $('#receita-fontes').innerHTML = d.fontes.map((f) => `
      <div class="card"><h2>${esc(f.titulo)}</h2><div class="grid-kpi">${f.kpis.map(kpiTile).join('')}</div></div>
    `).join('') || '<div class="aviso">Nenhuma fonte conectada.</div>';
  };

  R.conversao = (d) => {
    $('#conv-kpis').innerHTML = d.kpis.map(kpiTile).join('');
    const cols = (rotulo) => [
      { titulo: rotulo, campo: 'nome', render: (l) => esc(l.nome) },
      { titulo: 'Usuários', num: true, campo: 'usuarios', render: (l) => fmtInt(l.usuarios) },
      { titulo: 'Novos', num: true, campo: 'novos', render: (l) => fmtInt(l.novos) },
      { titulo: 'Tx conv.', num: true, campo: 'tx_conversao', render: (l) => fmtPct(l.tx_conversao) },
      { titulo: 'Pedidos', num: true, campo: 'pedidos', render: (l) => fmtInt(l.pedidos) },
      { titulo: 'Ticket', num: true, campo: 'ticket_cents', render: (l) => fmtBRL(l.ticket_cents) },
      { titulo: 'Receita', num: true, campo: 'receita_cents', render: (l) => fmtBRL(l.receita_cents) },
      { titulo: 'Δ receita', num: true, campo: 'delta_pct', render: (l) => deltaChip(l.delta_pct) },
    ];
    tabela($('#conv-canais'), cols('Canal'), d.canais);
    tabela($('#conv-origem'), cols('Origem / Mídia'), d.origem_midia);
  };

  R.produtos = (d) => {
    tabela($('#produtos-tabela'), [
      { titulo: 'Produto', campo: 'produto', render: (l) => esc(l.produto) },
      { titulo: 'Pedidos', num: true, campo: 'pedidos', render: (l) => fmtInt(l.pedidos) },
      { titulo: 'Receita', num: true, campo: 'receita_cents', render: (l) => fmtBRL(l.receita_cents) },
    ], d.produtos);
  };

  R.metas = (d) => {
    $('#metas-kpis').innerHTML = d.kpis.map(kpiTile).join('');
    tabela($('#metas-tabela'), [
      { titulo: 'Data', campo: 'data', render: (l) => dataBR(l.data) },
      { titulo: 'Projetado', num: true, campo: 'projetado_cents', render: (l) => fmtBRL(l.projetado_cents) },
      { titulo: 'Realizado', num: true, campo: 'realizado_cents', render: (l) => fmtBRL(l.realizado_cents) },
      { titulo: 'Investido', num: true, campo: 'gasto_cents', render: (l) => fmtBRL(l.gasto_cents) },
      { titulo: 'Sessões', num: true, campo: 'sessoes', render: (l) => fmtInt(l.sessoes) },
      { titulo: 'Pedidos', num: true, campo: 'pedidos', render: (l) => fmtInt(l.pedidos) },
      { titulo: 'ROAS', num: true, campo: 'roas', render: (l) => (l.roas == null ? '—' : fmtNum(l.roas)) },
    ], d.diario);
  };

  R.criativos = (d) => {
    tabela($('#criativos-tabela'), [
      { titulo: '', render: (l) => l.thumbnail_url ? `<img class="thumb" src="${esc(l.thumbnail_url)}" alt="" loading="lazy" />` : '<div class="thumb"></div>' },
      { titulo: 'Criativo', campo: 'ad_nome', render: (l) => esc(l.ad_nome) },
      { titulo: 'Investimento', num: true, campo: 'gasto_cents', render: (l) => fmtBRL(l.gasto_cents) },
      { titulo: 'Receita', num: true, campo: 'receita_cents', render: (l) => fmtBRL(l.receita_cents) },
      { titulo: 'Pedidos', num: true, campo: 'pedidos', render: (l) => fmtInt(l.pedidos) },
      { titulo: 'Alcance', num: true, campo: 'alcance', render: (l) => fmtInt(l.alcance) },
      { titulo: 'Freq.', num: true, campo: 'frequencia', render: (l) => fmtNum(l.frequencia) },
      { titulo: 'Cliques', num: true, campo: 'cliques', render: (l) => fmtInt(l.cliques) },
      { titulo: 'Sessões', num: true, campo: 'sessoes', render: (l) => (l.sessoes == null ? '—' : fmtInt(l.sessoes)) },
      { titulo: 'CTR', num: true, campo: 'ctr', render: (l) => fmtPct(l.ctr) },
    ], d.criativos);
  };

  // ---------- gráfico de linha (SVG, 1 série, hover com crosshair) ----------
  function grafico(el, serie) {
    if (!serie.length) { el.innerHTML = '<div class="aviso">Sem dados no período.</div>'; return; }
    const W = 900, H = 260, m = { t: 14, r: 12, b: 26, l: 56 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const max = Math.max(...serie.map((p) => p.receita_cents), 1) * 1.08;
    const x = (i) => m.l + (serie.length === 1 ? iw / 2 : (i / (serie.length - 1)) * iw);
    const y = (v) => m.t + ih - (v / max) * ih;

    const pts = serie.map((p, i) => `${x(i).toFixed(1)},${y(p.receita_cents).toFixed(1)}`);
    const linha = `M${pts.join('L')}`;
    const area = `${linha}L${x(serie.length - 1).toFixed(1)},${m.t + ih}L${x(0).toFixed(1)},${m.t + ih}Z`;

    const yticks = [0, 0.5, 1].map((f) => {
      const v = max * f, yy = y(v);
      return `<line class="eixo" x1="${m.l}" x2="${W - m.r}" y1="${yy}" y2="${yy}"/><text class="rot-eixo" x="${m.l - 6}" y="${yy + 3}" text-anchor="end">${fmtBRL(v).replace(/,\d+$/, '')}</text>`;
    }).join('');
    const passo = Math.max(1, Math.ceil(serie.length / 8));
    const xticks = serie.map((p, i) => i % passo ? '' : `<text class="rot-eixo" x="${x(i)}" y="${H - 8}" text-anchor="middle">${dataBR(p.data)}</text>`).join('');

    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Receita por dia">
      ${yticks}${xticks}
      <path class="area" d="${area}"/><path class="linha" d="${linha}"/>
      <line class="cursor" id="gcursor" y1="${m.t}" y2="${m.t + ih}" x1="-10" x2="-10" style="display:none"/>
      <circle id="gponto" r="4" fill="var(--serie)" stroke="var(--bg)" stroke-width="2" style="display:none"/>
    </svg><div class="tooltip" id="gtooltip"></div>`;

    const svg = el.querySelector('svg'), tip = el.querySelector('#gtooltip');
    const cursor = el.querySelector('#gcursor'), ponto = el.querySelector('#gponto');
    svg.addEventListener('pointermove', (ev) => {
      const r = svg.getBoundingClientRect();
      const px = ((ev.clientX - r.left) / r.width) * W;
      const i = Math.max(0, Math.min(serie.length - 1, Math.round(((px - m.l) / iw) * (serie.length - 1))));
      const cx = x(i), cy = y(serie[i].receita_cents);
      cursor.setAttribute('x1', cx); cursor.setAttribute('x2', cx); cursor.style.display = '';
      ponto.setAttribute('cx', cx); ponto.setAttribute('cy', cy); ponto.style.display = '';
      tip.style.display = 'block';
      tip.style.left = `${(cx / W) * r.width}px`;
      tip.style.top = `${(cy / H) * r.height}px`;
      tip.innerHTML = `${dataBR(serie[i].data)}<b>${fmtBRL(serie[i].receita_cents)}</b>`;
    });
    svg.addEventListener('pointerleave', () => {
      cursor.style.display = 'none'; ponto.style.display = 'none'; tip.style.display = 'none';
    });
  }

  // ---------- navegação e ciclo de vida ----------
  const TITULOS = { home: 'Home', funil: 'Funil de Vendas', receita: 'Receita', conversao: 'Conversão', produtos: 'Produtos', metas: 'Metas', criativos: 'Criativos' };

  async function renderSecao() {
    const { de, ate } = periodo();
    $('#titulo-secao').textContent = TITULOS[secaoAtiva];
    $('#subtitulo').textContent = `${dataBR(de)} – ${dataBR(ate)}`;
    document.querySelectorAll('.secao').forEach((s) => s.classList.toggle('ativa', s.id === `secao-${secaoAtiva}`));
    document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('ativo', a.dataset.secao === secaoAtiva));
    try {
      const dados = await api(secaoAtiva);
      if (dados.atualizado_ate) $('#atualizado').textContent = `atualizado até ${dataBR(dados.atualizado_ate)}`;
      R[secaoAtiva](dados);
    } catch (e) {
      $(`#secao-${secaoAtiva}`).innerHTML = '<div class="aviso">Não foi possível carregar os dados agora. Tente novamente em instantes.</div>';
    }
  }

  function trocarSecao() {
    const h = location.hash.replace('#', '');
    secaoAtiva = TITULOS[h] ? h : 'home';
    renderSecao();
  }

  async function init() {
    if (!slug) { $('#erro-slug').hidden = false; return; }
    let cliente;
    try {
      const r = await fetch(`/api/painel/cliente?slug=${encodeURIComponent(slug)}`);
      if (!r.ok) throw new Error();
      cliente = await r.json();
    } catch {
      $('#erro-slug').hidden = false;
      return;
    }
    fontes = cliente.fontes;
    $('#nome-cliente').textContent = cliente.nome;
    if (!fontes.meta) $('#nav a[data-secao="criativos"]').style.display = 'none';
    $('#app').hidden = false;

    window.addEventListener('hashchange', trocarSecao);
    $('#preset').addEventListener('change', () => {
      const custom = $('#preset').value === 'custom';
      $('#data-de').hidden = !custom; $('#data-ate').hidden = !custom;
      if (!custom) renderSecao();
    });
    $('#data-de').addEventListener('change', renderSecao);
    $('#data-ate').addEventListener('change', renderSecao);
    trocarSecao();
  }

  init();
})();
