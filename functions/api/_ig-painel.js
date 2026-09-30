// Central de Marketing — Instagram do @felipesantosae (issues 336, 340–343).
//
// Funções puras que transformam as linhas do schema `marketing` (Neon) no que
// a tela desenha. Toda conta mora aqui: a tela não soma, não divide e não
// decide nada (thin client). As rotas em `marketing/instagram/*.js` só
// consultam e chamam estas funções.
//
// Regras que vêm de medições (29/09/2026):
// - O alcance da Meta é de contas ÚNICAS por dia; somar dias conta a mesma
//   pessoa várias vezes. O indicador do período é a MÉDIA por dia.
// - "Orgânico" = soma dos tipos de conteúdo menos `AD` (anúncio).
// - Seguidores do último dia fechado chegam mais de 17h depois: dia recente
//   sem número é "ainda chegando", não zero.
// - Sem dado é null ("—" na tela), nunca zero.

export const CONTA = 'felipesantosae';
const DIA_MS = 86400000;

// Limite para avisar que a coleta parou (a diária roda 1x por dia; os
// stories, de hora em hora).
export const ATRASO_HORAS = { diaria: 26, posts: 26, stories: 3 };
const DIAS_EM_PREENCHIMENTO = 5;

const soma = (xs) => xs.reduce((a, b) => a + b, 0);
const somaOuNull = (xs) => { const v = xs.filter((x) => x !== null && x !== undefined); return v.length ? soma(v) : null; };
const media = (xs) => { const v = xs.filter((x) => x !== null && x !== undefined); return v.length ? soma(v) / v.length : null; };
const variacao = (atual, anterior) => (atual === null || anterior === null || !anterior ? null : ((atual - anterior) / anterior) * 100);
const ymd = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));

// Todos os dias entre dois YYYY-MM-DD, inclusive.
export function diasEntre(de, ate) {
  const saida = [];
  for (let t = Date.parse(de + 'T00:00:00Z'); t <= Date.parse(ate + 'T00:00:00Z'); t += DIA_MS) {
    saida.push(new Date(t).toISOString().slice(0, 10));
  }
  return saida;
}

export function organico(porTipo) {
  if (!porTipo || typeof porTipo !== 'object') return null;
  const chaves = Object.keys(porTipo);
  if (!chaves.length) return null;
  return soma(chaves.filter((k) => k !== 'AD').map((k) => Number(porTipo[k]) || 0));
}
const anuncio = (porTipo) => (porTipo && typeof porTipo === 'object' && Object.keys(porTipo).length ? Number(porTipo.AD) || 0 : null);

// ---------------------------------------------------------------- período

const MAX_DIAS = 400;

// `from`/`to` (e `antFrom`/`antTo`) em unix, como o resto do dash. O dia é o
// de Brasília; o dia da Meta (Pacífico) difere por poucas horas, o que não
// muda um período de dias inteiros. null = parâmetro inválido.
export function periodoDaRequisicao(url, ymdBrt, { comAnterior = false } = {}) {
  const ler = (nome) => { const v = Number(url.searchParams.get(nome)); return Number.isFinite(v) && v > 0 ? Math.floor(v) : null; };
  const from = ler('from'), to = ler('to');
  if (from === null || to === null || to < from || (to - from) / 86400 > MAX_DIAS) return null;
  const saida = { from, to, de: ymdBrt(from), ate: ymdBrt(to) };
  if (!comAnterior) return saida;
  const antFrom = ler('antFrom'), antTo = ler('antTo');
  if (antFrom === null || antTo === null || antTo < antFrom || (antTo - antFrom) / 86400 > MAX_DIAS) return null;
  return { ...saida, antDe: ymdBrt(antFrom), antAte: ymdBrt(antTo) };
}

// ---------------------------------------------------------------- cabeçalho

