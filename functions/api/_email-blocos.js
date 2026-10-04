// O documento de um e-mail montado por blocos (spec-editor-email.md, módulos 2,
// 3, 5, 6 e 7; issue 393).
//
// O documento mora na mesma coluna `corpo` do modelo, em JSON:
//   { formato: 'blocos', versao: 1,
//     cab:   { modo: 'padrao' | 'proprio' | 'sem', fundo: '' },
//     fundo: { fora: '#f3f1ec', conteudo: '#ffffff' },
//     blocos: [ { id, tipo, ..., zona?: 'cab' } ] }
// Os blocos do cabeçalho personalizado são os marcados com zona 'cab'.
//
// Imagem guarda a CHAVE da biblioteca (issue 392), nunca o endereço: o endereço
// é montado na hora com o domínio de quem envia.
//
// Corpo no formato antigo (texto com **negrito**, [texto](link) e [[Botão | link]])
// é convertido na hora de ler: nada deixa de sair enquanto a conversão não roda.
//
// Prefixo "_": o Cloudflare Pages não transforma o arquivo em rota.
import { MARCADOR } from './_email-campos.js';

export const FORMATO = 'blocos';
export const TIPOS = ['titulo', 'texto', 'imagem', 'botao', 'imgtexto', 'divisoria', 'espaco'];
const LARGURA = 544; // 600 do e-mail menos 28 px de cada lado
const FONTE = 'font-family:Arial,Helvetica,sans-serif';
const ALINH = { esquerda: 'left', centro: 'center', direita: 'right' };
const ALTURA = { pequeno: 12, medio: 24, grande: 48 };
const HEX = /^#[0-9a-f]{6}$/i;
const IMG_EXT = ['png', 'jpg', 'gif', 'webp'];

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// O cabeçalho de hoje (antes do editor por blocos): a logo, 150 px, à esquerda.
export const CAB_PADRAO_INICIAL = { fundo: '', blocos: [{ id: 'logo', tipo: 'imagem', fixa: 'logo', alt: 'Atacado Exponencial', largura: 'px', px: 150, alinh: 'esquerda', link: '' }] };

// ---------------------------------------------------------------------------
// Campos {{...}}: preenche, mantém para a Bulk API ou marca (prévia).
// ---------------------------------------------------------------------------
export function camposHtml(html, valores, marcar) {
  return String(html ?? '').replace(MARCADOR, (t, nome) => {
    if (valores && nome in valores) return esc(valores[nome]);
    if (marcar) return `<mark style="background:#fbe3e0;color:#b3261e">{{${nome}}}</mark>`;
    return `{{${nome}}}`;
  });
}
export function camposTexto(texto, valores) {
  return String(texto ?? '').replace(MARCADOR, (t, nome) => (valores && nome in valores ? String(valores[nome]) : `{{${nome}}}`));
}
/** Endereço de link: campo preenchido; campo sem valor vira "#" na prévia para não quebrar o atributo. */
function hrefDe(url, valores, marcar) {
  const u = esc(String(url ?? '').trim());
  if (!valores) return u.replace(MARCADOR, (t, nome) => `{{${nome}}}`);
  return u.replace(MARCADOR, (t, nome) => (nome in valores ? esc(valores[nome]) : (marcar ? '#' : t)));
}
const linkAceito = (u) => /^(https?:\/\/|mailto:)/i.test(String(u).trim()) || /^\{\{\s*[a-z_]+\s*\}\}$/i.test(String(u).trim());

