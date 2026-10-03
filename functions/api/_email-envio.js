// Envio registrado (issues 377 e 379): toda mensagem que sai pelo Postmark
// ganha uma linha em email_envios ANTES de sair, para o envio_id ir no
// Metadata e o webhook ligar entregue, aberto e voltou a ela.
//
// Prefixo "_": o Cloudflare Pages não transforma o arquivo em rota.
import { enviar } from './_postmark.js';
import { lerConfig, remetente } from './_email-config.js';

const agora = () => Math.floor(Date.now() / 1000);

/**
 * Envia e registra. Devolve:
 *   { ok: true, envioId }
 *   { ok: false, envioId, codigo, erro }     recusado: a linha fica "falhou" com o motivo
 *   { ok: false, semResposta: true, erro }   sem resposta: a linha é apagada (nada foi confirmado)
 */
export async function enviarERegistrar(env, { canal, origem, refId = null, para, assunto, html, texto, tag, cfg = null }) {
  const config = cfg || await lerConfig(env);
  // A linha nasce como "falhou" e só vira "enviado" com a confirmação do
  // serviço: assim o envio_id existe para ir no Metadata.
  const ins = await env.DB.prepare(
    `INSERT INTO email_envios (canal, origem, ref_id, destinatario, assunto, situacao, erro)
     VALUES (?, ?, ?, ?, ?, 'falhou', 'Envio em andamento.')`,
  ).bind(canal, origem, refId, para, assunto).run();
  const envioId = ins.meta.last_row_id;
  let r;
  try {
    r = await enviar(env, {
      canal, de: remetente(config, canal), para, assunto, html, texto,
      resposta: config[`resposta_${canal}`] || null,
      tag, metadata: { origem, envio_id: String(envioId) },
    });
  } catch (e) {
    await env.DB.prepare('DELETE FROM email_envios WHERE id = ?').bind(envioId).run();
    return { ok: false, semResposta: true, erro: e.message || 'Não foi possível falar com o serviço de envio agora. Tente de novo.' };
  }
  if (!r.ok) {
    await env.DB.prepare('UPDATE email_envios SET erro = ?, enviado_em = ? WHERE id = ?').bind(r.erro, agora(), envioId).run();
    return { ok: false, envioId, codigo: r.codigo, erro: r.erro };
  }
  await env.DB.prepare(
    "UPDATE email_envios SET message_id = ?, situacao = 'enviado', erro = NULL, enviado_em = ? WHERE id = ?",
  ).bind(r.messageId, agora(), envioId).run();
  return { ok: true, envioId };
}
