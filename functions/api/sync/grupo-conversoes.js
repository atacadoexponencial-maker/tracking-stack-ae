// POST /api/sync/grupo-conversoes
//
// Envia ao Meta a conversão `EntrouGrupo` para cada pessoa que entrou de verdade
// num grupo de WhatsApp elegível (spec 2026-07-29). Chamado por cron na VPS,
// irmão de meta-leads-sync.
//
// Duas camadas de deduplicação, de propósito:
//   1. UNIQUE(group_jid, phone) na whatsapp_group_conversions — reentrada da
//      mesma pessoa nunca vira segunda conversão, sem prazo de validade.
//   2. `event_id` estável (grupo:<jid>:<phone>) — se uma pendência for reenviada
//      depois de o Meta já ter recebido, ele reconhece o mesmo acontecimento.
// A primeira protege o nosso banco; a segunda protege o número do Meta.
//
// A tabela whatsapp_group_events NÃO é tocada: a aba Grupos do dash continua
// contando tudo, inclusive reentradas (exigência da spec).
//
// Destino: SOMENTE o pixel META_PIXEL_ID_2 (2800317883678788), onde a conversão
// personalizada 1595278292393579 foi criada. Mandar para o pixel antigo seria
// ruído — a conversão não existe lá.
//
// Auth: header `x-sync-secret: <env.SYNC_SECRET>`, como os demais syncs.

import { sha256, normalizePhone } from '../_hash.js';
import { entradaElegivel, eventIdDaEntrada, sufixoParaCasar, comNonoDigito } from '../_grupo-conversao.js';

const EVENT_NAME = 'EntrouGrupo';
const MAX_TENTATIVAS = 5;
// O Meta recusa evento com event_time mais velho que 7 dias. Uma pendência que
// chegou a 6 dias sem sair (token quebrado por uma semana, por exemplo) não tem
// mais como ser aceita — insistir só gastaria busca de lead e chamada à API
// para receber o mesmo erro. Marca como falha definitiva e libera a fila.
const DIAS_VALIDADE_PENDENCIA = 6;
// Sem movimentação nenhuma por mais que isto = a fonte (Evolution/n8n) caiu.
// A conversão pararia em silêncio, que é o risco assumido na spec.
const HORAS_SEM_EVENTO_PARA_ALERTAR = 48;

