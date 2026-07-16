/* Dashboard do painel — thin client: lê o slug da URL, pede dados prontos às
   APIs e só renderiza. Nesta fase (issues 75–82) usa mocks com o MESMO
   contrato das APIs reais (issues 94–100), trocados por fetch ao final. */
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

  function tabela(colunas, linhas) {
    if (!linhas.length) return '<div class="aviso">Sem dados no período.</div>';
    const ths = colunas.map((c) => `<th class="${c.num ? 'num' : ''}">${esc(c.titulo)}</th>`).join('');
    const trs = linhas.map((l) => `<tr>${colunas.map((c) => `<td class="${c.num ? 'num' : ''}">${c.render(l)}</td>`).join('')}</tr>`).join('');
    return `<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
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
  const USE_MOCK = true; // issues 94–100 trocam para false

  async function api(secao) {
    const { de, ate } = periodo();
    if (USE_MOCK) return mock(secao, de, ate);
    const r = await fetch(`/api/painel/${secao}?slug=${encodeURIComponent(slug)}&de=${de}&ate=${ate}`);
    if (!r.ok) throw new Error(`api ${secao} ${r.status}`);
    return r.json();
  }

  // ---------- mocks (mesmo contrato das APIs reais) ----------
  function mock(secao, de, ate) {
    const dias = [];
    for (let d = new Date(de + 'T12:00:00'); dataISO(d) <= ate; d.setDate(d.getDate() + 1)) dias.push(dataISO(d));
    const rnd = (a, b) => Math.round(a + Math.random() * (b - a));
    const del = () => rnd(-30, 60);

    if (secao === 'home') {
      const kpis = [
        { rotulo: 'Receita Captada', valor: 5969338, tipo: 'moeda', delta_pct: del() },
        { rotulo: 'Pedidos', valor: 95, tipo: 'int', delta_pct: del() },
        { rotulo: 'Ticket Médio', valor: 62835, tipo: 'moeda', delta_pct: del() },
        { rotulo: 'Tx de Conversão', valor: 0.58, tipo: 'pct', delta_pct: del() },
        { rotulo: 'Sessões', valor: 16470, tipo: 'int', delta_pct: del() },
        { rotulo: 'Novos usuários', valor: 8186, tipo: 'int', delta_pct: del() },
      ];
      if (fontes.meta || fontes.google) kpis.push(
        { rotulo: 'Investimento Total', valor: 1830022, tipo: 'moeda', delta_pct: del(), invertido: true },
        { rotulo: 'ROAS Geral', valor: 3.26, tipo: 'num', delta_pct: del() },
        { rotulo: 'CPA Geral', valor: 19263, tipo: 'moeda', delta_pct: del(), invertido: true },
        { rotulo: 'CPS Geral', valor: 1111, tipo: 'moeda', delta_pct: del(), invertido: true },
      );
      return {
        kpis,
        canais: ['(direct)', 'google', 'l.instagram.com', 'linktr.ee', 'IGShopping'].map((c) => ({
          canal: c, receita_cents: rnd(150000, 2100000), tx_conversao: rnd(30, 160) / 100, delta_pct: del(),
        })),
        produtos: Array.from({ length: 8 }, (_, i) => ({ produto: `Produto exemplo ${i + 1}`, receita_cents: rnd(80000, 170000) })),
      };
    }
    if (secao === 'funil') {
      const s = 16470, c = 2800, ck = 1272, p = 95;
      return {
        etapas: [
          { nome: 'Sessões', valor: s }, { nome: 'Adições ao carrinho', valor: c },
          { nome: 'Checkout', valor: ck }, { nome: 'Pedidos', valor: p },
        ],
        kpis: [
          { rotulo: 'Carrinho × Sessões', valor: (c / s) * 100, tipo: 'pct', delta_pct: del() },
          { rotulo: 'Checkout × Carrinho', valor: (ck / c) * 100, tipo: 'pct', delta_pct: del() },
          { rotulo: 'Pedidos × Checkout', valor: (p / ck) * 100, tipo: 'pct', delta_pct: del() },
          { rotulo: 'Pedidos × Sessões', valor: (p / s) * 100, tipo: 'pct', delta_pct: del() },
        ],
      };
    }
    if (secao === 'receita') {
      const fontesOut = [];
      if (fontes.ga4) fontesOut.push({ id: 'ga4', titulo: 'Google Analytics', kpis: [
        { rotulo: 'Receita', valor: 5969338, tipo: 'moeda', delta_pct: del() },
        { rotulo: 'Pedidos', valor: 95, tipo: 'int', delta_pct: del() },
        { rotulo: 'Ticket Médio', valor: 62835, tipo: 'moeda', delta_pct: del() },
        { rotulo: 'Sessões', valor: 16470, tipo: 'int', delta_pct: del() },
        { rotulo: 'Tx de Conversão', valor: 0.58, tipo: 'pct', delta_pct: del() },
      ]});
      if (fontes.meta) fontesOut.push({ id: 'meta', titulo: 'Meta Ads', kpis: [
        { rotulo: 'Investimento', valor: 1560000, tipo: 'moeda', delta_pct: del(), invertido: true },
        { rotulo: 'Receita atribuída', valor: 4300000, tipo: 'moeda', delta_pct: del() },
        { rotulo: 'ROAS', valor: 2.76, tipo: 'num', delta_pct: del() },
        { rotulo: 'CPM', valor: 1240, tipo: 'moeda', delta_pct: del(), invertido: true },
        { rotulo: 'CTR', valor: 1.9, tipo: 'pct', delta_pct: del() },
        { rotulo: 'CPC', valor: 87, tipo: 'moeda', delta_pct: del(), invertido: true },
      ]});
      if (fontes.google) fontesOut.push({ id: 'google', titulo: 'Google Ads', kpis: [
        { rotulo: 'Investimento', valor: 270022, tipo: 'moeda', delta_pct: del(), invertido: true },
        { rotulo: 'Impressões', valor: 88410, tipo: 'int', delta_pct: del() },
        { rotulo: 'Cliques', valor: 3120, tipo: 'int', delta_pct: del() },
        { rotulo: 'CPC', valor: 87, tipo: 'moeda', delta_pct: del(), invertido: true },
        { rotulo: 'Conversões', valor: 41, tipo: 'num', delta_pct: del() },
        { rotulo: 'CPA', valor: 6586, tipo: 'moeda', delta_pct: del(), invertido: true },
      ]});
      return { por_dia: dias.map((d) => ({ data: d, receita_cents: rnd(90000, 800000) })), fontes: fontesOut };
    }
    if (secao === 'conversao') {
      const linha = (nome) => ({
        nome, usuarios: rnd(90, 1900), novos: rnd(40, 1100), tx_conversao: rnd(30, 160) / 100,
        pedidos: rnd(2, 35), ticket_cents: rnd(50000, 90000), receita_cents: rnd(150000, 2100000), delta_pct: del(),
      });
      return {
        kpis: [
          { rotulo: 'Pedidos', valor: 95, tipo: 'int', delta_pct: del() },
          { rotulo: 'Ticket Médio', valor: 62835, tipo: 'moeda', delta_pct: del() },
          { rotulo: 'Tx de Conversão', valor: 0.58, tipo: 'pct', delta_pct: del() },
          { rotulo: 'Total de usuários', valor: 9971, tipo: 'int', delta_pct: del() },
          { rotulo: 'Sessões', valor: 16470, tipo: 'int', delta_pct: del() },
          { rotulo: 'Sessões engajadas', valor: 11353, tipo: 'int', delta_pct: del() },
          { rotulo: 'Tx de Engajamento', valor: 67.48, tipo: 'pct', delta_pct: del() },
        ],
        canais: ['Direct', 'Paid Social', 'Organic Social', 'Paid Search', 'Organic Search'].map(linha),
        origem_midia: ['(direct) / (none)', 'instagram / cpc', 'google / organic', 'facebook / cpc', 'linktr.ee / referral'].map(linha),
      };
    }
    if (secao === 'produtos') {
      return { produtos: Array.from({ length: 15 }, (_, i) => ({ produto: `Produto exemplo ${i + 1}`, receita_cents: rnd(40000, 180000), pedidos: rnd(1, 22) })) };
    }
    if (secao === 'metas') {
      return {
        mes: ate.slice(0, 7),
        kpis: [
          { rotulo: 'Meta de Faturamento', valor: 8000000, tipo: 'moeda' },
          { rotulo: 'Faturamento Captado', valor: 5969338, tipo: 'moeda' },
          { rotulo: '% Atingimento (Faturamento)', valor: 74.6, tipo: 'pct' },
          { rotulo: 'Meta de Investimento', valor: 2000000, tipo: 'moeda' },
          { rotulo: 'Investimento', valor: 1830022, tipo: 'moeda' },
          { rotulo: '% Atingimento (Investimento)', valor: 91.5, tipo: 'pct' },
          { rotulo: 'Taxa Projetada', valor: 1.2, tipo: 'pct' },
          { rotulo: 'Taxa Atual', valor: 0.58, tipo: 'pct' },
        ],
        diario: dias.slice(-10).map((d) => ({
          data: d, projetado_cents: 266000, realizado_cents: rnd(90000, 700000),
          gasto_cents: rnd(40000, 90000), sessoes: rnd(300, 900), pedidos: rnd(1, 12), roas: rnd(15, 45) / 10,
        })),
      };
    }
    if (secao === 'criativos') {
      if (!fontes.meta) return { criativos: [] };
      return { criativos: Array.from({ length: 10 }, (_, i) => ({
        ad_nome: `Criativo exemplo ${i + 1}`, thumbnail_url: '',
        gasto_cents: rnd(20000, 300000), receita_cents: rnd(0, 900000), pedidos: rnd(0, 14),
        alcance: rnd(4000, 90000), frequencia: rnd(10, 32) / 10, cliques: rnd(80, 2400),
        sessoes: rnd(60, 2000), ctr: rnd(8, 34) / 10,
      })) };
    }
    return {};
  }

  // ---------- renderizadores ----------
  const R = {};

  R.home = (d) => {
    $('#home-kpis').innerHTML = d.kpis.map(kpiTile).join('');
    $('#home-canais').innerHTML = tabela([
      { titulo: 'Canal', render: (l) => esc(l.canal) },
      { titulo: 'Receita', num: true, render: (l) => fmtBRL(l.receita_cents) },
      { titulo: 'Tx conv.', num: true, render: (l) => fmtPct(l.tx_conversao) },
      { titulo: 'Δ', num: true, render: (l) => deltaChip(l.delta_pct) },
    ], d.canais);
    $('#home-produtos').innerHTML = tabela([
      { titulo: 'Produto', render: (l) => esc(l.produto) },
      { titulo: 'Receita', num: true, render: (l) => fmtBRL(l.receita_cents) },
    ], d.produtos);
  };

  R.funil = (d) => {
    const max = Math.max(...d.etapas.map((e) => e.valor), 1);
    $('#funil-etapas').innerHTML = d.etapas.map((e) => `
      <div class="etapa">
        <div class="nome">${esc(e.nome)}</div>
        <div class="barra"><i style="width:${Math.max((e.valor / max) * 100, 0.5)}%"></i><span>${fmtInt(e.valor)}</span></div>
        <div class="taxa"></div>
      </div>`).join('');
    // taxas etapa a etapa na coluna direita
    const taxas = $('#funil-etapas').querySelectorAll('.taxa');
    for (let i = 1; i < d.etapas.length; i++) {
      const t = (d.etapas[i].valor / (d.etapas[i - 1].valor || 1)) * 100;
      taxas[i].innerHTML = `<b>${fmtNum(t)}%</b> da etapa anterior`;
    }
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
      { titulo: rotulo, render: (l) => esc(l.nome) },
      { titulo: 'Usuários', num: true, render: (l) => fmtInt(l.usuarios) },
      { titulo: 'Novos', num: true, render: (l) => fmtInt(l.novos) },
      { titulo: 'Tx conv.', num: true, render: (l) => fmtPct(l.tx_conversao) },
      { titulo: 'Pedidos', num: true, render: (l) => fmtInt(l.pedidos) },
      { titulo: 'Ticket', num: true, render: (l) => fmtBRL(l.ticket_cents) },
      { titulo: 'Receita', num: true, render: (l) => fmtBRL(l.receita_cents) },
      { titulo: 'Δ receita', num: true, render: (l) => deltaChip(l.delta_pct) },
    ];
    $('#conv-canais').innerHTML = tabela(cols('Canal'), d.canais);
    $('#conv-origem').innerHTML = tabela(cols('Origem / Mídia'), d.origem_midia);
  };

  R.produtos = (d) => {
    $('#produtos-tabela').innerHTML = tabela([
      { titulo: 'Produto', render: (l) => esc(l.produto) },
      { titulo: 'Pedidos', num: true, render: (l) => fmtInt(l.pedidos) },
      { titulo: 'Receita', num: true, render: (l) => fmtBRL(l.receita_cents) },
    ], d.produtos);
  };

  R.metas = (d) => {
    $('#metas-kpis').innerHTML = d.kpis.map(kpiTile).join('');
    $('#metas-tabela').innerHTML = tabela([
      { titulo: 'Data', render: (l) => dataBR(l.data) },
      { titulo: 'Projetado', num: true, render: (l) => fmtBRL(l.projetado_cents) },
      { titulo: 'Realizado', num: true, render: (l) => fmtBRL(l.realizado_cents) },
      { titulo: 'Investido', num: true, render: (l) => fmtBRL(l.gasto_cents) },
      { titulo: 'Sessões', num: true, render: (l) => fmtInt(l.sessoes) },
      { titulo: 'Pedidos', num: true, render: (l) => fmtInt(l.pedidos) },
      { titulo: 'ROAS', num: true, render: (l) => fmtNum(l.roas) },
    ], d.diario);
  };

  R.criativos = (d) => {
    $('#criativos-tabela').innerHTML = tabela([
      { titulo: '', render: (l) => l.thumbnail_url ? `<img class="thumb" src="${esc(l.thumbnail_url)}" alt="" loading="lazy" />` : '<div class="thumb"></div>' },
      { titulo: 'Criativo', render: (l) => esc(l.ad_nome) },
      { titulo: 'Investimento', num: true, render: (l) => fmtBRL(l.gasto_cents) },
      { titulo: 'Receita', num: true, render: (l) => fmtBRL(l.receita_cents) },
      { titulo: 'Pedidos', num: true, render: (l) => fmtInt(l.pedidos) },
      { titulo: 'Alcance', num: true, render: (l) => fmtInt(l.alcance) },
      { titulo: 'Freq.', num: true, render: (l) => fmtNum(l.frequencia) },
      { titulo: 'Cliques', num: true, render: (l) => fmtInt(l.cliques) },
      { titulo: 'Sessões', num: true, render: (l) => fmtInt(l.sessoes) },
      { titulo: 'CTR', num: true, render: (l) => fmtPct(l.ctr) },
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
