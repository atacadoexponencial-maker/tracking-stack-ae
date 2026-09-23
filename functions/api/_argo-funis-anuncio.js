// Funil de cada campanha e CPL médio de cada funil, para o Argo julgar
// anúncio (issue 305, spec-argo-regua-editavel.md módulo 2).
//
// Por que existe: até aqui o Argo só sabia o funil de um anúncio pelos LEADS
// dele — anúncio sem lead nenhum ficava sem funil e nunca era julgado, bem o
// caso que a gestora mais quer pegar ("gastou 3× o CPL e não trouxe ninguém").
// A campanha tem funil mesmo sem lead: o mesmo reconhecimento do feedback
// diário (`reconhecerCampanhasDoPeriodo`), com o mesmo cadastro.
//
// Módulo puro; quem lê o D1 e o CRM é o endpoint.

import { calcularCusto } from './_feedback-marketing-blocos.js';
import { contarMqls } from './_feedback-marketing-mql.js';

// Só é julgável por anúncio o funil de MQL cujos leads vêm de tráfego pago
// (hoje, a SE). A AQUISIÇÃO também é `lead_mql`, mas conta leads que NÃO vêm
// de anúncio (`exceto_trafego_pago`): julgar anúncio de tráfego por "sem
// lead" pausaria o que nunca foi feito para gerar lead. LIVE e WO PAGO têm
// outra régua (contagem manual, compra).
export function julgavelPorAnuncio(funil) {
  return funil.tipo === 'lead_mql' && funil.origem_lead === 'trafego_pago';
}

const MOTIVO_NAO_JULGAVEL = {
  manual: 'funil de contagem manual — os anúncios são julgados à mão',
  venda_greenn: 'o desfecho deste funil é compra, não lead',
  lead_mql: 'os leads deste funil não vêm de anúncio pago (régua de campanha)',
};

// `investimento` = saída de montarInvestimento; `leadsPorBloco` = Map(id →
// cards) de atribuirCards, ou null quando o CRM não pôde ser lido (aí nenhum
// CPL existe — null, nunca 0).
export function funisParaArgo({ funisAtivos = [], investimento, leadsPorBloco }) {
  return funisAtivos.map((f) => {
    const inv = investimento.blocos.get(f.id) || { investido: 0 };
    const cards = leadsPorBloco ? (leadsPorBloco.get(f.id) || []) : null;
    const leads = cards ? cards.length : null;
    const julgavel = julgavelPorAnuncio(f);
    return {
      id: f.id,
      nome: f.nome,
      tipo: f.tipo,
      julgavel_por_anuncio: julgavel,
      motivo_nao_julgavel: julgavel ? null : (MOTIVO_NAO_JULGAVEL[f.tipo] || 'funil sem régua de anúncio'),
      investido: inv.investido,
      leads,
      // A mesma contagem de MQL do feedback diário. Funil sem MQL nenhum na
      // janela suspende o julgamento por qualificado (medição, não anúncio).
      mqls: cards ? contarMqls(cards) : null,
      // Mesmo cálculo do CPL do feedback diário (centavos, duas casas).
      cpl_medio: calcularCusto(inv.investido, leads),
    };
  });
}

// Campanha → funil, pela saída de reconhecerCampanhasDoPeriodo. Campanha que
// não casou com exatamente um funil vem com `funil_id: null` e o motivo — o
// Argo mostra "campanha sem funil" em vez de sumir com o anúncio.
export function campanhasParaArgo(campanhas = []) {
  return campanhas.map((c) => ({
    campaign_id: String(c.campaign_id),
    nome: c.nome,
    funil_id: c.bloco_id ?? null,
    motivo: c.bloco_id != null ? null : (c.motivo || 'nenhum funil reconhecido'),
  }));
}
