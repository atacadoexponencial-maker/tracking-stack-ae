// Pacote de fatos da semana do relatório do Argo
// (spec-relatorio-semanal-argo.md, módulo 3; issue 405).
//
// É TUDO o que a análise escrita pode ver, e a única coisa que ela enxerga.
// Cada número e cada informação vira um fato com etiqueta (F1, F2...), valor
// cru, valor já escrito em português, período, fonte e marcas
// (indisponível, amostra pequena, contexto vencido). A tela desenha a partir
// daqui e a checagem (issue 407) confere a análise contra estes fatos.
//
// Regras que valem para o módulo inteiro:
// - Fonte que falhou vira fato "indisponível", nunca zero.
// - Média das 4 semanas soma antes de dividir (média de razões mente quando o
//   volume muda).
// - Os sinais (melhor, pior, estável) e as marcas saem prontos daqui: a tela e
//   a análise não calculam nada.
// Módulo puro: recebe as fontes já lidas (`_argo-relatorio-fontes.js`).

export const VERSAO_PACOTE = 1;
// Abaixo disso a variação de um funil não sustenta conclusão nenhuma. Junto
// com o piso do Argo (gasto mínimo = multiplicador × CPL médio), o mesmo que
// ele usa para julgar anúncio de lead.
export const PISO_LEADS = 10;
export const LIMITE_ATIPICA = 0.3;
export const LIMITE_ESTAVEL = 0.05;

// Espaço comum depois do "R$" (o Intl usa o não separável): a checagem compara texto.
const brl = (c) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\u00a0/g, ' ');
const int = (n) => Number(n).toLocaleString('pt-BR');
const pct = (x, casas = 1) => `${(x * 100).toLocaleString('pt-BR', { maximumFractionDigits: casas, minimumFractionDigits: casas })}%`;

export function textoDoValor(valor, unidade) {
  if (valor == null) return 'indisponível';
  if (unidade === 'centavos') return brl(valor);
  if (unidade === 'int') return int(valor);
  if (unidade === 'fracao') return pct(valor);
  return String(valor);
}

const METRICAS_LEAD = [
  { id: 'gasto', nome: 'Gasto', unidade: 'centavos', menorMelhor: null },
  { id: 'leads', nome: 'Leads', unidade: 'int', menorMelhor: false },
  { id: 'mqls', nome: 'MQLs', unidade: 'int', menorMelhor: false, crm: true },
  { id: 'cpl', nome: 'CPL', unidade: 'centavos', menorMelhor: true },
  { id: 'cpmql', nome: 'Custo por MQL', unidade: 'centavos', menorMelhor: true, crm: true },
];
const METRICAS_VENDA = [
  { id: 'gasto', nome: 'Gasto', unidade: 'centavos', menorMelhor: null },
  { id: 'compras', nome: 'Compras', unidade: 'int', menorMelhor: false },
  { id: 'cpa', nome: 'Custo por compra', unidade: 'centavos', menorMelhor: true },
];
const METRICAS_MANUAL = [{ id: 'gasto', nome: 'Gasto', unidade: 'centavos', menorMelhor: null }];

// Custo que fica sem valor porque o denominador é zero.
const SEM_DENOMINADOR = { cpl: 'sem leads', cpmql: 'sem MQLs', cpa: 'sem compras' };

const metricasDoTipo = (tipo) => (tipo === 'lead_mql' ? METRICAS_LEAD : tipo === 'venda_greenn' ? METRICAS_VENDA : METRICAS_MANUAL);
// Custo sem gasto (venda sem anúncio, funil parado) não é custo zero: fica sem valor.
const div = (a, b) => (a == null || b == null || !a || !b ? null : Math.round(a / b));
const numOuNulo = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** O "sem funil" do relatório de marketing com a cara de um bloco de lead. */
export function blocoSemFunil(r) {
  if (!r || !r.sem_funil) return null;
  const sf = r.sem_funil;
  return { nome: 'Sem funil', tipo: 'lead_mql', sem_funil: true, investido: Number(sf.investido || 0), metricas: { novos_leads: sf.novos_leads, mqls: sf.mqls } };
}

