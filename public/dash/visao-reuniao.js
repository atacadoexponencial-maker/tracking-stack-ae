// Visão geral da reunião semanal (spec-visao-geral-reuniao-semanal.md, série S4).
//
// Desenho em funil (ajuste de 26/10): Leads novos → MQL (SE) → SQL → Reunião
// agendada → Reunião realizada, com o número e a variação à esquerda, o custo
// da etapa à direita e as taxas de passagem entre as faixas. Ao lado, o
// investimento, os leads e o CPL de todos os canais e os níveis de
// qualificação da SE. Embaixo, a tabela com o mesmo funil para cada funil.
//
// Sem conta nova: as mesmas da Visão geral antiga (aba Detalhado) — soma dos
// funnelCounts de /api/leads, investimento do Meta (/api/attribution) ou do
// funil (/api/cpl), leads novos, reuniões, custos de reunião e entradas nos
// grupos do /api/cpl, MQLs, SQLs, taxas e qualificação do /api/agenda/taxas.
// Qual funil tem MQL vem do backend (`mql_funil`).
//
// O index.html chama `VisaoReuniao.montarNumeros(respostas, ctx)` e depois
// `VisaoReuniao.desenhar(raiz, dados, ctx)`. respostas: { leadsA, leadsB,
// cplA, cplB, atrA, atrB, taxas, fSel, quando } (taxas: undefined = ainda
// lendo o CRM; null = falhou). ctx: { esc, fmtInt, fmtNum, fmtPct, money,
// tile, tabela, comparar, delta, deltaChip }.
(() => {
  'use strict';

  const SEM_CRM = 'sem dados do CRM';
  const LENDO = 'lendo o CRM…';
  const SO_SE = 'só Sessão Estratégica';
  const MQL_FUNIL_PADRAO = 'sessao-estrategica';
  const vazio = (v) => v === null || v === undefined;

  // ---------------------------------------------------------------------------
  // Montagem: o funil completo de um recorte (total ou um funil), num lado
  // ('a' = período escolhido, 'b' = anterior).
  // ---------------------------------------------------------------------------
  function recorte(r, f, lado) {
    const leadsResp = lado === 'a' ? r.leadsA : r.leadsB;
    const cpl = lado === 'a' ? r.cplA : r.cplB;
    const atr = lado === 'a' ? r.atrA : r.atrB;
    const tx = r.taxas ? r.taxas[lado === 'a' ? 'atual' : 'anterior'] : null;
    const linha = (fn) => ((cpl && cpl.por_funil) || []).find((x) => x.funnel === fn);
    const gastoDe = (fn) => { const l = linha(fn); return l && l.spend > 0 ? l.spend : null; };
    const div = (g, n) => (g > 0 && n > 0 ? g / n : null);
    const par = (num, den) => (vazio(num) || vazio(den) ? null : { num, den });

    const leads = ((leadsResp && leadsResp.funnelCounts) || [])
      .filter((c) => !f || (c.funnel || '') === f)
      .reduce((t, c) => t + Number(c.count || 0), 0);
    const gasto = f ? gastoDe(f) : (atr && atr.meta_spend > 0 ? atr.meta_spend : null);
    const novos = !cpl ? null : f ? ((linha(f) || {}).leads_novos || 0) : (cpl.total_leads_novos || 0);
    const reun = !cpl || !cpl.reunioes ? null
      : f ? (cpl.reunioes.por_funil[f] || { agendadas: 0, realizadas: 0, custo_agendada: null, custo_realizada: null })
        : cpl.reunioes.total;

    const mf = (tx && tx.mql_funil) || MQL_FUNIL_PADRAO;
    const mqlAplica = !f || f === mf;
    const crm = tx && tx.crm ? tx.crm : null;
    const crmF = crm ? (f ? crm[f] || { mqls: 0, sqls: 0, leads_novos: 0 } : tx.crm_total) : null;
    const crmSe = crm ? crm[mf] || { mqls: 0, leads_novos: 0 } : null;
    const mqls = mqlAplica && crmSe ? crmSe.mqls : null;
    const sqls = crmF ? crmF.sqls || 0 : null;
    const ag = tx ? (f ? (tx.por_funil || {})[f] : tx.total) : null;
    const grupos = f && cpl && cpl.entradas_grupos && f in cpl.entradas_grupos ? cpl.entradas_grupos[f] : null;

    return {
      gasto, leads, cpl: div(gasto, leads),
      novos, cpl_novos: div(gasto, novos),
      mqls, custo_mql: div(f ? gasto : gastoDe(mf), mqls),
      sqls, custo_sql: div(gasto, sqls),
      agendadas: reun ? reun.agendadas : null, custo_agendada: reun ? reun.custo_agendada : null,
      realizadas: reun ? reun.realizadas : null, custo_realizada: reun ? reun.custo_realizada : null,
      lead_mql: mqlAplica && crmSe ? par(crmSe.mqls, crmSe.leads_novos) : null,
      mql_ra: ag ? par(ag.mqls_com_reuniao, ag.mqls) : null,
      ra_rr: ag ? par(ag.realizadas, ag.ocorridas) : null,
      grupos, mql_aplica: mqlAplica,
    };
  }

  function montarNumeros(r, ctx) {
    const { esc, fmtInt, fmtNum, money, delta } = ctx;
    const f = r.fSel || '';
    const a = recorte(r, f, 'a'), b = recorte(r, f, 'b');
    const lido = r.taxas === undefined ? null : !!(r.taxas && r.taxas.atual && r.taxas.atual.crm_lido);
    const funis = ((r.leadsA && r.leadsA.funnelCounts) || [])
      .filter((c) => !f || (c.funnel || '') === f)
      .sort((x, y) => Number(y.count || 0) - Number(x.count || 0))
      .map((c) => ({ funil: c.funnel || '', a: recorte(r, c.funnel || '', 'a'), b: recorte(r, c.funnel || '', 'b') }));
    const qf = (r.taxas && r.taxas.atual && r.taxas.atual.qualificacao_funil) || MQL_FUNIL_PADRAO;
    const d = delta(a.leads, b.leads);
    const manchete = `<strong>${fmtInt(a.leads)} leads</strong> ${esc(r.quando)}`
      + (f ? ` no funil ${esc(f)}` : '')
      + (d !== null && isFinite(d) ? `, ${d === 0 ? 'o mesmo que' : `${fmtNum(Math.abs(d), 0)}% ${d > 0 ? 'a mais que' : 'a menos que'}`} no período anterior` : '')
      + (a.cpl !== null ? `, com CPL de <strong>${money(a.cpl)}</strong>` : '') + '.';
    return {
      manchete,
      crm_lido: lido,
      a, b,
      por_funil: funis,
      // Níveis de qualificação: só sem filtro ou no funil da qualificação.
      qualificacao: r.taxas === undefined || (f && f !== qf) ? null
        : lido ? { a: r.taxas.atual.qualificacao, b: r.taxas.anterior ? r.taxas.anterior.qualificacao : null } : {},
      nota_gasto: f ? 'sem investimento no funil' : 'precisa do sync de investimento',
    };
  }

  // ---------------------------------------------------------------------------
  // Desenho
  // ---------------------------------------------------------------------------
  // Variação pequena (▲ 25%) contra o período anterior; nos custos, subir é ruim.
  // Taxas variam em pontos percentuais.
  function variacao(x, y, { invertido = false, pp = false, delta, fmtNum }) {
    if (vazio(x) || vazio(y)) return '';
    const v = pp ? x - y : y ? delta(x, y) : null;
    if (v === null || !isFinite(v)) return '';
    const cls = v === 0 ? 'neutro' : (v > 0) !== invertido ? 'alta' : 'queda';
    return `<span class="vr-var vr-var--${cls}">${v === 0 ? '=' : v > 0 ? '▲' : '▼'} ${fmtNum(Math.abs(v), pp ? 0 : 1)}${pp ? ' p.p.' : '%'}</span>`;
  }
  const pctDe = (t) => (t && t.den > 0 ? (t.num / t.den) * 100 : null);

  function funil(d, ctx) {
    const { fmtInt, fmtPct, money, delta, fmtNum } = ctx;
    const { a, b } = d;
    const vr = { delta, fmtNum };
    // Estado do CRM nas etapas que dependem dele.
    const doCrm = (valor) => (d.crm_lido === false ? { nota: SEM_CRM } : d.crm_lido === null ? { nota: LENDO } : valor);
    const ETAPAS = [
      { rotulo: 'Leads novos', k: 'novos', custo: 'cpl_novos', rotCusto: 'CPL lead novo', nota: 'card novo no CRM' },
      { rotulo: 'MQL', sub: 'Sessão Estratégica', k: 'mqls', custo: 'custo_mql', rotCusto: 'por MQL', crm: true, so_se: true },
      { rotulo: 'SQL', k: 'sqls', custo: 'custo_sql', rotCusto: 'por SQL', crm: true },
      { rotulo: 'Reunião agendada', k: 'agendadas', custo: 'custo_agendada', rotCusto: 'por reunião agendada', nota: 'pela data em que agendou' },
      { rotulo: 'Reunião realizada', k: 'realizadas', custo: 'custo_realizada', rotCusto: 'por reunião realizada', nota: 'pela data da reunião' },
    ];
    // Passagem depois de cada etapa (índice da etapa de cima).
    const PASSAGENS = { 0: ['lead_mql', 'Lead → MQL', 'Sessão Estratégica'], 2: ['mql_ra', 'MQL → RA', 'dos MQLs, quantos agendaram'], 3: ['ra_rr', 'RA → RR', 'das que já passaram'] };
    const LARGURAS = [100, 88, 76, 64, 52];
    const etapa = (e, i) => {
      let nota = e.nota || '';
      let num = vazio(a[e.k]) ? '<span class="semdado">—</span>' : fmtInt(a[e.k]);
      let custo = vazio(a[e.custo]) ? '<span class="semdado">—</span>' : money(a[e.custo]);
      if (e.so_se && !a.mql_aplica) { num = '<span class="semdado">—</span>'; custo = num; nota = SO_SE; }
      else if (e.crm) {
        const s = doCrm(null);
        if (s) { num = '<span class="semdado">—</span>'; custo = num; nota = s.nota; }
      }
      const comNumero = !num.includes('semdado');
      return `<div class="vr-etapa" style="--vr-largura:${LARGURAS[i]}%">
        <div class="vr-etapa__num"><b>${num}</b>${comNumero ? variacao(a[e.k], b[e.k], vr) : ''}</div>
        <div class="vr-etapa__faixa"><span>${e.rotulo}${e.sub ? ` <small>${e.sub}</small>` : ''}</span></div>
        <div class="vr-etapa__custo"><small>${e.rotCusto}</small><b>${custo}</b>${comNumero ? variacao(a[e.custo], b[e.custo], { ...vr, invertido: true }) : ''}</div>
        ${nota ? `<p class="vr-etapa__nota">${nota}</p>` : ''}
      </div>`;
    };
    const passagem = (i) => {
      const p = PASSAGENS[i];
      if (!p) return '';
      const [k, rotulo, explica] = p;
      const semCrm = k !== 'ra_rr' && d.crm_lido !== true;
      const soSe = k === 'lead_mql' && !a.mql_aplica;
      const t = a[k], v = pctDe(t);
      const valor = soSe || semCrm || v === null ? '—' : fmtPct(v, 0);
      const detalhe = soSe ? SO_SE : semCrm ? (d.crm_lido === null ? LENDO : SEM_CRM) : t ? `${fmtInt(t.num)} de ${fmtInt(t.den)} · ${explica}` : explica;
      return `<div class="vr-passagem"><span class="vr-passagem__seta" aria-hidden="true">↓</span>
        <b>${valor}</b> <span class="vr-passagem__rotulo">${rotulo}</span>
        ${valor !== '—' ? variacao(v, pctDe(b[k]), { ...vr, pp: true }) : ''}
        <small>${detalhe}</small></div>`;
    };
    return `<div class="vr-funil" aria-label="Funil do período">${ETAPAS.map((e, i) => etapa(e, i) + passagem(i)).join('')}</div>`;
  }

  function lateral(d, ctx) {
    const { fmtInt, money, tile, comparar, delta } = ctx;
    const { a, b } = d;
    const um = (rotulo, k, fmt, extra = {}) => ({
      rotulo, valor: vazio(a[k]) ? null : fmt(a[k]),
      delta: !vazio(a[k]) && b[k] ? delta(a[k], b[k]) : undefined,
      ...comparar(a[k], b[k], fmt), ...extra,
    });
    const quadros = [
      um('Investimento em ads', 'gasto', money, { neutro: true, nota: vazio(a.gasto) ? d.nota_gasto : '' }),
      um('Leads', 'leads', fmtInt, { nota: 'todos, novos e que voltaram' }),
      um('CPL', 'cpl', money, { invertido: true, nota: vazio(a.cpl) ? d.nota_gasto : 'todos os leads' }),
    ];
    return `<aside class="vr-lateral">
      <div class="vr-lateral__quadros">${quadros.map((k) => tile(k)).join('')}</div>
      ${d.qualificacao ? qualificacao(d.qualificacao, ctx, d.crm_lido) : ''}
    </aside>`;
  }

  function qualificacao(q, ctx, crmLido) {
    const { fmtInt, fmtPct, delta, fmtNum } = ctx;
    const cab = '<h2>Níveis de qualificação <small>leads novos da Sessão Estratégica · faturamento mensal no CRM</small></h2>';
    if (crmLido === false || !q.a) return `<div class="bloco vr-qualif">${cab}<p class="mini">${crmLido === false ? SEM_CRM : LENDO}</p></div>`;
    const qa = q.a, qb = q.b;
    const pct = (x, k) => (x && x.total ? (x[k] / x.total) * 100 : 0);
    const FAIXAS = [['abaixo', 'Abaixo de R$ 20 mil'], ['acima', 'Acima de R$ 20 mil'], ['nao_informado', 'Não informado']];
    const ant = (k) => (qb ? `<small class="vr-ant">ant. ${fmtInt(qb[k])}</small>` : '');
    if (!qa.total) return `<div class="bloco vr-qualif">${cab}<p class="mini">Nenhum lead novo de Sessão Estratégica no período.${qb ? ` Anterior: ${fmtInt(qb.total)}.` : ''}</p></div>`;
    return `<div class="bloco vr-qualif">${cab}
      ${FAIXAS.map(([k, r]) => `<div class="vr-faixa">
        <span class="vr-faixa__rotulo">${r}</span>
        <div class="regua" role="img" aria-label="${r}: ${fmtPct(pct(qa, k), 0)}"><i style="width:${pct(qa, k).toFixed(1)}%"></i></div>
        <span class="vr-faixa__num">${fmtInt(qa[k])} <small>${fmtPct(pct(qa, k), 0)}</small> ${qb ? variacao(qa[k], qb[k], { delta, fmtNum }) : ''} ${ant(k)}</span>
      </div>`).join('')}
      <p class="mini">${fmtInt(qa.total)} leads novos de Sessão Estratégica no período ${qb ? variacao(qa.total, qb.total, { delta, fmtNum }) : ''} ${qb ? `· anterior: ${fmtInt(qb.total)}` : ''}</p>
    </div>`;
  }

  // Tabela larga: o mesmo funil, uma linha por funil, com a variação embaixo.
  function tabelaFunis(el, linhas, ctx, crmLido) {
    const { esc, fmtInt, fmtPct, money, tabela, delta, fmtNum } = ctx;
    const vr = { delta, fmtNum };
    const traco = '<span class="semdado">—</span>';
    const cel = (r, k, fmt, opts = {}) => {
      const x = r.a[k];
      if (opts.crm && crmLido !== true) return traco;
      if (vazio(x)) return opts.vazio === '' ? '' : traco;
      return `${fmt(x)}<br>${variacao(x, r.b[k], { ...vr, ...opts })}`;
    };
    const taxa = (r, k) => {
      const v = pctDe(r.a[k]);
      if ((k !== 'ra_rr' && crmLido !== true) || v === null) return traco;
      return `${fmtPct(v, 0)}<br>${variacao(v, pctDe(r.b[k]), { ...vr, pp: true })}`;
    };
    const COLS = [
      { titulo: 'Funil', campo: 'funil', render: (r) => `<b>${esc(r.funil || '(sem funil)')}</b>` },
      { titulo: 'Investimento', campo: 'gasto', render: (r) => cel(r, 'gasto', money, { neutro: true }) },
      { titulo: 'Leads', campo: 'leads', render: (r) => cel(r, 'leads', fmtInt) },
      { titulo: 'Leads novos', campo: 'novos', render: (r) => cel(r, 'novos', fmtInt) },
      { titulo: 'CPL', campo: 'cpl', render: (r) => cel(r, 'cpl', money, { invertido: true }) },
      { titulo: 'CPL lead novo', campo: 'cpl_novos', render: (r) => cel(r, 'cpl_novos', money, { invertido: true }) },
      { titulo: 'MQL', campo: 'mqls', render: (r) => cel(r, 'mqls', fmtInt, { crm: true }) },
      { titulo: 'SQL', campo: 'sqls', render: (r) => cel(r, 'sqls', fmtInt, { crm: true }) },
      { titulo: 'Reunião agendada', campo: 'agendadas', render: (r) => cel(r, 'agendadas', fmtInt) },
      { titulo: 'Reunião realizada', campo: 'realizadas', render: (r) => cel(r, 'realizadas', fmtInt) },
      { titulo: 'Custo por MQL', campo: 'custo_mql', render: (r) => cel(r, 'custo_mql', money, { invertido: true, crm: true }) },
      { titulo: 'Custo por SQL', campo: 'custo_sql', render: (r) => cel(r, 'custo_sql', money, { invertido: true, crm: true }) },
      { titulo: 'Custo por reunião agendada', campo: 'custo_agendada', render: (r) => cel(r, 'custo_agendada', money, { invertido: true }) },
      { titulo: 'Custo por reunião realizada', campo: 'custo_realizada', render: (r) => cel(r, 'custo_realizada', money, { invertido: true }) },
      { titulo: 'Lead → MQL', campo: 'lead_mql', render: (r) => taxa(r, 'lead_mql') },
      { titulo: 'MQL → RA', campo: 'mql_ra', render: (r) => taxa(r, 'mql_ra') },
      { titulo: 'RA → RR', campo: 'ra_rr', render: (r) => taxa(r, 'ra_rr') },
      { titulo: 'Entraram nos grupos', campo: 'grupos', render: (r) => cel(r, 'grupos', fmtInt, { vazio: '' }) },
    ].map((c, i) => (i ? { ...c, num: true } : c));
    tabela(el, COLS, linhas, undefined, 'Nenhum lead no período. Aqui aparece um funil por linha, com a comparação ao período anterior.');
  }

  function desenhar(raiz, d, ctx) {
    raiz.innerHTML = `
      ${d.manchete ? `<p class="manchete">${d.manchete}</p>` : ''}
      <div class="vr-topo">${funil(d, ctx)}${lateral(d, ctx)}</div>
      <div class="bloco"><h2>Por funil <small>o mesmo funil para cada um · variação contra o período anterior</small></h2><div class="tabela-wrap vr-tabela" id="vr-funis"></div></div>`;
    tabelaFunis(raiz.querySelector('#vr-funis'), d.por_funil || [], ctx, d.crm_lido);
  }

  window.VisaoReuniao = { desenhar, montarNumeros };
})();
