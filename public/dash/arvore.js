// Aba Árvore: a árvore de métricas de cada funil, da venda ao criativo
// (spec-arvore-metricas.md, série S5).
//
// PROTÓTIPO S5-01: números de exemplo fixos, para aprovar o desenho. Da S5-02
// em diante os exemplos saem e entra a resposta do backend, que já vem com
// tudo calculado (taxas, precisa/tem, gargalo); aqui só se desenha.
//
// O index.html chama `ArvoreMetricas.abrir(raiz, ctx)` quando a aba aparece;
// ctx traz { esc, fmtInt, fmtPct, fmtNum, money } do próprio dash.
(() => {
  'use strict';

  // ── Números de exemplo (forma da futura resposta do backend) ──────────
  // Cada etapa do tronco: `tem` = coorte do período; `taxa` = da etapa
  // anterior na coorte; `hist` = taxa histórica do 🎯 CON; `precisa` = conta
  // de trás pra frente com as taxas históricas; `gargalo` marcado pelo backend.
  const EXEMPLOS = {
    se: {
      nome: 'SE',
      topo: { meta: 6, esperadas: 4.1, compras_con: 5, arrecadado_con: 47600, rr_compra: 34, ticket: 10100, base: 'abr–set/2026', base_meses: 6 },
      tronco: [
        { rotulo: 'Lead', nota: 'card novo no CRM', tem: 91, precisa: 99 },
        { rotulo: 'MQL', tem: 65, taxa: 71, hist: 65, precisa: 64 },
        { rotulo: 'Agendou', tem: 33, taxa: 51, hist: 55, precisa: 35 },
        { rotulo: 'Compareceu', tem: 12, taxa: 36, hist: 50, precisa: 18, gargalo: true },
        { rotulo: 'SQL', nota: 'só informação: a venda sai de quem compareceu', tem: 10, taxa: 83, info: true },
      ],
      investimento: { tem: 5262, precisa: 5922, cpl_hist: 59.82 },
      anuncio: { investimento: 5262, impressoes: 263100, cpm: 20.0, hook: 24, hold: 11, ctr: 0.9, cliques: 2368, cpc: 2.22, cpl: 57.82, custo_mql: 80.95 },
      pagina: { cliques: 2368, visitas: 1610, connect: 68, cta: 22, form_ini: 140, form_fim: 91, form: 65, leads: 91, conversao: 5.7 },
      anuncios: [
        { campanha: '[SE] Captação · Vídeos', anuncio: 'Varejo disfarçado 01', investimento: 1980, impressoes: 98200, cpm: 20.16, hook: 27, hold: 12, ctr: 1.1, cpc: 1.83, connect: 71, leads: 41, cpl: 48.29, mqls: 30, custo_mql: 66.0 },
        { campanha: '[SE] Captação · Vídeos', anuncio: 'Só chega varejo 03', investimento: 1420, impressoes: 71000, cpm: 20.0, hook: 22, hold: 9, ctr: 0.8, cpc: 2.5, connect: 66, leads: 22, cpl: 64.55, mqls: 15, custo_mql: 94.67 },
        { campanha: '[SE] Captação · Vídeos', anuncio: 'Depoimento Carla', investimento: 640, impressoes: 30100, cpm: 21.26, hook: 31, hold: 15, ctr: 1.0, cpc: 2.13, connect: 70, leads: 11, cpl: 58.18, mqls: 8, custo_mql: 80.0 },
        { campanha: '[SE] Remarketing', anuncio: 'Carrossel 4 erros', investimento: 702, impressoes: 36900, cpm: 19.02, hook: null, hold: null, ctr: 0.7, cpc: 2.72, connect: 62, leads: 8, cpl: 87.75, mqls: 5, custo_mql: 140.4 },
        { campanha: '[SE] Remarketing', anuncio: 'Vídeo bastidores', investimento: 520, impressoes: 26900, cpm: 19.33, hook: 18, hold: 8, ctr: 0.6, cpc: 3.25, connect: 64, leads: 5, cpl: 104.0, mqls: 3, custo_mql: 173.33 },
        { campanha: 'sem anúncio identificado', anuncio: '', sem: true, leads: 4, mqls: 4 },
      ],
    },
    aquisicao: {
      nome: 'AQUISIÇÃO',
      topo: { meta: 3, esperadas: 1.8, compras_con: 2, arrecadado_con: 19400, rr_compra: 26, ticket: 9700, base: 'abr–set/2026', base_meses: 6 },
      tronco: [
        { rotulo: 'Lead', nota: 'formulário completo, sem tráfego pago', tem: 55, precisa: 74 },
        { rotulo: 'MQL', tem: 30, taxa: 55, hist: 60, precisa: 44 },
        { rotulo: 'Agendou', tem: 14, taxa: 47, hist: 52, precisa: 23, gargalo: true },
        { rotulo: 'Compareceu', tem: 7, taxa: 50, hist: 50, precisa: 12 },
        { rotulo: 'SQL', nota: 'só informação: a venda sai de quem compareceu', tem: 5, taxa: 71, info: true },
      ],
      investimento: null,
      anuncio: null,
      pagina: { cliques: null, visitas: 940, connect: null, cta: 14, form_ini: 88, form_fim: 55, form: 63, leads: 55, conversao: 5.9 },
      anuncios: [],
    },
    wo: {
      nome: 'WO PAGO',
      topo: { meta: 2, esperadas: 1.2, compras_con: 1, arrecadado_con: 9800, rr_compra: 20, ticket: 9800, base: 'abr–set/2026', base_meses: 6 },
      tronco: [
        { rotulo: 'Comprou o workshop', nota: 'compras pagas na Greenn', tem: 48, precisa: 83 },
        { rotulo: 'Entrou no grupo', tem: 41, taxa: 85, hist: 88, precisa: 73 },
        { rotulo: 'Agendou', tem: 9, taxa: 22, hist: 25, precisa: 18, gargalo: true },
        { rotulo: 'Compareceu', tem: 6, taxa: 67, hist: 55, precisa: 10 },
        { rotulo: 'SQL', nota: 'só informação: a venda sai de quem compareceu', tem: 3, taxa: 50, info: true },
      ],
      investimento: { tem: 2160, precisa: 3735, cpl_hist: 45.0 },
      anuncio: { investimento: 2160, impressoes: 144000, cpm: 15.0, hook: 19, hold: 7, ctr: 1.3, cliques: 1872, cpc: 1.15, cpl: 45.0, custo_mql: null },
      pagina: { cliques: 1872, visitas: 1385, connect: 74, cta: 9, form_ini: 96, form_fim: 48, form: 50, leads: 48, conversao: 3.5 },
      anuncios: [
        { campanha: '[WO] Workshop pago · Vídeos', anuncio: 'Convite Felipe 02', investimento: 1310, impressoes: 84000, cpm: 15.6, hook: 21, hold: 8, ctr: 1.4, cpc: 1.11, connect: 75, leads: 31, cpl: 42.26, mqls: null, custo_mql: null },
        { campanha: '[WO] Workshop pago · Vídeos', anuncio: 'Antes e depois', investimento: 850, impressoes: 60000, cpm: 14.17, hook: 16, hold: 6, ctr: 1.2, cpc: 1.18, connect: 72, leads: 17, cpl: 50.0, mqls: null, custo_mql: null },
      ],
    },
  };

  const CENARIOS = [
    ['normal', 'Normal'],
    ['sem-meta', 'Sem meta no 🎯 CON'],
    ['coorte-jovem', 'Coorte jovem'],
    ['sem-video', 'Anúncios sem vídeo'],
    ['sem-pagina', 'Funil sem página'],
    ['sem-dado', 'Taxa sem dado'],
    ['base-curta', 'Base de 2 meses'],
  ];

  // Aplica o cenário escolhido no selo de protótipo sobre uma cópia do exemplo.
  function comCenario(base, c) {
    const d = JSON.parse(JSON.stringify(base));
    if (c === 'sem-meta') d.topo.meta = null;
    if (c === 'coorte-jovem') d.coorte_jovem = true;
    if (c === 'sem-video' && d.anuncio) {
      d.anuncio.hook = null; d.anuncio.hold = null;
      d.anuncios.forEach((a) => { if (!a.sem) { a.hook = null; a.hold = null; } });
    }
    if (c === 'sem-pagina') d.pagina = null;
    if (c === 'sem-dado') {
      d.tronco[3].taxa = null; d.tronco[3].hist = null;
      d.tronco.forEach((e, i) => { if (i < 3) e.precisa = null; e.gargalo = false; });
      d.sem_base_de = 3;
      if (d.investimento) d.investimento.precisa = null;
    }
    if (c === 'base-curta') { d.topo.base = 'ago–set/2026'; d.topo.base_meses = 2; }
    return d;
  }

  const estado = { funil: 'se', cenario: 'normal', lista: false, ordem: { col: null, asc: true } };

  function desenhar(raiz, ctx) {
    const { esc, fmtInt, fmtPct, fmtNum, money } = ctx;
    const d = comCenario(EXEMPLOS[estado.funil], estado.cenario);
    const sem = (t = '—') => `<span class="semdado">${esc(t)}</span>`;
    const pct = (v, c = 0) => (v === null || v === undefined ? sem() : fmtPct(v, c));
    const brl = (v) => (v === null || v === undefined ? sem() : money(v));
    const num = (v) => (v === null || v === undefined ? sem() : fmtInt(v));
    const temMeta = d.topo.meta !== null;

    const proto = `<div class="em-proto">
      <span class="em-proto__selo">Protótipo</span>
      <span>números de exemplo · o filtro de datas ainda não muda nada aqui</span>
      <label class="em-proto__cen">cenário
        <select data-av-cenario>${CENARIOS.map(([k, r]) => `<option value="${k}"${k === estado.cenario ? ' selected' : ''}>${esc(r)}</option>`).join('')}</select>
      </label>
    </div>`;

    const funis = `<div class="av-funis" role="group" aria-label="Funil">${Object.entries(EXEMPLOS).map(([k, f]) =>
      `<button type="button" data-av-funil="${k}" aria-pressed="${k === estado.funil}">${esc(f.nome)}</button>`).join('')}</div>`;

    const aviso = d.coorte_jovem
      ? '<div class="aviso alerta">O período termina há menos de 14 dias: parte dos leads ainda pode agendar, comparecer ou virar SQL. Os números do tronco tendem a subir.</div>'
      : '';

    // Topo: a meta e o que a árvore espera vender.
    const t = d.topo;
    const baseNota = `base: ${esc(t.base)}${t.base_meses < 6 ? ` · <b>base de ${t.base_meses} meses</b>` : ''}`;
    const topo = `<div class="bloco">
      <h2>Vendas <small>meta e compras do 🎯 CON · vendas esperadas pela árvore</small></h2>
      <div class="grid-etiquetas">
        <div class="etiqueta heroi"><div class="ref">Meta de vendas</div><div class="valor">${temMeta ? fmtInt(t.meta) : sem('sem meta')}</div>
          <div class="rodape"><span class="nota">${temMeta ? '#META do 🎯 CON, proporcional aos dias' : 'card do mês sem #META'}</span></div></div>
        <div class="etiqueta"><div class="ref">Vendas esperadas</div><div class="valor">${fmtNum(t.esperadas, 1)}</div>
          <div class="rodape"><span class="carimbo neutro">estimativa</span><span class="nota">compareceu × RR → Compra</span></div></div>
        <div class="etiqueta"><div class="ref">Vendas no 🎯 CON</div><div class="valor">${fmtInt(t.compras_con)}</div>
          <div class="rodape"><span class="nota">${money(t.arrecadado_con)} arrecadados</span></div></div>
        <div class="etiqueta"><div class="ref">RR → Compra</div><div class="valor">${fmtPct(t.rr_compra, 0)}</div>
          <div class="rodape"><span class="nota">${baseNota}</span></div></div>
        <div class="etiqueta"><div class="ref">Ticket médio</div><div class="valor">${money(t.ticket)}</div>
          <div class="rodape"><span class="nota">${baseNota}</span></div></div>
      </div>
    </div>`;

    // Tronco: faixas como o funil da Visão geral; à direita, precisa · tem · faltam.
    const LARGURAS = [100, 86, 72, 58, 46];
    const precisaTem = (e, i) => {
      if (e.info) return '<small>fora da conta da meta</small>';
      if (!temMeta) return '<small>sem meta</small>';
      if (d.sem_base_de !== undefined && i < d.sem_base_de) return `<small>${sem('sem base para calcular')}</small>`;
      if (e.precisa === null || e.precisa === undefined) return `<small>${sem('sem base para calcular')}</small>`;
      const falta = e.precisa - e.tem;
      return `<small>precisa ${fmtInt(e.precisa)} · tem ${fmtInt(e.tem)}</small><b class="${falta > 0 ? 'av-falta' : 'av-sobra'}">${falta > 0 ? `faltam ${fmtInt(falta)}` : `sobram ${fmtInt(-falta)}`}</b>`;
    };
    const passagem = (e) => (e.taxa === undefined ? '' : `<div class="vr-passagem">
        <span class="vr-passagem__seta" aria-hidden="true">↓</span>
        <span class="vr-passagem__rotulo">${e.taxa === null ? sem('sem dado') : fmtPct(e.taxa, 0)}</span>
        ${e.info ? '' : `<span class="mini">histórico ${e.hist === null ? 'sem dado' : fmtPct(e.hist, 0)}</span>`}
      </div>`);
    const etapas = d.tronco.map((e, i) => `${passagem(e)}
      <div class="vr-etapa av-etapa${e.gargalo && temMeta ? ' av-gargalo' : ''}${e.info ? ' av-info' : ''}" style="--vr-largura:${LARGURAS[i]}%">
        <div class="vr-etapa__nome"><b>${esc(e.rotulo)}</b>${e.nota ? `<small>${esc(e.nota)}</small>` : ''}${e.gargalo && temMeta ? '<span class="carimbo queda">gargalo</span>' : ''}</div>
        <div class="vr-etapa__faixa"><span><b>${fmtInt(e.tem)}</b></span></div>
        <div class="vr-etapa__custo av-precisa">${precisaTem(e, i)}</div>
      </div>`).join('');
    const inv = d.investimento;
    const linhaInv = !inv ? '' : `<div class="av-investimento">
        <span><b>Investimento</b> <small>leads × CPL histórico (${money(inv.cpl_hist)})</small></span>
        <span class="av-precisa">${!temMeta ? '<small>sem meta</small>' : inv.precisa === null ? `<small>${sem('sem base para calcular')}</small>`
          : `<small>precisa ${money(inv.precisa)} · tem ${money(inv.tem)}</small><b class="${inv.precisa > inv.tem ? 'av-falta' : 'av-sobra'}">${inv.precisa > inv.tem ? `faltam ${money(inv.precisa - inv.tem)}` : `sobram ${money(inv.tem - inv.precisa)}`}</b>`}</span>
      </div>`;
    const tronco = `<div class="bloco">
      <h2>Tronco <small>leads que entraram no período e até onde chegaram até hoje · precisa = meta ÷ taxas históricas dos 6 meses do 🎯 CON</small></h2>
      <div class="vr-funil av-tronco">${etapas}${linhaInv}</div>
    </div>`;

    // Galhos: anúncio (até o clique) e página (do clique ao lead).
    const item = (rot, val, nota = '') => `<div class="av-item"><dt>${rot}</dt><dd>${val}${nota ? ` <small>${nota}</small>` : ''}</dd></div>`;
    const a = d.anuncio;
    const semVideo = a && a.hook === null;
    const galhoAnuncio = !a
      ? `<div class="av-galho"><h3>Anúncio</h3><p class="semdado">funil sem mídia paga</p></div>`
      : `<div class="av-galho"><h3>Anúncio <small>investimento até o clique</small></h3><dl>
          ${item('Investimento', money(a.investimento))}
          ${item('Impressões', fmtInt(a.impressoes))}
          ${item('CPM', money(a.cpm))}
          ${item('Hook rate', semVideo ? sem('sem vídeo') : pct(a.hook), semVideo ? '' : 'viu 3 s ÷ impressões')}
          ${item('Hold rate', semVideo ? sem('sem vídeo') : pct(a.hold), semVideo ? '' : 'viu até o fim ÷ viu 3 s')}
          ${item('CTR do link', pct(a.ctr, 1), `${fmtInt(a.cliques)} cliques no link`)}
          ${item('CPC', money(a.cpc))}
          ${item(estado.funil === 'wo' ? 'Custo por compra' : 'CPL', money(a.cpl))}
          ${a.custo_mql === null ? '' : item('Custo por MQL', money(a.custo_mql))}
        </dl><button type="button" class="mini" data-av-lista>ver por campanha e anúncio →</button></div>`;
    const p = d.pagina;
    const galhoPagina = !p
      ? `<div class="av-galho"><h3>Página</h3><p class="semdado">sem página</p></div>`
      : `<div class="av-galho"><h3>Página <small>do clique ao lead</small></h3><dl>
          ${item('Connect rate', p.connect === null ? sem('sem mídia paga') : pct(p.connect), p.connect === null ? '' : `${fmtInt(p.visitas)} visitas de ${fmtInt(p.cliques)} cliques`)}
          ${item('Clique no CTA', pct(p.cta), 'de quem visitou')}
          ${item('Formulário', pct(p.form), `${fmtInt(p.form_fim)} concluídos de ${fmtInt(p.form_ini)} iniciados`)}
          ${item('Conversão da página', pct(p.conversao, 1), `${fmtInt(p.leads)} de ${fmtInt(p.visitas)} visitas`)}
        </dl>${a ? '<button type="button" class="mini" data-av-lista>ver por campanha e anúncio →</button>' : ''}</div>`;
    const galhos = `<div class="bloco">
      <h2>Galhos <small>de onde vêm os leads do tronco</small></h2>
      <div class="av-galhos">${galhoAnuncio}${galhoPagina}</div>
    </div>`;

    // Lista por campanha e anúncio (ao clicar num galho).
    const COLS = [
      ['investimento', 'Investimento', brl], ['cpm', 'CPM', brl], ['hook', 'Hook', (v) => pct(v)], ['hold', 'Hold', (v) => pct(v)],
      ['ctr', 'CTR do link', (v) => pct(v, 1)], ['cpc', 'CPC', brl], ['connect', 'Connect', (v) => pct(v)],
      ['leads', 'Leads', num], ['cpl', 'CPL', brl], ['mqls', 'MQLs', num], ['custo_mql', 'Custo por MQL', brl],
    ];
    const lista = () => {
      const linhas = d.anuncios.filter((x) => !x.sem);
      const { col, asc } = estado.ordem;
      if (col) linhas.sort((x, y) => ((x[col] ?? Infinity) - (y[col] ?? Infinity)) * (asc ? 1 : -1));
      const semId = d.anuncios.find((x) => x.sem);
      const td = (x) => COLS.map(([k, , f]) => `<td class="num" data-rot="${k}">${x.sem && x[k] === undefined ? '' : f(x[k])}</td>`).join('');
      return `<div class="bloco">
        <h2>${esc(d.nome)} por campanha e anúncio <small>clique no título de uma coluna para ordenar</small></h2>
        <button type="button" class="mini" data-av-voltar>← voltar à árvore</button>
        <div class="tabela-wrap"><table class="av-lista">
          <thead><tr><th>Campanha</th><th>Anúncio</th>${COLS.map(([k, r]) => `<th class="num"><button type="button" data-av-ordem="${k}">${r}${col === k ? (asc ? ' ↑' : ' ↓') : ''}</button></th>`).join('')}</tr></thead>
          <tbody>${linhas.map((x) => `<tr><td>${esc(x.campanha)}</td><td>${esc(x.anuncio)}</td>${td(x)}</tr>`).join('')}
          ${semId ? `<tr class="av-semid"><td colspan="2">sem anúncio identificado</td>${td(semId)}</tr>` : ''}</tbody>
        </table></div>
      </div>`;
    };

    raiz.innerHTML = proto + funis + aviso + (estado.lista ? lista() : topo + tronco + galhos);
  }

  function ligar(raiz, ctx) {
    raiz.addEventListener('click', (ev) => {
      const b = ev.target.closest('button');
      if (!b || !raiz.contains(b)) return;
      if (b.dataset.avFunil) { estado.funil = b.dataset.avFunil; estado.lista = false; estado.ordem = { col: null, asc: true }; }
      else if ('avLista' in b.dataset) estado.lista = true;
      else if ('avVoltar' in b.dataset) estado.lista = false;
      else if (b.dataset.avOrdem) {
        const k = b.dataset.avOrdem;
        estado.ordem = estado.ordem.col === k ? { col: k, asc: !estado.ordem.asc } : { col: k, asc: true };
      } else return;
      desenhar(raiz, ctx);
    });
    raiz.addEventListener('change', (ev) => {
      if (!ev.target.matches('[data-av-cenario]')) return;
      estado.cenario = ev.target.value;
      desenhar(raiz, ctx);
    });
  }

  window.ArvoreMetricas = {
    abrir(raiz, ctx) {
      if (!raiz.dataset.avLigado) { ligar(raiz, ctx); raiz.dataset.avLigado = '1'; }
      desenhar(raiz, ctx);
    },
  };
})();
