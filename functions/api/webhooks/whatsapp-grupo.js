// POST /api/webhooks/whatsapp-grupo
//
// Recebe uma CÓPIA do evento cru da Evolution, repassada por um nó HTTP do
// workflow do n8n que já recebe o webhook ("Evolution -> Postgres | Grupos
// clientes read-only"). A Evolution só aceita uma URL de webhook por instância,
// e ela já aponta para o n8n — repontar quebraria aquele fluxo.
//
// Auth: header `x-grupos-secret: <env.GRUPOS_WEBHOOK_SECRET>`. É um segredo
// PRÓPRIO, não o SYNC_SECRET: aquele abre quatro endpoints de sync, e colá-lo no
// n8n daria poder de escrita em todos eles a quem tem acesso ao n8n.
//
// Responde 200 rápido mesmo quando ignora o evento — a resposta do n8n para a
// Evolution não pode ficar pendurada por causa daqui.

import { classificarEvento } from './_classificar.js';
import { registrarHorario } from '../_horario-registro.js';
import { telefoneDoJid } from '../_grupo-conversao.js';
import { pontearGrupoLive, GRUPO_LIVE_JID } from '../_grupo-live-manychat.js';
import { registrarNoCrm } from '../_grupo-live-crm.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  // Este endpoint é a ÚNICA porta de entrada e a Evolution não reentrega evento
  // nenhum — falha aqui é perda definitiva. Os console.error abaixo (401, JSON
  // inválido, evento ignorado) existem para diferenciar "semana parada" de
  // "ingestão quebrada" nos logs do Pages. Nunca logar o valor do segredo.
  const enviado = request.headers.get('x-grupos-secret') || '';
  if (!env.GRUPOS_WEBHOOK_SECRET || enviado !== env.GRUPOS_WEBHOOK_SECRET) {
    console.error('whatsapp-grupo — segredo divergente ou ausente (401)');
    return json({ error: 'Unauthorized' }, 401);
  }

  let body;
  try { body = await request.json(); } catch (e) {
    console.error('whatsapp-grupo — JSON inválido no corpo da requisição:', e?.message || e);
    return json({ ok: true, status: 'ignorado', motivo: 'json_invalido' });
  }

  const chegadaMs = Date.now();
  const evento = classificarEvento(body, chegadaMs);
  // Horário suspeito (spec-protecoes-integracoes.md): o informado pela Evolution
  // ANTES da correção mede o defeito da fonte; o corrigido confirma que a
  // correção funciona. Só observação — não muda nada no evento.
  if (evento) {
    context.waitUntil(Promise.all([
      registrarHorario(env, 'grupos-whatsapp', body.date_time, { chegadaMs, ref: evento.groupJid }),
      registrarHorario(env, 'grupos-whatsapp:corrigido', evento.occurredAt, { chegadaMs, ref: evento.groupJid }),
    ]));
  }
  if (!evento) {
    // Nunca o corpo cru no log: ele carrega os JIDs (telefones) dos
    // participantes, inclusive de grupos de terceiros que a feature
    // deliberadamente não persiste no banco (decisão de privacidade da spec).
    // Só o suficiente para diagnosticar por que o evento foi descartado.
    console.error('whatsapp-grupo — evento ignorado (não é GROUP_PARTICIPANTS_UPDATE de grupo válido):', {
      event: body?.event,
      action: body?.data?.action,
      groupJid: body?.data?.id,
      participantes: Array.isArray(body?.data?.participants) ? body.data.participants.length : 0,
    });
    return json({ ok: true, status: 'ignorado' });
  }

  const agora = Math.floor(Date.now() / 1000);

  // Todo grupo que gera evento é registrado — sem participantes. É assim que uma
  // Comunidade nova aparece no dash em vez de sumir calada.
  const stmts = [
    env.DB.prepare(
      `INSERT INTO whatsapp_groups_seen (group_jid, group_name, events, last_event_at)
       VALUES (?, NULL, 1, ?)
       ON CONFLICT(group_jid) DO UPDATE SET
         events = whatsapp_groups_seen.events + 1,
         last_event_at = excluded.last_event_at`
    ).bind(evento.groupJid, evento.occurredAt),
  ];

  const monitorado = await env.DB.prepare(
    `SELECT label FROM whatsapp_groups_tracked WHERE group_jid = ? AND enabled = 1`
  ).bind(evento.groupJid).first();

  if (!monitorado) {
    await env.DB.batch(stmts);
    return json({ ok: true, status: 'nao_monitorado', group_jid: evento.groupJid });
  }

  // Payload truncado: serve para depurar um caso estranho, não para virar acervo.
  // Cópia rasa (não muta `body`) removendo campos que não são dados do evento:
  // `apikey` vem em texto claro no payload real da Evolution (confirmado em
  // produção em 2026-07-27) e não pode parar no D1; `server_url`, `destination`
  // e `sender` são metadados de transporte/roteamento, só ruído aqui.
  const { apikey, server_url, destination, sender, ...semSegredo } = body || {};
  const cru = JSON.stringify(semSegredo).slice(0, 2000);
  const ins = env.DB.prepare(
    `INSERT OR IGNORE INTO whatsapp_group_events
       (group_jid, participant_jid, action, actor_jid, occurred_at, day_local, received_at, raw_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const l of evento.linhas) {
    stmts.push(ins.bind(
      evento.groupJid, l.participantJid, l.action, l.actorJid,
      evento.occurredAt, evento.dayLocal, agora, cru));
  }

  const resultados = await env.DB.batch(stmts);

  // Ponte para o ManyChat, só no grupo da live semanal. Roda DEPOIS da
  // gravação e fora do caminho da resposta: o n8n não espera por ela e uma
  // falha do ManyChat não custa o evento.
  //
  // Só as linhas que o `INSERT OR IGNORE` acabou de inserir são encaminhadas —
  // `meta.changes` de cada comando (os resultados voltam na ordem em que foram
  // enfileirados, e o primeiro é o upsert de whatsapp_groups_seen). É isso que
  // impede a reentrega do mesmo evento pelo n8n de mandar a mensagem de
  // boas-vindas duas vezes.
  let manychat = 'nao_e_o_grupo';
  if (evento.groupJid === GRUPO_LIVE_JID) {
    // Participante que já chega como admin é da equipe — fora da automação.
    const admins = new Set(
      (Array.isArray(body?.data?.participants) ? body.data.participants : [])
        .filter((p) => p && typeof p === 'object' && p.admin)
        .map((p) => String(p.phoneNumber || p.id || '')),
    );
    const novas = evento.linhas.filter((l, i) => {
      const mudou = resultados?.[i + 1]?.meta?.changes;
      return mudou === 1 && !admins.has(l.participantJid);
    });
    if (typeof resultados?.[1]?.meta?.changes !== 'number') {
      // Sem saber o que é linha nova, mandar arriscaria mensagem repetida.
      manychat = 'sem_confirmacao_de_linha_nova';
      console.error('whatsapp-grupo — D1 não devolveu meta.changes; ponte do ManyChat não foi chamada');
    } else if (novas.length) {
      manychat = 'despachado';
      context.waitUntil(pontearGrupoLive(env, novas).catch((e) => {
        console.error('grupo-live-manychat — ponte falhou por inteiro:', e?.message || e);
      }));
      // Comentário no card de quem já é lead, para o comercial. Independente da
      // ponte do ManyChat: uma falhar não pode levar a outra junto.
      context.waitUntil(registrarNoCrm(env, novas, evento.occurredAt).catch((e) => {
        console.error('grupo-live-crm — ponte falhou por inteiro:', e?.message || e);
      }));
    } else {
      manychat = 'reentrega';
    }
  }

  // Quantas linhas vieram SEM telefone (só "@lid"): a partir de 2026-09-09 a
  // Evolution passou a mandar participante sem phoneNumber com frequência, e
  // essas entradas contam na aba Grupos mas nunca viram conversão EntrouGrupo
  // nem cruzam com lead. Devolver o número aqui é o que deixa o n8n/log
  // mostrar quando isso vira regra em vez de exceção.
  const semTelefone = evento.linhas.filter((l) => !telefoneDoJid(l.participantJid)).length;
  return json({ ok: true, status: 'gravado', linhas: evento.linhas.length, sem_telefone: semTelefone, manychat });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
