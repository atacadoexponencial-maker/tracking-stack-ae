// GET /api/email/relatorios?key=...&campanha=<id>                         → relatório da campanha (números, taxas, links)
// GET /api/email/relatorios?key=...&campanha=<id>&lista=abriram&pagina=1  → quem abriu / clicou / voltou / descadastrou
// GET /api/email/relatorios?key=...[&periodo=mes|mes-passado|90]          → visão geral do canal
//
// Spec spec-email-proprio.md, módulo 7 (issue 384). Regras em ../_email-relatorios.js.
import { relatorioCampanha, pessoasDaCampanha, visaoCanal } from '../_email-relatorios.js';
import { ErroCampanha } from '../_email-campanhas.js';

const json = (dados, status = 200) => Response.json(dados, { status });
const autorizado = (url, env) => !!env.DASH_KEY && url.searchParams.get('key') === env.DASH_KEY;

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (!autorizado(url, env)) return json({ error: 'Unauthorized' }, 401);
  const p = url.searchParams;
  try {
    if (p.get('campanha') && p.get('lista')) return json(await pessoasDaCampanha(env, p.get('campanha'), p.get('lista'), p.get('pagina') || 1));
    if (p.get('campanha')) return json(await relatorioCampanha(env, p.get('campanha')));
    return json(await visaoCanal(env, p.get('periodo') || 'mes'));
  } catch (e) {
    if (e instanceof ErroCampanha) return json({ error: e.message }, e.status);
    return json({ error: 'Não foi possível carregar o relatório agora. Tente de novo.' }, 500);
  }
}
