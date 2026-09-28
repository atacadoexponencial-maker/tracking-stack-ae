// Metas mensais por funil (spec-metas-funil.md, issue 333). Módulo puro,
// testado por `node --test`: validação, vigência por mês e montagem do
// cadastro que a aba Funis do relatório desenha. O endpoint só lê e grava.
//
// Vigência: a meta de um mês M é a linha de maior (mes_inicio, id) com
// mes_inicio <= M. Cada salvamento é uma linha nova (histórico imutável).

// Só a Sessão Estratégica recebe meta por enquanto (decisão D3 da spec). A
// lista é de `funil_tracking`, que não muda quando o funil é renomeado.
export const FUNIS_COM_META = Object.freeze(['sessao-estrategica']);
export const MOTIVO_BLOQUEIO = 'metas só para a Sessão Estratégica por enquanto';
export const CAMPOS_META = Object.freeze(['cpl_max_centavos', 'leads_novos', 'mqls', 'custo_mql_max_centavos']);
const CAMPOS_DINHEIRO = new Set(['cpl_max_centavos', 'custo_mql_max_centavos']);
export const MAX_CENTAVOS = 10_000_000; // R$ 100 mil
export const MAX_VOLUME = 100_000;
export const ALTERADA_POR = 'painel'; // sem login por pessoa: a chave do dash é única

export const ERRO_CONCORRENCIA = 'as metas mudaram desde que você abriu a aba, recarregue';
export const ERRO_NAO_EDITAVEL = MOTIVO_BLOQUEIO;
export const ERRO_FUNIL = 'funil não encontrado ou arquivado';

// Mês 'YYYY-MM' de um unix (segundos) no calendário de Brasília.
export function mesBrt(unixSegundos) {
  return new Date(unixSegundos * 1000).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }).slice(0, 7);
}

export function funilEditavel(funil) {
  return !!funil && funil.situacao === 'ativo' && funil.tipo === 'lead_mql' && FUNIS_COM_META.includes(funil.funil_tracking);
}

// Corpo do POST: as quatro chaves presentes; cada uma null ou inteiro >= 0,
// dentro do teto. Nunca corrige em silêncio.
export function validarMeta(meta) {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
    return { ok: false, erro: 'Envie as quatro metas (use vazio para "sem meta").', campos: {} };
  }
  const campos = {};
  for (const c of CAMPOS_META) {
    if (!(c in meta)) { campos[c] = 'campo ausente'; continue; }
    const v = meta[c];
    if (v === null) continue;
    const teto = CAMPOS_DINHEIRO.has(c) ? MAX_CENTAVOS : MAX_VOLUME;
    if (typeof v !== 'number' || !Number.isInteger(v)) {
      campos[c] = CAMPOS_DINHEIRO.has(c) ? 'valor em reais com no máximo duas casas' : 'número inteiro';
    } else if (v < 0) {
      campos[c] = 'não pode ser negativo';
    } else if (v > teto) {
      campos[c] = CAMPOS_DINHEIRO.has(c) ? 'acima de R$ 100.000,00' : `acima de ${MAX_VOLUME.toLocaleString('pt-BR')}`;
    }
  }
  for (const c of Object.keys(meta)) if (!CAMPOS_META.includes(c)) campos[c] = 'campo desconhecido';
  if (Object.keys(campos).length) return { ok: false, erro: 'Corrija os campos marcados. Nada foi salvo.', campos };
  return { ok: true, meta: Object.fromEntries(CAMPOS_META.map((c) => [c, meta[c]])) };
}

const somenteMeta = (linha) => (linha ? Object.fromEntries(CAMPOS_META.map((c) => [c, linha[c] ?? null])) : null);
const ordenarDesc = (a, b) => (a.mes_inicio === b.mes_inicio ? b.id - a.id : a.mes_inicio < b.mes_inicio ? 1 : -1);

// Linha vigente no mês (ou null). `linhas` = todas as linhas de UM funil.
export function metaVigente(linhas, mes) {
  return [...(linhas || [])].filter((l) => l.mes_inicio <= mes).sort(ordenarDesc)[0] ?? null;
}

const iso = (unix) => (unix ? new Date(unix * 1000).toISOString() : null);

// Um funil do contrato da issue 332.
export function montarFunil(funil, linhasDoFunil, mes) {
  const editavel = funilEditavel(funil);
  const todas = [...(linhasDoFunil || [])].sort(ordenarDesc);
  const vigente = metaVigente(todas, mes);
  const maisRecente = todas[0] ?? null;
  const historico = todas.map((l, i) => ({
    mes: l.mes_inicio,
    em: iso(l.alterada_em),
    por: l.alterada_por,
    antes: somenteMeta(todas[i + 1]) ?? Object.fromEntries(CAMPOS_META.map((c) => [c, null])),
    depois: somenteMeta(l),
  }));
  return {
    funil_id: funil.id,
    nome: funil.nome,
    editavel,
    motivo_bloqueio: editavel ? null : MOTIVO_BLOQUEIO,
    meta: somenteMeta(vigente),
    vigente_desde: vigente ? vigente.mes_inicio : null,
    alterada_em: iso(vigente?.alterada_em),
    alterada_por: vigente?.alterada_por ?? null,
    // Versão = id da linha mais recente; null quando nunca houve meta.
    versao: maisRecente ? maisRecente.id : null,
    historico,
  };
}

// Cadastro inteiro: funis de lead ativos, na ordem do relatório.
export function montarCadastro({ funis = [], linhas = [], mes }) {
  const porFunil = new Map();
  for (const l of linhas) {
    if (!porFunil.has(l.funil_id)) porFunil.set(l.funil_id, []);
    porFunil.get(l.funil_id).push(l);
  }
  const deLead = funis
    .filter((f) => f.situacao === 'ativo' && f.tipo === 'lead_mql')
    .sort((a, b) => (a.posicao ?? 1e9) - (b.posicao ?? 1e9));
  return { mes, funis: deLead.map((f) => montarFunil(f, porFunil.get(f.id), mes)) };
}
