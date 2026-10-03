// POST /api/webhooks/postmark  (GET/HEAD respondem 200 só para dizer que a URL existe)
//
// Recebe os avisos do Postmark: entregue, voltou, spam, abriu, clicou e
// descadastrou (issue 377). Cadastrado pelo dash em "Conectar resultados"
// (POST /api/email/config, acao conectar_resultados), um por stream.
//
// Auth: Basic Auth contra POSTMARK_WEBHOOK_USER e POSTMARK_WEBHOOK_PASS. É o
// único fator: o Postmark não assina o corpo com HMAC.
//
// Respostas: 401 sem senha certa (nada gravado); 200 para corpo inválido ou
// aviso que não interessa (evita reentrega infinita de lixo); 200 para aviso
// repetido; 500 só quando o D1 falha de verdade, para o Postmark reentregar.
//
// Nada do corpo vai para log: ele traz o e-mail do destinatário.

import { normalizarEvento, sqlAtualizarEnvio } from '../_email-eventos.js';

const json = (dados, status = 200) => Response.json(dados, { status });

export async function onRequestGet() {
  return json({ ok: true, endpoint: 'postmark', metodo: 'use POST para entregar eventos' });
}

export async function onRequestHead() {
  return new Response(null, { status: 200 });
}

// Comparação em tempo constante, sem depender de crypto.subtle.timingSafeEqual
// (que só existe no runtime da Cloudflare).
function iguais(a, b) {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let dif = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) dif |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return dif === 0;
}

export function autorizado(request, env) {
  if (!env.POSTMARK_WEBHOOK_USER || !env.POSTMARK_WEBHOOK_PASS) return false;
  const m = /^Basic\s+(.+)$/i.exec(request.headers.get('authorization') || '');
  if (!m) return false;
  let par;
  try { par = atob(m[1].trim()); } catch { return false; }
  const i = par.indexOf(':');
  if (i < 0) return false;
  const usuarioOk = iguais(par.slice(0, i), String(env.POSTMARK_WEBHOOK_USER));
  const senhaOk = iguais(par.slice(i + 1), String(env.POSTMARK_WEBHOOK_PASS));
  return usuarioOk && senhaOk;
}

export async function onRequestPost({ request, env }) {
  if (!autorizado(request, env)) {
    // Só booleanos: nada do valor recebido nem do esperado.
    console.error('postmark: 401:', {
      configurado: !!(env.POSTMARK_WEBHOOK_USER && env.POSTMARK_WEBHOOK_PASS),
      recebido: !!request.headers.get('authorization'),
    });
    return json({ error: 'Unauthorized' }, 401);
  }

  let corpo;
  try { corpo = await request.json(); } catch { return json({ ok: true, status: 'ignorado', motivo: 'json_invalido' }); }

  const evento = normalizarEvento(corpo);
  if (!evento) return json({ ok: true, status: 'ignorado', motivo: 'aviso_sem_interesse' });

  try {
    const ja = await env.DB.prepare('SELECT 1 FROM email_eventos WHERE chave = ?').bind(evento.chave).first();
    if (ja) return json({ ok: true, status: 'repetido' });

    const envio = await env.DB.prepare('SELECT id FROM email_envios WHERE message_id = ?').bind(evento.messageId).first();
    // Primeiro o envio (idempotente), depois o evento: se o D1 cair entre os
    // dois, a reentrega do Postmark refaz os dois sem estragar nada.
    if (envio) {
      const { sql, binds } = sqlAtualizarEnvio(evento, envio.id);
      await env.DB.prepare(sql).bind(...binds).run();
    }
    await env.DB.prepare(
      `INSERT OR IGNORE INTO email_eventos (chave, message_id, envio_id, tipo, stream, ocorrido_em, recebido_em, detalhe_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      evento.chave, evento.messageId, envio ? envio.id : null, evento.tipo, evento.stream,
      evento.ocorridoEm, Math.floor(Date.now() / 1000), evento.detalhe ? JSON.stringify(evento.detalhe) : null,
    ).run();
    return json({ ok: true, status: 'gravado', ligado: !!envio });
  } catch (e) {
    console.error('postmark: falha no D1:', e?.message || 'erro');
    return json({ error: 'Falha ao gravar.' }, 500);
  }
}
