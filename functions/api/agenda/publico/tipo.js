// GET /api/agenda/publico/tipo?slug=<slug>[&c=<convite>]
//
// O que a página /agendar/<slug> precisa para abrir (spec, módulo 4). Sem
// chave: é a página que o lead vê. Nunca devolve configuração interna
// (agendas, funil, grade) — só o que aparece na tela.
//
//   estado 'ok'          → mostra a agenda
//   estado 'pausado'     → "agenda indisponível" + contato alternativo
//   estado 'sem_convite' → tipo comercial aberto sem passar pelo formulário:
//                          a página manda para a LP do funil (decisão 10)
//   404                  → tipo não existe
import { lerTipo } from '../../_agenda.js';
import { lerConvite } from '../../_agenda-convite.js';
import { FUNIL_POR_PAGINA } from '../../_funil-paginas.js';

const json = (dados, status = 200) => Response.json(dados, { status, headers: { 'Cache-Control': 'no-store' } });

export function lpDoFunil(funil) {
  for (const [pagina, f] of FUNIL_POR_PAGINA) if (f === funil) return pagina;
  return '/';
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const tipo = await lerTipo(env, { slug: url.searchParams.get('slug') });
  if (!tipo) return json({ error: 'Página não encontrada.' }, 404);
  const base = {
    nome: tipo.nome, duracao_min: tipo.duracao_min, comercial: tipo.comercial,
    contato: tipo.contato_alternativo || '',
  };
  if (!tipo.ativo) return json({ ...base, estado: 'pausado' });

  if (tipo.comercial) {
    const convite = await lerConvite(env, url.searchParams.get('c'));
    if (!convite || convite.tipo_id !== tipo.id) {
      return json({ ...base, estado: 'sem_convite', destino: lpDoFunil(tipo.funil) });
    }
    return json({
      ...base, estado: 'ok', janela_dias: tipo.janela_dias,
      lead: { nome: convite.nome || '', email: convite.email || '', telefone: convite.telefone || '' },
      perguntas: tipo.perguntas,
    });
  }
  return json({ ...base, estado: 'ok', janela_dias: tipo.janela_dias, lead: null, perguntas: tipo.perguntas });
}