/** Números de um bloco do relatório de marketing, em centavos. `semanas` divide os volumes. */
export function numerosDoBloco(bloco, semanas = 1) {
  if (!bloco) return null;
  const gastoTotal = Math.round(Number(bloco.investido || 0) * 100);
  const m = bloco.metricas || {};
  const leadsT = numOuNulo(m.novos_leads);
  const mqlsT = numOuNulo(m.mqls);
  const comprasT = numOuNulo(m.compras_realizadas);
  return {
    gasto: Math.round(gastoTotal / semanas),
    leads: leadsT == null ? null : Math.round(leadsT / semanas),
    mqls: mqlsT == null ? null : Math.round(mqlsT / semanas),
    compras: comprasT == null ? null : Math.round(comprasT / semanas),
    cpl: div(gastoTotal, leadsT),
    cpmql: div(gastoTotal, mqlsT),
    cpa: div(gastoTotal, comprasT),
  };
}

/** Sinal de uma métrica frente à meta (quando há) ou à média. */
export function sinalDaMetrica({ valor, meta, media, menorMelhor, amostraPequena }) {
  if (menorMelhor == null || valor == null) return null;
  if (amostraPequena) return { tipo: 'amostra' };
  const ref = meta != null ? meta : media;
  if (ref == null || ref === 0) return null;
  const d = (valor - ref) / ref;
  const contra = meta != null ? 'meta' : 'media';
  if (Math.abs(d) < LIMITE_ESTAVEL) return { tipo: 'estavel', pct: d, contra };
  const melhor = menorMelhor ? d < 0 : d > 0;
  return { tipo: melhor ? 'melhor' : 'pior', pct: d, contra };
}

/**
 * Separa a mudança do CPL geral (funis de lead) em preço e mix, segurando a
 * divisão da verba da semana anterior. Sem dado dos dois lados, devolve null.
 */
export function precoEMix(atuais, anteriores) {
  const pares = atuais.map((a) => ({ a, b: anteriores.find((x) => x.nome === a.nome) }))
    .filter(({ a, b }) => b && a.leads && b.leads && a.gasto && b.gasto);
  if (!pares.length) return null;
  const gA = pares.reduce((s, p) => s + p.b.gasto, 0);
  const lA = pares.reduce((s, p) => s + p.b.leads, 0);
  const gB = pares.reduce((s, p) => s + p.a.gasto, 0);
  const lB = pares.reduce((s, p) => s + p.a.leads, 0);
  const cplA = gA / lA;
  const cplB = gB / lB;
  const cplPreco = 1 / pares.reduce((s, p) => s + (p.b.gasto / gA) / (p.a.gasto / p.a.leads), 0);
  return { cpl_anterior: Math.round(cplA), cpl_atual: Math.round(cplB), efeito_preco: Math.round(cplPreco - cplA), efeito_mix: Math.round(cplB - cplPreco) };
}

const ROTULO_ACAO = {
  pausar_campanha_trafego: 'Pausar campanha', pausar_anuncio: 'Pausar anúncio', pausar_conjunto: 'Pausar conjunto',
  reduzir_orcamento: 'Reduzir orçamento', aumentar_orcamento: 'Aumentar orçamento', realocar_verba: 'Realocar verba',
  reativar_anuncio: 'Reativar anúncio', desfazer_pausa: 'Desfazer pausa', mudanca_manual: 'Mudança manual',
};
const GRUPO_ACAO = (tipo) => (/pausar|desfazer|reativar/.test(tipo) ? 'Pausas' : /orcamento|verba/.test(tipo) ? 'Orçamento' : 'Outras');
const dataBR = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' }) : '');

/**
 * Monta o pacote inteiro. `fontes` vem de `coletarFontes`; cada campo é o dado
 * lido ou `{ erro }` quando a fonte falhou.
 */
