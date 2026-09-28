// Realizado × meta do mês corrente (spec-metas-funil.md, issue 334). Módulo
// puro, testado por `node --test`. O endpoint lê o relatório de marketing do
// mês até ontem (mesma conta, números nunca divergem) e a meta vigente; aqui
// se decide projeção, situação, "precisa de N por dia" e os textos. A tela só
// desenha.
//
// Situação (decisão D8): nos custos, verde se realizado ≤ meta, âmbar até 10%
// acima, coral além disso; nos volumes, pela PROJEÇÃO de fim de mês: verde se
// ≥ meta, âmbar entre 90% e 100%, coral abaixo de 90%.

export const FAIXA_PERTO = 0.10;
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export const reais = (v) => (v === null || v === undefined ? null
  : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/ /g, ' '));
const inteiro = (n) => (n === null || n === undefined ? null : Number(n).toLocaleString('pt-BR'));
const decimal1 = (n) => Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const sinal = (n) => (n > 0 ? '+' : n < 0 ? '−' : '');

export function diasDoMes(mes) {
  const [a, m] = mes.split('-').map(Number);
  return new Date(Date.UTC(a, m, 0)).getUTCDate();
}

export const rotuloDoMes = (mes) => MESES[Number(mes.slice(5, 7)) - 1] || mes;

// Custo: CPL ou custo por MQL. `realizado`/`meta` em reais (meta em centavos
// convertida antes).
export function indicadorCusto({ chave, rotulo, realizado, metaReais }) {
  const base = { chave, rotulo, tipo: 'custo', realizado: reais(realizado), meta: reais(metaReais), diferenca: null };
  if (metaReais === null || metaReais === undefined) return { ...base, situacao: realizado === null ? 'sem_dado' : 'sem_meta' };
  if (realizado === null || realizado === undefined) return { ...base, situacao: 'sem_dado' };
  const dif = Math.round((realizado - metaReais) * 100) / 100;
  const pct = metaReais > 0 ? (dif / metaReais) * 100 : 0;
  const situacao = realizado <= metaReais ? 'dentro' : realizado <= metaReais * (1 + FAIXA_PERTO) ? 'perto' : 'fora';
  const pctTxt = `${sinal(pct)}${Math.abs(pct).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  return { ...base, situacao, diferenca: `${sinal(dif)}${reais(Math.abs(dif))} (${pctTxt})` };
}

// Volume: leads novos ou MQLs no mês, com projeção e ritmo necessário.
export function indicadorVolume({ chave, rotulo, realizado, meta, diasFechados, diasNoMes }) {
  const base = { chave, rotulo, tipo: 'volume', realizado: inteiro(realizado), meta: inteiro(meta),
    pct: null, projecao: null, por_dia: null, atingida: false };
  if (realizado === null || realizado === undefined) return { ...base, situacao: 'sem_dado' };
  if (meta === null || meta === undefined) return { ...base, situacao: 'sem_meta' };
  const atingida = realizado >= meta;
  const pct = meta > 0 ? Math.round((realizado / meta) * 100) : 100;
  const restantesDias = diasNoMes - diasFechados; // hoje incluso
  const falta = Math.max(0, meta - realizado);
  const porDia = atingida ? null
    : restantesDias > 0 ? `precisa de ${decimal1(falta / restantesDias)} por dia` : 'o mês acabou';
  if (!diasFechados) return { ...base, situacao: atingida ? 'dentro' : 'sem_dado', pct, projecao: '—', por_dia: porDia, atingida };
  const projecao = Math.round((realizado / diasFechados) * diasNoMes);
  const situacao = atingida || projecao >= meta ? 'dentro' : projecao >= meta * (1 - FAIXA_PERTO) ? 'perto' : 'fora';
  return { ...base, situacao, pct, projecao: inteiro(projecao), por_dia: porDia, atingida };
}

// Um funil: `bloco` = o bloco do relatório de marketing (ou null sem dia
// fechado), `meta` = a meta vigente (centavos e quantidades), `vigente` = a
// linha vigente de metas_funil.
export function montarFunilAcompanhamento({ funil, bloco, meta, vigente, mes, diasFechados, diasNoMes, inicioDoMesUnix }) {
  const investido = bloco ? Number(bloco.investido || 0) : 0;
  const leads = bloco ? (typeof bloco.metricas?.novos_leads === 'number' ? bloco.metricas.novos_leads : null) : 0;
  const mqls = bloco ? (typeof bloco.metricas?.mqls === 'number' ? bloco.metricas.mqls : null) : 0;
  const crmOk = !bloco || leads !== null;
  const cpl = leads ? Math.round((investido / leads) * 100) / 100 : null;
  const custoMql = mqls ? Math.round((investido / mqls) * 100) / 100 : null;
  const aReais = (c) => (c === null || c === undefined ? null : c / 100);
  const alteradaNoMes = vigente && vigente.mes_inicio === mes && vigente.alterada_em > inicioDoMesUnix
    ? new Date(vigente.alterada_em * 1000).toISOString() : null;
  return {
    funil_id: funil.id,
    nome: funil.nome,
    investido_centavos: Math.round(investido * 100),
    crm_ok: crmOk,
    meta_alterada_no_mes_em: alteradaNoMes,
    alterada_em: vigente ? new Date(vigente.alterada_em * 1000).toISOString() : null,
    alterada_por: vigente ? vigente.alterada_por : null,
    indicadores: [
      indicadorCusto({ chave: 'cpl', rotulo: 'CPL', realizado: cpl, metaReais: aReais(meta.cpl_max_centavos) }),
      indicadorVolume({ chave: 'leads_novos', rotulo: 'Leads novos', realizado: leads, meta: meta.leads_novos, diasFechados, diasNoMes }),
      indicadorVolume({ chave: 'mqls', rotulo: 'MQLs', realizado: mqls, meta: meta.mqls, diasFechados, diasNoMes }),
      indicadorCusto({ chave: 'custo_mql', rotulo: 'Custo por MQL', realizado: custoMql, metaReais: aReais(meta.custo_mql_max_centavos) }),
    ],
  };
}

// Avisos do relatório que importam para as metas: investimento atrasado e
// CRM fora. Os outros (campanha sem funil etc.) ficam no relatório.
export function filtrarAvisos(avisos) {
  return (avisos || []).filter((a) => typeof a === 'string'
    && (/atualizado pela última vez|registro de atualização do investimento/i.test(a) || /CRM/.test(a)));
}
