// Visão geral da reunião semanal (spec-visao-geral-reuniao-semanal.md, série S4).
//
// Só desenha. Os números chegam prontos (contas no backend e no index.html,
// as mesmas da Visão geral antiga, que virou a aba Detalhado):
//   numeros:      { leads, leads_novos, cpl, cpl_novos, mqls, sqls, agendadas,
//                   realizadas } — cada um { a, b } (agora e período anterior;
//                   null = sem dado)
//   notas:        { cpl } — nota do CPL quando não há investimento
//   crm_lido:     false = CRM não respondeu (MQLs e SQL "sem dados do CRM")
//   taxas:        { a, b } — cada um { lead_mql, mql_ra, ra_rr }: { num, den }
//   qualificacao: { abaixo, acima, nao_informado, total } ou null (bloco some)
//   por_funil:    [{ funil, leads, leads_ant, novos, novos_ant, grupos }]
//                 (grupos: null fora do workshop)
//   manchete:     frase do topo, HTML já escapado pelo index
//
// O index.html chama `VisaoReuniao.desenhar(raiz, dados, ctx)`; ctx traz
// { esc, fmtInt, fmtPct, money, tile, tabela, comparar, delta, deltaChip }.
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
    const crm = (rotulo, x) => (d.crm_lido === false
      ? { rotulo, valor: null, nota: SEM_CRM }
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
      ${d.proto || ''}
      ${d.manchete ? `<p class="manchete">${d.manchete}</p>` : ''}
      <div class="grid-etiquetas vr-numeros">${quadros(d, ctx).map((k) => tile(k, true)).join('')}</div>
      <div class="bloco"><h2>Taxas de passagem <small>leads novos · MQL pelo status atual no CRM</small></h2>
        <div class="grid-etiquetas">${taxas(d, ctx).map((k) => tile(k)).join('')}</div></div>
      ${d.qualificacao ? qualificacao(d.qualificacao, ctx, d.crm_lido) : ''}
      <div class="bloco"><h2>Leads por funil <small>no período · vs. o anterior</small></h2><div class="tabela-wrap" id="vr-funis"></div></div>`;
    tabelaFunis(raiz.querySelector('#vr-funis'), d.por_funil || [], ctx);
  }

  // ---------------------------------------------------------------------------
  // Protótipo (issue S4-01): números de exemplo por cenário, só com proto=1.
  // ---------------------------------------------------------------------------
  const base = () => ({
    manchete: '<strong>214 leads</strong> nos últimos 7 dias, 14% a mais que no período anterior, com CPL de <strong>R$ 23,36</strong>.',
    numeros: {
      leads: { a: 214, b: 187 }, leads_novos: { a: 96, b: 88 },
      cpl: { a: 23.36, b: 25.67 }, cpl_novos: { a: 52.08, b: 54.55 },
      mqls: { a: 31, b: 24 }, sqls: { a: 9, b: 7 },
      agendadas: { a: 18, b: 15 }, realizadas: { a: 11, b: 10 },
    },
    notas: {},
    crm_lido: true,
    taxas: {
      a: { lead_mql: { num: 31, den: 96 }, mql_ra: { num: 16, den: 31 }, ra_rr: { num: 11, den: 16 } },
      b: { lead_mql: { num: 24, den: 88 }, mql_ra: { num: 13, den: 24 }, ra_rr: { num: 10, den: 14 } },
    },
    qualificacao: { abaixo: 19, acima: 27, nao_informado: 6, total: 52 },
    por_funil: [
      { funil: 'sessao-estrategica', leads: 120, leads_ant: 101, novos: 52, novos_ant: 47, grupos: null },
      { funil: 'workshop', leads: 78, leads_ant: 70, novos: 38, novos_ant: 35, grupos: 63 },
      { funil: 'aquisicao', leads: 16, leads_ant: 16, novos: 6, novos_ant: 6, grupos: null },
    ],
  });
  const EXEMPLO = {
    normal: base,
    'sem-crm': () => ({ ...base(), crm_lido: false }),
    workshop: () => {
      const d = base();
      return {
        ...d,
        manchete: '<strong>78 leads</strong> nos últimos 7 dias no funil workshop, 11% a mais que no período anterior, com CPL de <strong>R$ 12,82</strong>.',
        numeros: {
          leads: { a: 78, b: 70 }, leads_novos: { a: 38, b: 35 }, cpl: { a: 12.82, b: 14.29 }, cpl_novos: { a: 26.32, b: 28.57 },
          mqls: { a: 4, b: 3 }, sqls: { a: 1, b: 0 }, agendadas: { a: 2, b: 1 }, realizadas: { a: 1, b: 1 },
        },
        taxas: { a: { lead_mql: { num: 4, den: 38 }, mql_ra: { num: 2, den: 4 }, ra_rr: { num: 1, den: 2 } }, b: null },
        qualificacao: null,
        por_funil: d.por_funil.filter((r) => r.funil === 'workshop'),
      };
    },
  };
  const CENARIOS = [['normal', 'Normal'], ['sem-crm', 'CRM fora do ar'], ['workshop', 'Filtro no workshop']];

  function prototipo(raiz, ctx, cenario = 'normal') {
    const selo = `<div class="em-proto" role="note"><span class="em-proto__selo">Protótipo</span>
      <span>Visão geral da reunião semanal com números de exemplo. Nada aqui vem do CRM nem do Meta.</span>
      <label class="em-proto__cen">Cenário <select id="vr-cenario">${CENARIOS.map(([v, r]) => `<option value="${v}"${v === cenario ? ' selected' : ''}>${r}</option>`).join('')}</select></label></div>`;
    desenhar(raiz, { ...EXEMPLO[cenario](), proto: selo }, ctx);
    raiz.querySelector('#vr-cenario').onchange = (e) => prototipo(raiz, ctx, e.target.value);
  }

  window.VisaoReuniao = { desenhar, prototipo };
})();