export async function onRequestPost(context) {
  const { request, env } = context;

  const sent = request.headers.get('x-sync-secret') || '';
  if (!env.SYNC_SECRET || sent !== env.SYNC_SECRET) {
    return json({ error: 'Unauthorized' }, 401);
  }
  if (!env.DB) return json({ error: 'DB unavailable' }, 500);

  const started = Date.now();
  const agora = Math.floor(Date.now() / 1000);
  let aceitas = 0, jaConvertidas = 0, enviadas = 0, falhas = 0, semTelefone = 0;
  let credencialQuebrada = null;

  // 1. Grupos que participam. Sem nenhum, não há o que fazer — e isso é estado
  //    normal (ex.: antes da ativação), não erro.
  const { results: grupos } = await env.DB.prepare(
    `SELECT group_jid, label, send_conversion, conversion_since
       FROM whatsapp_groups_tracked
      WHERE enabled = 1 AND send_conversion = 1 AND COALESCE(conversion_since, 0) > 0`
  ).all();

  if (grupos && grupos.length) {
    const porJid = new Map(grupos.map((g) => [g.group_jid, g]));
    const corteMin = Math.min(...grupos.map((g) => g.conversion_since));

    // 2. Entradas candidatas. O filtro grosso é por `received_at` (INTEGER
    //    confiável, indexado desde a 0037); o fino fica em entradaElegivel, que
    //    lê o `occurred_at` real.
    //
    //    Cursor (revisão 2026-09-13): antes, cada rodada relia TODAS as entradas
    //    desde o corte do grupo — a cada 15 min, pelo ciclo inteiro da
    //    Comunidade — só para o INSERT OR IGNORE dizer "já tinha". O cursor é a
    //    última vez que este sync aceitou algo (MAX(criado_em)), com 1h de folga
    //    para não perder evento que a Evolution entregou atrasado. O corte por
    //    conversion_since continua valendo: vence o maior dos dois.
    const { results: eventos } = await env.DB.prepare(
      `SELECT group_jid, participant_jid, action, occurred_at
         FROM whatsapp_group_events
        WHERE action = 'entrou'
          AND received_at >= ?
          AND received_at > (SELECT COALESCE(MAX(criado_em), 0) - 3600 FROM whatsapp_group_conversions)
        ORDER BY occurred_at`
    ).bind(corteMin - 86400).all();

    // INSERTs acumulados e gravados num batch único (1 subrequisição ao D1),
    // em vez de uma ida ao banco por entrada. INSERT OR IGNORE segue sendo a
    // dedup: quem já converteu neste grupo não passa.
    const inserir = env.DB.prepare(
      `INSERT OR IGNORE INTO whatsapp_group_conversions
         (group_jid, phone, event_id, occurred_at, status, tentativas, enriquecida, criado_em)
       VALUES (?, ?, ?, ?, 'pendente', 0, 0, ?)`
    );
    const lote = [];

    for (const ev of eventos || []) {
      const ocorridoUnix = Math.floor(Date.parse(ev.occurred_at) / 1000);
      const veredito = entradaElegivel(
        {
          action: ev.action,
          groupJid: ev.group_jid,
          participantJid: ev.participant_jid,
          occurredAtUnix: Number.isFinite(ocorridoUnix) ? ocorridoUnix : 0,
        },
        porJid.get(ev.group_jid)
      );

      if (!veredito.elegivel) {
        // Entrada sem telefone utilizável é contabilizada mas não interrompe o
        // lote — as demais do mesmo evento seguem normalmente.
        if (veredito.motivo === 'sem_telefone') semTelefone++;
        continue;
      }

      lote.push(inserir.bind(
        ev.group_jid, veredito.phone,
        eventIdDaEntrada(ev.group_jid, veredito.phone),
        ev.occurred_at, agora
      ));
    }

    if (lote.length) {
      const resultados = await env.DB.batch(lote);
      for (const r of resultados || []) {
        if (r && r.meta && r.meta.changes > 0) aceitas++; else jaConvertidas++;
      }
    }
  }

  // 3a. Pendência velha demais não vale mais a pena: o Meta recusa event_time
  //     além de 7 dias, então tentar de novo só devolveria o mesmo erro (e
  //     custaria uma busca de lead por rodada). occurred_at é ISO UTC com "Z",
  //     então a comparação de texto é a comparação cronológica.
  const limiteValidade = new Date((agora - DIAS_VALIDADE_PENDENCIA * 86400) * 1000).toISOString();
  const expiradas = await env.DB.prepare(
    `UPDATE whatsapp_group_conversions
        SET status = 'falha', erro = 'expirada (>6 dias)'
      WHERE status = 'pendente' AND occurred_at < ?`
  ).bind(limiteValidade).run();
  const expiradasN = (expiradas && expiradas.meta && expiradas.meta.changes) || 0;

  // 3b. Fila: novas + pendências de execuções anteriores que ainda têm crédito.
  const { results: pendentes } = await env.DB.prepare(
    `SELECT id, group_jid, phone, event_id, occurred_at, tentativas
       FROM whatsapp_group_conversions
      WHERE status = 'pendente' AND tentativas < ?
      ORDER BY criado_em LIMIT 100`
  ).bind(MAX_TENTATIVAS).all();

  // 3c. Credencial ANTES do loop. Vars sumidas é o modo de falha silenciosa que
  //     já mordeu este projeto: registra o motivo em vez de fingir sucesso — e
  //     sem gastar uma busca de lead para descobrir isso.
  if ((pendentes || []).length && (!env.META_PIXEL_ID_2 || !env.META_ACCESS_TOKEN_2)) {
    credencialQuebrada = 'META_PIXEL_ID_2/META_ACCESS_TOKEN_2 ausentes';
    falhas += pendentes.length;
  }
  // Token validado com uma chamada barata antes da PRIMEIRA busca de lead da
  // rodada. Motivo: a busca (varredura de lead_dispatch) é a parte cara, e com
  // o token do pixel 2 inválido desde 31/07 ela rodava para nada — foi o que
  // consumiu 7,2 milhões de linhas/dia do D1 em 2026-09-04. O abort do lote
  // reduziu para 1 busca por rodada; a validação prévia leva a zero. Só
  // 190/OAuthException/401 abortam: qualquer outra resposta deixa o envio real
  // decidir (um token de CAPI pode não ter permissão de LEITURA do pixel e
  // ainda assim aceitar eventos).
  let tokenValidado = false;

  for (const c of credencialQuebrada ? [] : (pendentes || [])) {
    try {
      if (!tokenValidado) {
        const v = await validarCredencial(env);
        if (!v.ok) {
          credencialQuebrada = v.erro;
          falhas += pendentes.length;
          break;
        }
        tokenValidado = true;
      }
      const lead = await buscarLead(env, c.phone);
      const resultado = await enviarAoMeta(env, c, lead);

      if (resultado.ok) {
        await env.DB.prepare(
          `UPDATE whatsapp_group_conversions
              SET status = 'enviada', enriquecida = ?, enviado_em = ?, erro = NULL,
                  tentativas = tentativas + 1
            WHERE id = ?`
        ).bind(lead ? 1 : 0, agora, c.id).run();
        enviadas++;
      } else if (resultado.credencial) {
        // Token inválido/ausente é problema NOSSO, não daquela conversão: se
        // consumisse tentativa, um token quebrado por algumas horas queimaria as
        // 5 chances de cada entrada da live e as perderia para sempre. Fica
        // pendente sem gastar crédito, e o alerta chama alguém para consertar.
        await env.DB.prepare(
          `UPDATE whatsapp_group_conversions SET erro = ? WHERE id = ?`
        ).bind(resultado.erro.slice(0, 500), c.id).run();
        falhas++;
        credencialQuebrada = resultado.erro;
        // ABORTA o lote: a credencial é a mesma para todas as pendências, então
        // as demais falhariam pelo mesmo motivo. Insistir custa uma busca de
        // lead por pendência (varredura de lead_dispatch) a cada rodada do
        // cron — e como o erro de credencial não consome tentativa, a fila
        // nunca esvazia e isso se repete para sempre. Foi o que consumiu 7,2
        // milhões de linhas/dia do D1 em 2026-09-04, com o token do pixel 2
        // inválido desde 31/07. Uma tentativa por rodada basta para detectar
        // que o token voltou.
        break;
      } else {
        const tentativas = c.tentativas + 1;
        // Erro do Meta sobre event_time (evento velho demais) é definitivo:
        // o tempo só anda para frente, a próxima tentativa recebe o mesmo não.
        const definitiva = tentativas >= MAX_TENTATIVAS || resultado.definitivo === true;
        await env.DB.prepare(
          `UPDATE whatsapp_group_conversions
              SET status = ?, tentativas = ?, erro = ?
            WHERE id = ?`
        ).bind(definitiva ? 'falha' : 'pendente', tentativas, resultado.erro.slice(0, 500), c.id).run();
        falhas++;
      }
    } catch (e) {
      const tentativas = c.tentativas + 1;
      await env.DB.prepare(
        `UPDATE whatsapp_group_conversions
            SET status = ?, tentativas = ?, erro = ?
          WHERE id = ?`
      ).bind(tentativas >= MAX_TENTATIVAS ? 'falha' : 'pendente', tentativas,
        String(e && e.message || e).slice(0, 500), c.id).run();
      falhas++;
    }
  }

  // 4. A fonte caiu? Sem isto a conversão morre calada — que é exatamente o
  //    risco que a spec manda deixar visível.
  const ultimo = await env.DB.prepare(
    `SELECT MAX(received_at) AS ts FROM whatsapp_group_events`
  ).first();
  const horasSemEvento = ultimo && ultimo.ts ? (agora - ultimo.ts) / 3600 : null;
  const fonteParada = horasSemEvento !== null && horasSemEvento > HORAS_SEM_EVENTO_PARA_ALERTAR;

  // sync_log só quando houve trabalho ou erro. O cron roda a cada 15 min e a
  // maior parte das rodadas não tem nada a fazer — 96 linhas/dia de "ok, 0"
  // só enterravam as rodadas que importam.
  const houveTrabalho = aceitas || enviadas || falhas || expiradasN;
  if (houveTrabalho || credencialQuebrada || fonteParada) {
    await env.DB.prepare(
      `INSERT INTO sync_log (platform, status, rows_upserted, date_from, date_to, error_message, duration_ms, run_at)
       VALUES ('grupo_conversoes', ?, ?, NULL, NULL, ?, ?, ?)`
    ).bind(
      falhas ? 'error' : 'ok', enviadas,
      credencialQuebrada
        ? `CREDENCIAL do pixel 2 inválida — nada é enviado até corrigir: ${String(credencialQuebrada).slice(0, 200)}`
        : (falhas ? `${falhas} envio(s) falharam` : (fonteParada ? `sem eventos de grupo há ${Math.round(horasSemEvento)}h` : null)),
      Date.now() - started, agora
    ).run();
  }

  return json({
    ok: true, aceitas, ja_convertidas: jaConvertidas, enviadas, falhas,
    expiradas: expiradasN,
    sem_telefone: semTelefone,
    credencial_invalida: credencialQuebrada ? true : false,
    horas_sem_evento: horasSemEvento === null ? null : Math.round(horasSemEvento),
    fonte_parada: fonteParada,
  });
}

