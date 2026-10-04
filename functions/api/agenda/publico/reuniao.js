// GET  /api/agenda/publico/reuniao?g=<token de gestão>  → a reunião marcada
// POST /api/agenda/publico/reuniao  { g, acao: 'cancelar', motivo? }
//                                   { g, acao: 'remarcar', inicio }
//
// Página de confirmação e de gerenciamento do lead (spec, módulos 5 e 6). O
// token de gestão é o único acesso: quem tem o link gerencia a reunião.
// Abaixo da antecedência mínima do tipo, não deixa mudar e mostra o contato.
import { emCimaDaHora, SITUACOES_ATIVAS } from '../../_agenda-regras.js';
import {
  lerReuniao, lerTipo, cancelar, remarcar, registrarNoCrm, textoCrm, agora,
} from '../../_agenda.js';
import { emailsDaMudanca } from '../../_email-agenda.js';

// E-mails da agenda (issue 379) sem segurar a resposta quando há waitUntil.
const depois = (waitUntil, promessa) => (waitUntil ? waitUntil(promessa) : promessa);

const json = (dados, status = 200) => Response.json(dados, { status, headers: { 'Cache-Control': 'no-store' } });

function publico(reuniao, tipo) {
  const t = agora();
  const ativa = SITUACOES_ATIVAS.includes(reuniao.situacao);
  return {
    tipo: { nome: tipo.nome, slug: tipo.slug, duracao_min: tipo.duracao_min, ativo: tipo.ativo, comercial: tipo.comercial },
    inicio: reuniao.inicio,
    fim: reuniao.fim,
    nome: reuniao.nome,
    meet: ativa ? reuniao.meet_link : null,
    situacao: ativa && reuniao.fim < t ? 'passou' : (ativa ? 'marcada' : reuniao.situacao === 'cancelada' ? 'cancelada' : 'passou'),
    pode_mudar: ativa && !emCimaDaHora(reuniao.inicio, tipo.antecedencia_min, t),
    contato: tipo.contato_alternativo || '',
  };
}

export async function onRequestGet({ request, env }) {
  const g = new URL(request.url).searchParams.get('g');
  const reuniao = await lerReuniao(env, { tokenGestao: g });
  if (!reuniao) return json({ error: 'Link inválido.' }, 404);
  const tipo = await lerTipo(env, { id: reuniao.tipo_id });
  return json(publico(reuniao, tipo));
}

export async function onRequestPost({ request, env, waitUntil }) {
  const corpo = await request.json().catch(() => ({}));
  const reuniao = await lerReuniao(env, { tokenGestao: corpo.g });
  if (!reuniao) return json({ error: 'Link inválido.' }, 404);
  const tipo = await lerTipo(env, { id: reuniao.tipo_id });
  const estado = publico(reuniao, tipo);
  if (!estado.pode_mudar) {
    return json({ error: estado.situacao === 'marcada'
      ? 'Está muito em cima da hora para mudar pela página. Fale com a gente pelo contato abaixo.'
      : 'Esta reunião não pode mais ser alterada.', estado }, 409);
  }

  if (corpo.acao === 'cancelar') {
    const r = await cancelar(env, reuniao, { por: 'lead', motivo: corpo.motivo });
    if (r.erro) return json({ error: r.erro }, 409);
    await registrarNoCrm(env, reuniao, textoCrm('cancelou', tipo, reuniao, corpo.motivo ? `Motivo: ${String(corpo.motivo).slice(0, 500)}` : 'Cancelada pelo lead.'));
    await depois(waitUntil, emailsDaMudanca(env, reuniao.id, 'cancelou'));
    return json(publico(await lerReuniao(env, { id: reuniao.id }), tipo));
  }

  if (corpo.acao === 'remarcar') {
    const r = await remarcar(env, reuniao, tipo, Number(corpo.inicio), { por: 'lead' });
    if (r.erro) return json({ error: r.erro, codigo: r.codigo }, 409);
    await registrarNoCrm(env, reuniao, textoCrm('remarcou', tipo, { ...reuniao, inicio: r.inicio }));
    await depois(waitUntil, emailsDaMudanca(env, reuniao.id, 'remarcou'));
    return json(publico(await lerReuniao(env, { id: reuniao.id }), tipo));
  }

  return json({ error: 'Ação desconhecida.' }, 400);
}