// `execucoes`: últimas linhas de marketing.execucoes (qualquer ordem).
// `perfil`: linha mais recente com total observado de ig_perfil_diario.
export function montarResumo({ execucoes = [], perfil = null, agoraMs = Date.now() }) {
  const coletas = {};
  for (const nome of Object.keys(ATRASO_HORAS)) {
    const minhas = execucoes.filter((e) => e.coleta === nome)
      .sort((a, b) => new Date(b.iniciada_em) - new Date(a.iniciada_em));
    const ok = minhas.find((e) => e.ok === true);
    const ultima = minhas.find((e) => e.ok !== null && e.ok !== undefined);
    const okEm = ok ? new Date(ok.concluida_em || ok.iniciada_em) : null;
    coletas[nome] = {
      ultima_ok_em: okEm ? okEm.toISOString() : null,
      atrasada: !okEm || agoraMs - okEm.getTime() > ATRASO_HORAS[nome] * 3600000,
      ultima_falha: ultima && ultima.ok === false
        ? { em: new Date(ultima.iniciada_em).toISOString(), motivo: ultima.erro || 'sem motivo registrado' }
        : null,
    };
  }
  const oks = Object.values(coletas).map((c) => c.ultima_ok_em).filter(Boolean).sort();
  return {
    perfil: {
      usuario: CONTA,
      seguidores: perfil ? perfil.seguidores_total : null,
      posts: perfil ? perfil.posts_total : null,
    },
    atualizado_em: oks.length ? oks[oks.length - 1] : null,
    coletas,
    nunca_coletou: !oks.length,
  };
}

// ---------------------------------------------------------------- crescimento

function resumoDoPeriodo(linhas, dias) {
  const porDia = new Map(linhas.map((l) => [ymd(l.dia), l]));
  const doDia = dias.map((d) => porDia.get(d) || null);
  const com = doDia.filter((l) => l && l.alcance_total !== null && l.alcance_total !== undefined);
  return {
    cobertura: com.length,
    completo: com.length === dias.length && dias.length > 0,
    alcanceOrg: media(com.map((l) => organico(l.alcance_por_tipo))),
    alcanceAds: media(com.map((l) => anuncio(l.alcance_por_tipo))),
    viewsOrg: somaOuNull(com.map((l) => organico(l.views_por_tipo))),
    viewsAds: somaOuNull(com.map((l) => anuncio(l.views_por_tipo))),
    interOrg: somaOuNull(com.map((l) => organico(l.interacoes_por_tipo))),
    interAds: somaOuNull(com.map((l) => anuncio(l.interacoes_por_tipo))),
    visitas: somaOuNull(com.map((l) => l.visitas_perfil)),
    toques: somaOuNull(com.map((l) => l.toques_link)),
    // Seguidores têm janela própria (a Meta guarda 30 dias e o último dia
    // chega atrasado): só compara quando todos os dias têm o número.
    seguidoresCompleto: dias.length > 0 && doDia.every((l) => l && l.seguidores_ganhos !== null && l.seguidores_ganhos !== undefined),
    ganhos: somaOuNull(doDia.map((l) => (l ? l.seguidores_ganhos : null))),
    perdidos: somaOuNull(doDia.map((l) => (l ? l.seguidores_perdidos : null))),
    quebra: {
      curtidas: somaOuNull(com.map((l) => l.curtidas)),
      comentarios: somaOuNull(com.map((l) => l.comentarios)),
      compartilhamentos: somaOuNull(com.map((l) => l.compartilhamentos)),
      salvamentos: somaOuNull(com.map((l) => l.salvamentos)),
      respostas: somaOuNull(com.map((l) => l.respostas)),
      reposts: somaOuNull(com.map((l) => l.reposts)),
    },
    doDia,
  };
}

