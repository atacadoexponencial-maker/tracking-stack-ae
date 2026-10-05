// Testar uma mudança nas instruções da análise nas semanas passadas
// (spec-relatorio-semanal-argo.md, módulo 7; issue 410).
//
// A versão candidata escreve de novo a análise dos pacotes guardados e passa
// pela mesma checagem. Compara com o que foi publicado:
// - aprovação na checagem: verificada vale 1, parcial vale meio, o resto zero;
// - trechos que a gestora marcou como errado: a candidata "repete" o erro
//   quando o bloco dela continua dizendo praticamente a mesma coisa.
// A mudança só pode valer se não piorar nenhum dos dois. Módulo puro.

const PESO = { verificada: 1, parcial: 0.5 };
const SEMELHANCA_REPETIDO = 0.6;

const palavras = (t) => new Set(String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter((p) => p.length >= 4));

/** Semelhança de Jaccard entre dois textos (0 a 1). */
export function semelhanca(a, b) {
  const A = palavras(a);
  const B = palavras(b);
  if (!A.size || !B.size) return 0;
  let comum = 0;
  for (const p of A) if (B.has(p)) comum += 1;
  return comum / (A.size + B.size - comum);
}

const textoDoBloco = (analise, chave) => {
  const b = (analise || []).find((x) => x.chave === chave);
  if (!b) return '';
  if (b.tipo === 'texto') return b.frases.map((f) => f.texto).join(' ');
  if (b.tipo === 'sugestao') return `${b.sugestao.hipotese} ${b.sugestao.mudar}`;
  return b.texto || '';
};

/**
 * `semanas`: [{ relatorio_id, rotulo, publicado: { situacao, analise }, errados: [bloco...], candidata: { situacao, blocos } }]
 */
export function avaliarCandidata(semanas) {
  let base = 0;
  let cand = 0;
  let errados = 0;
  let repetidos = 0;
  const detalhe = semanas.map((s) => {
    const pb = PESO[s.publicado.situacao] || 0;
    const pc = PESO[s.candidata.situacao] || 0;
    base += pb;
    cand += pc;
    const rep = s.errados.filter((bloco) => {
      const antes = textoDoBloco(s.publicado.analise, bloco);
      const depois = textoDoBloco(s.candidata.blocos, bloco);
      return antes && depois && semelhanca(antes, depois) >= SEMELHANCA_REPETIDO;
    });
    errados += s.errados.length;
    repetidos += rep.length;
    return { relatorio_id: s.relatorio_id, rotulo: s.rotulo, publicada: s.publicado.situacao, candidata: s.candidata.situacao, errados: s.errados.length, repetidos: rep.length };
  });
  const n = semanas.length || 1;
  const aprovacaoBase = base / n;
  const aprovacaoCand = cand / n;
  const piorou = aprovacaoCand < aprovacaoBase || repetidos > errados;
  return {
    semanas: semanas.length,
    base: { aprovacao: aprovacaoBase, errados },
    candidata: { aprovacao: aprovacaoCand, repetidos },
    situacao: semanas.length && !piorou ? 'aprovada' : 'recusada',
    motivo: !semanas.length ? 'Não há semanas guardadas com análise para comparar.'
      : aprovacaoCand < aprovacaoBase ? 'A versão nova passou menos na checagem que a atual.'
      : repetidos > errados ? 'A versão nova repetiu mais trechos marcados como errado.' : 'Não piorou: pode valer.',
    detalhe,
  };
}