// Procura o telefone entre os leads já conhecidos para enriquecer a conversão.
// Sem correspondência devolve null e a conversão vai só com o telefone — o
// enriquecimento é opcional, a conversão não.
async function buscarLead(env, phone) {
  const sufixo = sufixoParaCasar(phone);
  if (!sufixo) return null;
  try {
    // Mais recente vence quando o mesmo telefone aparece em vários leads.
    return await env.DB.prepare(
      `SELECT s.fbp, s.fbc, s.external_id, s.ip_address, s.user_agent
         FROM lead_dispatch d
         JOIN event_log e ON e.event_id = d.event_id
         JOIN sessions s ON s.session_id = e.session_id
        WHERE REPLACE(REPLACE(REPLACE(REPLACE(d.phone,'+',''),'-',''),' ',''),'(','') LIKE ?
        ORDER BY d.criado_em DESC LIMIT 1`
    ).bind('%' + sufixo).first();
  } catch (_) {
    // Busca é melhoria, não pré-requisito: falhar aqui não pode barrar o envio.
    return null;
  }
}

// Token inválido/expirado devolve OAuthException 190 em QUALQUER endpoint do
// Graph, então um GET no próprio pixel basta para saber se vale a pena seguir.
// Só o erro de credencial reprova; permissão insuficiente para LER o pixel não
// diz nada sobre ESCREVER eventos, e aí deixa o envio real decidir.
async function validarCredencial(env) {
  const pixelId = env.META_PIXEL_ID_2;
  const accessToken = env.META_ACCESS_TOKEN_2;
  if (!pixelId || !accessToken) {
    return { ok: false, erro: 'META_PIXEL_ID_2/META_ACCESS_TOKEN_2 ausentes' };
  }
  try {
    const resp = await fetch(
      `https://graph.facebook.com/v25.0/${pixelId}?fields=id&access_token=${accessToken}`
    );
    if (resp.ok) return { ok: true };
    const corpo = await resp.text().catch(() => '');
    if (ehErroDeCredencial(resp.status, corpo)) {
      return { ok: false, erro: `HTTP ${resp.status}: ${corpo}` };
    }
    return { ok: true };
  } catch (_) {
    // Rede falhou na validação: não é veredito sobre o token. Segue o fluxo
    // normal — o envio real vai falhar (ou não) por conta própria.
    return { ok: true };
  }
}

