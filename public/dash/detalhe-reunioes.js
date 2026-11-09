// Detalhe das reuniões na Visão geral (spec-detalhe-reunioes.md, série S7).
//
// Das reuniões criadas no período do filtro: os números (criadas, realizadas,
// faltaram, canceladas, a acontecer, sem presença marcada, no-show) comparados
// ao período anterior, e as listas de nomes fechadas em drop (Ainda vão
// acontecer, Faltaram, Cancelaram, Sem presença marcada, Reagendamentos).
//
// `desenhar(raiz, coorte, fSel, ctx)`: os números com a resposta de
// /api/agenda/coorte ({ atual, anterior }, cada um { total, por_funil } com o
// `no_show` já calculado no servidor). `prototipo(raiz, ctx)`: dados de
// exemplo, só com #visao?proto=1 (S7-01). ctx: { esc, fmtInt, fmtPct, tile }.
(() => {
  'use strict';

  const FUNIS = { 'sessao-estrategica': 'Sessão Estratégica', 'aplicacao-mentoria': 'Aplicação Mentoria' };
  const LISTAS = [
    ['a_acontecer', 'Ainda vão acontecer'],
    ['faltou', 'Faltaram'],
    ['cancelada', 'Cancelaram'],
    ['sem_presenca', 'Sem presença marcada'],
    ['reagendamentos', 'Reagendamentos'],
  ];
  const SITUACAO = {
    realizada: 'realizada', faltou: 'faltou', cancelada: 'cancelada', a_acontecer: 'a acontecer', sem_presenca: 'sem presença marcada',
  };
  const NUMEROS = [
    ['criadas', 'Criadas'], ['realizada', 'Realizadas'], ['faltou', 'Faltaram'], ['cancelada', 'Canceladas'],
    ['a_acontecer', 'A acontecer'], ['sem_presenca', 'Sem presença marcada'],
  ];

  // ---------------------------------------------------------------------------
  // Dados de exemplo (nomes fictícios), no formato que a API vai devolver.
  // Horários em texto ISO de Brasília para o protótipo não depender de fuso.
  // ---------------------------------------------------------------------------
  const r = (nome, funil, quando, extra = {}) => ({ nome, funil, quando, ...extra });
  const EXEMPLO = {
    atual: { criadas: 11, realizada: 1, faltou: 1, cancelada: 1, a_acontecer: 8, sem_presenca: 0, fora_do_registro: 0, no_show: 50 },
    anterior: { criadas: 8, realizada: 3, faltou: 1, cancelada: 0, a_acontecer: 0, sem_presenca: 4, fora_do_registro: 0, no_show: 25 },
    listas: {
      a_acontecer: [
        r('Ana Paula', 'sessao-estrategica', '2026-11-09T14:00'),
        r('Bruna Lima', 'sessao-estrategica', '2026-11-09T15:00'),
        r('Carla Souza', 'sessao-estrategica', '2026-11-10T15:00', { remarcada: true }),
        r('Diego Alves', 'sessao-estrategica', '2026-11-12T15:00'),
        r('Eduardo Reis', 'sessao-estrategica', '2026-11-12T17:00', { remarcada: true }),
        r('Fernanda Rocha', 'sessao-estrategica', '2026-11-13T17:00'),
        r('Gabriel Costa', 'sessao-estrategica', '2026-11-16T15:00'),
        r('Helena Dias', 'sessao-estrategica', '2026-11-16T17:00'),
      ],
      faltou: [r('Igor Martins', 'sessao-estrategica', '2026-11-06T16:00')],
      cancelada: [r('Joana Pires', 'aplicacao-mentoria', '2026-11-06T15:00')],
      sem_presenca: [],
      reagendamentos: [
        r('Carla Souza', 'sessao-estrategica', '2026-11-10T15:00', {
          situacao: 'a_acontecer', trocas: [{ de: '2026-11-06T15:00', para: '2026-11-10T15:00' }],
        }),
        r('Eduardo Reis', 'sessao-estrategica', '2026-11-12T17:00', {
          situacao: 'a_acontecer',
          trocas: [{ de: '2026-11-07T10:00', para: '2026-11-10T11:00' }, { de: '2026-11-10T11:00', para: '2026-11-12T17:00' }],
        }),
      ],
    },
  };
  const CENARIOS = [['normal', 'semana normal'], ['sem-presenca', 'sem presença marcada ainda'], ['vazio', 'período sem reunião']];

  function comCenario(c) {
    const d = JSON.parse(JSON.stringify(EXEMPLO));
    if (c === 'sem-presenca') {
      // Nenhuma presença marcada: as duas que já passaram ficam aguardando.
      d.atual = { criadas: 11, realizada: 0, faltou: 0, cancelada: 1, a_acontecer: 8, sem_presenca: 2, fora_do_registro: 0, no_show: null };
      d.listas.sem_presenca = [r('Igor Martins', 'sessao-estrategica', '2026-11-06T16:00'), r('Kátia Nunes', 'sessao-estrategica', '2026-11-06T15:00')];
      d.listas.faltou = [];
    }
    if (c === 'vazio') {
      d.atual = { criadas: 0, realizada: 0, faltou: 0, cancelada: 0, a_acontecer: 0, sem_presenca: 0, fora_do_registro: 0, no_show: null };
      Object.keys(d.listas).forEach((k) => { d.listas[k] = []; });
    }
    return d;
  }

  // ---------------------------------------------------------------------------
  // Desenho
  // ---------------------------------------------------------------------------
  // Variação contra o anterior, como o `delta` do index: sem base, sem carimbo.
  const variacao = (a, b) => (a === null || a === undefined || b === null || b === undefined || !b ? null : ((a - b) / b) * 100);
  const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  function quando(iso) {
    const [d, h] = iso.split('T');
    const [a, m, dia] = d.split('-').map(Number);
    const sem = SEMANA[new Date(Date.UTC(a, m - 1, dia)).getUTCDay()];
    return `${sem} ${String(dia).padStart(2, '0')}/${String(m).padStart(2, '0')} · ${h.replace(':00', 'h').replace(':', 'h')}`;
  }

  // Os cards: { rotulo, valor, anterior, delta, invertido, neutro, nota } no
  // formato do `tile` do index (valor null vira "—").
  function cardsDosNumeros(d, ctx) {
    const { fmtInt, fmtPct } = ctx;
    const ant = d.anterior || {};
    const num = (v) => (v === null || v === undefined ? null : fmtInt(v));
    const cards = NUMEROS.map(([k, rotulo]) => ({
      chave: k, rotulo, valor: fmtInt(d.atual[k] || 0), anterior: num(ant[k]),
      // Falta, cancelamento e sem presença subindo é ruim; a acontecer não tem lado.
      delta: variacao(d.atual[k] || 0, ant[k]) ?? undefined,
      invertido: ['faltou', 'cancelada', 'sem_presenca'].includes(k), neutro: k === 'a_acontecer',
    }));
    // Calendly de antes de 19/10 sem presença: só quando houver (SUP-S7-06).
    if (d.atual.fora_do_registro) {
      cards.push({ chave: 'fora_do_registro', rotulo: 'Fora do registro', valor: fmtInt(d.atual.fora_do_registro), nota: 'Calendly antes de 19/10, sem presença' });
    }
    const ns = d.atual.no_show, nsAnt = ant.no_show;
    const pct = (v) => (v === null || v === undefined ? null : fmtPct(v, 0));
    cards.push({
      chave: 'no_show', rotulo: 'No-show', valor: pct(ns), anterior: pct(nsAnt) ?? '—',
      delta: variacao(ns, nsAnt) ?? undefined, invertido: true,
      nota: ns === null || ns === undefined ? 'sem presença marcada' : `${fmtInt(d.atual.faltou)} de ${fmtInt(d.atual.realizada + d.atual.faltou)}`,
    });
    return cards;
  }

  function numeros(d, ctx) {
    return `<div class="grid-etiquetas dr-numeros">${cardsDosNumeros(d, ctx).map((c) => ctx.tile(c)).join('')}</div>`;
  }

  // O recorte do filtro: total, ou o funil escolhido (zerado se não teve reunião).
  const ZERO = { agendadas: 0, realizada: 0, faltou: 0, cancelada: 0, a_acontecer: 0, sem_presenca: 0, fora_do_registro: 0, no_show: null };
  function recorte(resumo, fSel) {
    if (!resumo) return null;
    const r = fSel ? (resumo.por_funil || {})[fSel] || ZERO : resumo.total || ZERO;
    return { ...r, criadas: r.agendadas };
  }

  /** { atual, anterior } dos números da seção, já no recorte do filtro de funil. */
  function montarNumeros(coorte, fSel) {
    if (!coorte) return null;
    return { atual: recorte(coorte.atual, fSel), anterior: recorte(coorte.anterior, fSel) };
  }

  const CAB = '<h2>Detalhe das reuniões <small>reuniões criadas no período · variação contra o período anterior</small></h2>';

  function desenhar(raiz, coorte, fSel, ctx) {
    if (!raiz) return;
    const d = montarNumeros(coorte, fSel);
    let corpo;
    if (!d || !d.atual) corpo = '<p class="dr-vazio">Não foi possível carregar as reuniões agora.</p>';
    else if (!d.atual.criadas) corpo = '<p class="dr-vazio">Nenhuma reunião criada no período.</p>';
    else corpo = numeros(d, ctx);
    raiz.innerHTML = `<div class="bloco dr">${CAB}${corpo}</div>`;
  }

  function linha(x, k, esc) {
    const funil = esc(FUNIS[x.funil] || x.funil || 'sem funil');
    const marca = x.remarcada ? ' <span class="dr-marca">remarcada</span>' : '';
    if (k !== 'reagendamentos') {
      return `<li class="dr-linha"><div><b>${esc(x.nome)}</b>${marca}</div><span>${funil}</span><span>${esc(quando(x.quando))}</span></li>`;
    }
    const n = x.trocas.length;
    const trocas = x.trocas.map((t) => `<li>${esc(quando(t.de))} → ${esc(quando(t.para))}</li>`).join('');
    return `<li class="dr-linha dr-linha--reag"><b>${esc(x.nome)}</b><span>${funil}</span>
      <span>${n} ${n === 1 ? 'remarcação' : 'remarcações'} · agora: ${esc(SITUACAO[x.situacao] || x.situacao)}</span>
      <ol class="dr-trocas">${trocas}</ol></li>`;
  }

  function listas(d, esc) {
    return `<div class="dr-listas">${LISTAS.map(([k, titulo]) => {
      const itens = d.listas[k] || [];
      const corpo = itens.length
        ? `<ul>${itens.map((x) => linha(x, k, esc)).join('')}</ul>`
        : '<p class="dr-vazio">Ninguém nesta situação no período.</p>';
      return `<details class="dr-lista"><summary>${esc(titulo)} <span class="dr-qtd">(${itens.length})</span></summary>${corpo}</details>`;
    }).join('')}</div>`;
  }

  const estado = { cenario: 'normal' };

  function prototipo(raiz, ctx) {
    if (!raiz) return;
    const { esc } = ctx;
    const d = comCenario(estado.cenario);
    const proto = `<div class="em-proto">
      <span class="em-proto__selo">Protótipo</span>
      <span>números e nomes de exemplo · o filtro ainda não muda nada aqui</span>
      <label class="em-proto__cen">cenário
        <select data-dr-cenario>${CENARIOS.map(([k, t]) => `<option value="${k}"${k === estado.cenario ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>
      </label>
    </div>`;
    const cab = CAB;
    const corpo = d.atual.criadas
      ? numeros(d, ctx) + listas(d, esc)
      : '<p class="dr-vazio">Nenhuma reunião criada no período.</p>';
    raiz.innerHTML = `<div class="bloco dr">${cab}${proto}${corpo}</div>`;
    raiz.querySelector('[data-dr-cenario]').addEventListener('change', (e) => {
      estado.cenario = e.target.value;
      prototipo(raiz, ctx);
    });
  }

  window.DetalheReunioes = { prototipo, desenhar, montarNumeros, cardsDosNumeros };
})();
