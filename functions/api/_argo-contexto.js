// Contexto do negócio que o relatório semanal do Argo lê
// (spec-relatorio-semanal-argo.md, módulo 1; issue 402).
//
// Módulo puro, testado por `node --test`: valida o que a aba manda e monta a
// lista que ela desenha. A aba não calcula situação, dias nem "evento
// terminado": tudo sai pronto daqui, e o pacote de fatos (issue 405) usa as
// mesmas funções, para a tela e o relatório nunca discordarem.

export const TIPOS_CONTEXTO = Object.freeze(['prioridade', 'oferta', 'evento', 'restricao', 'observacao']);
export const ACOES_CONTEXTO = Object.freeze(['criar', 'editar', 'revisar', 'arquivar']);
export const VALIDADES = Object.freeze([15, 30, 60, 90]);
export const VALIDADE_PADRAO = 30;

const DIA_MS = 86400000;
const ISO_DATA = /^\d{4}-\d{2}-\d{2}$/;

const texto = (v) => (typeof v === 'string' ? v.trim() : '');
const dataValida = (v) => typeof v === 'string' && ISO_DATA.test(v) && !Number.isNaN(Date.parse(v + 'T00:00:00Z'));

// Hoje no fuso de Brasília, como 'YYYY-MM-DD'. `sv-SE` formata em ISO.
export function hojeBrt(agoraMs = Date.now()) {
  return new Date(agoraMs).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
}

/**
 * Valida o corpo do POST. Devolve `{ ok, acao, id, valores }` ou
 * `{ ok:false, erro }` com uma mensagem que a aba mostra como está.
 */
export function validarContexto(corpo) {
  const c = corpo && typeof corpo === 'object' ? corpo : {};
  const acao = c.acao;
  if (!ACOES_CONTEXTO.includes(acao)) return { ok: false, erro: 'Ação desconhecida.' };
  let id = null;
  if (acao !== 'criar') {
    id = Number(c.id);
    if (!Number.isInteger(id) || id <= 0) return { ok: false, erro: 'Item inválido.' };
    if (acao === 'revisar' || acao === 'arquivar') return { ok: true, acao, id, valores: null };
  }
  const tipo = c.tipo;
  if (!TIPOS_CONTEXTO.includes(tipo)) return { ok: false, erro: 'Escolha o tipo do item.' };
  const titulo = texto(c.titulo);
  if (!titulo) return { ok: false, erro: 'Escreva um título.' };
  if (titulo.length > 120) return { ok: false, erro: 'O título passa de 120 caracteres.' };
  const corpoTexto = texto(c.texto);
  if (corpoTexto.length > 500) return { ok: false, erro: 'O texto passa de 500 caracteres.' };
  const funil = texto(c.funil) || null;
  const validade = c.validade_dias == null ? VALIDADE_PADRAO : Number(c.validade_dias);
  if (!VALIDADES.includes(validade)) return { ok: false, erro: 'Validade inválida.' };
  let inicio = null;
  let fim = null;
  if (tipo === 'evento') {
    if (!dataValida(c.inicio) || !dataValida(c.fim)) return { ok: false, erro: 'Evento precisa de data de início e de fim.' };
    if (c.fim < c.inicio) return { ok: false, erro: 'A data de fim é antes do início.' };
    inicio = c.inicio;
    fim = c.fim;
  }
  return { ok: true, acao, id, valores: { tipo, titulo, texto: corpoTexto, funil, inicio, fim, validade_dias: validade } };
}

const isoData = (v) => {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
};

/** Dias inteiros entre a revisão e hoje (Brasília). */
export function diasDesde(revisadoEm, hoje) {
  if (!revisadoEm) return null;
  const rev = new Date(revisadoEm).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  return Math.max(0, Math.round((Date.parse(hoje) - Date.parse(rev)) / DIA_MS));
}

/** Um item como a aba e o relatório o enxergam. */
export function montarItem(linha, hoje) {
  const inicio = isoData(linha.inicio);
  const fim = isoData(linha.fim);
  const dias = diasDesde(linha.revisado_em, hoje);
  const terminado = linha.tipo === 'evento' && !!fim && fim < hoje;
  const arquivado = !!linha.arquivado_em;
  const vencido = !arquivado && !terminado && dias != null && dias > linha.validade_dias;
  let situacao = 'em_dia';
  if (arquivado) situacao = 'arquivado';
  else if (terminado) situacao = 'terminado';
  else if (vencido) situacao = 'revisar';
  return {
    id: Number(linha.id),
    tipo: linha.tipo,
    titulo: linha.titulo,
    texto: linha.texto || '',
    funil: linha.funil || null,
    inicio,
    fim,
    validade_dias: linha.validade_dias,
    revisado_em: linha.revisado_em ? new Date(linha.revisado_em).toISOString() : null,
    dias_desde_revisao: dias,
    arquivado_em: arquivado ? new Date(linha.arquivado_em).toISOString() : null,
    situacao,
  };
}

/**
 * Lista inteira da aba: valendo (os que precisam de revisão primeiro),
 * arquivados e eventos terminados, mais o resumo do topo.
 */
export function montarContexto(linhas, hoje) {
  const itens = (linhas || []).map((l) => montarItem(l, hoje));
  const valendo = itens.filter((i) => i.situacao === 'em_dia' || i.situacao === 'revisar')
    .sort((a, b) => Number(b.situacao === 'revisar') - Number(a.situacao === 'revisar') || b.id - a.id);
  const arquivados = itens.filter((i) => i.situacao === 'arquivado').sort((a, b) => (b.arquivado_em || '').localeCompare(a.arquivado_em || ''));
  const terminados = itens.filter((i) => i.situacao === 'terminado').sort((a, b) => (b.fim || '').localeCompare(a.fim || ''));
  return {
    hoje,
    valendo,
    arquivados,
    terminados,
    resumo: { valendo: valendo.length, revisar: valendo.filter((i) => i.situacao === 'revisar').length, terminados: terminados.length },
  };
}

/** Eventos que tocam um intervalo de datas (para marcar a semana como atípica). */
export function eventosNoPeriodo(itens, de, ate) {
  return (itens || []).filter((i) => i.tipo === 'evento' && i.situacao !== 'arquivado' && i.inicio && i.fim && i.inicio <= ate && i.fim >= de);
}
