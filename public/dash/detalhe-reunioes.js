// Detalhe das reuniões na Visão geral (spec-detalhe-reunioes.md, série S7).
//
// O que aconteceu na agenda no período do filtro (spec-funil-leads-novos.md,
// série S9): das reuniões que CAEM no período, de leads novos e antigos, os
// números (na agenda, realizadas, faltaram, canceladas, a acontecer, sem
// presença marcada, comparecimento, no-show) comparados ao período anterior,
// quantas foram agendadas no período (separadas em lead novo e lead antigo) e
// as listas de nomes fechadas em drop (Ainda vão acontecer, Faltaram,
// Cancelaram, Sem presença marcada, Reagendamentos).
//
// `desenhar(raiz, coorte, fSel, ctx, detalhe, taxas)`: os números com a
// resposta de /api/agenda/coorte ({ atual, anterior }, cada um { total,
// por_funil, agendou } com `no_show` e `comparecimento` já calculados no
// servidor), as listas com a de /api/agenda/detalhe ({ listas }, já no funil
// do filtro; null = falhou) e a separação lead novo/antigo com a de
// /api/agenda/taxas (undefined = ainda lendo o CRM; null = falhou).
// `prototipo(raiz, ctx)`:
// dados de exemplo, só com #visao?proto=1 (S7-01). ctx: { esc, fmtInt, fmtPct, tile }.
(() => {
  'use strict';

  const FUNIS = {
    'sessao-estrategica': 'Sessão Estratégica', 'aplicacao-mentoria': 'Aplicação Mentoria', workshop: 'Workshop', aquisicao: 'Aquisição',
  };
  const LISTAS = [
    ['a_acontecer', 'Ainda vão acontecer'],
    ['faltou', 'Faltaram'],
    ['cancelada', 'Cancelaram'],
    ['sem_presenca', 'Sem presença marcada'],
    ['reagendamentos', 'Reagendamentos'],
  ];
  const VAZIA = {
    a_acontecer: 'Ninguém com reunião pela frente.', faltou: 'Ninguém faltou.', cancelada: 'Ninguém cancelou.',
    sem_presenca: 'Nenhuma reunião aguardando presença.', reagendamentos: 'Ninguém remarcou.',
  };
  const SITUACAO = {
    realizada: 'realizada', faltou: 'faltou', cancelada: 'cancelada', a_acontecer: 'a acontecer', sem_presenca: 'sem presença marcada',
  };
  const NUMEROS = [
    ['na_agenda', 'Na agenda'], ['realizada', 'Realizadas'], ['faltou', 'Faltaram'], ['cancelada', 'Canceladas'],
    ['a_acontecer', 'A acontecer'], ['sem_presenca', 'Sem presença marcada'],
  ];

  // ---------------------------------------------------------------------------
  // Dados de exemplo (nomes fictícios), no formato que a API devolve.
  // ---------------------------------------------------------------------------
  const u = (iso) => Math.floor(Date.parse(`${iso}:00-03:00`) / 1000); // horário de Brasília → unix
  const r = (nome, funil, quando, extra = {}) => ({ nome, funil, inicio: u(quando), ...extra });
  const troca = (detalhe, em) => ({ detalhe, em: u(em) });
  const EXEMPLO = {
    atual: { na_agenda: 11, realizada: 1, faltou: 1, cancelada: 1, a_acontecer: 8, sem_presenca: 0, fora_do_registro: 0, no_show: 50, comparecimento: 50, agendou: 9, agendou_novo: 7 },
    anterior: { na_agenda: 8, realizada: 3, faltou: 1, cancelada: 0, a_acontecer: 0, sem_presenca: 4, fora_do_registro: 0, no_show: 25, comparecimento: 75, agendou: 8, agendou_novo: 6 },
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
          remarcada: true, situacao: 'a_acontecer', trocas: [troca('sex., 06/11, 15:00 → ter., 10/11, 15:00', '2026-11-05T10:00')],
        }),
        r('Eduardo Reis', 'sessao-estrategica', '2026-11-12T17:00', {
          remarcada: true, situacao: 'a_acontecer',
          trocas: [troca('sáb., 07/11, 10:00 → ter., 10/11, 11:00', '2026-11-04T09:00'), troca('movida direto na agenda do Google', '2026-11-06T16:00')],
        }),
      ],
    },
  };
  const CENARIOS = [['normal', 'semana normal'], ['sem-presenca', 'sem presença marcada ainda'], ['vazio', 'período sem reunião']];

  function comCenario(c) {
    const d = JSON.parse(JSON.stringify(EXEMPLO));
    if (c === 'sem-presenca') {
      // Nenhuma presença marcada: as duas que já passaram ficam aguardando.
      d.atual = { na_agenda: 11, realizada: 0, faltou: 0, cancelada: 1, a_acontecer: 8, sem_presenca: 2, fora_do_registro: 0, no_show: null, comparecimento: null, agendou: 9, agendou_novo: 7 };
      d.listas.sem_presenca = [r('Igor Martins', 'sessao-estrategica', '2026-11-06T16:00'), r('Kátia Nunes', 'sessao-estrategica', '2026-11-06T15:00')];
      d.listas.faltou = [];
    }
    if (c === 'vazio') {
      d.atual = { na_agenda: 0, realizada: 0, faltou: 0, cancelada: 0, a_acontecer: 0, sem_presenca: 0, fora_do_registro: 0, no_show: null, comparecimento: null, agendou: 0, agendou_novo: 0 };
      Object.keys(d.listas).forEach((k) => { d.listas[k] = []; });
    }
    return d;
  }

  // ---------------------------------------------------------------------------
  // Desenho
  // ---------------------------------------------------------------------------
  // Variação contra o anterior, como o `delta` do index: sem base, sem carimbo.
  const variacao = (a, b) => (a === null || a === undefined || b === null || b === undefined || !b ? null : ((a - b) / b) * 100);
  // Horário da reunião em Brasília, no mesmo formato das trocas do histórico
  // ("seg., 09/11, 14:00").
  const FUSO = 'America/Sao_Paulo';
  const quando = (unix) => (unix ? new Date(unix * 1000).toLocaleString('pt-BR', {
    timeZone: FUSO, weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  }) : '—');
  const dia = (unix) => new Date(unix * 1000).toLocaleDateString('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit' });
  // Troca do histórico: "de → para"; movida no Google não tem os horários (SUP-S7-08).
  const textoTroca = (t) => (t.detalhe.includes('→') ? t.detalhe : `${t.detalhe || 'remarcada'} em ${dia(t.em)}`);

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
    const cp = d.atual.comparecimento, cpAnt = ant.comparecimento;
    const pct = (v) => (v === null || v === undefined ? null : fmtPct(v, 0));
    const base = fmtInt(d.atual.realizada + d.atual.faltou);
    const semPresenca = ns === null || ns === undefined;
    cards.push({
      chave: 'comparecimento', rotulo: 'Comparecimento', valor: pct(cp), anterior: pct(cpAnt) ?? '—',
      delta: variacao(cp, cpAnt) ?? undefined,
      nota: semPresenca ? 'sem presença marcada' : `${fmtInt(d.atual.realizada)} de ${base}`,
    });
    cards.push({
      chave: 'no_show', rotulo: 'No-show', valor: pct(ns), anterior: pct(nsAnt) ?? '—',
      delta: variacao(ns, nsAnt) ?? undefined, invertido: true,
      nota: semPresenca ? 'sem presença marcada' : `${fmtInt(d.atual.faltou)} de ${base}`,
    });
    // Agendadas no período (pela data em que agendou), separadas em lead novo
    // (card criado no período) e lead antigo quando o CRM responde.
    const ag = d.atual.agendou || 0, novo = d.atual.agendou_novo;
    cards.push({
      chave: 'agendou', rotulo: 'Agendadas no período', valor: fmtInt(ag), anterior: num(ant.agendou),
      delta: variacao(ag, ant.agendou) ?? undefined,
      nota: novo === undefined ? 'lendo o CRM…' : novo === null ? 'sem dados do CRM'
        : `${fmtInt(novo)} de lead novo · ${fmtInt(Math.max(0, ag - novo))} de lead antigo`,
    });
    return cards;
  }

  function numeros(d, ctx) {
    return `<div class="grid-etiquetas dr-numeros">${cardsDosNumeros(d, ctx).map((c) => ctx.tile(c)).join('')}</div>`;
  }

  // O recorte do filtro: total, ou o funil escolhido (zerado se não teve reunião).
  const ZERO = { agendadas: 0, realizada: 0, faltou: 0, cancelada: 0, a_acontecer: 0, sem_presenca: 0, fora_do_registro: 0, no_show: null };
  // `tx`: o lado de /api/agenda/taxas (undefined = ainda lendo; null = sem CRM).
  function recorte(resumo, fSel, tx) {
    if (!resumo) return null;
    const r = fSel ? (resumo.por_funil || {})[fSel] || ZERO : resumo.total || ZERO;
    const ag = resumo.agendou || { total: 0, por_funil: {} };
    let agendou_novo;
    if (tx !== undefined) {
      const n = tx && tx.crm_lido ? tx.agendou_lead_novo : null;
      agendou_novo = !n ? null : fSel ? (n.por_funil || {})[fSel] || 0 : n.total;
    }
    return { ...r, na_agenda: r.agendadas, agendou: fSel ? (ag.por_funil || {})[fSel] || 0 : ag.total, agendou_novo };
  }

  /** { atual, anterior } dos números da seção, já no recorte do filtro de funil. */
  function montarNumeros(coorte, fSel, taxas) {
    if (!coorte) return null;
    const lado = (k) => (taxas === undefined ? undefined : taxas ? taxas[k] || null : null);
    return { atual: recorte(coorte.atual, fSel, lado('atual')), anterior: recorte(coorte.anterior, fSel, lado('anterior')) };
  }

  const CAB = '<h2>Detalhe das reuniões <small>reuniões que caem no período, de leads novos e antigos · variação contra o período anterior</small></h2>';
  const SEM_REUNIAO = '<p class="dr-vazio">Nenhuma reunião no período.</p>';

  function desenhar(raiz, coorte, fSel, ctx, detalhe, taxas) {
    if (!raiz) return;
    const d = montarNumeros(coorte, fSel, taxas);
    let corpo;
    if (!d || !d.atual) corpo = '<p class="dr-vazio">Não foi possível carregar as reuniões agora.</p>';
    else if (!d.atual.na_agenda && !d.atual.agendou) corpo = SEM_REUNIAO;
    else {
      corpo = numeros(d, ctx) + (detalhe && detalhe.listas
        ? listas(detalhe.listas, ctx.esc)
        : '<p class="dr-vazio">Não foi possível carregar os nomes agora.</p>');
    }
    raiz.innerHTML = `<div class="bloco dr">${CAB}${corpo}</div>`;
  }

  function linha(x, k, esc) {
    const funil = esc(FUNIS[x.funil] || x.funil || 'sem funil');
    const marca = x.remarcada ? ' <span class="dr-marca">remarcada</span>' : '';
    if (k !== 'reagendamentos') {
      return `<li class="dr-linha"><div><b>${esc(x.nome)}</b>${marca}</div><span>${funil}</span><span>${esc(quando(x.inicio))}</span></li>`;
    }
    // Calendly remarcado vem sem as trocas (SUP-S7-03): só a marca.
    const trocasDe = x.trocas || [];
    const n = trocasDe.length;
    const qtd = n ? `${n} ${n === 1 ? 'remarcação' : 'remarcações'}` : 'remarcada';
    const trocas = n ? `<ol class="dr-trocas">${trocasDe.map((t) => `<li>${esc(textoTroca(t))}</li>`).join('')}</ol>` : '';
    return `<li class="dr-linha dr-linha--reag"><b>${esc(x.nome)}</b><span>${funil}</span>
      <span>${qtd} · agora: ${esc(SITUACAO[x.situacao] || x.situacao)}</span>${trocas}</li>`;
  }

  // As cinco listas, cada uma num drop próprio que começa fechado.
  function listas(dados, esc) {
    return `<div class="dr-listas">${LISTAS.map(([k, titulo]) => {
      const itens = dados[k] || [];
      const corpo = itens.length
        ? `<ul>${itens.map((x) => linha(x, k, esc)).join('')}</ul>`
        : `<p class="dr-vazio">${esc(VAZIA[k])}</p>`;
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
    const corpo = d.atual.na_agenda || d.atual.agendou
      ? numeros(d, ctx) + listas(d.listas, esc)
      : SEM_REUNIAO;
    raiz.innerHTML = `<div class="bloco dr">${cab}${proto}${corpo}</div>`;
    raiz.querySelector('[data-dr-cenario]').addEventListener('change', (e) => {
      estado.cenario = e.target.value;
      prototipo(raiz, ctx);
    });
  }

  window.DetalheReunioes = { prototipo, desenhar, montarNumeros, cardsDosNumeros };
})();