// ---------------------------------------------------------------------------
// Texto rico: só o que o e-mail aceita. Vale para o que chega do editor e para
// o que foi convertido do formato antigo.
// ---------------------------------------------------------------------------
const TAGS = { p: 'p', br: 'br', b: 'b', strong: 'b', i: 'i', em: 'i', a: 'a', ul: 'ul', li: 'li', div: 'p' };
export function limparHtml(html) {
  let s = String(html ?? '');
  // Remove blocos perigosos inteiros (com o conteúdo).
  s = s.replace(/<(script|style|iframe|object|template)[\s\S]*?<\/\1\s*>/gi, '');
  // "<" que não abre tag (ex.: "a < b") é texto.
  s = s.replace(/<(?![a-z/!])/gi, '&lt;');
  const pilha = [];
  s = s.replace(/<\/?([a-z0-9]+)([^>]*)>|<!--[\s\S]*?-->|<[^>]*>?/gi, (m, nome, attrs) => {
    if (!nome) return '';
    const t = TAGS[nome.toLowerCase()];
    if (!t) return '';
    const fecha = m.startsWith('</');
    if (t === 'br') return '<br>';
    // Fechar uma tag fecha junto o que ficou aberto dentro dela.
    if (fecha) { const i = pilha.lastIndexOf(t); if (i < 0) return ''; return pilha.splice(i).reverse().map((x) => `</${x}>`).join(''); }
    // Item novo ou parágrafo novo fecham o anterior aberto (como o navegador faz).
    let antes = '';
    if ((t === 'li' || t === 'p') && pilha[pilha.length - 1] === t) { pilha.pop(); antes = `</${t}>`; }
    if (t === 'a') {
      const h = /href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs || '');
      const url = h ? (h[2] ?? h[3] ?? h[4] ?? '').replace(/&amp;/g, '&') : '';
      pilha.push('a');
      return `<a href="${esc(url)}">`;
    }
    pilha.push(t);
    return `${antes}<${t}>`;
  });
  // Fecha o que ficou aberto.
  while (pilha.length) s += `</${pilha.pop()}>`;
  // Caracteres < e > soltos que sobraram viram texto.
  return s.replace(/<(?!\/?(p|br|b|i|a|ul|li)\b)/g, '&lt;').replace(/<p><\/p>/g, '').trim();
}
const textoDoHtml = (html) => String(html ?? '')
  .replace(/<\/p>|<\/ul>/g, '\n\n').replace(/<br>|<\/li>/g, '\n').replace(/<li>/g, '• ')
  .replace(/<a href="([^"]*)">([\s\S]*?)<\/a>/g, (m, u, t) => `${t} (${u.replace(/&amp;/g, '&')})`)
  .replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
  .replace(/\n{3,}/g, '\n\n').trim();

// ---------------------------------------------------------------------------
// Formato antigo → documento
// ---------------------------------------------------------------------------
const BOTAO = /^\[\[([^\]|]+?)\|([^\]]+?)\]\]$/;
const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g;
const NEGRITO = /\*\*(.+?)\*\*/g;
const paragrafos = (corpo) => String(corpo ?? '').replace(/\r\n/g, '\n').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

