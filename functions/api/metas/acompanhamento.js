// GET /api/metas/acompanhamento?key=... — metas do MÊS CORRENTE até ontem
// (spec-metas-funil.md, issue 334), para a Visão geral e a aba Leads.
//
// O realizado sai de `montarFeedback`, a mesma função do relatório de
// marketing, no período 1º do mês → ontem: leads novos, MQLs e investido nunca
// divergem entre as duas telas. Hoje fica de fora (investimento atrasado).
import { montarFeedback } from '../feedback-marketing.js';
import { resolverPeriodo } from '../_feedback-marketing-periodo.js';
import { metaVigente, mesBrt } from '../_metas.js';
import {
  montarFunilAcompanhamento, filtrarAvisos, diasDoMes, rotuloDoMes,
} from '../_metas-acompanhamento.js';
import { ymdBrt, inicioDoDiaBrt } from '../_data-brt.js';

const json = (dados, status = 200) => Response.json(dados, { status });

function somarDias(ymd, n) {
  const [a, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (!env.DASH_KEY || url.searchParams.get('key') !== env.DASH_KEY) {
    return json({ error: 'Unauthorized' }, 401);
  }
  try {
    const agora = Math.floor(Date.now() / 1000);
    const hoje = ymdBrt(agora);
    const mes = mesBrt(agora);
    const primeiroDia = `${mes}-01`;
    const diasNoMes = diasDoMes(mes);
    const diasFechados = Number(hoje.slice(8, 10)) - 1;
    const ontem = somarDias(hoje, -1);

    const [funisRes, linhasRes] = await Promise.all([
      env.DB.prepare(`SELECT id, nome, tipo, posicao, situacao FROM funis_relatorio
                       WHERE situacao = 'ativo' ORDER BY posicao, id`).all(),
      env.DB.prepare(`SELECT id, funil_id, mes_inicio, cpl_max_centavos, leads_novos, mqls,
                             custo_mql_max_centavos, alterada_em, alterada_por FROM metas_funil`).all(),
    ]);
    const linhas = linhasRes.results || [];
    // Só funis com meta vigente neste mês entram no cartão.
    const comMeta = (funisRes.results || [])
      .map((f) => ({ funil: f, vigente: metaVigente(linhas.filter((l) => l.funil_id === f.id), mes) }))
      .filter((x) => x.vigente);

    const base = {
      mes, mes_rotulo: rotuloDoMes(mes),
      dados_ate: diasFechados > 0 ? ontem : null,
      dias_restantes: diasNoMes - diasFechados,
      dias_fechados: diasFechados, dias_no_mes: diasNoMes,
      avisos: [],
    };
    if (!comMeta.length) return json({ ...base, funis: [] });

    // Dia 1º: não há dia fechado; nada para ler no relatório.
    let relatorio = null;
    if (diasFechados > 0) {
      const r = resolverPeriodo({ inicio: primeiroDia, fim: ontem }, agora);
      if (!r.ok) return json({ erro: 'Não foi possível montar o período do mês.' }, 500);
      relatorio = await montarFeedback(env, r.periodo, []);
    }
    const inicioDoMesUnix = inicioDoDiaBrt(primeiroDia);
    const funis = comMeta.map(({ funil, vigente }) => {
      const bloco = relatorio
        ? (relatorio.blocos || []).find((b) => b.nome === funil.nome && b.posicao === funil.posicao) ?? null
        : null;
      return montarFunilAcompanhamento({
        funil, bloco: relatorio ? (bloco || { investido: 0, metricas: { novos_leads: 0, mqls: 0 } }) : null,
        meta: vigente, vigente, mes, diasFechados, diasNoMes, inicioDoMesUnix,
      });
    });
    return json({ ...base, avisos: relatorio ? filtrarAvisos(relatorio.avisos) : [], funis });
  } catch (e) {
    console.error('metas/acompanhamento — falha:', e && e.message ? e.message : e);
    return json({ erro: 'Não foi possível ler as metas agora.' }, 500);
  }
}