// `linhas`/`linhasAnteriores`: ig_perfil_diario dos dois períodos.
// `publicacoes`: [{dia, formato}] dos posts do período (dia em Brasília).
// `historicoSeguidoresDesde`: menor dia com seguidores_ganhos na tabela.
// `ultimoDiaColetado`: maior dia com alcance na tabela (para "ainda chegando").
export function montarCrescimento({ de, ate, antDe, antAte, linhas = [], linhasAnteriores = [], publicacoes = [],
  historicoSeguidoresDesde = null, ultimoDiaColetado = null }) {
  const dias = diasEntre(de, ate);
  const atual = resumoDoPeriodo(linhas, dias);
  const ant = resumoDoPeriodo(linhasAnteriores, diasEntre(antDe, antAte));
  const comparar = (a, b) => (ant.completo ? variacao(a, b) : null);
  const saldo = atual.ganhos === null || atual.perdidos === null ? null : atual.ganhos - atual.perdidos;
  const saldoAnt = ant.ganhos === null || ant.perdidos === null ? null : ant.ganhos - ant.perdidos;
  const ultimoTotal = [...linhas].filter((l) => l.seguidores_total !== null && l.seguidores_total !== undefined)
    .sort((a, b) => (ymd(a.dia) < ymd(b.dia) ? 1 : -1))[0];

  const pubPorDia = new Map();
  for (const p of publicacoes) {
    const d = ymd(p.dia);
    if (!pubPorDia.has(d)) pubPorDia.set(d, []);
    pubPorDia.get(d).push(p.formato);
  }
  const limitePendente = ultimoDiaColetado
    ? new Date(Date.parse(ymd(ultimoDiaColetado) + 'T00:00:00Z') - (DIAS_EM_PREENCHIMENTO - 1) * DIA_MS).toISOString().slice(0, 10)
    : null;

  const serie = dias.map((d, i) => {
    const l = atual.doDia[i];
    const semGanho = !l || l.seguidores_ganhos === null || l.seguidores_ganhos === undefined;
    return {
      d,
      coletado: !!(l && l.alcance_total !== null && l.alcance_total !== undefined),
      alcance_org: l ? organico(l.alcance_por_tipo) : null,
      alcance_ads: l ? anuncio(l.alcance_por_tipo) : null,
      views_org: l ? organico(l.views_por_tipo) : null,
      views_ads: l ? anuncio(l.views_por_tipo) : null,
      visitas: l ? l.visitas_perfil ?? null : null,
      ganhos: semGanho ? null : l.seguidores_ganhos,
      perdidos: semGanho ? null : l.seguidores_perdidos,
      total: l ? l.seguidores_total ?? null : null,
      total_reconstruido: l ? l.total_reconstruido === true : false,
      seguidores_chegando: semGanho && !!limitePendente && d >= limitePendente && d <= ymd(ultimoDiaColetado),
      publicacoes: pubPorDia.get(d) || [],
    };
  });

  return {
    periodo: { de, ate, dias: dias.length, dias_com_dado: atual.cobertura },
    comparacao_disponivel: ant.completo,
    kpis: {
      alcance_medio: { organico: atual.alcanceOrg, anuncios: atual.alcanceAds, delta: comparar(atual.alcanceOrg, ant.alcanceOrg) },
      visualizacoes: { organico: atual.viewsOrg, anuncios: atual.viewsAds, delta: comparar(atual.viewsOrg, ant.viewsOrg) },
      interacoes: { organico: atual.interOrg, anuncios: atual.interAds, delta: comparar(atual.interOrg, ant.interOrg), quebra: atual.quebra },
      seguidores: { saldo, ganhos: atual.ganhos, perdidos: atual.perdidos, total: ultimoTotal ? ultimoTotal.seguidores_total : null,
        delta: atual.seguidoresCompleto && ant.seguidoresCompleto ? variacao(saldo, saldoAnt) : null, inclui_anuncios: true },
      visitas_perfil: { valor: atual.visitas, delta: comparar(atual.visitas, ant.visitas), inclui_anuncios: true },
      toques_link: { valor: atual.toques, delta: comparar(atual.toques, ant.toques), inclui_anuncios: true },
    },
    seguidores: {
      ganhos: atual.ganhos, perdidos: atual.perdidos, saldo,
      historico_desde: historicoSeguidoresDesde ? ymd(historicoSeguidoresDesde) : null,
    },
    serie,
  };
}

// ---------------------------------------------------------------- conteúdo

const FORMATOS = [
  { formato: 'Reel', rotulo: 'Reels' },
  { formato: 'Carrossel', rotulo: 'Carrosséis' },
  { formato: 'Foto', rotulo: 'Fotos' },
  { formato: 'Story', rotulo: 'Stories' },
];
const num = (v) => (v === null || v === undefined ? null : Number(v));
const taxa = (a, b) => (a === null || b === null || !b ? null : (a / b) * 100);

