// Como o relatório semanal do Argo chega à aba (issues 405, 406, 408 e 409).
// Módulo puro: valida as ações da gestora e monta a resposta a partir das
// linhas do banco. A aba só desenha.

export const TIPOS_REACAO = Object.freeze(['util', 'obvio', 'errado']);

/** Uma linha de `argo.relatorios` como a aba enxerga. */
export function montarRelatorio(linha, reacoes = [], decisoes = []) {
  if (!linha) return null;
  const iso = (v) => (v ? new Date(v).toISOString() : null);
  const dia = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));
  const pacote = linha.pacote || {};
  return {
    id: Number(linha.id),
    semana: pacote.semana || { inicio: dia(linha.semana_inicio), fim: dia(linha.semana_fim) },
    situacao: linha.situacao,
    origem: linha.origem,
    gerado_em: iso(linha.gerado_em),
    substituido_em: iso(linha.substituido_em),
    substituido_por: linha.substituido_por ? Number(linha.substituido_por) : null,
    erro: linha.erro || null,
    modelo: linha.modelo || null,
    instrucoes_versao: linha.instrucoes_versao || null,
    pacote,
    analise: Array.isArray(linha.analise) ? linha.analise : [],
    removidos: Array.isArray(linha.removidos) ? linha.removidos : [],
    checagem: Array.isArray(linha.checagem) ? linha.checagem : [],
    reacoes: reacoes.map((r) => ({ bloco: r.bloco, tipo: r.tipo || null, comentario: r.comentario || '' })),
    decisoes: decisoes.map((d) => ({ chave: d.sugestao_chave, decisao: d.decisao, motivo: d.motivo || '', teste_id: d.teste_id ? Number(d.teste_id) : null })),
  };
}

/** Histórico da aba: uma linha por versão, as substituídas marcadas. */
export function montarHistorico(linhas) {
  return linhas.map((l) => ({
    id: Number(l.id),
    semana: { inicio: String(l.semana_inicio instanceof Date ? l.semana_inicio.toISOString() : l.semana_inicio).slice(0, 10), fim: String(l.semana_fim instanceof Date ? l.semana_fim.toISOString() : l.semana_fim).slice(0, 10) },
    situacao: l.situacao,
    origem: l.origem,
    gerado_em: l.gerado_em ? new Date(l.gerado_em).toISOString() : null,
    substituido_em: l.substituido_em ? new Date(l.substituido_em).toISOString() : null,
    atipica: !!(l.atipica),
    erro: l.erro || null,
  }));
}

/**
 * Painel de qualidade: por relatório publicado (não substituído, com análise),
 * quantos trechos foram marcados como útil, óbvio e errado, do mais antigo
 * para o mais recente.
 */
export function montarQualidade(linhas) {
  return linhas.map((l) => ({
    relatorio_id: Number(l.id),
    semana_inicio: String(l.semana_inicio instanceof Date ? l.semana_inicio.toISOString() : l.semana_inicio).slice(0, 10),
    util: Number(l.util || 0), obvio: Number(l.obvio || 0), errado: Number(l.errado || 0),
  })).sort((a, b) => a.semana_inicio.localeCompare(b.semana_inicio));
}

/** Valida uma reação. Devolve `{ ok, valores }` ou `{ ok:false, erro }`. */
export function validarReacao(corpo, blocosDoRelatorio) {
  const relatorioId = Number(corpo.relatorio_id);
  if (!Number.isInteger(relatorioId) || relatorioId <= 0) return { ok: false, erro: 'Relatório inválido.' };
  const bloco = String(corpo.bloco || '');
  if (!blocosDoRelatorio.includes(bloco)) return { ok: false, erro: 'Este trecho não existe no relatório.' };
  const tipo = corpo.tipo == null || corpo.tipo === '' ? null : corpo.tipo;
  if (tipo !== null && !TIPOS_REACAO.includes(tipo)) return { ok: false, erro: 'Reação desconhecida.' };
  const comentario = typeof corpo.comentario === 'string' ? corpo.comentario.trim().slice(0, 1000) : '';
  if (tipo === 'errado' && !comentario) return { ok: false, erro: 'Diga o que está errado para marcar este trecho.' };
  return { ok: true, valores: { relatorio_id: relatorioId, bloco, tipo, comentario } };
}

const TIPO_TESTE = { criativo: 'criativo', publico: 'publico', pagina: 'pagina', oferta: 'oferta' };

/** Valida a decisão sobre um teste proposto e monta o teste planejado, quando aceito. */
export function validarDecisao(corpo, analise) {
  const relatorioId = Number(corpo.relatorio_id);
  if (!Number.isInteger(relatorioId) || relatorioId <= 0) return { ok: false, erro: 'Relatório inválido.' };
  const chave = String(corpo.chave || '');
  const bloco = (analise || []).find((b) => b.chave === chave && b.tipo === 'sugestao');
  if (!bloco) return { ok: false, erro: 'Este teste proposto não existe no relatório.' };
  if (corpo.decisao === 'descartada') {
    const motivo = typeof corpo.motivo === 'string' ? corpo.motivo.trim().slice(0, 300) : '';
    if (!motivo) return { ok: false, erro: 'Escreva o motivo do descarte.' };
    return { ok: true, valores: { relatorio_id: relatorioId, chave, decisao: 'descartada', motivo } };
  }
  if (corpo.decisao !== 'aceita') return { ok: false, erro: 'Decisão desconhecida.' };
  const s = bloco.sugestao;
  const nome = String(s.hipotese || s.mudar || 'Teste proposto').replace(/^Acreditamos que /i, '').slice(0, 110);
  return {
    ok: true,
    valores: { relatorio_id: relatorioId, chave, decisao: 'aceita', motivo: '' },
    teste: {
      nome: nome.charAt(0).toUpperCase() + nome.slice(1),
      tipo: TIPO_TESTE[s.tipo] || 'criativo',
      funil: String(s.funil || '').slice(0, 80) || null,
      hipotese: String(s.hipotese || '').slice(0, 1000),
      mudou: String(s.mudar || '').slice(0, 500),
      metrica: String(s.metrica || 'a definir').slice(0, 120),
      criterio: String(s.criterio || '').slice(0, 300),
    },
  };
}
