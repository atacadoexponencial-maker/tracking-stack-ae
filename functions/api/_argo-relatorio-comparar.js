// Comparação de duas semanas do relatório do Argo (spec, módulo 4: "comparar
// duas semanas"; issue 406). Módulo puro: recebe dois pacotes de fatos já
// gravados e devolve os painéis por funil lado a lado, com a diferença.

const ESTAVEL = 0.05;
const MENOR_MELHOR = { gasto: null, leads: false, mqls: false, compras: false, cpl: true, cpmql: true, cpa: true };

export function compararPacotes(a, b) {
  const nomes = [...new Set([...(a.funis || []).map((f) => f.nome), ...(b.funis || []).map((f) => f.nome)])];
  const funis = nomes.map((nome) => {
    const fa = (a.funis || []).find((f) => f.nome === nome);
    const fb = (b.funis || []).find((f) => f.nome === nome);
    const metricasIds = [...new Set([...(fa ? fa.metricas : []), ...(fb ? fb.metricas : [])].map((m) => m.metrica))];
    const metricas = metricasIds.map((id) => {
      const ma = fa && fa.metricas.find((m) => m.metrica === id);
      const mb = fb && fb.metricas.find((m) => m.metrica === id);
      const xa = ma ? a.fatos[ma.fato_id] : null;
      const xb = mb ? b.fatos[mb.fato_id] : null;
      const va = xa ? xa.valor : null;
      const vb = xb ? xb.valor : null;
      let diferenca = null;
      let sinal = null;
      if (va != null && vb != null && va !== 0) {
        diferenca = (vb - va) / va;
        const mm = MENOR_MELHOR[id];
        if (mm != null) sinal = Math.abs(diferenca) < ESTAVEL ? 'estavel' : ((mm ? diferenca < 0 : diferenca > 0) ? 'melhor' : 'pior');
      }
      return {
        metrica: id, nome: (ma || mb).nome,
        a: xa ? xa.valor_texto : 'sem dado', b: xb ? xb.valor_texto : 'sem dado',
        diferenca, sinal,
      };
    });
    return { nome, metricas };
  });
  return { a: { semana: a.semana }, b: { semana: b.semana }, funis };
}