export function linhaDoPost(p) {
  const alcance = num(p.alcance), interacoes = num(p.interacoes);
  const pago = p.pago_campanhas
    ? {
        alcance: num(p.pago_alcance), views: num(p.pago_views), investimento: num(p.pago_investimento),
        campanhas: p.pago_campanhas, inicio: p.pago_inicio ? ymd(p.pago_inicio) : null,
        fim: p.pago_fim ? ymd(p.pago_fim) : null, em_veiculacao: !!p.pago_inicio && !p.pago_fim,
      }
    : null;
  return {
    id: p.media_id, formato: p.formato, publicado_em: new Date(p.publicado_em).toISOString(),
    legenda: p.legenda || '', link: p.link, miniatura: p.miniatura || null,
    alcance, views: num(p.views), curtidas: num(p.curtidas), comentarios: num(p.comentarios),
    compartilhamentos: num(p.compartilhamentos), salvamentos: num(p.salvamentos), interacoes,
    engajamento: taxa(interacoes, alcance),
    tempo_medio_s: p.tempo_medio_ms === null || p.tempo_medio_ms === undefined ? null : Number(p.tempo_medio_ms) / 1000,
    visitas_perfil: num(p.visitas_perfil), seguidores: num(p.seguidores),
    impulsionado: pago, atualizado_em: new Date(p.atualizado_em).toISOString(),
  };
}

export function montarConteudo({ posts = [], stories = [] }) {
  const linhas = posts.map(linhaDoPost);
  const itensStory = stories.map((s) => ({
    id: s.story_id, formato: 'Story', publicado_em: new Date(s.publicado_em).toISOString(), link: s.link,
    miniatura: s.miniatura || null, alcance: num(s.alcance), views: num(s.views), interacoes: num(s.interacoes),
    engajamento: taxa(num(s.interacoes), num(s.alcance)), seguidores: num(s.seguidores),
  }));
  const formatos = FORMATOS.map(({ formato, rotulo }) => {
    const itens = formato === 'Story' ? itensStory : linhas.filter((l) => l.formato === formato);
    if (!itens.length) return { formato, rotulo, quantidade: 0 };
    const melhor = itens.reduce((a, b) => ((b.alcance ?? -1) > (a.alcance ?? -1) ? b : a));
    return {
      formato, rotulo, quantidade: itens.length,
      alcance_medio: media(itens.map((i) => i.alcance)),
      views_medio: media(itens.map((i) => i.views)),
      interacoes_medio: media(itens.map((i) => i.interacoes)),
      engajamento_medio: media(itens.map((i) => i.engajamento)),
      seguidores: somaOuNull(itens.map((i) => i.seguidores)),
      melhor: { id: melhor.id, miniatura: melhor.miniatura, alcance: melhor.alcance, publicado_em: melhor.publicado_em, link: melhor.link },
    };
  });
  const comDado = formatos.filter((f) => f.quantidade);
  const lider = (campo) => (comDado.length > 1
    ? comDado.reduce((a, b) => ((b[campo] ?? -1) > (a[campo] ?? -1) ? b : a)).formato : null);
  return {
    formatos,
    lider_alcance: lider('alcance_medio'),
    lider_engajamento: lider('engajamento_medio'),
    posts: linhas.sort((a, b) => (b.alcance ?? -1) - (a.alcance ?? -1)),
  };
}

// ---------------------------------------------------------------- stories

const NAV = { tap_forward: 'avancou', tap_back: 'voltou', tap_exit: 'saiu', swipe_forward: 'proximo' };
const DURACAO_STORY_MS = 24 * 3600000;
// Última captura mais de 3h antes do fim: o número final pode ter sido maior.
const MARGEM_PARCIAL_MS = 3 * 3600000;

