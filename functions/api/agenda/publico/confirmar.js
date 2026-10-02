// POST /api/agenda/publico/confirmar
//   { slug, c?, inicio, nome, email, telefone, respostas: [], fuso }
//
// Confirma o agendamento (spec, módulos 4 e 5): bloqueia robô, valida, reconfere
// o horário no Google, cria a reunião com Meet e grava. Nos tipos comerciais,
// em seguida (sem segurar a resposta): registra no card do CRM e manda o
// Schedule. Tipos não comerciais (RH, entrevistas) não tocam tracking, CRM,
// Meta nem GA4.
import { validarDadosAgendamento } from '../../_agenda-regras.js';
import {
  lerTipo, reservar, registrarNoCrm, textoCrm, enviarSchedule, atualizarDescricao, linkGestao,
} from '../../_agenda.js';
import { lerConvite } from '../../_agenda-convite.js';
import { padronizarTelefone } from '../../../_telefone.js';
import { detectBot, detectBotPorIp } from '../../../_bots.js';
import { motivoBloqueio } from '../../../_lead-bloqueio.js';

const json = (dados, status = 200) => Response.json(dados, { status, headers: { 'Cache-Control': 'no-store' } });

function lerCookie(request, nome) {
  const m = new RegExp('(?:^|;\\s*)' + nome + '=([^;]*)').exec(request.headers.get('Cookie') || '');
  return m ? decodeURIComponent(m[1]) : '';
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const corpo = await request.json().catch(() => ({}));
  const ip = request.headers.get('cf-connecting-ip') || '';
  const ua = request.headers.get('user-agent') || '';

  const tipo = await lerTipo(env, { slug: corpo.slug });
  if (!tipo || !tipo.ativo) return json({ error: 'Esta agenda está indisponível.' }, 404);

  let convite = null;
  if (tipo.comercial) {
    convite = await lerConvite(env, corpo.c);
    if (!convite || convite.tipo_id !== tipo.id) {
      return json({ error: 'Este link expirou. Preencha o formulário de novo para agendar.', codigo: 'sem_convite' }, 403);
    }
  }

  const v = validarDadosAgendamento(corpo, tipo.perguntas, padronizarTelefone);
  if (v.erros) return json({ error: 'Confira os campos destacados.', campos: v.erros }, 400);

  // Mesmas regras de bloqueio dos formulários do site. Robô recebe a mesma
  // cara de erro genérico: não ensinamos o que foi detectado.
  const robo = detectBot(ua).isBot || detectBotPorIp(ip).isBot
    || motivoBloqueio(v.dados.email, ip, tipo.funil || '') !== '';
  if (robo) return json({ error: 'Não foi possível concluir o agendamento.' }, 403);

  const inicio = Number(corpo.inicio);
  if (!Number.isInteger(inicio)) return json({ error: 'Escolha um horário.' }, 400);

  const fuso = typeof corpo.fuso === 'string' && corpo.fuso.length < 60 ? corpo.fuso : null;
  const r = await reservar(env, tipo, inicio, { ...v.dados, fuso }, {
    convite, sessionId: lerCookie(request, '_krob_sid'), ip,
  });
  if (r.erro) return json({ error: r.erro, codigo: r.codigo }, r.codigo === 'horario_ocupado' ? 409 : 503);

  const reuniao = r.reuniao;
  const eventId = `schedule-${reuniao.id}`;
  context.waitUntil((async () => {
    await atualizarDescricao(env, tipo, reuniao);
    if (!reuniao.comercial) return;
    await registrarNoCrm(env, reuniao, textoCrm('agendou', tipo, reuniao));
    await enviarSchedule(context, reuniao, eventId);
  })().catch((e) => console.error('agenda: pós-confirmação', e.message)));

  return json({
    ok: true,
    gestao: reuniao.token_gestao,
    link_gestao: linkGestao(reuniao.token_gestao),
    pagina_pos: tipo.pagina_pos || null,
    // O navegador espelha o Schedule no pixel com o MESMO event_id (dedup).
    schedule_event_id: reuniao.comercial ? eventId : null,
  });
}
