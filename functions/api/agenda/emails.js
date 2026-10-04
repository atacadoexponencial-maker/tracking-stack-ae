// GET  /api/agenda/emails?key=...[&tipo=<id>]  → tipos, e-mails do tipo, modelos transacionais e remetente
// POST /api/agenda/emails?key=...  → { acao: 'salvar', id, ligado?, modelo_id? }
//                                    { acao: 'adicionar_lembrete', tipo_id, antes_min }
//                                    { acao: 'tirar_lembrete', id }
//
// Spec spec-email-proprio.md, módulo 3 (issue 379). Regras em ../_email-agenda.js.
// O "Mandar teste" da tela usa POST /api/email/modelos (enviar_teste) com o modelo escolhido.
import {
  ANTECEDENCIAS, ErroEmailAgenda, configDoTipo, salvarEmailDaAgenda, adicionarLembrete, tirarLembrete,
} from '../_email-agenda.js';
import { lerConfig } from '../_email-config.js';

const json = (dados, status = 200) => Response.json(dados, { status });
const autorizado = (url, env) => !!env.DASH_KEY && url.searchParams.get('key') === env.DASH_KEY;

async function estado(env, tipoPedido, comTestes) {
  // Tipos de teste ficam fora, a não ser com ?testes=1 ("Mostrar testes").
  const todos = (await env.DB.prepare('SELECT id, nome, comercial, ativo, teste FROM agenda_tipos ORDER BY ativo DESC, nome').all()).results || [];
  const tipos = comTestes ? todos : todos.filter((t) => !t.teste);
  const tipo = tipos.find((t) => t.id === Number(tipoPedido)) || tipos[0] || null;
  const [emails, modelos, cfg] = await Promise.all([
    tipo ? configDoTipo(env, tipo.id) : [],
    env.DB.prepare("SELECT id, nome FROM email_modelos WHERE canal = 'transacional' AND arquivado = 0 ORDER BY nome").all().then((r) => r.results || []),
    lerConfig(env),
  ]);
  return {
    tipos,
    tipo_id: tipo ? tipo.id : null,
    emails,
    modelos,
    remetente: { nome: cfg.remetente_transacional_nome, email: cfg.remetente_transacional_email },
    antecedencias: ANTECEDENCIAS,
    testes_escondidos: todos.length - tipos.length,
  };
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (!autorizado(url, env)) return json({ error: 'Unauthorized' }, 401);
  return json(await estado(env, url.searchParams.get('tipo'), url.searchParams.get('testes') === '1'));
}

export async function onRequestPost({ request, env }) {
  if (!autorizado(new URL(request.url), env)) return json({ error: 'Unauthorized' }, 401);
  const corpo = await request.json().catch(() => ({}));
  try {
    let tipoId;
    if (corpo.acao === 'salvar') tipoId = await salvarEmailDaAgenda(env, corpo);
    else if (corpo.acao === 'adicionar_lembrete') tipoId = await adicionarLembrete(env, corpo);
    else if (corpo.acao === 'tirar_lembrete') tipoId = await tirarLembrete(env, corpo);
    else return json({ error: 'Ação desconhecida.' }, 400);
    return json({ ok: true, ...(await estado(env, tipoId, !!corpo.testes)) });
  } catch (e) {
    if (e instanceof ErroEmailAgenda) return json({ error: e.message }, e.status);
    return json({ error: 'Não foi possível concluir agora. Tente de novo.' }, 500);
  }
}