export function montarPacote(fontes) {
  const { hoje, janelas } = fontes;
  const fatos = {};
  const ordem = [];
  let n = 0;
  const fato = (grupo, nome, valor, unidade, extra = {}) => {
    const id = `F${++n}`;
    const marcas = extra.marcas || [];
    let valorTexto = extra.texto || '';
    if (unidade && unidade !== 'texto') {
      // Custo sem denominador ("sem leads") não é dado faltando.
      valorTexto = valor == null && !marcas.includes('indisponivel') && extra.semValor ? extra.semValor : textoDoValor(valor, unidade);
    }
    fatos[id] = {
      id, grupo, nome, valor: valor ?? null, unidade: unidade || 'texto',
      valor_texto: valorTexto,
      periodo: extra.periodo || janelas.semana.rotulo, fonte: extra.fonte || '', marcas,
    };
    ordem.push(id);
    return id;
  };
  const fontesComProblema = [];
  const problema = (fonte, aviso) => {
    const id = fato('Fontes com problema', `${fonte} indisponível`, null, 'texto', { texto: aviso, fonte: 'Geração do relatório', marcas: ['indisponivel'] });
    fontesComProblema.push({ fonte, aviso, fato_id: id });
  };

  // ---------------------------------------------------------------- funis
  const res = fontes.resultados || {};
  const okRes = (r) => r && !r.erro && Array.isArray(r.blocos);
  if (!okRes(res.atual)) problema('Resultados por funil', (res.atual && res.atual.erro) || 'O relatório de marketing não respondeu.');
  const crmFora = okRes(res.atual) && (res.atual.blocos || []).some((b) => b.tipo === 'lead_mql' && b.metricas && b.metricas.novos_leads == null);
  if (crmFora) problema('CRM (ClickUp)', 'Leads e MQLs da semana ficaram sem número: o CRM não respondeu na geração.');

  const metas = Array.isArray(fontes.metas) ? fontes.metas : [];
  if (fontes.metas && fontes.metas.erro) problema('Metas por funil', fontes.metas.erro);
  const piso = Number((fontes.piso && fontes.piso.multiplicador) || 3);
  const funis = [];
  const resumoGasto = { atual: 0, media: null };
  const atuaisLead = [];
  const anterioresLead = [];
  if (okRes(res.atual)) {
    // "Sem funil" entra como mais um painel quando teve gasto ou lead: dinheiro
    // fora de qualquer funil não pode sumir do relatório.
    const semFunilAtual = blocoSemFunil(res.atual);
    const blocosDaSemana = [...res.atual.blocos, ...(semFunilAtual && (semFunilAtual.investido > 0 || semFunilAtual.metricas.novos_leads > 0) ? [semFunilAtual] : [])];
    for (const bloco of blocosDaSemana) {
      // O nome nos fatos diz que o funil foi desativado: a análise não trata como funil vivo.
      const nomeFunil = bloco.arquivado ? `${bloco.nome} (desativado)` : bloco.nome;
      const achar = (r) => (!okRes(r) ? null : bloco.sem_funil ? blocoSemFunil(r) : r.blocos.find((b) => b.nome === bloco.nome));
      const atual = numerosDoBloco(bloco, 1);
      const ant = numerosDoBloco(achar(res.anterior), 1);
      const media = numerosDoBloco(achar(res.media4), 4);
      const meta = metas.find((m) => m.nome === bloco.nome) || null;
      resumoGasto.atual += atual.gasto;
      if (bloco.tipo === 'lead_mql') {
        atuaisLead.push({ nome: bloco.nome, ...atual });
        if (ant) anterioresLead.push({ nome: bloco.nome, ...ant });
      }
      const amostraPequena = bloco.tipo === 'lead_mql' && atual.leads != null
        && (atual.leads < PISO_LEADS || (media && media.cpl && atual.gasto < piso * media.cpl));
      const metaDe = (id) => {
        if (!meta) return null;
        if (id === 'cpl') return meta.cpl_max_centavos ?? null;
        if (id === 'cpmql') return meta.custo_mql_max_centavos ?? null;
        if (id === 'leads' && meta.leads_novos != null) return Math.round((meta.leads_novos * 7) / meta.dias_no_mes);
        if (id === 'mqls' && meta.mqls != null) return Math.round((meta.mqls * 7) / meta.dias_no_mes);
        return null;
      };
      const metricas = metricasDoTipo(bloco.tipo).map((m) => {
        const fora = (v) => v == null && (m.crm || ['leads', 'cpl'].includes(m.id)) && crmFora;
        const marcasAtual = [];
        if (fora(atual[m.id])) marcasAtual.push('indisponivel');
        if (amostraPequena && m.id !== 'gasto' && atual[m.id] != null) marcasAtual.push('amostra_pequena');
        const fonte = m.id === 'gasto' ? 'Meta (relatório de marketing)' : m.crm || m.id === 'leads' ? 'CRM (ClickUp)' : m.id === 'compras' ? 'Greenn' : 'Cálculo do relatório';
        const semValorDe = (x) => (x && x.gasto === 0 && m.menorMelhor === true ? 'sem gasto' : SEM_DENOMINADOR[m.id]);
        const semValor = semValorDe(atual);
        const marcasNulo = (x) => (x == null && !semValor ? ['indisponivel'] : []);
        const fatoId = fato('Resultados por funil', `${m.nome} · ${nomeFunil}`, atual[m.id], m.unidade, { fonte, marcas: marcasAtual, semValor });
        const antId = ant ? fato('Comparações', `${m.nome} · ${nomeFunil} · semana anterior`, ant[m.id], m.unidade, { fonte, periodo: janelas.anterior.rotulo, marcas: marcasNulo(ant[m.id]), semValor: semValorDe(ant) }) : null;
        const mediaId = media ? fato('Comparações', `${m.nome} · ${nomeFunil} · média das 4 semanas anteriores`, media[m.id], m.unidade, { fonte, periodo: janelas.media4.rotulo, marcas: marcasNulo(media[m.id]), semValor: semValorDe(media) }) : null;
        const metaValor = metaDe(m.id);
        const metaId = metaValor != null ? fato('Metas', `Meta de ${m.nome} · ${nomeFunil}${['leads', 'mqls'].includes(m.id) ? ' (semanal, proporcional à mensal)' : ''}`, metaValor, m.unidade, { fonte: 'Metas por funil (dash)' }) : null;
        const sinal = sinalDaMetrica({ valor: atual[m.id], meta: metaValor, media: media ? media[m.id] : null, menorMelhor: m.menorMelhor, amostraPequena: marcasAtual.includes('amostra_pequena') });
        // A variação vira fato próprio: a análise cita o número pronto e não faz conta.
        let variacaoId = null;
        if (sinal && sinal.pct != null) {
          const ref = sinal.contra === 'meta' ? 'meta' : 'média das 4 semanas anteriores';
          const sentido = sinal.pct < 0 ? 'abaixo' : 'acima';
          variacaoId = fato('Comparações', `Variação de ${m.nome} · ${nomeFunil} frente à ${ref}`, null, 'texto', {
            texto: `${pct(Math.abs(sinal.pct), 0)} ${sentido} da ${ref} (${sinal.tipo === 'estavel' ? 'estável' : sinal.tipo}).`, fonte: 'Cálculo do relatório', marcas: marcasAtual,
          });
        }
        return {
          metrica: m.id, nome: m.nome, unidade: m.unidade, fato_id: fatoId, ant_id: antId, media_id: mediaId, meta_id: metaId, variacao_id: variacaoId,
          tem_meta_possivel: ['cpl', 'cpmql'].includes(m.id),
          sinal,
        };
      });
      funis.push({ nome: bloco.nome, tipo: bloco.tipo, sem_investimento: !!bloco.sem_investimento, amostra_pequena: !!amostraPequena, arquivado: !!bloco.arquivado, sem_funil: !!bloco.sem_funil, metricas });
    }
    if (okRes(res.media4)) resumoGasto.media = Math.round(res.media4.blocos.reduce((s, b) => s + Math.round(Number(b.investido || 0) * 100), 0) / 4);
  }
  if (okRes(res.atual) && !okRes(res.anterior)) problema('Semana anterior', 'Os números da semana anterior não responderam: sem comparação com ela.');

  // ---------------------------------------------------------- contexto
  const ctx = fontes.contexto;
  const contexto = { itens: [], vencidos: [], vazio: false };
  let eventosSemana = [];
  if (!ctx || ctx.erro) problema('Contexto do negócio', (ctx && ctx.erro) || 'Não foi possível ler o contexto.');
  else {
    for (const i of ctx.valendo) {
      const id = fato('Contexto do negócio', `${i.tipo}: ${i.titulo}`, null, 'texto', {
        texto: [i.texto, i.funil ? `Funil: ${i.funil}.` : '', i.inicio ? `De ${dataBR(i.inicio + 'T12:00:00Z')} a ${dataBR(i.fim + 'T12:00:00Z')}.` : ''].filter(Boolean).join(' '),
        fonte: 'Contexto do negócio', periodo: `revisado há ${i.dias_desde_revisao} dias`, marcas: i.situacao === 'revisar' ? ['vencido'] : [],
      });
      const item = { id: i.id, tipo: i.tipo, titulo: i.titulo, situacao: i.situacao, dias: i.dias_desde_revisao, fato_id: id };
      contexto.itens.push(item);
      if (i.situacao === 'revisar') contexto.vencidos.push(item);
    }
    contexto.vazio = !ctx.valendo.length;
    eventosSemana = [...ctx.valendo, ...ctx.terminados].filter((i) => i.tipo === 'evento' && i.inicio <= janelas.semana.fim && i.fim >= janelas.semana.inicio);
  }

  // ------------------------------------------------------------ marcas
  const motivosAtipica = eventosSemana.map((e) => `${e.titulo} (${dataBR(e.inicio + 'T12:00:00Z')}${e.fim !== e.inicio ? ` a ${dataBR(e.fim + 'T12:00:00Z')}` : ''}), do contexto.`);
  if (resumoGasto.media) {
    const d = (resumoGasto.atual - resumoGasto.media) / resumoGasto.media;
    if (Math.abs(d) >= LIMITE_ATIPICA) motivosAtipica.push(`gasto total ${d > 0 ? 'acima' : 'abaixo'} da média das 4 semanas anteriores em ${pct(Math.abs(d), 0)}.`);
  }
  const marcas = { atipica: null, mix: null };
  if (motivosAtipica.length) {
    marcas.atipica = { motivos: motivosAtipica, fato_id: fato('Marcas da semana', 'Semana atípica', null, 'texto', { texto: motivosAtipica.join(' '), fonte: 'Cálculo do relatório' }) };
  }
  const mix = precoEMix(atuaisLead, anterioresLead);
  if (mix) {
    const s = (c) => `${c < 0 ? '−' : '+'}${brl(Math.abs(c))}`;
    marcas.mix = { ...mix, fato_id: fato('Marcas da semana', 'Mudança do CPL geral: preço e mix', null, 'texto', {
      texto: `O CPL geral dos funis de lead foi de ${brl(mix.cpl_anterior)} para ${brl(mix.cpl_atual)}. Preço dos funis: ${s(mix.efeito_preco)}. Verba mudando de funil: ${s(mix.efeito_mix)}.`,
      fonte: 'Cálculo do relatório' }) };
  }

  // ------------------------------------------------- o que foi feito na conta
  const argo = fontes.argo;
  const acoes = { aprovadas: 0, recusadas: 0, pendentes: 0, executadas: 0, itens: [] };
  if (!argo || argo.erro) problema('Ações do Argo', (argo && argo.erro) || 'Não foi possível ler as ações do Argo.');
  else {
    const vereditoDaAcao = new Map((argo.vereditos || []).map((v) => [Number(v.acao_id), v]));
    for (const p of argo.propostas || []) {
      if (p.decisao === 'aprovada') acoes.aprovadas += 1;
      else if (p.decisao === 'rejeitada') acoes.recusadas += 1;
      else if (!p.decisao) acoes.pendentes += 1;
    }
    const vistas = new Set();
    for (const a of argo.acoes || []) {
      // Tentativa que não chegou a mudar a conta (alvo já estava pausado, Meta
      // recusou) não é "o que foi feito": o monitor repete a cada rodada.
      if (a.desfaz_acao_id || !a.aplicada) continue;
      vistas.add(Number(a.id));
      acoes.executadas += a.aplicada ? 1 : 0;
      const v = vereditoDaAcao.get(Number(a.id));
      const manual = a.tipo === 'mudanca_manual';
      const nome = `${ROTULO_ACAO[a.tipo] || a.tipo}: ${a.alvo_nome || a.alvo_id}`;
      const fatoId = fato('O que foi feito na conta', nome, null, 'texto', {
        texto: `${a.motivo || ''}${a.aplicada ? '' : ' (não aplicada)'}`.trim(), fonte: manual ? 'Mudanças manuais (Argo)' : 'Ações do Argo', periodo: dataBR(a.criada_em),
      });
      let vFato = null;
      if (v && ['acertou', 'errou', 'inconclusivo'].includes(v.situacao)) {
        vFato = fato('Vereditos', `Veredito de ${nome}`, null, 'texto', { texto: `${v.situacao}. ${v.motivo || ''}`.trim(), fonte: 'Vereditos do Argo', periodo: dataBR(v.avaliada_em) });
      }
      const proposta = (argo.propostas || []).find((p) => Number(p.acao_id) === Number(a.id));
      acoes.itens.push({
        grupo: manual ? 'Mudanças manuais' : GRUPO_ACAO(a.tipo), tipo: ROTULO_ACAO[a.tipo] || a.tipo, alvo: a.alvo_nome || a.alvo_id,
        motivo: a.motivo || '', quando: a.criada_em, aplicada: !!a.aplicada, manual,
        veredito: vFato ? { situacao: v.situacao, texto: v.motivo || '' } : null,
        aguardando: !vFato && v && v.situacao === 'avaliando' ? 'aguardando veredito' : null,
        proposta_id: proposta ? Number(proposta.id) : null, fato_id: fatoId, veredito_fato_id: vFato,
      });
    }
    // Vereditos da semana de ações de semanas anteriores.
    for (const v of argo.vereditos || []) {
      if (vistas.has(Number(v.acao_id)) || !['acertou', 'errou', 'inconclusivo'].includes(v.situacao)) continue;
      const nome = `${ROTULO_ACAO[v.tipo] || v.tipo}: ${v.alvo_nome || ''}`;
      const vFato = fato('Vereditos', `Veredito de ${nome} (ação anterior à semana)`, null, 'texto', { texto: `${v.situacao}. ${v.motivo || ''}`.trim(), fonte: 'Vereditos do Argo', periodo: dataBR(v.avaliada_em) });
      acoes.itens.push({ grupo: 'Vereditos de ações anteriores', tipo: ROTULO_ACAO[v.tipo] || v.tipo, alvo: v.alvo_nome || '', motivo: '', quando: v.criada_em, aplicada: true, manual: v.tipo === 'mudanca_manual',
        veredito: { situacao: v.situacao, texto: v.motivo || '' }, aguardando: null, proposta_id: null, fato_id: vFato, veredito_fato_id: vFato });
    }
    for (const p of (argo.propostas || []).filter((x) => x.decisao === 'rejeitada')) {
      const fatoId = fato('O que foi feito na conta', `Recusada: ${ROTULO_ACAO[p.tipo] || p.tipo}: ${p.alvo_nome || ''}`, null, 'texto', {
        texto: p.por_que ? `Motivo da recusa: ${p.por_que}` : (p.motivo || ''), fonte: 'Propostas do Argo', periodo: dataBR(p.decidida_em),
      });
      acoes.itens.push({ grupo: 'Recusadas', tipo: ROTULO_ACAO[p.tipo] || p.tipo, alvo: p.alvo_nome || '', motivo: p.por_que || p.motivo || '', quando: p.decidida_em, aplicada: false, manual: false,
        veredito: null, aguardando: null, proposta_id: Number(p.id), fato_id: fatoId, veredito_fato_id: null });
    }
  }

  // ------------------------------------------------------------ anúncios
  const an = fontes.anuncios;
  const anuncios = { itens: [], juncao: null };
  if (!an || an.erro) problema('Resultados por anúncio', (an && an.erro) || 'Não foi possível ler os anúncios.');
  else {
    const porNome = new Map();
    for (const l of an.insights) {
      const x = porNome.get(l.anuncio_nome) || { nome: l.anuncio_nome, conjunto: l.conjunto_nome, gasto: 0, impressoes: 0 };
      x.gasto += l.gasto_centavos;
      x.impressoes += l.impressoes;
      porNome.set(l.anuncio_nome, x);
    }
    const leads = an.leadsPorNome || {};
    let casados = 0;
    for (const [nome, x] of Object.entries(leads)) if (porNome.has(nome)) casados += x.leads;
    const totalPagos = Number(an.totalLeadsPagos || 0);
    if (totalPagos > 0) {
      const taxa = casados / totalPagos;
      anuncios.juncao = { taxa, fato_id: fato('Resultados por anúncio', 'Leads de tráfego pago que casam com um anúncio da conta (taxa de junção)', taxa, 'fracao', { fonte: 'CRM × Meta' }) };
    }
    const lista = [...porNome.values()].filter((x) => x.gasto > 0).sort((a, b) => b.gasto - a.gasto).slice(0, 15);
    for (const x of lista) {
      const l = leads[x.nome] || { leads: 0, mqls: 0 };
      const cpl = l.leads ? Math.round(x.gasto / l.leads) : null;
      const id = fato('Resultados por anúncio', `Anúncio ${x.nome}`, null, 'texto', {
        texto: `Gasto ${brl(x.gasto)}, ${int(l.leads)} leads, ${int(l.mqls)} MQLs${cpl ? `, CPL ${brl(cpl)}` : ''}. Conjunto: ${x.conjunto}.`,
        fonte: 'Meta + CRM', marcas: l.leads < PISO_LEADS ? ['amostra_pequena'] : [],
      });
      anuncios.itens.push({ nome: x.nome, conjunto: x.conjunto, gasto: x.gasto, leads: l.leads, mqls: l.mqls, cpl, fato_id: id });
    }
  }

  // --------------------------------------------------------------- testes
  const tt = fontes.testes;
  const testes = { itens: [] };
  if (!tt || tt.erro) problema('Registro de testes', (tt && tt.erro) || 'Não foi possível ler o registro de testes.');
  else {
    for (const t of tt.testes) {
      const ativo = t.situacao === 'rodando' || t.situacao === 'pronto';
      const fechadoNaSemana = (t.situacao === 'concluido' || t.situacao === 'abandonado') && t.fim && t.fim >= janelas.semana.inicio && t.fim <= hoje;
      const relevante = ativo || fechadoNaSemana || t.situacao === 'planejado';
      const historicoConcluido = t.situacao === 'concluido' && !fechadoNaSemana;
      if (!relevante && !historicoConcluido) continue;
      let numeros = '';
      if (t.numeros && t.numeros.ok && t.numeros.lados) {
        const L = t.numeros.lados;
        numeros = t.tipo === 'pagina'
          ? `Controle: ${int(L.controle.visitas)} visitas, ${L.controle.taxa == null ? 'sem conversão' : pct(L.controle.taxa)}. Variante: ${int(L.variante.visitas)} visitas, ${L.variante.taxa == null ? 'sem conversão' : pct(L.variante.taxa)}.`
          : `Controle: ${brl(L.controle.gasto_centavos)}, ${int(L.controle.leads)} leads, ${int(L.controle.mqls)} MQLs. Variante: ${brl(L.variante.gasto_centavos)}, ${int(L.variante.leads)} leads, ${int(L.variante.mqls)} MQLs.`;
      } else if (ativo) numeros = 'Números indisponíveis agora.';
      const leitura = t.leitura ? (t.situacao === 'pronto' ? 'Pronto para ler: atingiu os mínimos.' : `Ainda não pode ser lido: faltam ${t.leitura.falta_dias} dias${t.leitura.falta_amostra != null ? ` e ${t.leitura.falta_amostra} ${t.unidade}` : ''}.`) : '';
      const texto = [`Hipótese: ${t.hipotese}`, `Métrica: ${t.metrica}.`, t.criterio ? `Sucesso: ${t.criterio}.` : '', numeros, leitura,
        t.resultado ? `Resultado: ${t.resultado}. Aprendizado: ${t.aprendizado}` : '', t.motivo_abandono ? `Abandonado: ${t.motivo_abandono}` : ''].filter(Boolean).join(' ');
      const marcasT = ativo && t.situacao !== 'pronto' ? ['nao_pronto'] : [];
      const id = fato(historicoConcluido ? 'Testes já concluídos' : 'Testes', `Teste ${t.situacao}: ${t.nome}`, null, 'texto', {
        texto, fonte: 'Registro de testes', periodo: t.inicio ? `desde ${dataBR(t.inicio + 'T12:00:00Z')}` : 'planejado', marcas: marcasT,
      });
      testes.itens.push({ id: t.id, nome: t.nome, tipo: t.tipo, situacao: t.situacao, resultado: t.resultado, fechado_na_semana: !!fechadoNaSemana, historico: historicoConcluido, numeros, leitura, fato_id: id });
    }
  }

  // --------------------------------------------------- anúncios sem teste
  const novos = fontes.anunciosNovos;
  const anunciosSemTeste = [];
  if (novos && !novos.erro && tt && !tt.erro) {
    const ligados = new Set(tt.testes.flatMap((t) => [...(t.controle || []), ...(t.variante || [])].map((a) => a.id)));
    for (const a of novos.filter((x) => x.criado_em >= janelas.semana.inicio && x.criado_em <= janelas.semana.fim && !ligados.has(x.id))) {
      const id = fato('Anúncios novos sem teste', `Anúncio novo: ${a.nome}`, null, 'texto', { texto: `Criado em ${dataBR(a.criado_em + 'T12:00:00Z')}, conjunto ${a.conjunto_nome}. Não está ligado a nenhum teste do registro.`, fonte: 'Meta + Registro de testes' });
      anunciosSemTeste.push({ id: a.id, nome: a.nome, criado_em: a.criado_em, fato_id: id });
    }
  }

  // ------------------------------------------ o que a gestora disse antes
  const antes = fontes.semanaAnterior || { reacoes: [], descartes: [] };
  const semanaAnterior = { reacoes: [], descartes: [] };
  for (const r of antes.reacoes || []) {
    if (!r.tipo && !r.comentario) continue;
    const id = fato('Comentários da gestora na semana anterior', `Reação ao bloco "${r.bloco}"`, null, 'texto', { texto: `${r.tipo ? `Marcou como ${r.tipo}.` : ''} ${r.comentario || ''}`.trim(), fonte: 'Reações ao relatório anterior' });
    semanaAnterior.reacoes.push({ ...r, fato_id: id });
  }
  for (const d of antes.descartes || []) {
    const id = fato('Comentários da gestora na semana anterior', `Teste proposto descartado: ${d.titulo}`, null, 'texto', { texto: `Motivo: ${d.motivo}`, fonte: 'Testes propostos anteriores' });
    semanaAnterior.descartes.push({ ...d, fato_id: id });
  }

  return {
    versao: VERSAO_PACOTE,
    hoje,
    semana: janelas.semana,
    anterior: janelas.anterior,
    media4: janelas.media4,
    primeira: !fontes.temRelatorioAnterior,
    fatos,
    ordem,
    funis,
    acoes,
    anuncios,
    testes,
    contexto,
    marcas,
    anuncios_sem_teste: anunciosSemTeste,
    semana_anterior: semanaAnterior,
    fontes_com_problema: fontesComProblema,
    piso: { leads: PISO_LEADS, multiplicador: piso },
  };
}
