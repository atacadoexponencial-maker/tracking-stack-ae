// Registro de testes do Argo (spec-relatorio-semanal-argo.md, módulo 2;
// issues 403 e 404).
//
// Módulo puro, testado por `node --test`: valida cada ação da aba, decide quais
// transições valem, o que vai para o histórico e quando um teste fica pronto
// para ler. A aba e o relatório semanal usam as mesmas funções.

export const TIPOS_TESTE = Object.freeze(['criativo', 'publico', 'pagina', 'oferta']);
export const SITUACOES_TESTE = Object.freeze(['planejado', 'rodando', 'pronto', 'concluido', 'abandonado']);
export const RESULTADOS_TESTE = Object.freeze(['variante', 'controle', 'empate', 'inconclusivo']);
export const ACOES_TESTE = Object.freeze(['criar', 'editar', 'iniciar', 'concluir', 'abandonar']);
export const NIVEIS_ALVO = Object.freeze(['anuncio', 'conjunto']);

// Mínimos padrão do formulário: 14 dias (duas semanas inteiras, a mesma regra
// do teste A/B de página) e 60 leads (o volume que detecta uma melhora de 50%,
// medido no A/B). A gestora ajusta por teste.
export const MIN_DIAS_PADRAO = 14;
export const MIN_AMOSTRA_PADRAO = 60;

const ATIVOS = ['rodando', 'pronto'];
const DIA_MS = 86400000;
const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function lado(lista) {
  if (!Array.isArray(lista)) return null;
  const vistos = new Set();
  const saida = [];
  for (const a of lista) {
    if (!a || !NIVEIS_ALVO.includes(a.nivel)) return null;
    const id = String(a.id ?? '').trim();
    if (!/^\d{1,30}$/.test(id)) return null;
    if (vistos.has(id)) continue;
    vistos.add(id);
    saida.push({ nivel: a.nivel, id, nome: texto(a.nome, 200) || id });
  }
  return saida;
}

function camposDoTeste(c, tipo) {
  const nome = texto(c.nome, 120);
  if (!nome) return { erro: 'Dê um nome ao teste.' };
  const hipotese = texto(c.hipotese, 1000);
  if (!hipotese) return { erro: 'Escreva a hipótese.' };
  const metrica = texto(c.metrica, 120);
  if (!metrica) return { erro: 'Escolha a métrica principal.' };
  const minDias = c.min_dias == null ? MIN_DIAS_PADRAO : Number(c.min_dias);
  if (!Number.isInteger(minDias) || minDias < 1 || minDias > 180) return { erro: 'Duração mínima entre 1 e 180 dias.' };
  const minAmostra = c.min_amostra == null ? MIN_AMOSTRA_PADRAO : Number(c.min_amostra);
  if (!Number.isInteger(minAmostra) || minAmostra < 1 || minAmostra > 1000000) return { erro: 'Amostra mínima inválida.' };
  let controle = [];
  let variante = [];
  let abTestId = null;
  if (tipo === 'pagina') {
    abTestId = Number(c.ab_test_id);
    if (!Number.isInteger(abTestId) || abTestId <= 0) return { erro: 'Escolha o teste A/B da página.' };
  } else {
    controle = lado(c.controle);
    variante = lado(c.variante);
    if (!controle || !variante) return { erro: 'Os lados do teste vieram em formato inválido.' };
    if (!controle.length || !variante.length) return { erro: 'Escolha pelo menos um anúncio ou conjunto em cada lado.' };
    // Criativo e público comparam anúncios ou conjuntos diferentes. Oferta pode
    // rodar nos mesmos (o que muda é o formulário ou a isca, não o anúncio).
    const ids = new Set(controle.map((a) => a.id));
    if (tipo !== 'oferta' && variante.some((a) => ids.has(a.id))) return { erro: 'O mesmo anúncio ou conjunto não pode estar nos dois lados.' };
  }
  return {
    valores: {
      nome, funil: texto(c.funil, 80) || null, hipotese, mudou: texto(c.mudou, 500), controle, variante,
      ab_test_id: abTestId, metrica, criterio: texto(c.criterio, 300), min_dias: minDias, min_amostra: minAmostra,
    },
  };
}

/** Valida o corpo do POST. Devolve `{ ok, acao, id, valores }` ou `{ ok:false, erro }`. */
export function validarTeste(corpo) {
  const c = corpo && typeof corpo === 'object' ? corpo : {};
  const acao = c.acao;
  if (!ACOES_TESTE.includes(acao)) return { ok: false, erro: 'Ação desconhecida.' };
  if (acao === 'criar') {
    if (!TIPOS_TESTE.includes(c.tipo)) return { ok: false, erro: 'Escolha o tipo do teste.' };
    const r = camposDoTeste(c, c.tipo);
    if (r.erro) return { ok: false, erro: r.erro };
    const comeca = c.comeca === 'rodando' ? 'rodando' : 'planejado';
    return { ok: true, acao, id: null, valores: { ...r.valores, tipo: c.tipo, comeca } };
  }
  const id = Number(c.id);
  if (!Number.isInteger(id) || id <= 0) return { ok: false, erro: 'Teste inválido.' };
  if (acao === 'editar') return { ok: true, acao, id, valores: c };
  if (acao === 'iniciar') return { ok: true, acao, id, valores: null };
  if (acao === 'concluir') {
    if (!RESULTADOS_TESTE.includes(c.resultado)) return { ok: false, erro: 'Escolha o resultado.' };
    const aprendizado = texto(c.aprendizado, 1500);
    if (!aprendizado) return { ok: false, erro: 'Escreva o aprendizado: é o que o relatório usa para não repetir o teste.' };
    return { ok: true, acao, id, valores: { resultado: c.resultado, aprendizado } };
  }
  const motivo = texto(c.motivo, 300);
  if (!motivo) return { ok: false, erro: 'Escreva o motivo do abandono.' };
  return { ok: true, acao, id, valores: { motivo } };
}