export function montarStories({ stories = [], registroDesde = null, de = null, agoraMs = Date.now() }) {
  const itens = stories.map((s) => {
    const pub = new Date(s.publicado_em).getTime();
    const ultima = new Date(s.ultima_captura_em).getTime();
    const noAr = agoraMs < pub + DURACAO_STORY_MS;
    const nav = {};
    for (const [k, v] of Object.entries(s.navegacao || {})) if (NAV[k]) nav[NAV[k]] = Number(v);
    return {
      id: s.story_id, publicado_em: new Date(pub).toISOString(), link: s.link, miniatura: s.miniatura || null,
      tipo: s.tipo, alcance: num(s.alcance), views: num(s.views), respostas: num(s.respostas),
      compartilhamentos: num(s.compartilhamentos), interacoes: num(s.interacoes), seguidores: num(s.seguidores),
      visitas_perfil: num(s.visitas_perfil), navegacao: nav,
      no_ar: noAr, captura_parcial: !noAr && ultima < pub + DURACAO_STORY_MS - MARGEM_PARCIAL_MS,
      ultima_captura_em: new Date(ultima).toISOString(),
    };
  }).sort((a, b) => (a.publicado_em < b.publicado_em ? 1 : -1));
  const alcances = somaOuNull(itens.map((i) => i.alcance));
  const saidas = somaOuNull(itens.map((i) => i.navegacao.saiu ?? null));
  const desde = registroDesde ? new Date(registroDesde).toISOString() : null;
  return {
    totais: {
      quantidade: itens.length,
      alcance_medio: media(itens.map((i) => i.alcance)),
      visualizacoes: somaOuNull(itens.map((i) => i.views)),
      respostas: somaOuNull(itens.map((i) => i.respostas)),
      taxa_saida: taxa(saidas, alcances),
    },
    registro_desde: desde,
    periodo_antes_do_registro: !!(desde && de && de < desde.slice(0, 10)),
    stories: itens,
  };
}

// ---------------------------------------------------------------- público

const PAISES = {
  BR: 'Brasil', US: 'Estados Unidos', PT: 'Portugal', ES: 'Espanha', FR: 'França', GB: 'Reino Unido',
  IT: 'Itália', AR: 'Argentina', PY: 'Paraguai', JP: 'Japão', DE: 'Alemanha', CA: 'Canadá', UY: 'Uruguai',
  CL: 'Chile', MX: 'México', CO: 'Colômbia', BO: 'Bolívia', PE: 'Peru', AO: 'Angola', CH: 'Suíça', IE: 'Irlanda',
};
const GENERO = { F: 'Mulheres', M: 'Homens', U: 'Não informado' };
const limparCidade = (c) => c.replace(/ \(state\)/g, '').replace(/, /, ' · ');

function distribuicao(valores, rotulo, ordem, limite) {
  const total = soma(Object.values(valores).map(Number));
  let itens = Object.entries(valores).map(([k, v]) => ({ chave: k, rotulo: rotulo(k), valor: Number(v), pct: total ? (Number(v) / total) * 100 : 0 }));
  itens = ordem === 'chave' ? itens.sort((a, b) => a.chave.localeCompare(b.chave)) : itens.sort((a, b) => b.valor - a.valor);
  return limite ? itens.slice(0, limite) : itens;
}

// `linhas`: ig_publico do retrato mais recente. `online`: linha de ig_online.
export function montarPublico({ linhas = [], online = null }) {
  const dia = linhas.length ? linhas.map((l) => ymd(l.dia)).sort().pop() : null;
  const publico = (qual) => {
    const minhas = linhas.filter((l) => l.publico === qual && ymd(l.dia) === dia);
    if (!minhas.length || minhas.every((l) => l.vazio)) return { vazio: true };
    const v = (dim) => (minhas.find((l) => l.dimensao === dim) || {}).valores || {};
    return {
      vazio: false,
      idade: distribuicao(v('idade'), (k) => `${k} anos`, 'chave'),
      genero: distribuicao(v('genero'), (k) => GENERO[k] || k, 'chave'),
      cidades: distribuicao(v('cidade'), limparCidade, 'valor', 10),
      paises: distribuicao(v('pais'), (k) => PAISES[k] || k, 'valor', 5),
    };
  };
  let horas = null;
  if (online && Array.isArray(online.por_hora) && online.por_hora.length === 24) {
    const pico = online.por_hora.indexOf(Math.max(...online.por_hora));
    horas = { dia: ymd(online.dia), por_hora: online.por_hora.map(Number), pico };
  }
  return { retrato_dia: dia, seguidores: publico('seguidores'), engajados: publico('engajados'), online: horas };
}