// OAuthException (code 190) e 401/403 são credencial, não o evento: token
// inválido, expirado ou sem permissão. Distinguir importa porque só o outro
// tipo de erro deve consumir tentativa.
function ehErroDeCredencial(status, corpo) {
  return status === 401 || status === 403 || /"code"\s*:\s*190|OAuthException/.test(corpo);
}

async function enviarAoMeta(env, conversao, lead) {
  const pixelId = env.META_PIXEL_ID_2;
  const accessToken = env.META_ACCESS_TOKEN_2;
  if (!pixelId || !accessToken) {
    // Vars sumidas é o modo de falha silenciosa que já mordeu este projeto:
    // registra o motivo em vez de fingir sucesso.
    return { ok: false, credencial: true, erro: 'META_PIXEL_ID_2/META_ACCESS_TOKEN_2 ausentes' };
  }

  // Telefone com o nono dígito completado: é o formato do perfil da pessoa no
  // Meta. `conversao.phone` fica como veio do WhatsApp porque compõe o event_id
  // e a chave UNIQUE — mudá-lo lá abriria espaço para conversão duplicada.
  const userData = {
    ph: [await sha256(normalizePhone(comNonoDigito(conversao.phone), env.DEFAULT_COUNTRY_CODE))],
  };
  if (lead) {
    if (lead.fbp) userData.fbp = lead.fbp;
    if (lead.fbc) userData.fbc = lead.fbc;
    if (lead.external_id) userData.external_id = [await sha256(lead.external_id)];
    if (lead.ip_address) userData.client_ip_address = lead.ip_address;
    if (lead.user_agent) userData.client_user_agent = lead.user_agent;
  }

  const payload = {
    data: [{
      event_name: EVENT_NAME,
      // Momento REAL da entrada no grupo, não o do envio.
      event_time: Math.floor(Date.parse(conversao.occurred_at) / 1000),
      event_id: conversao.event_id,
      // A entrada acontece no WhatsApp, fora do site.
      action_source: 'other',
      user_data: userData,
      // Qual grupo, para a operação criar uma conversão personalizada por grupo
      // sem precisar de eventos com nomes diferentes.
      custom_data: { group_jid: conversao.group_jid },
    }],
  };
  if (env.META_TEST_EVENT_CODE) payload.test_event_code = env.META_TEST_EVENT_CODE;

  const resp = await fetch(
    `https://graph.facebook.com/v25.0/${pixelId}/events?access_token=${accessToken}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
  );
  if (resp.ok) return { ok: true };
  const corpo = await resp.text().catch(() => '');
  const credencial = ehErroDeCredencial(resp.status, corpo);
  // Reclamação sobre event_time (evento além dos 7 dias que o Meta aceita) é
  // definitiva: nenhuma tentativa futura passa.
  const definitivo = !credencial && /event_time/i.test(corpo);
  return { ok: false, credencial, definitivo, erro: `HTTP ${resp.status}: ${corpo}` };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
