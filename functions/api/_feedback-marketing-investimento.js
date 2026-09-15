// Investimento do período por bloco para GET /api/feedback-marketing
// (spec-feedback-marketing.md, módulo 2, "Investimento e reconhecimento de
// campanhas").
//
// Módulo PURO. O reconhecimento campanha → bloco NÃO mora aqui: vem de
// `reconhecerGastos` (_funis-relatorio-conflitos.js), a mesma função do aviso
// de conflito da aba "Funis do relatório" — o relatório e a aba nunca
// discordam por critério.

import { reconhecerGastos } from './_funis-relatorio-conflitos.js';
import { FUSO_BRT } from './_data-brt.js';
import { limitesDoPeriodoUnix } from './_feedback-marketing-periodo.js';

export const AVISO_NAO_FECHA = 'Investimento dos blocos não fecha com o investido geral.';
export const AVISO_SEM_REGISTRO_ATUALIZACAO = 'Não há registro de atualização do investimento — pode estar incompleto.';

// Issue 256. Soma em CENTAVOS inteiros e só divide por 100 na saída: somar
// reais em ponto flutuante faz 0,1 + 0,2 virar 0,30000000000000004.
//
// `gastos` = todas as linhas do período por campanha (inclusive soma ≤ 0);
// `campanhas` = saída de reconhecerCampanhasDoPeriodo; `funisAtivos` = [{ id }];
// `ultimaAtualizacaoUnix` = última sincronização com sucesso do Meta, ou null;
// `periodo` = { inicio, fim } resolvido (issue 254).
//
// O investido geral vem das LINHAS, não da soma dos blocos: é assim que a
// conferência de fechamento consegue pegar dinheiro que não foi a lugar nenhum
// (ex.: campanha com estorno maior que o gasto no período).
export function montarInvestimento({ gastos = [], campanhas = [], funisAtivos = [], ultimaAtualizacaoUnix = null, periodo }) {
  const centavos = (v) => Math.round(Number(v) || 0);
  const geral = (gastos || []).reduce((soma, g) => soma + centavos(g.spend_cents), 0);

  const porBloco = new Map((funisAtivos || []).map((f) => [f.id, { centavos: 0, campanhas: [] }]));
  const semFunil = { centavos: 0, campanhas: [] };

  for (const c of campanhas || []) {
    const valor = centavos(c.spend_cents);
    const bloco = c.bloco_id != null ? porBloco.get(c.bloco_id) : null;
    if (bloco) {
      bloco.centavos += valor;
      bloco.campanhas.push({ nome: c.nome, valor: valor / 100, reconhecida_por: c.reconhecida_por });
    } else {
      semFunil.centavos += valor;
      semFunil.campanhas.push({ nome: c.nome, valor: valor / 100, motivo: c.motivo || 'nenhum funil reconhecido' });
    }
  }

  const ordenar = (lista) => lista.sort((a, b) => b.valor - a.valor || String(a.nome).localeCompare(String(b.nome)));
  const blocos = new Map([...porBloco].map(([id, b]) => [id, {
    investido: b.centavos / 100,
    sem_investimento: b.centavos === 0,
    campanhas: ordenar(b.campanhas),
  }]));

  const avisos = [];
  const ultima = ultimaAtualizacaoUnix == null ? null : Number(ultimaAtualizacaoUnix);
  if (ultima == null || !Number.isFinite(ultima)) {
    avisos.push(AVISO_SEM_REGISTRO_ATUALIZACAO);
  } else if (ultima < limitesDoPeriodoUnix(periodo).ate) {
    avisos.push(`O investimento foi atualizado pela última vez em ${dataHoraLegivel(ultima)} — pode estar incompleto.`);
  }

  const somaDistribuida = [...porBloco.values()].reduce((soma, b) => soma + b.centavos, 0) + semFunil.centavos;
  if (somaDistribuida !== geral) avisos.push(AVISO_NAO_FECHA);

  return {
    investido_geral: geral / 100,
    blocos,
    sem_funil: { investido: semFunil.centavos / 100, campanhas: ordenar(semFunil.campanhas) },
    investimento_atualizado_em: ultima != null && Number.isFinite(ultima) ? dataHoraIso(ultima) : null,
    avisos,
  };
}

// 'AAAA-MM-DD HH:MM:SS' em Brasília (`sv-SE` é ISO, como em ymdBrt). `h23`
// evita o "24:00" que alguns motores devolvem à meia-noite com hour12:false.
function dataHoraBrt(unix) {
  return new Date(unix * 1000).toLocaleString('sv-SE', { timeZone: FUSO_BRT, hourCycle: 'h23' });
}

export function dataHoraLegivel(unix) {
  const [dia, hora] = dataHoraBrt(unix).split(' ');
  return `${dia.slice(8, 10)}/${dia.slice(5, 7)}/${dia.slice(0, 4)} ${hora.slice(0, 5)}`;
}

// Mesmo formato de `gerado_em` do contrato. Deslocamento fixo: o Brasil não tem
// horário de verão (mesmo pressuposto de _data-brt.js).
export function dataHoraIso(unix) {
  return `${dataHoraBrt(unix).replace(' ', 'T')}-03:00`;
}

// Issue 255. `gastos` = [{ campaign_id, campaign_name, spend_cents }] já
// somados por campanha no período; `ctx` = { overrides, funisAtivos,
// funisConhecidos }. Cada campanha com investimento sai com o bloco (ou null,
// com o motivo, para ir ao "sem funil") e como foi reconhecida.
export function reconhecerCampanhasDoPeriodo(gastos, ctx = {}) {
  const avisos = [];
  const campanhas = reconhecerGastos(gastos, ctx).map((r) => {
    const casou = !r.motivo && r.blocos.length === 1;
    if (r.blocos.length > 1) {
      const nomes = r.blocos.map((b) => b.nome).join(', ');
      avisos.push(`A campanha ${r.campanha} casou com o trecho de mais de um funil (${nomes}) e foi para 'sem funil' — ajuste os trechos no cadastro de funis.`);
    }
    return {
      campaign_id: r.campaign_id,
      nome: r.campanha,
      spend_cents: r.spend_cents,
      bloco_id: casou ? r.blocos[0].id : null,
      reconhecida_por: casou ? r.reconhecida_por : null,
      motivo: r.motivo,
    };
  });
  return { campanhas, avisos };
}
