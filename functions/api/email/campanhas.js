// GET  /api/email/campanhas?key=...[&situacao=]  → campanhas com andamento, uso do mês e opções do formulário
// GET  /api/email/campanhas?key=...&id=<id>      → uma campanha com andamento
// POST /api/email/campanhas?key=...  → { acao: 'salvar', id?, nome, modelo_id?, segmentos?, dia?, hora? }  (dia/hora: reagendar uma agendada)
//                                      { acao: 'agendar', id, dia: 'AAAA-MM-DD', hora: 'HH:MM' }   (Brasília; 383)
//                                      { acao: 'cancelar', id }   (só agendada; 383)
//                                      { acao: 'resumo', modelo_id, segmentos }   (sem gravar)
//                                      { acao: 'disparar' | 'duplicar' | 'excluir', id }
//
// Spec spec-email-proprio.md, módulo 6 (issue 382). Regras em ../_email-campanhas.js.
// O disparo responde na hora; os lotes saem em segundo plano e a rodada
// /api/sync/email-campanhas continua o que faltar. O "Mandar teste" usa
// POST /api/email/modelos (enviar_teste) com o modelo da campanha.
import {
  ErroCampanha, listarCampanhas, detalheCampanha, usoDoMes, salvarCampanha, resumo, disparar,
  duplicarCampanha, excluirCampanha, processarEnvio, agendar, cancelarAgendada,
} from '../_email-campanhas.js';
import { listarSegmentos } from '../_email-segmentos.js';
import { lerConfig, remetente } from '../_email-config.js';

const json = (dados, status = 200) => Response.json(dados, { status });
const autorizado = (url, env) => !!env.DASH_KEY && url.searchParams.get('key') === env.DASH_KEY;

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (!autorizado(url, env)) return json({ error: 'Unauthorized' }, 401);
  try {
    if (url.searchParams.get('id')) return json({ campanha: await detalheCampanha(env, url.searchParams.get('id')) });
    const [lista, uso, segmentos, modelos, cfg] = await Promise.all([
      listarCampanhas(env, { situacao: url.searchParams.get('situacao') || '' }),
      usoDoMes(env),
      listarSegmentos(env),
      env.DB.prepare("SELECT id, nome, assunto, previa FROM email_modelos WHERE canal = 'marketing' AND arquivado = 0 ORDER BY nome").all().then((r) => r.results || []),
      lerConfig(env),
    ]);
    return json({
      ...lista,
      uso,
      marketing_liberado: cfg.marketing_liberado === '1',
      remetente: remetente(cfg, 'marketing'),
      opcoes: { modelos, segmentos: segmentos.map((s) => ({ id: s.id, nome: s.nome, ativos: s.ativos })) },
    });
  } catch (e) {
    if (e instanceof ErroCampanha) return json({ error: e.message }, e.status);
    throw e;
  }
}

export async function onRequestPost({ request, env, waitUntil }) {
  if (!autorizado(new URL(request.url), env)) return json({ error: 'Unauthorized' }, 401);
  const corpo = await request.json().catch(() => ({}));
  try {
    switch (corpo.acao) {
      case 'salvar': return json({ ok: true, campanha: await salvarCampanha(env, corpo) });
      case 'resumo': return json(await resumo(env, corpo));
      case 'disparar': {
        const campanha = await disparar(env, corpo.id);
        const envio = processarEnvio(env, { campanhaId: campanha.id }).catch((e) => console.error('campanha: envio', e.message));
        if (waitUntil) waitUntil(envio); else await envio;
        return json({ ok: true, campanha });
      }
      case 'agendar': return json({ ok: true, campanha: await agendar(env, corpo.id, corpo) });
      case 'cancelar': return json({ ok: true, campanha: await cancelarAgendada(env, corpo.id) });
      case 'duplicar': return json({ ok: true, campanha: await duplicarCampanha(env, corpo.id) });
      case 'excluir': await excluirCampanha(env, corpo.id); return json({ ok: true });
      default: return json({ error: 'Ação desconhecida.' }, 400);
    }
  } catch (e) {
    if (e instanceof ErroCampanha) return json({ error: e.message }, e.status);
    return json({ error: 'Não foi possível concluir agora. Tente de novo.' }, 500);
  }
}