/** Valida a edição contra o teste atual (o tipo não muda depois de criado). */
export function validarEdicao(corpo, atual) {
  if (!ATIVOS.includes(atual.situacao) && atual.situacao !== 'planejado') return { ok: false, erro: 'Teste fechado não pode ser editado.' };
  const r = camposDoTeste(corpo, atual.tipo);
  if (r.erro) return { ok: false, erro: r.erro };
  return { ok: true, valores: r.valores };
}

/** O que muda de situação, e se pode. */
export function transicao(acao, situacao) {
  if (acao === 'iniciar') return situacao === 'planejado' ? { ok: true, para: 'rodando' } : { ok: false, erro: 'Só um teste planejado pode ser iniciado.' };
  if (acao === 'concluir') return ATIVOS.includes(situacao) ? { ok: true, para: 'concluido' } : { ok: false, erro: 'Só um teste rodando pode ser concluído.' };
  if (acao === 'abandonar') return situacao === 'planejado' || ATIVOS.includes(situacao) ? { ok: true, para: 'abandonado' } : { ok: false, erro: 'Este teste já foi fechado.' };
  return { ok: false, erro: 'Ação desconhecida.' };
}

const ROTULO_CAMPO = { hipotese: 'Hipótese', metrica: 'Métrica', criterio: 'Critério' };

/**
 * Linhas de histórico de uma edição. Depois do início, mudar hipótese, métrica
 * ou critério muda a leitura do teste: vai em destaque, com o antes e o depois.
 */
export function mudancasDaEdicao(atual, novos) {
  if (!ATIVOS.includes(atual.situacao)) return [];
  return Object.keys(ROTULO_CAMPO)
    .filter((k) => (atual[k] || '') !== (novos[k] || ''))
    .map((k) => ({ texto: `${ROTULO_CAMPO[k]} mudou de "${atual[k] || ''}" para "${novos[k] || ''}".`, destaque: true }));
}

export const unidadeDoTeste = (tipo) => (tipo === 'pagina' ? 'visitas' : 'leads');

const isoData = (v) => (!v ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));

/** Dias corridos desde o início, contando o dia de início como o primeiro. */
export function diasRodando(inicio, hoje) {
  if (!inicio) return 0;
  return Math.max(0, Math.round((Date.parse(hoje) - Date.parse(isoData(inicio))) / DIA_MS));
}

/**
 * Leitura de um teste ativo: quanto falta de dias e de amostra. Só fica pronto
 * com os DOIS mínimos: parar no primeiro número bom infla o falso positivo.
 * `amostra` null = números indisponíveis (nunca vira zero).
 */
export function avaliarLeitura({ min_dias, min_amostra, dias, amostra }) {
  const faltaDias = Math.max(0, min_dias - dias);
  if (amostra == null) return { dias, amostra: null, falta_dias: faltaDias, falta_amostra: null, pronto: false };
  const faltaAmostra = Math.max(0, min_amostra - amostra);
  return { dias, amostra, falta_dias: faltaDias, falta_amostra: faltaAmostra, pronto: faltaDias === 0 && faltaAmostra === 0 };
}

/** Um teste como a aba e o relatório o enxergam. */
export function montarTeste(linha, historico, hoje, numeros = null) {
  const inicio = isoData(linha.inicio);
  const fim = isoData(linha.fim);
  const ativo = ATIVOS.includes(linha.situacao);
  const dias = ativo ? diasRodando(inicio, hoje) : (inicio && fim ? diasRodando(inicio, fim) : 0);
  const teste = {
    id: Number(linha.id),
    nome: linha.nome,
    tipo: linha.tipo,
    funil: linha.funil || null,
    situacao: linha.situacao,
    hipotese: linha.hipotese,
    mudou: linha.mudou || '',
    controle: linha.controle || [],
    variante: linha.variante || [],
    ab_test_id: linha.ab_test_id ?? null,
    metrica: linha.metrica,
    criterio: linha.criterio || '',
    min_dias: linha.min_dias,
    min_amostra: linha.min_amostra,
    unidade: unidadeDoTeste(linha.tipo),
    inicio,
    fim,
    dias_rodando: dias,
    resultado: linha.resultado || null,
    aprendizado: linha.aprendizado || null,
    motivo_abandono: linha.motivo_abandono || null,
    origem: linha.origem,
    relatorio_id: linha.relatorio_id ? Number(linha.relatorio_id) : null,
    historico: (historico || []).map((h) => ({ texto: h.texto, destaque: !!h.destaque, em: new Date(h.criado_em).toISOString() })),
    numeros,
    leitura: null,
  };
  if (ativo) {
    const amostra = numeros && numeros.ok ? numeros.amostra : null;
    teste.leitura = avaliarLeitura({ min_dias: linha.min_dias, min_amostra: linha.min_amostra, dias, amostra });
  }
  return teste;
}

/** Lista inteira da aba, com o resumo do topo. */
export function montarTestes(linhas, historicoPorTeste, hoje, numerosPorTeste = new Map()) {
  const testes = (linhas || []).map((l) => montarTeste(l, historicoPorTeste.get(Number(l.id)) || [], hoje, numerosPorTeste.get(Number(l.id)) || null));
  const conta = (s) => testes.filter((t) => t.situacao === s).length;
  return {
    hoje,
    testes,
    resumo: { planejado: conta('planejado'), rodando: conta('rodando'), pronto: conta('pronto'), concluido: conta('concluido'), abandonado: conta('abandonado') },
  };
}
