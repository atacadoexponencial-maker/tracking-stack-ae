// Monta o e-mail final a partir de um modelo (spec-email-proprio.md, módulo 2;
// issue 378). Usado pela prévia, pelos testes e, depois, por agenda, campanhas
// e fluxos: todo e-mail sai com o mesmo layout (logo, corpo, rodapé comum e,
// no marketing, o link de descadastro de um clique do Postmark).
//
// Formatação do corpo (a mesma do protótipo aprovado):
//   **negrito** · [texto](link) · [[Texto do botão | link]] (sozinho no parágrafo)
//   parágrafos separados por linha em branco.
// Tudo é escapado ANTES da formatação: HTML digitado vira texto.
//
// Campos {{nome}}:
//   valores = { campo: valor } → preenche (envio direto pelo /email do Postmark);
//   valores = null             → mantém os marcadores, para a Bulk API preencher;
//   marcar = true              → campo sem valor vira <mark> (só na prévia).
//
// Prefixo "_": o Cloudflare Pages não transforma o arquivo em rota.
import { MARCADOR } from './_email-campos.js';

export const SITE = 'https://atacadoexponencial.com';
export const DESCADASTRO = '{{{ pm:unsubscribe }}}';
export const AVISO_RODAPE = 'Rodapé vazio: preencha em Configuração.';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const BOTAO = /^\[\[([^\]|]+?)\|([^\]]+?)\]\]$/;
const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g;
const NEGRITO = /\*\*(.+?)\*\*/g;

const paragrafos = (corpo) => String(corpo ?? '').replace(/\r\n/g, '\n').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

/** Links do corpo, com o trecho onde aparecem (para a validação apontar). */
export function linksDoCorpo(corpo) {
  const links = [];
  for (const p of paragrafos(corpo)) {
    const b = p.match(BOTAO);
    if (b) { links.push({ trecho: p, url: b[2].trim() }); continue; }
    for (const m of p.matchAll(LINK)) links.push({ trecho: m[0], url: m[2] });
  }
  return links;
}

/** Troca os marcadores de um texto JÁ escapado (HTML). */
function camposHtml(html, valores, marcar) {
  return html.replace(MARCADOR, (t, nome) => {
    if (valores && nome in valores) return esc(valores[nome]);
    if (marcar) return `<mark style="background:#fbe3e0;color:#b3261e">{{${nome}}}</mark>`;
    return `{{${nome}}}`;
  });
}

/** Troca os marcadores de um texto puro (assunto, prévia, versão em texto). */
function camposTexto(texto, valores) {
  return String(texto ?? '').replace(MARCADOR, (t, nome) => (valores && nome in valores ? String(valores[nome]) : `{{${nome}}}`));
}

/** Endereço de um link: campo preenchido; campo sem valor vira "#" para não quebrar o atributo. */
function href(urlEscapada, valores, marcar) {
  const u = urlEscapada.trim();
  if (!valores) return u.replace(MARCADOR, (t, nome) => `{{${nome}}}`);
  return u.replace(MARCADOR, (t, nome) => (nome in valores ? esc(valores[nome]) : (marcar ? '#' : t)));
}

const FONTE = 'font-family:Arial,Helvetica,sans-serif';

function corpoHtml(corpo, valores, marcar) {
  return paragrafos(corpo).map((bruto) => {
    const p = esc(bruto);
    const b = p.match(BOTAO);
    if (b) {
      return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px"><tr><td style="background:#1f1f1f;border-radius:4px">`
        + `<a href="${href(b[2], valores, marcar)}" style="display:inline-block;padding:12px 22px;${FONTE};font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none">${camposHtml(b[1].trim(), valores, marcar)}</a>`
        + '</td></tr></table>';
    }
    const html = p
      .replace(LINK, (t, rot, u) => `<a href="${href(u, valores, marcar)}" style="color:#2f6db3;text-decoration:underline">${rot}</a>`)
      .replace(NEGRITO, '<b>$1</b>')
      .replace(/\n/g, '<br>');
    return `<p style="margin:0 0 16px">${camposHtml(html, valores, marcar)}</p>`;
  }).join('\n');
}

function corpoTexto(corpo, valores) {
  return paragrafos(corpo).map((p) => {
    const b = p.match(BOTAO);
    if (b) return `${b[1].trim()}: ${b[2].trim()}`;
    return p.replace(LINK, '$1 ($2)').replace(NEGRITO, '$1');
  }).map((p) => camposTexto(p, valores)).join('\n\n');
}

/**
 * Monta assunto, prévia, HTML e texto puro.
 * @param {object} m        { canal, assunto, previa, corpo }
 * @param {object} cfg      configuração (lerConfig): usa o rodapé
 * @param {object} opcoes   { valores, marcar, site, descadastro }
 * @returns {{ assunto, previa, html, texto, avisos: string[] }}
 */
export function montarEmail(m, cfg, { valores = null, marcar = false, site = SITE, descadastro = DESCADASTRO } = {}) {
  const marketing = m.canal === 'marketing';
  const rodape = String(cfg?.rodape || '').trim();
  const assunto = camposTexto(m.assunto, valores);
  const previa = camposTexto(m.previa, valores);
  const avisos = rodape ? [] : [AVISO_RODAPE];

  const linhasRodape = [
    rodape ? esc(rodape).replace(/\n/g, '<br>') : '',
    marketing ? `<a href="${descadastro}" style="color:#888888;text-decoration:underline">Não quero mais receber estes e-mails</a>` : '',
  ].filter(Boolean).join('<br><br>');

  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(assunto)}</title></head>
<body style="margin:0;padding:0;background:#f3f1ec">
${previa ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${esc(previa)}</div>\n` : ''}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f1ec"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border:1px solid #e5e2da;border-radius:4px">
<tr><td style="padding:24px 28px 8px"><img src="${site}/email/logo.png" width="150" alt="Atacado Exponencial" style="display:block;width:150px;height:auto;border:0"></td></tr>
<tr><td style="padding:12px 28px 12px;${FONTE};font-size:15px;line-height:1.6;color:#222222">
${corpoHtml(m.corpo, valores, marcar)}
</td></tr>
${linhasRodape ? `<tr><td style="padding:16px 28px 24px;border-top:1px solid #eeeae2;${FONTE};font-size:12px;line-height:1.5;color:#888888">${linhasRodape}</td></tr>\n` : ''}</table>
</td></tr></table>
</body></html>`;

  const fim = [rodape, marketing ? `Para não receber mais estes e-mails: ${descadastro}` : ''].filter(Boolean).join('\n\n');
  const texto = corpoTexto(m.corpo, valores) + (fim ? `\n\n--\n${fim}\n` : '\n');

  return { assunto, previa, html, texto, avisos };
}
