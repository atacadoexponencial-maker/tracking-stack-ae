// Monta o e-mail final a partir de um modelo (spec-email-proprio.md, módulo 2;
// issue 378). Usado pela prévia, pelos testes e, depois, por agenda, campanhas
// e fluxos: todo e-mail sai com o mesmo layout (logo, corpo, rodapé comum e,
// no marketing, o link de descadastro de um clique do Postmark).
//
// O corpo é um documento de blocos (issue 393, ./_email-blocos.js). Corpo no
// formato antigo (texto com **negrito**, [texto](link) e [[Botão | link]]) é
// convertido na hora: nada deixa de sair.
//
// Campos {{nome}}:
//   valores = { campo: valor } → preenche (envio direto pelo /email do Postmark);
//   valores = null             → mantém os marcadores, para a Bulk API preencher;
//   marcar = true              → campo sem valor vira <mark> (só na prévia).
//
// Prefixo "_": o Cloudflare Pages não transforma o arquivo em rota.

export const SITE = 'https://atacadoexponencial.com';
export const DESCADASTRO = '{{{ pm:unsubscribe }}}';
export const AVISO_RODAPE = 'Rodapé vazio: preencha em Configuração.';

import { lerDocumento, htmlDosBlocos, textoDosBlocos, linksDoDocumento, camposTexto, esc } from './_email-blocos.js';

const FONTE = 'font-family:Arial,Helvetica,sans-serif';

/** Links do corpo (documento de blocos ou texto antigo), com o bloco onde aparecem. */
export function linksDoCorpo(corpo) {
  return linksDoDocumento(lerDocumento(corpo));
}

/**
 * Monta assunto, prévia, HTML e texto puro a partir do documento de blocos
 * (issue 393; corpo antigo em texto é convertido na hora).
 * @param {object} m        { canal, assunto, previa, corpo }
 * @param {object} cfg      configuração (lerConfig): rodapé e cabeçalho padrão
 * @param {object} opcoes   { valores, marcar, site, descadastro }
 * @returns {{ assunto, previa, html, texto, avisos: string[] }}
 */
export function montarEmail(m, cfg, { valores = null, marcar = false, site = SITE, descadastro = DESCADASTRO, editor = false } = {}) {
  const marketing = m.canal === 'marketing';
  const doc = lerDocumento(m.corpo);
  const rodape = String(cfg?.rodape || '').trim();
  const assunto = camposTexto(m.assunto, valores);
  const previa = camposTexto(m.previa, valores);
  const avisos = rodape ? [] : [AVISO_RODAPE];

  const linhasRodape = [
    rodape ? esc(rodape).replace(/\n/g, '<br>') : '',
    marketing ? `<a href="${descadastro}" style="color:#888888;text-decoration:underline">Não quero mais receber estes e-mails</a>` : '',
  ].filter(Boolean).join('<br><br>');

  const { fora, conteudo } = doc.fundo;
  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(assunto)}</title>
<style>@media only screen and (max-width:480px){.eb-col{display:block!important;width:100%!important;padding:0 0 12px!important}}</style></head>
<body style="margin:0;padding:0;background:${fora}">
${previa ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${esc(previa)}</div>\n` : ''}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${fora}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:${conteudo};border:1px solid #e5e2da;border-radius:4px">
${htmlDosBlocos(doc, cfg, { valores, marcar, site, editor })}
${linhasRodape ? `<tr><td style="padding:16px 28px 24px;border-top:1px solid #eeeae2;${FONTE};font-size:12px;line-height:1.5;color:#888888">${linhasRodape}</td></tr>\n` : ''}</table>
</td></tr></table>
</body></html>`;

  const fim = [rodape, marketing ? `Para não receber mais estes e-mails: ${descadastro}` : ''].filter(Boolean).join('\n\n');
  const texto = textoDosBlocos(doc, cfg, valores) + (fim ? `\n\n--\n${fim}\n` : '\n');

  return { assunto, previa, html, texto, avisos };
}
