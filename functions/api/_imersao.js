// Imersão Planejamento Atacado 2027 (spec-imersao-2027.md, série S8).
//
// Regras e contas da tela do lançamento, sem banco: recebem os dados já lidos
// (vendas, tráfego, Meet) e as metas, e devolvem cada bloco pronto para o
// dash desenhar. O dash não faz conta nenhuma (public/dash/imersao.js).
//
// Valores em reais (a leitura do banco converte de centavos). Instantes em
// unix (segundos). Datas de calendário em 'YYYY-MM-DD' no fuso de Brasília.
import { LOTES_IMERSAO } from '../../src/data/lotes-imersao.js';
import { loteVigente } from '../../src/data/lotes-workshop.js';
import { canalDeLead } from './_canal.js';
import { ymdBrt } from './_data-brt.js';
import { variantesTelefone } from '../_telefone.js';

export const META_INGRESSOS = 100;
export const PRECO_BUMP = 297;
export const PCT_TRAFEGO_PADRAO = 75;
export const PRIMEIRO_DIA = '2026-11-09';
export const DIA_EVENTO = '2026-12-05';
// Último dia de venda que conta no pacing (SUP-S8-12): o sábado 05/12 só tem
// a manhã e só conta quando hoje já é 05/12.
export const ULTIMO_DIA_CHEIO = '2026-12-04';
export const FIM_VENDA = Date.parse('2026-12-05T09:30:00-03:00') / 1000;
// "Dias seguintes" da venda da Mentoria: 14 dias depois do pitch.
export const ULTIMO_DIA_POS = '2026-12-19';
// Janela do pico ao vivo depois do horário da oferta (SUP-S8-09).
export const JANELA_PICO_S = 30 * 60;
// Até aqui (fração da meta) o CAC acima do teto acende alerta (SUP-S8-07).
export const RETA_FINAL = 0.70;

// Faixas do especialista (lançamentos pagos de outros nichos): sempre
// "referência", nunca meta.
export const REFERENCIAS = {
  origem: '~75% das vendas vinham do tráfego pago',
  cpa_teto: 'manter o CAC abaixo do teto até 60% a 70% dos ingressos vendidos; na reta final pode subir',
  ctr: '0,95% a 1,06%',
  connect: '75% a 94%',
  page_checkout: '~15%',
  checkout_compra: '~40%',
  mentoria_bump: 'quem compra o bump costuma converter 30% a 100% mais',
  comparecimento: '70% a 80% (indicador secundário)',
  pico: 'costuma cair ao longo do dia',
  conversao_mentoria: '15% a 30% (indicador primário)',
  dia_pitch: '9% no dia + 11% nos 14 dias seguintes',
};

export const CAMPOS_META = ['verba_ingresso', 'pct_trafego', 'meta_bump', 'meta_mentoria', 'horario_oferta'];

const r1 = (n) => Math.round(n * 10) / 10;
const r2 = (n) => Math.round(n * 100) / 100;
const pct = (parte, todo) => (todo > 0 ? r2((parte / todo) * 100) : null);
const vazio = (v) => v === null || v === undefined || v === '';

// ── Calendário ─────────────────────────────────────────────────────────────