let seq = 0;
const novoId = () => `b${(++seq).toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export function converterLegado(texto) {
  const blocos = [];
  let ps = [];
  const fecharTexto = () => {
    if (ps.length) blocos.push({ id: novoId(), tipo: 'texto', html: ps.map((p) => `<p>${p}</p>`).join(''), alinh: 'esquerda', cor: '#222222', corLink: '#2f6db3' });
    ps = [];
  };
  for (const bruto of paragrafos(texto)) {
    const b = bruto.match(BOTAO);
    if (b) {
      fecharTexto();
      blocos.push({ id: novoId(), tipo: 'botao', texto: b[1].trim(), link: b[2].trim(), estilo: 'cheio', alinh: 'esquerda', fundo: '#1f1f1f', corTexto: '#ffffff' });
      continue;
    }
    ps.push(esc(bruto).replace(LINK, (t, rot, u) => `<a href="${u}">${rot}</a>`).replace(NEGRITO, '<b>$1</b>').replace(/\n/g, '<br>'));
  }
  fecharTexto();
  return { formato: FORMATO, versao: 1, cab: { modo: 'padrao', fundo: '' }, fundo: { fora: '#f3f1ec', conteudo: '#ffffff' }, blocos };
}

export const ehDocumento = (corpo) => typeof corpo === 'string' && /^\s*\{\s*"formato"\s*:\s*"blocos"/.test(corpo);

/** Lê o corpo guardado: documento JSON, ou texto antigo convertido na hora. */
export function lerDocumento(corpo) {
  if (corpo && typeof corpo === 'object') return normalizarDocumento(corpo);
  if (ehDocumento(corpo)) {
    try { return normalizarDocumento(JSON.parse(corpo)); } catch { /* JSON quebrado: cai no texto */ }
  }
  return converterLegado(corpo);
}

// ---------------------------------------------------------------------------
// Normalizar: o que entra no banco é só o que se conhece, limpo.
// ---------------------------------------------------------------------------
const cor = (v, padrao) => (HEX.test(String(v || '')) ? String(v).toLowerCase() : padrao);
const corOuVazio = (v) => (HEX.test(String(v || '')) ? String(v).toLowerCase() : '');
const um = (v, lista, padrao) => (lista.includes(v) ? v : padrao);
const txt = (v, max = 500) => String(v ?? '').replace(/\r\n/g, '\n').slice(0, max);
const idOk = (v) => (/^[a-z0-9]{1,24}$/i.test(String(v || '')) ? String(v) : novoId());

function normalizarImagem(b) {
  if (b.fixa === 'logo') return { fixa: 'logo' };
  const i = b.img && typeof b.img === 'object' ? b.img : null;
  if (!i || !/^[0-9a-f]{32}$/.test(String(i.chave || '')) || !IMG_EXT.includes(i.ext)) return { img: null };
  return { img: { chave: i.chave, ext: i.ext, w: Math.max(1, Number(i.w) || 0) || null, h: Math.max(1, Number(i.h) || 0) || null, nome: txt(i.nome, 100) } };
}

export function normalizarBloco(b) {
  if (!b || !TIPOS.includes(b.tipo)) return null;
  const base = { id: idOk(b.id), tipo: b.tipo, ...(b.zona === 'cab' ? { zona: 'cab' } : {}) };
  switch (b.tipo) {
    case 'titulo': return { ...base, texto: txt(b.texto, 200), tam: um(b.tam, ['grande', 'medio'], 'grande'), alinh: um(b.alinh, ['esquerda', 'centro'], 'esquerda'), cor: cor(b.cor, '#161513') };
    case 'texto': return { ...base, html: limparHtml(txt(b.html, 20000)), alinh: um(b.alinh, ['esquerda', 'centro'], 'esquerda'), cor: cor(b.cor, '#222222'), corLink: cor(b.corLink, '#161513') };
    case 'imagem': return { ...base, ...normalizarImagem(b), alt: txt(b.alt, 200), largura: um(b.largura, ['toda', 'metade', 'original', 'px'], 'toda'), px: Math.min(LARGURA, Math.max(20, Number(b.px) || 200)), alinh: um(b.alinh, ['esquerda', 'centro', 'direita'], 'centro'), link: txt(b.link, 1000).trim() };
    case 'botao': return { ...base, texto: txt(b.texto, 80), link: txt(b.link, 1000).trim(), estilo: um(b.estilo, ['cheio', 'contorno'], 'cheio'), alinh: um(b.alinh, ['esquerda', 'centro', 'toda'], 'esquerda'), fundo: cor(b.fundo, '#161513'), corTexto: cor(b.corTexto, '#ffffff') };
    case 'imgtexto': return { ...base, ...normalizarImagem(b), alt: txt(b.alt, 200), html: limparHtml(txt(b.html, 20000)), lado: um(b.lado, ['esquerda', 'direita'], 'esquerda'), link: txt(b.link, 1000).trim(), cor: cor(b.cor, '#222222'), corLink: cor(b.corLink, '#161513') };
    case 'divisoria': return { ...base, cor: cor(b.cor, '#e5e2da') };
    case 'espaco': return { ...base, altura: um(b.altura, ['pequeno', 'medio', 'grande'], 'medio') };
    default: return null;
  }
}

export function normalizarDocumento(d) {
  const blocos = (Array.isArray(d?.blocos) ? d.blocos : []).slice(0, 80).map(normalizarBloco).filter(Boolean);
  // Os do cabeçalho sempre antes dos do corpo.
  const cab = blocos.filter((b) => b.zona === 'cab');
  const corpo = blocos.filter((b) => b.zona !== 'cab');
  return {
    formato: FORMATO,
    versao: 1,
    cab: { modo: um(d?.cab?.modo, ['padrao', 'proprio', 'sem'], 'padrao'), fundo: corOuVazio(d?.cab?.fundo) },
    fundo: { fora: cor(d?.fundo?.fora, '#f3f1ec'), conteudo: cor(d?.fundo?.conteudo, '#ffffff') },
    blocos: [...cab, ...corpo],
  };
}

/** Cabeçalho padrão guardado na configuração (397), ou a logo de hoje. */
export function cabecalhoPadrao(cfg) {
  const bruto = cfg?.cabecalho_padrao;
  if (!bruto) return CAB_PADRAO_INICIAL;
  try {
    const d = typeof bruto === 'string' ? JSON.parse(bruto) : bruto;
    const blocos = (Array.isArray(d.blocos) ? d.blocos : []).map(normalizarBloco).filter(Boolean).map((b) => ({ ...b, zona: 'cab' }));
    return { fundo: corOuVazio(d.fundo), blocos };
  } catch { return CAB_PADRAO_INICIAL; }
}

// ---------------------------------------------------------------------------
// Montagem
// ---------------------------------------------------------------------------
const urlImagem = (site, b) => (b.fixa === 'logo' ? `${site}/email/logo.png` : b.img ? `${site}/email/i/${b.img.chave}.${b.img.ext}` : '');

function larguraImagem(b, maxW) {
  if (b.largura === 'metade') return Math.round(maxW / 2);
  if (b.largura === 'px') return Math.min(Number(b.px) || 200, maxW);
  if (b.largura === 'original') return Math.min((b.img && b.img.w) || (b.fixa === 'logo' ? 939 : maxW), maxW);
  return maxW;
}

function imagemHtml(b, maxW, o) {
  const src = urlImagem(o.site, b);
  if (!src) return '';
  const w = larguraImagem(b, maxW);
  const alt = esc(camposTexto(b.alt, o.valores));
  const alinh = ALINH[b.alinh] || 'center';
  const img = `<img src="${esc(src)}" width="${w}" alt="${alt}" style="display:block;width:100%;max-width:${w}px;height:auto;border:0;outline:none;text-decoration:none${alinh === 'center' ? ';margin:0 auto' : alinh === 'right' ? ';margin-left:auto' : ''}">`;
  return b.link ? `<a href="${hrefDe(b.link, o.valores, o.marcar)}" target="_blank" style="text-decoration:none">${img}</a>` : img;
}

function textoHtml(html, b, o) {
  const h = limparHtml(html)
    .replace(/<p>/g, '<p style="margin:0 0 16px">')
    .replace(/<ul>/g, '<ul style="margin:0 0 16px;padding-left:22px">')
    .replace(/<li>/g, '<li style="margin:0 0 6px">')
    .replace(/<a href="([^"]*)">/g, (m, u) => `<a href="${hrefDe(u.replace(/&amp;/g, '&'), o.valores, o.marcar)}" style="color:${b.corLink};text-decoration:underline">`);
  return camposHtml(h, o.valores, o.marcar);
}

const celula = (estilo, conteudo, fundo) => `<tr><td style="${fundo ? `background:${fundo};` : ''}${estilo}">${conteudo}</td></tr>`;

function blocoHtml(b, o, fundo) {
  const pad = 'padding:0 28px 16px';
  switch (b.tipo) {
    case 'titulo': {
      const t = camposHtml(esc(b.texto), o.valores, o.marcar);
      return t ? celula(`${pad};${FONTE};text-align:${ALINH[b.alinh]};color:${b.cor};font-size:${b.tam === 'grande' ? 26 : 20}px;line-height:1.25;font-weight:bold`, t, fundo) : '';
    }
    case 'texto': {
      const t = textoHtml(b.html, b, o);
      return t ? celula(`${pad};${FONTE};text-align:${ALINH[b.alinh]};color:${b.cor};font-size:15px;line-height:1.6`, t, fundo) : '';
    }
    case 'imagem': {
      const i = imagemHtml(b, LARGURA, o);
      return i ? celula(pad, i, fundo) : '';
    }
    case 'botao': {
      if (!b.texto) return '';
      const cheio = b.estilo === 'cheio';
      const larga = b.alinh === 'toda';
      const a = `<a href="${hrefDe(b.link || '#', o.valores, o.marcar)}" target="_blank" style="display:${larga ? 'block' : 'inline-block'};padding:12px 22px;${FONTE};font-size:15px;font-weight:bold;color:${cheio ? b.corTexto : b.fundo};text-decoration:none;text-align:center">${camposHtml(esc(b.texto), o.valores, o.marcar)}</a>`;
      const td = `<td style="border-radius:4px;${cheio ? `background:${b.fundo};` : `border:2px solid ${b.fundo};`}">${a}</td>`;
      // Alinhado pela célula (sem float): a tabela do botão fica em linha.
      const lado = larga ? 'center' : ALINH[b.alinh] || 'left';
      const tabela = `<table role="presentation" cellpadding="0" cellspacing="0" border="0"${larga ? ' width="100%"' : ''} style="margin:8px 0 4px${larga ? '' : ';display:inline-table'}"><tr>${td}</tr></table>`;
      return `<tr><td align="${lado}" style="${fundo ? `background:${fundo};` : ''}${pad};text-align:${lado}">${tabela}</td></tr>`;
    }
    case 'divisoria': return celula('padding:4px 28px 20px', `<div style="border-top:1px solid ${b.cor};font-size:0;line-height:0">&nbsp;</div>`, fundo);
    case 'espaco': return celula(`height:${ALTURA[b.altura]}px;font-size:0;line-height:0`, '&nbsp;', fundo);
    case 'imgtexto': {
      const col = 262;
      const img = `<td class="eb-col" width="50%" valign="top" style="padding:0 ${b.lado === 'esquerda' ? '10px 0 0' : '0 0 10px'}">${imagemHtml({ ...b, largura: 'toda', alinh: 'centro' }, col, o)}</td>`;
      const t = `<td class="eb-col" width="50%" valign="top" style="${FONTE};font-size:15px;line-height:1.6;color:${b.cor};padding:0 ${b.lado === 'esquerda' ? '0 0 10px' : '10px 0 0'}">${textoHtml(b.html, b, o)}</td>`;
      return celula(pad, `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${b.lado === 'esquerda' ? img + t : t + img}</tr></table>`, fundo);
    }
    default: return '';
  }
}

// Modo editor (394): cada linha ganha a marca que a prévia usa para clicar,
// arrastar e soltar; bloco vazio vira um lugar marcado (no e-mail ele some).
const VAZIO = { titulo: 'Título vazio', texto: 'Texto vazio', imagem: 'Escolha uma imagem', botao: 'Botão sem texto', imgtexto: 'Imagem com texto vazia' };
const vazioHtml = (texto, fundo, attrs) => `<tr${attrs}><td style="${fundo ? `background:${fundo};` : ''}padding:14px 28px;${FONTE};font-size:13px;color:#8a837a;text-align:center;border:1px dashed #d9d3c9">${texto}</td></tr>`;
function blocoMarcado(b, o, fundo, editavel) {
  const html = blocoHtml(b, o, fundo);
  if (!o.editor) return html;
  const attrs = editavel ? ` data-b="${b.id}" draggable="true"` : ' data-cabeca';
  if (!html) return vazioHtml(VAZIO[b.tipo] || 'Bloco vazio', fundo, attrs);
  return html.replace(/^<tr/, `<tr${attrs}`);
}

/** Linhas da faixa do cabeçalho (com o fundo dela) ou nada. */
function cabecalhoHtml(doc, cfg, o) {
  if (doc.cab.modo === 'sem') {
    return o.editor ? `<tr data-cabeca class="eb-sem-cab"><td style="padding:8px 28px;${FONTE};font-size:12px;color:#8a837a;text-align:center;border-bottom:1px dashed #d9d3c9">Sem cabeçalho · clique para mudar (esta faixa só aparece no editor)</td></tr>` : '';
  }
  const proprio = doc.cab.modo === 'proprio';
  const fonte = proprio ? { fundo: doc.cab.fundo, blocos: doc.blocos.filter((b) => b.zona === 'cab') } : cabecalhoPadrao(cfg);
  const f = fonte.fundo;
  let linhas = fonte.blocos.map((b) => blocoMarcado(b, o, f, proprio)).join('');
  if (!linhas && o.editor && proprio) linhas = vazioHtml('Cabeçalho vazio: arraste um bloco para cá ou use o "+" na lista', f, ' data-vazio-cab');
  if (!linhas) return '';
  const topo = o.editor ? ' data-cabeca' : '';
  return `${celula('height:24px;font-size:0;line-height:0', '&nbsp;', f).replace(/^<tr/, `<tr${topo}`)}${linhas}${celula('height:0;font-size:0;line-height:0', '', f)}<tr><td style="height:12px;font-size:0;line-height:0">&nbsp;</td></tr>`;
}

/** HTML de todas as linhas (cabeçalho e corpo) para dentro da tabela do e-mail. */
export function htmlDosBlocos(doc, cfg, { valores = null, marcar = false, site, editor = false } = {}) {
  const o = { valores, marcar, site, editor };
  const corpo = doc.blocos.filter((b) => b.zona !== 'cab').map((b) => blocoMarcado(b, o, '', true)).join('');
  return cabecalhoHtml(doc, cfg, o) + (corpo || (editor ? vazioHtml('Nenhum bloco ainda. Arraste um bloco da paleta para cá.', '', ' data-vazio') : ''));
}

/** Versão só texto: títulos, textos, endereços de botões e texto alternativo das imagens. */
export function textoDosBlocos(doc, cfg, valores) {
  const cab = doc.cab.modo === 'proprio' ? doc.blocos.filter((b) => b.zona === 'cab') : doc.cab.modo === 'padrao' ? cabecalhoPadrao(cfg).blocos.filter((b) => b.tipo !== 'imagem') : [];
  return [...cab, ...doc.blocos.filter((b) => b.zona !== 'cab')].map((b) => {
    if (b.tipo === 'titulo') return camposTexto(b.texto, valores);
    if (b.tipo === 'texto') return camposTexto(textoDoHtml(b.html), valores);
    if (b.tipo === 'imagem') return (b.img || b.fixa) && b.alt ? `[${camposTexto(b.alt, valores)}]${b.link ? ` ${camposTexto(b.link, valores)}` : ''}` : '';
    if (b.tipo === 'botao') return b.texto ? `${camposTexto(b.texto, valores)}: ${camposTexto(b.link, valores)}` : '';
    if (b.tipo === 'imgtexto') return `${b.alt ? `[${camposTexto(b.alt, valores)}]\n` : ''}${camposTexto(textoDoHtml(b.html), valores)}`;
    if (b.tipo === 'divisoria') return '----------';
    return '';
  }).filter(Boolean).join('\n\n');
}

// ---------------------------------------------------------------------------
// Para validar e procurar
// ---------------------------------------------------------------------------
const ROTULO = { titulo: 'Título', texto: 'Texto', imagem: 'Imagem', botao: 'Botão', imgtexto: 'Imagem com texto', divisoria: 'Divisória', espaco: 'Espaço' };
export function rotulos(doc) {
  const cont = {};
  return doc.blocos.map((b) => {
    const total = doc.blocos.filter((x) => x.tipo === b.tipo).length;
    cont[b.tipo] = (cont[b.tipo] || 0) + 1;
    return `${b.zona === 'cab' ? 'Cabeçalho, ' : ''}${ROTULO[b.tipo]}${total > 1 ? ` ${cont[b.tipo]}` : ''}`;
  });
}

/** Links do documento, com o rótulo do bloco (para a validação apontar). */
export function linksDoDocumento(doc) {
  const r = rotulos(doc);
  const links = [];
  doc.blocos.forEach((b, i) => {
    if (b.link) links.push({ trecho: r[i], url: b.link });
    if (b.tipo === 'botao' && !b.link) links.push({ trecho: r[i], url: '' });
    for (const m of String(b.html || '').matchAll(/<a href="([^"]*)">/g)) links.push({ trecho: r[i], url: m[1].replace(/&amp;/g, '&') });
  });
  return links;
}
export { linkAceito };

/** Todo o texto onde podem aparecer campos {{...}}. */
export function textosDoDocumento(doc) {
  return doc.blocos.map((b) => [b.texto, b.html, b.alt, b.link].filter(Boolean).join('\n')).join('\n');
}

export const blocosDoCorpo = (doc) => doc.blocos.filter((b) => b.zona !== 'cab');
export const chavesDeImagens = (doc) => doc.blocos.map((b) => b.img && b.img.chave).filter(Boolean);
