// GET  /api/email/segmentos?key=...  → segmentos com os ativos de agora + opções do montador
// POST /api/email/segmentos?key=...  → { acao: 'salvar', id?, nome, regras }
//                                      { acao: 'previa', regras }   (contagem e amostra, sem gravar)
//                                      { acao: 'duplicar' | 'excluir', id }
//
// Spec spec-email-proprio.md, módulo 5 (issue 381). Regras em ../_email-segmentos.js.
import {
  ErroSegmento, listarSegmentos, opcoes, validarRegras, contar, amostra, salvarSegmento, duplicarSegmento, excluirSegmento,
} from '../_email-segmentos.js';

const json = (dados, status = 200) => Response.json(dados, { status });
const autorizado = (url, env) => !!env.DASH_KEY && url.searchParams.get('key') === env.DASH_KEY;

export async function onRequestGet({ request, env }) {
  if (!autorizado(new URL(request.url), env)) return json({ error: 'Unauthorized' }, 401);
  const [segmentos, op] = await Promise.all([listarSegmentos(env), opcoes(env)]);
  return json({ segmentos, opcoes: op });
}

export async function onRequestPost({ request, env }) {
  if (!autorizado(new URL(request.url), env)) return json({ error: 'Unauthorized' }, 401);
  const corpo = await request.json().catch(() => ({}));
  try {
    switch (corpo.acao) {
      case 'previa': {
        const regras = await validarRegras(env, corpo.regras);
        const [c, a] = await Promise.all([contar(env, regras), amostra(env, regras)]);
        return json({ ...c, amostra: a });
      }
      case 'salvar': return json({ ok: true, segmento: await salvarSegmento(env, corpo) });
      case 'duplicar': return json({ ok: true, segmento: await duplicarSegmento(env, corpo.id) });
      case 'excluir': await excluirSegmento(env, corpo.id); return json({ ok: true });
      default: return json({ error: 'Ação desconhecida.' }, 400);
    }
  } catch (e) {
    if (e instanceof ErroSegmento) return json({ error: e.message }, e.status);
    return json({ error: 'Não foi possível concluir agora. Tente de novo.' }, 500);
  }
}