/** Dia seguinte de 'YYYY-MM-DD'. */
function proximoDia(ymd) {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Lista de dias de `de` a `ate`, inclusive. */
export function diasEntre(de, ate) {
  const out = [];
  for (let d = de; d <= ate; d = proximoDia(d)) out.push(d);
  return out;
}

const diaUtil = (ymd) => { const s = new Date(`${ymd}T12:00:00Z`).getUTCDay(); return s >= 1 && s <= 5; };

/**
 * Dias de venda pela frente, contando hoje (SUP-S8-02 e SUP-S8-12): de hoje
 * até sexta 04/12; no próprio 05/12 antes das 9h30, só esse dia (corrido).
 */
export function diasDeVenda(agora) {
  if (agora >= FIM_VENDA) return { lista: [], corridos: 0, uteis: 0, encerrada: true };
  const hoje = ymdBrt(agora);
  const inicio = hoje < PRIMEIRO_DIA ? PRIMEIRO_DIA : hoje;
  const lista = hoje === DIA_EVENTO ? [DIA_EVENTO] : diasEntre(inicio, ULTIMO_DIA_CHEIO);
  return { lista, corridos: lista.length, uteis: lista.filter(diaUtil).length, encerrada: false };
}

// ── Lotes ──────────────────────────────────────────────────────────────────

const precoDoTexto = (valor) => Number(String(valor).replace(/[^\d,]/g, '').replace(',', '.'));

/** Índice do lote vigente no instante (unix). Encerrada → último lote. */
export function indiceDoLote(unix) {
  const l = loteVigente(unix * 1000, LOTES_IMERSAO);
  return l.estado === 'aberto' ? l.indice : LOTES_IMERSAO.length - 1;
}

/** Preço do lote vigente ao meio-dia de um dia de calendário. */
export function precoDoDia(ymd) {
  return precoDoTexto(LOTES_IMERSAO[indiceDoLote(Date.parse(`${ymd}T12:00:00-03:00`) / 1000)].valor);
}

// ── Origem da venda (SUP-S8-04) ────────────────────────────────────────────

export const ORIGENS = [
  { chave: 'pago', rotulo: 'Tráfego pago' },
  { chave: 'organico', rotulo: 'Orgânico / conteúdo' },
  { chave: 'base', rotulo: 'Base antiga' },
  { chave: 'outros', rotulo: 'Outros' },
];

/** Reaproveita a regra de canal do tracking e refina o que ela chama de "outro". */
export function origemDaVenda(v) {
  const canal = canalDeLead({ utm_source: v.utm_source, utm_campaign: v.utm_campaign });
  if (canal === 'meta-ads') return 'pago';
  if (canal === 'bio') return 'organico';
  if (canal === 'email') return 'base';
  if (canal === 'direto') return 'outros';
  const fonte = String(v.utm_source || '').toLowerCase();
  const meio = String(v.utm_medium || '').toLowerCase();
  if (/(cpc|paid|pago|ads|anuncio)/.test(meio) || /ads/.test(fonte)) return 'pago';
  if (/(whatsapp|zap|manychat|disparo|base|lista)/.test(`${fonte} ${meio}`)) return 'base';
  if (/(bio|stor|post|reels|instagram|organic|conteudo|youtube|tiktok)/.test(`${fonte} ${meio}`)) return 'organico';
  return 'outros';
}

// ── Pessoas (SUP-S8-08) ────────────────────────────────────────────────────

const chavesDaPessoa = (v) => {
  const ch = [];
  const email = String(v.email || '').trim().toLowerCase();
  if (email) ch.push(`e:${email}`);
  for (const t of variantesTelefone(v.telefone)) ch.push(`t:${t}`);
  return ch;
};

function conjuntoDe(vendas) {
  const s = new Set();
  for (const v of vendas) for (const c of chavesDaPessoa(v)) s.add(c);
  return s;
}
const pertence = (v, conjunto) => chavesDaPessoa(v).some((c) => conjunto.has(c));

// ── Cores, picos ───────────────────────────────────────────────────────────

/** Cor do faturamento do dia: 20% ou mais acima = forte; acima ou igual = claro; abaixo = vermelho. */
export function corDoDia(realizado, previsto) {
  if (!(previsto > 0)) return null;
  const razao = realizado / previsto;
  if (razao >= 1.2) return 'forte';
  if (razao >= 1) return 'claro';
  return 'vermelho';
}

/** Previsto do dia pela meta: (faltam ÷ dias) × lote do dia + bump pela meta de conversão. */
export function previstoDoDia({ faltam, dias, preco, metaBump }) {
  if (!(faltam > 0) || !(dias > 0)) return 0;
  const porDia = faltam / dias;
  const bump = vazio(metaBump) ? 0 : porDia * (Number(metaBump) / 100) * PRECO_BUMP;
  return r2(porDia * preco + bump);
}

/** Maior número de pessoas presentes ao mesmo tempo dentro de [de, ate]. */
export function picoNaJanela(meet, de, ate) {
  const porPessoa = new Map();
  for (const m of meet || []) {
    const ini = Math.max(Number(m.entrou), de);
    const fim = Math.min(Number(m.saiu), ate);
    if (!(fim > ini)) continue;
    if (!porPessoa.has(m.pessoa)) porPessoa.set(m.pessoa, []);
    porPessoa.get(m.pessoa).push([ini, fim]);
  }
  const marcos = [];
  for (const trechos of porPessoa.values()) {
    trechos.sort((a, b) => a[0] - b[0]);
    const juntos = [];
    for (const t of trechos) {
      const u = juntos[juntos.length - 1];
      if (u && t[0] <= u[1]) u[1] = Math.max(u[1], t[1]); else juntos.push([...t]);
    }
    for (const [i, f] of juntos) marcos.push([i, 1], [f, -1]);
  }
  // Quem sai no mesmo segundo em que outro entra não conta como simultâneo.
  marcos.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let agora = 0, pico = 0;
  for (const [, d] of marcos) { agora += d; if (agora > pico) pico = agora; }
  return pico;
}

// ── Metas ──────────────────────────────────────────────────────────────────

/** Linhas de imersao_metas → { campo: valor } (número ou "HH:MM"; vazio = null). */
export function metasDasLinhas(linhas) {
  const m = Object.fromEntries(CAMPOS_META.map((c) => [c, null]));
  for (const l of linhas || []) {
    if (!CAMPOS_META.includes(l.campo) || vazio(l.valor)) continue;
    m[l.campo] = l.campo === 'horario_oferta' ? String(l.valor) : Number(l.valor);
  }
  return m;
}

const CAMPOS_PCT = ['pct_trafego', 'meta_bump', 'meta_mentoria'];
export const ERRO_NUMERO = 'digite um número';
export const ERRO_NEGATIVO = 'a verba não pode ser negativa';
export const ERRO_PCT = 'a porcentagem vai de 0 a 100';
export const ERRO_HORARIO = 'use o formato HH:MM (ex.: 16:00)';

/**
 * Valida as metas enviadas pela tela (S8-02). Só os campos conhecidos que
 * vierem no corpo; vazio = apagar a meta. Qualquer erro recusa o envio inteiro.
 * → { ok: true, metas: { campo: valor|null } } | { ok: false, erros: { campo: motivo } }
 */
export function validarMetas(corpo) {
  const metas = {};
  const erros = {};
  for (const campo of CAMPOS_META) {
    if (!corpo || !(campo in corpo)) continue;
    const bruto = corpo[campo];
    if (vazio(bruto) || String(bruto).trim() === '') { metas[campo] = null; continue; }
    if (campo === 'horario_oferta') {
      const h = String(bruto).trim();
      if (/^([01]\d|2[0-3]):[0-5]\d$/.test(h)) metas[campo] = h; else erros[campo] = ERRO_HORARIO;
      continue;
    }
    // "3.500,50" (com vírgula) → 3500.5; "10.5" ou 10.5 → 10.5.
    const texto = String(bruto).trim();
    const num = typeof bruto === 'number' ? bruto
      : Number(texto.includes(',') ? texto.replace(/\./g, '').replace(',', '.') : texto);
    if (!Number.isFinite(num)) { erros[campo] = ERRO_NUMERO; continue; }
    if (CAMPOS_PCT.includes(campo) && (num < 0 || num > 100)) { erros[campo] = ERRO_PCT; continue; }
    if (campo === 'verba_ingresso' && num < 0) { erros[campo] = ERRO_NEGATIVO; continue; }
    metas[campo] = num;
  }
  return Object.keys(erros).length ? { ok: false, erros } : { ok: true, metas };
}

/** Metas salvas prevalecem; no exemplo, as vazias recebem o valor de exemplo. */
export function metasEfetivas(salvas, exemplo = null) {
  const out = {};
  const origem = {};
  for (const c of CAMPOS_META) {
    if (!vazio(salvas?.[c])) { out[c] = salvas[c]; origem[c] = 'salva'; }
    else if (exemplo && !vazio(exemplo[c])) { out[c] = exemplo[c]; origem[c] = 'exemplo'; }
    else { out[c] = null; origem[c] = 'vazia'; }
  }
  return { ...out, meta_ingressos: META_INGRESSOS, origem };
}

const instanteDoHorario = (hhmm) => {
  if (!/^\d{2}:\d{2}$/.test(String(hhmm || ''))) return null;
  return Date.parse(`${DIA_EVENTO}T${hhmm}:00-03:00`) / 1000;
};

// ── Visão geral ────────────────────────────────────────────────────────────

/**
 * Os 5 blocos da Visão geral.
 * dados = { vendas[], trafego{investimento,impressoes,cliques}|null,
 *           visualizacoes|null, inicios_checkout|null, anuncios[], meet[]|null }
 */
export function calcularVisao(dados, metas, agora, { exemplo = false } = {}) {
  const pagas = (dados.vendas || []).filter((v) => (v.situacao || 'paga') === 'paga');
  const ingressos = pagas.filter((v) => v.produto === 'ingresso');
  const bumps = pagas.filter((v) => v.produto === 'bump');
  const vendidos = ingressos.length;
  const hoje = ymdBrt(agora);

  // ── Bloco 1: venda de ingressos ──
  const faltam = Math.max(0, META_INGRESSOS - vendidos);
  const dv = diasDeVenda(agora);
  const metaBatida = vendidos >= META_INGRESSOS;
  const diasDecorridos = diasEntre(PRIMEIRO_DIA, hoje > DIA_EVENTO ? DIA_EVENTO : hoje).length;
  const pacing = {
    faltam,
    dias_corridos: dv.corridos,
    dias_uteis: dv.uteis,
    por_dia_corrido: metaBatida || !dv.corridos ? null : r1(faltam / dv.corridos),
    por_dia_util: metaBatida || !dv.uteis ? null : r1(faltam / dv.uteis),
    ritmo_realizado: diasDecorridos > 0 ? r1(vendidos / diasDecorridos) : null,
    meta_batida: metaBatida,
    encerrada: dv.encerrada,
  };

  const ultimoDiaVenda = hoje > DIA_EVENTO ? DIA_EVENTO : hoje;
  const porDia = new Map();
  for (const d of hoje >= PRIMEIRO_DIA ? diasEntre(PRIMEIRO_DIA, ultimoDiaVenda) : []) {
    porDia.set(d, { dia: d, ingressos: 0, bumps: 0, realizado: 0 });
  }
  for (const v of [...ingressos, ...bumps]) {
    const d = porDia.get(ymdBrt(v.pago_em));
    if (!d) continue;
    d.realizado += Number(v.valor) || 0;
    if (v.produto === 'ingresso') d.ingressos += 1; else d.bumps += 1;
  }
  let acumulado = 0;
  const faturamentoDia = [];
  for (const d of porDia.values()) {
    const faltamNoDia = Math.max(0, META_INGRESSOS - acumulado);
    const diasNoDia = diasDeVenda(Date.parse(`${d.dia}T00:00:00-03:00`) / 1000).corridos;
    const previsto = previstoDoDia({ faltam: faltamNoDia, dias: diasNoDia, preco: precoDoDia(d.dia), metaBump: metas.meta_bump });
    faturamentoDia.push({ ...d, realizado: r2(d.realizado), previsto, cor: corDoDia(d.realizado, previsto) });
    acumulado += d.ingressos;
  }

  const atual = dv.encerrada ? -1 : indiceDoLote(agora);
  const lotes = LOTES_IMERSAO.map((l, i) => ({ rotulo: l.rotulo, preco: precoDoTexto(l.valor), ate: l.ate, vendidos: 0, atual: i === atual }));
  for (const v of ingressos) lotes[indiceDoLote(v.pago_em)].vendidos += 1;

  const contaOrigem = Object.fromEntries(ORIGENS.map((o) => [o.chave, 0]));
  for (const v of ingressos) contaOrigem[origemDaVenda(v)] += 1;
  const origem = ORIGENS.map((o) => ({ ...o, quantidade: contaOrigem[o.chave], pct: pct(contaOrigem[o.chave], vendidos) }));

  // ── Bloco 2: tráfego e página ──
  const t = dados.trafego || null;
  const inv = t && !vazio(t.investimento) ? Number(t.investimento) : null;
  const doTrafego = contaOrigem.pago;
  const cac = inv !== null && doTrafego > 0 ? r2(inv / doTrafego) : null;
  const pctTrafego = vazio(metas.pct_trafego) ? PCT_TRAFEGO_PADRAO : Number(metas.pct_trafego);
  const esperadosTrafego = (META_INGRESSOS * pctTrafego) / 100;
  const verbaVazia = vazio(metas.verba_ingresso);
  const teto = !verbaVazia && esperadosTrafego > 0 ? r2(Number(metas.verba_ingresso) / esperadosTrafego) : null;
  const alertaCac = cac !== null && teto !== null && cac > teto && vendidos / META_INGRESSOS < RETA_FINAL;
  const taxa = (valor, referencia) => ({ valor, referencia });
  const impr = t ? Number(t.impressoes) || 0 : 0;
  const cliques = t ? Number(t.cliques) || 0 : 0;
  const vis = vazio(dados.visualizacoes) ? null : Number(dados.visualizacoes);
  const ini = vazio(dados.inicios_checkout) ? null : Number(dados.inicios_checkout);

  const anuncios = (dados.anuncios || []).map((a) => {
    const nome = String(a.anuncio || '').trim().toLowerCase();
    const n = ingressos.filter((v) => String(v.utm_content || '').trim().toLowerCase() === nome).length;
    const investimento = Number(a.investimento) || 0;
    return { anuncio: a.anuncio, campanha: a.campanha || '', investimento, vendas: n, custo_por_venda: n > 0 ? r2(investimento / n) : null };
  });
  const porVendas = [...anuncios].sort((a, b) => b.vendas - a.vendas || (a.custo_por_venda ?? Infinity) - (b.custo_por_venda ?? Infinity));
  const porCusto = [...anuncios].sort((a, b) => (a.custo_por_venda ?? Infinity) - (b.custo_por_venda ?? Infinity) || b.vendas - a.vendas);

  const trafego = {
    investimento: inv,
    ingressos_trafego: doTrafego,
    cac: { valor: cac, alerta: alertaCac },
    cpa_teto: { valor: teto, falta_meta: verbaVazia, esperados_trafego: r1(esperadosTrafego), referencia: REFERENCIAS.cpa_teto },
    cpm: taxa(inv !== null && impr > 0 ? r2((inv / impr) * 1000) : null, null),
    ctr: taxa(t ? pct(cliques, impr) : null, REFERENCIAS.ctr),
    connect: taxa(vis !== null ? pct(vis, cliques) : null, REFERENCIAS.connect),
    page_checkout: taxa(vis !== null && ini !== null ? pct(ini, vis) : null, REFERENCIAS.page_checkout),
    checkout_compra: taxa(ini !== null ? pct(vendidos, ini) : null, REFERENCIAS.checkout_compra),
    ranking: { por_vendas: porVendas, por_custo: porCusto },
  };

  // ── Bloco 3: order bump ──
  const bumpDia = faturamentoDia.map((d) => ({ dia: d.dia, ingressos: d.ingressos, bumps: d.bumps, conversao: pct(d.bumps, d.ingressos) }));
  const compradoresIngresso = conjuntoDe(ingressos);
  const compradoresBump = conjuntoDe(bumps);
  const mentorias = pagas.filter((v) => v.produto === 'mentoria' && pertence(v, compradoresIngresso));
  const mentoriasComBump = mentorias.filter((v) => pertence(v, compradoresBump)).length;
  const qtdBump = bumps.length;
  const soIngresso = Math.max(0, vendidos - qtdBump);
  const convCom = pct(mentoriasComBump, qtdBump);
  const convSem = pct(mentorias.length - mentoriasComBump, soIngresso);
  const bump = {
    por_dia: bumpDia,
    total: { ingressos: vendidos, bumps: qtdBump, conversao: pct(qtdBump, vendidos) },
    meta: vazio(metas.meta_bump) ? null : Number(metas.meta_bump),
    mentoria: {
      com_bump: { compradores: qtdBump, mentorias: mentoriasComBump, conversao: convCom },
      sem_bump: { compradores: soIngresso, mentorias: mentorias.length - mentoriasComBump, conversao: convSem },
      diferenca_pct: convCom !== null && convSem ? r1((convCom / convSem - 1) * 100) : null,
      referencia: REFERENCIAS.mentoria_bump,
    },
  };

  // ── Blocos 4 e 5: evento e depois do evento ──
  const disponivel = exemplo || hoje >= DIA_EVENTO;
  const oferta = instanteDoHorario(metas.horario_oferta);
  const meet = dados.meet || null;
  const presentes = meet ? new Set(meet.map((m) => m.pessoa)).size : null;
  const pico = meet && oferta !== null ? picoNaJanela(meet, oferta, oferta + JANELA_PICO_S) : null;
  const evento = {
    disponivel,
    comparecimento: { valor: presentes !== null ? pct(presentes, vendidos) : null, presentes, referencia: REFERENCIAS.comparecimento },
    pico: { valor: pico, falta_meta: oferta === null, horario: metas.horario_oferta || null, referencia: REFERENCIAS.pico },
  };

  const noDia = mentorias.filter((v) => ymdBrt(v.pago_em) === DIA_EVENTO).length;
  const seguintes = mentorias.filter((v) => { const d = ymdBrt(v.pago_em); return d > DIA_EVENTO && d <= ULTIMO_DIA_POS; }).length;
  const soma = (lista) => lista.reduce((s, v) => s + (Number(v.valor) || 0), 0);
  const fatIngressos = soma(ingressos), fatBump = soma(bumps), fatMentoria = soma(mentorias);
  const faturamento = r2(fatIngressos + fatBump + fatMentoria);
  const ticket = vendidos > 0 ? r2(faturamento / vendidos) : null;
  const conversaoMentoria = pct(mentorias.length, vendidos);
  const resultado = {
    disponivel,
    destaque: {
      pessoas_ao_vivo: pico,
      ticket_medio: ticket,
      conversao_mentoria: conversaoMentoria,
      meta_mentoria: vazio(metas.meta_mentoria) ? null : Number(metas.meta_mentoria),
    },
    conversao_mentoria: { valor: conversaoMentoria, mentorias: mentorias.length, referencia: REFERENCIAS.conversao_mentoria },
    dia_x_seguintes: {
      no_dia: { mentorias: noDia, conversao: pct(noDia, vendidos) },
      seguintes: { mentorias: seguintes, conversao: pct(seguintes, vendidos) },
      referencia: REFERENCIAS.dia_pitch,
    },
    faturamento: { total: faturamento, ingressos: r2(fatIngressos), bump: r2(fatBump), mentoria: r2(fatMentoria) },
    ticket_medio: ticket,
    roas: inv ? r2(faturamento / inv) : null,
  };

  return {
    exemplo,
    agora,
    hoje,
    metas,
    ingressos: {
      vendidos: { valor: vendidos, meta: META_INGRESSOS, pct: pct(vendidos, META_INGRESSOS) },
      pacing,
      faturamento_dia: faturamentoDia,
      lotes,
      origem: { linhas: origem, referencia: REFERENCIAS.origem },
    },
    trafego,
    bump,
    evento,
    resultado,
  };
}
