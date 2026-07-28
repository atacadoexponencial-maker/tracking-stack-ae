// Agregação do CPL por funil e por canal (spec 2026-07-28).
//
// Função pura: recebe leads, gastos e overrides já lidos do D1 e devolve os
// recortes prontos. Todo o cálculo acontece aqui — o endpoint só faz I/O e o
// dashboard só desenha.
//
// O agrupamento é em JS, não em SQL, de propósito: são centenas de leads por
// período e assim a regra de canal existe UMA vez (em _canal.js), em vez de
// uma cópia em JS e outra em SQL que divergem na primeira manutenção. Se um
// dia o volume passar de dezenas de milhares de leads por período, vale mover
// para SQL — aí com a regra gerada a partir deste módulo.

import { canalDeLead, CANAIS, CANAL_AQUISICAO } from './_canal.js';
import { resolverFunilAuto, FUNIL_SEM_CLASSIFICACAO } from './_funil-campanha.js';

export function calcularCpl({ leads = [], gastos = [], overrides = [], funisConhecidos = [] }) {
  const mapaOverride = new Map((overrides || []).map((o) => [String(o.campaign_id), o.funnel]));

  // 1. Gasto por funil. Override manual vence; depois o automático; senão balde.
  const gastoPorFunil = new Map();
  let totalCentavos = 0;
  let centavosAquisicao = 0;
  let centavosMetaAds = 0;

  for (const g of gastos) {
    const centavos = Number(g.spend_cents) || 0;
    totalCentavos += centavos;

    const funil =
      mapaOverride.get(String(g.campaign_id)) ||
      resolverFunilAuto(g.campaign_name, funisConhecidos) ||
      FUNIL_SEM_CLASSIFICACAO;

    gastoPorFunil.set(funil, (gastoPorFunil.get(funil) || 0) + centavos);

    // Do lado do canal, o gasto do Meta é 'meta-ads' — exceto o
    // impulsionamento, que é o gasto de topo de funil.
    if (funil === CANAL_AQUISICAO) centavosAquisicao += centavos;
    else centavosMetaAds += centavos;
  }

  // 2. Leads por funil, por canal e no cruzamento.
  const leadsPorFunil = new Map();
  const leadsPorCanal = new Map();
  const leadsCruzado = new Map();

  for (const l of leads) {
    const funil = (l.funnel == null ? '' : String(l.funnel)).trim() || FUNIL_SEM_CLASSIFICACAO;
    const canal = canalDeLead(l);

    leadsPorFunil.set(funil, (leadsPorFunil.get(funil) || 0) + 1);
    leadsPorCanal.set(canal, (leadsPorCanal.get(canal) || 0) + 1);
    const chave = funil + '||' + canal;
    leadsCruzado.set(chave, (leadsCruzado.get(chave) || 0) + 1);
  }

  // 3. Montagem das linhas.
  const cpl = (centavos, qtd) => (qtd > 0 ? centavos / 100 / qtd : null);

  const funis = new Set([...gastoPorFunil.keys(), ...leadsPorFunil.keys()]);
  const por_funil = [...funis]
    .map((funnel) => {
      const centavos = gastoPorFunil.get(funnel) || 0;
      const qtd = leadsPorFunil.get(funnel) || 0;
      return {
        funnel,
        spend: centavos / 100,
        leads: qtd,
        cpl: cpl(centavos, qtd),
        share: totalCentavos > 0 ? (centavos / totalCentavos) * 100 : 0,
      };
    })
    .sort((a, b) => b.spend - a.spend || b.leads - a.leads);

  const gastoPorCanal = new Map([['meta-ads', centavosMetaAds]]);
  const canais = new Set([...gastoPorCanal.keys(), ...leadsPorCanal.keys()]);
  const por_canal = [...canais]
    .map((canal) => {
      const centavos = gastoPorCanal.get(canal) || 0;
      const qtd = leadsPorCanal.get(canal) || 0;
      return { canal, spend: centavos / 100, leads: qtd, cpl: cpl(centavos, qtd) };
    })
    .sort((a, b) => CANAIS.indexOf(a.canal) - CANAIS.indexOf(b.canal));

  // Numerador e denominador de origens diferentes: o turbinar não manda
  // ninguém ao site, o lead aparece depois pela bio ou pelo ManyChat. É
  // dedução, não rastreio — por isso sai separado e marcado.
  const leadsAquisicao = (leadsPorCanal.get('bio') || 0) + (leadsPorCanal.get('manychat') || 0);
  const aquisicao_estimativa = {
    canal: CANAL_AQUISICAO,
    spend: centavosAquisicao / 100,
    leads: leadsAquisicao,
    cpl: cpl(centavosAquisicao, leadsAquisicao),
    estimado: true,
    nota: 'estimativa: leads de bio e ManyChat, ligação por dedução',
  };

  const cruzado = [...leadsCruzado.entries()]
    .map(([chave, qtd]) => {
      const [funnel, canal] = chave.split('||');
      return { funnel, canal, leads: qtd };
    })
    .sort((a, b) => b.leads - a.leads);

  return {
    por_funil,
    por_canal,
    aquisicao_estimativa,
    cruzado,
    total_investimento: totalCentavos / 100,
    total_leads: leads.length,
  };
}
