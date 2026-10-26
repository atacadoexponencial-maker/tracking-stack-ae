// Visão geral da reunião semanal (spec-visao-geral-reuniao-semanal.md, série S4).
//
// Só desenha. Os números chegam prontos (contas no backend e no index.html,
// as mesmas da Visão geral antiga, que virou a aba Detalhado):
//   numeros:      { leads, leads_novos, cpl, cpl_novos, mqls, sqls, agendadas,
//                   realizadas } — cada um { a, b } (agora e período anterior;
//                   null = sem dado)
//   notas:        { cpl } — nota do CPL quando não há investimento
//   crm_lido:     false = CRM não respondeu (MQLs e SQL "sem dados do CRM");
//                 null = ainda lendo o CRM
//   taxas:        { a, b } — cada um { lead_mql, mql_ra, ra_rr }: { num, den }
//   qualificacao: { abaixo, acima, nao_informado, total } ou null (bloco some)
//   por_funil:    [{ funil, leads, leads_ant, novos, novos_ant, grupos }]
//                 (grupos: null fora do workshop)
//   manchete:     frase do topo, HTML já escapado pelo index
//
// O index.html chama `VisaoReuniao.montarNumeros(respostas, ctx)` e depois
// `VisaoReuniao.desenhar(raiz, dados, ctx)`; ctx traz { esc, fmtInt, fmtNum,
// fmtPct, money, tile, tabela, comparar, delta, deltaChip }.
(() => {
  'use strict';

  const SEM_CRM = 'sem dados do CRM';

  function quadros(d, ctx) {
    const { fmtInt, money, comparar, delta } = ctx;
    const n = d.numeros;
    const dl = (x) => (x.a !== null && x.a !== undefined && x.b ? delta(x.a, x.b) : undefined);
    const um = (rotulo, x, fmt, extra = {}) => ({
      rotulo,
      valor: x.a === null || x.a === undefined ? null : fmt(x.a),
      delta: dl(x),
      ...comparar(x.a, x.b, fmt),
      ...extra,
    });
    const crm = (rotulo, x) => (d.crm_lido === false ? { rotulo, valor: null, nota: SEM_CRM }
      : d.crm_lido === null ? { rotulo, valor: null, nota: 'lendo o CRM…' }
        : um(rotulo, x, fmtInt, { nota: 'status atual no CRM' }));
    return [
      um('Leads', n.leads, fmtInt),
      um('Leads novos', n.leads_novos, fmtInt, { nota: 'card novo no CRM' }),
      um('CPL', n.cpl, money, { invertido: true, nota: n.cpl.a === null ? (d.notas && d.notas.cpl) || '' : 'todos os canais' }),
      um('CPL lead novo', n.cpl_novos, money, { invertido: true, nota: n.cpl_novos.a === null ? (d.notas && d.notas.cpl) || '' : '' }),
      crm('MQLs', n.mqls),
      crm('SQL', n.sqls),
      um('Reunião agendada', n.agendadas, fmtInt, { nota: 'pela data em que agendou' }),
      um('Reunião realizada', n.realizadas, fmtInt, { nota: 'pela data da reunião' }),
    ];
  }

  function taxas(d, ctx) {
    const { fmtInt, fmtPct, comparar, delta } = ctx;
    const pct = (t) => (t && t.den > 0 ? (t.num / t.den) * 100 : null);
    const ROTULOS = [['lead_mql', 'Lead → MQL'], ['mql_ra', 'MQL → RA'], ['ra_rr', 'RA → RR']];
    return ROTULOS.map(([chave, rotulo]) => {
      const ta = d.taxas && d.taxas.a ? d.taxas.a[chave] : null;
      const tb = d.taxas && d.taxas.b ? d.taxas.b[chave] : null;
      const a = pct(ta), b = pct(tb);
      const semCrm = chave !== 'ra_rr' && d.crm_lido === false;
      return {
        rotulo,
        valor: semCrm || a === null ? null : fmtPct(a, 0),
        delta: a !== null && b ? delta(a, b) : undefined,
        ...comparar(a, b, (x) => fmtPct(x, 0), { pp: 0 }),
        nota: semCrm ? SEM_CRM : ta ? `${fmtInt(ta.num)} de ${fmtInt(ta.den)}` : '',
      };
    });
  }

  function qualificacao(q, ctx, crmLido) {
    const { fmtInt, fmtPct } = ctx;
    if (crmLido === false) {
      return `<div class="bloco vr-qualif"><h2>Níveis de qualificação <small>leads novos da Sessão Estratégica</small></h2><p class="mini">${SEM_CRM}</p></div>`;
    }
    const pct = (v) => (q.total ? (v / q.total) * 100 : 0);
    const FAIXAS = [['abaixo', 'Abaixo de R$ 20 mil'], ['acima', 'Acima de R$ 20 mil'], ['nao_informado', 'Não informado']];
    return `<div class="bloco vr-qualif">
      <h2>Níveis de qualificação <small>leads novos da Sessão Estratégica · faturamento mensal informado no CRM</small></h2>
      ${q.total ? FAIXAS.map(([k, r]) => `<div class="vr-faixa">
        <span class="vr-faixa__rotulo">${r}</span>
        <div class="regua" role="img" aria-label="${r}: ${fmtPct(pct(q[k]), 0)}"><i style="width:${pct(q[k]).toFixed(1)}%"></i></div>
        <span class="vr-faixa__num">${fmtInt(q[k])} <small>${fmtPct(pct(q[k]), 0)}</small></span>
      </div>`).join('') + `<p class="mini">${fmtInt(q.total)} leads novos de Sessão Estratégica no período</p>`
        : '<p class="mini">Nenhum lead novo de Sessão Estratégica no período.</p>'}
    </div>`;
  }

  function tabelaFunis(el, linhas, ctx) {
    const { esc, fmtInt, tabela, delta, deltaChip } = ctx;
    const comDelta = (v, ant) => `${fmtInt(v)} ${ant ? deltaChip(delta(v, ant)) : '<span class="carimbo neutro">novo</span>'}`;
    tabela(el, [
      { titulo: 'Funil', campo: 'funil', render: (r) => `<b>${esc(r.funil)}</b>` },
      { titulo: 'Leads', num: true, campo: 'leads', render: (r) => comDelta(r.leads, r.leads_ant) },
      { titulo: 'Leads novos', num: true, campo: 'novos', render: (r) => (r.novos === null ? '<span class="semdado">—</span>' : comDelta(r.novos, r.novos_ant)) },
      { titulo: 'Entraram nos grupos', num: true, campo: 'grupos', render: (r) => (r.grupos === null || r.grupos === undefined ? '' : fmtInt(r.grupos)) },
    ], linhas, undefined, 'Nenhum lead no período. Aqui aparece um funil por linha, com a comparação ao período anterior.');
  }

  function desenhar(raiz, d, ctx) {
    const { tile } = ctx;
    raiz.innerHTML = `
      ${d.manchete ? `<p class="manchete">${d.manchete}</p>` : ''}
      <div class="grid-etiquetas vr-numeros">${quadros(d, ctx).map((k) => tile(k, true)).join('')}</div>
      <div class="bloco"><h2>Taxas de passagem <small>leads novos · MQL pelo status atual no CRM</small></h2>
        <div class="grid-etiquetas">${taxas(d, ctx).map((k) => tile(k)).join('')}</div></div>
      ${d.qualificacao ? qualificacao(d.qualificacao, ctx, d.crm_lido) : ''}
      <div class="bloco"><h2>Leads por funil <small>no período · vs. o anterior</small></h2><div class="tabela-wrap" id="vr-funis"></div></div>`;
    tabelaFunis(raiz.querySelector('#vr-funis'), d.por_funil || [], ctx);
  }

  // ---------------------------------------------------------------------------
  // Montagem a partir das respostas da API (issue S4-03). Sem conta nova: as
  // mesmas da Visão geral antiga (aba Detalhado) — soma dos funnelCounts de
  // /api/leads, investimento do Meta (/api/attribution) ou do funil (/api/cpl),
  // leads novos e reuniões do /api/cpl, MQLs e SQLs do /api/agenda/taxas.
  //   r: { leadsA, leadsB, cplA, cplB, atrA, atrB, taxas, fSel, quando }
  //   taxas: undefined = ainda lendo o CRM; null = falhou
  // ---------------------------------------------------------------------------
  // Leads por funil (S4-06): leads de /api/leads, leads novos e entradas nos
  // grupos de /api/cpl, cada um com o período anterior; mais leads primeiro.
  function porFunil(r, f, leadsDe) {
    const antes = Object.fromEntries(leadsDe(r.leadsB && r.leadsB.funnelCounts).map((c) => [c.funnel || '', Number(c.count || 0)]));
    const novos = (cpl, funil) => (!cpl ? null : ((cpl.por_funil || []).find((x) => x.funnel === funil) || {}).leads_novos || 0);
    const grupos = r.cplA && r.cplA.entradas_grupos ? r.cplA.entradas_grupos : {};
    return leadsDe(r.leadsA && r.leadsA.funnelCounts).map((c) => {
      const funil = c.funnel || '';
      return {
        funil: funil || '(sem funil)',
        leads: Number(c.count || 0),
        leads_ant: antes[funil] || 0,
        novos: novos(r.cplA, funil),
        novos_ant: novos(r.cplB, funil),
        grupos: funil in grupos ? grupos[funil] : null,
      };
    }).sort((a, b) => b.leads - a.leads);
  }

  function montarNumeros(r, ctx) {
    const { esc, fmtInt, fmtNum, money, delta } = ctx;
    const f = r.fSel || '';
    const leadsDe = (fc) => (fc || []).filter((c) => !f || (c.funnel || '') === f);
    const soma = (fc) => leadsDe(fc).reduce((t, c) => t + Number(c.count || 0), 0);
    const leadsA = soma(r.leadsA && r.leadsA.funnelCounts), leadsB = soma(r.leadsB && r.leadsB.funnelCounts);
    const linha = (cpl) => ((cpl && cpl.por_funil) || []).find((x) => x.funnel === f);
    const gasto = (atr, cpl) => {
      if (!f) return atr && atr.meta_spend > 0 ? atr.meta_spend : null;
      const l = linha(cpl);
      return l && l.spend > 0 ? l.spend : null;
    };
    const novos = (cpl) => (!cpl ? null : f ? ((linha(cpl) || {}).leads_novos || 0) : (cpl.total_leads_novos || 0));
    const div = (g, n) => (n && g ? g / n : null);
    const gA = gasto(r.atrA, r.cplA), gB = gasto(r.atrB, r.cplB);
    const nA = novos(r.cplA), nB = novos(r.cplB);
    const reun = (cpl) => {
      const x = cpl && cpl.reunioes;
      if (!x) return null;
      return f ? (x.por_funil[f] || { agendadas: 0, realizadas: 0 }) : x.total;
    };
    const rA = reun(r.cplA), rB = reun(r.cplB);
    const doCrm = (rec) => (!rec || !rec.crm ? null : f ? (rec.crm[f] || { mqls: 0, sqls: 0 }) : rec.crm_total);
    const lido = r.taxas === undefined ? null : !!(r.taxas && r.taxas.atual && r.taxas.atual.crm_lido);
    const cA = lido ? doCrm(r.taxas.atual) : null, cB = lido ? doCrm(r.taxas.anterior) : null;
    const cplA = div(gA, leadsA), cplB = div(gB, leadsB);
    // Taxas (S4-04): Lead → MQL de todos os funis (ou do filtrado); MQL → RA e
    // RA → RR dos funis que agendam reunião, como em /api/agenda/taxas.
    const taxasDe = (rec) => {
      if (!rec) return null;
      const crm = !rec.crm ? null : f ? rec.crm[f] : rec.crm_total;
      const ag = f ? (rec.por_funil || {})[f] : rec.total;
      const par = (num, den) => (num === null || num === undefined || den === null || den === undefined ? null : { num, den });
      return {
        lead_mql: crm ? par(crm.mqls, crm.leads_novos) : null,
        mql_ra: ag ? par(ag.mqls_com_reuniao, ag.mqls) : null,
        ra_rr: ag ? par(ag.realizadas, ag.ocorridas) : null,
      };
    };
    const d = delta(leadsA, leadsB);
    const manchete = `<strong>${fmtInt(leadsA)} leads</strong> ${esc(r.quando)}`
      + (f ? ` no funil ${esc(f)}` : '')
      + (d !== null && isFinite(d) ? `, ${d === 0 ? 'o mesmo que' : `${fmtNum(Math.abs(d), 0)}% ${d > 0 ? 'a mais que' : 'a menos que'}`} no período anterior` : '')
      + (cplA !== null ? `, com CPL de <strong>${money(cplA)}</strong>` : '') + '.';
    return {
      manchete,
      crm_lido: lido,
      taxas: r.taxas ? { a: taxasDe(r.taxas.atual), b: taxasDe(r.taxas.anterior) } : null,
      por_funil: porFunil(r, f, leadsDe),
      // Níveis de qualificação (S4-05): só sem filtro ou no funil da qualificação.
      qualificacao: r.taxas === undefined || (f && f !== (r.taxas && r.taxas.atual && r.taxas.atual.qualificacao_funil || 'sessao-estrategica'))
        ? null : (lido ? r.taxas.atual.qualificacao : {}),
      notas: { cpl: f ? 'sem investimento no funil' : 'precisa do sync de investimento' },
      numeros: {
        leads: { a: leadsA, b: leadsB },
        leads_novos: { a: nA, b: nB },
        cpl: { a: cplA, b: cplB },
        cpl_novos: { a: div(gA, nA), b: div(gB, nB) },
        mqls: { a: cA ? cA.mqls : null, b: cB ? cB.mqls : null },
        sqls: { a: cA ? cA.sqls : null, b: cB ? cB.sqls : null },
        agendadas: { a: rA ? rA.agendadas : null, b: rB ? rB.agendadas : null },
        realizadas: { a: rA ? rA.realizadas : null, b: rB ? rB.realizadas : null },
      },
    };
  }

  window.VisaoReuniao = { desenhar, montarNumeros };
})();
