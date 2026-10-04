// Biblioteca de imagens dos e-mails (spec-editor-email.md, módulo 4; issue 392).
//
// A ÚNICA porta para onde as imagens moram: bytes no KV `EMAIL_IMAGENS`, ficha
// no D1 (`email_imagens`). O R2 seria a ferramenta certa, mas não está
// habilitado na conta (erro 10042); se um dia for, é este arquivo que muda.
//
// O tipo é conferido pelos BYTES (assinatura do arquivo), não pelo nome nem pelo
// que o navegador informou, e largura e altura são lidas do próprio cabeçalho da
// imagem. Apagar só marca a ficha: os bytes ficam, porque e-mails já enviados
// apontam para o endereço público.
//
// Prefixo "_": o Cloudflare Pages não transforma o arquivo em rota.

export const PESO_MAX = 1024 * 1024; // 1 MB, o mesmo limite do Mailchimp
export const LARGURA_RECOMENDADA = 1200;

export class ErroImagem extends Error {
  constructor(mensagem, status = 400) { super(mensagem); this.status = status; }
}

const TIPOS = {
  png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
};

const agora = () => Math.floor(Date.now() / 1000);

/** Lê tipo, largura e altura dos bytes. Devolve null se não for imagem aceita. */
export function identificar(b) {
  const u = b instanceof Uint8Array ? b : new Uint8Array(b);
  const u16be = (i) => (u[i] << 8) | u[i + 1];
  const u16le = (i) => u[i] | (u[i + 1] << 8);
  const u24le = (i) => u[i] | (u[i + 1] << 8) | (u[i + 2] << 16);
  const u32be = (i) => ((u[i] << 24) >>> 0) + (u[i + 1] << 16) + (u[i + 2] << 8) + u[i + 3];
  const txt = (i, n) => String.fromCharCode(...u.slice(i, i + n));

  if (u.length >= 24 && u[0] === 0x89 && txt(1, 3) === 'PNG' && txt(12, 4) === 'IHDR') {
    return { extensao: 'png', largura: u32be(16), altura: u32be(20) };
  }
  if (u.length >= 10 && (txt(0, 6) === 'GIF87a' || txt(0, 6) === 'GIF89a')) {
    return { extensao: 'gif', largura: u16le(6), altura: u16le(8) };
  }
  if (u.length >= 30 && txt(0, 4) === 'RIFF' && txt(8, 4) === 'WEBP') {
    const bloco = txt(12, 4);
    if (bloco === 'VP8X') return { extensao: 'webp', largura: u24le(24) + 1, altura: u24le(27) + 1 };
    if (bloco === 'VP8 ') return { extensao: 'webp', largura: u16le(26) & 0x3fff, altura: u16le(28) & 0x3fff };
    if (bloco === 'VP8L') {
      const b0 = u[21], b1 = u[22], b2 = u[23], b3 = u[24];
      return { extensao: 'webp', largura: 1 + (((b1 & 0x3f) << 8) | b0), altura: 1 + (((b3 & 0xf) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)) };
    }
    return null;
  }
  if (u.length >= 4 && u[0] === 0xff && u[1] === 0xd8) {
    // JPEG: procura o marcador SOF (C0–CF, menos C4, C8 e CC), que traz as medidas.
    let i = 2;
    while (i + 9 < u.length) {
      if (u[i] !== 0xff) { i += 1; continue; }
      const m = u[i + 1];
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
      const len = u16be(i + 2);
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        return { extensao: 'jpg', largura: u16be(i + 7), altura: u16be(i + 5) };
      }
      i += 2 + len;
    }
    return null;
  }
  return null;
}

/** Endereço público da imagem, no domínio de quem pede (ou o informado). */
export function urlImagem(origem, f) {
  return `${String(origem).replace(/\/+$/, '')}/email/i/${f.chave}.${f.extensao}`;
}

function novaChave() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

const nomeLimpo = (n) => String(n || '').replace(/\.[^.]+$/, '').replace(/\s+/g, ' ').trim().slice(0, 100);

/** Confere e guarda. Devolve a ficha (com `aviso` quando passa de 1200 px). */
export async function guardarImagem(env, { bytes, nome }) {
  if (!env.EMAIL_IMAGENS) throw new ErroImagem('Armazenamento de imagens indisponível neste ambiente.', 503);
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (!u.length) throw new ErroImagem('Arquivo vazio.');
  const tipo = identificar(u);
  if (!tipo || !tipo.largura || !tipo.altura) throw new ErroImagem('Formato não aceito. Use JPG, PNG, GIF ou WebP.', 415);
  if (u.length > PESO_MAX) {
    throw new ErroImagem(`A imagem tem ${(u.length / 1024 / 1024).toFixed(1).replace('.', ',')} MB e o limite é 1 MB. Exporte menor e suba de novo.`, 413);
  }
  const chave = novaChave();
  const t = agora();
  // Bytes primeiro: ficha sem arquivo apareceria quebrada; arquivo sem ficha é só lixo invisível.
  await env.EMAIL_IMAGENS.put(chave, u, { metadata: { mimetype: TIPOS[tipo.extensao] } });
  const r = await env.DB.prepare(
    `INSERT INTO email_imagens (chave, nome, extensao, mimetype, largura, altura, tamanho, criada_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(chave, nomeLimpo(nome) || 'imagem', tipo.extensao, TIPOS[tipo.extensao], tipo.largura, tipo.altura, u.length, t).run();
  const ficha = await obterImagem(env, r.meta.last_row_id);
  return { ...ficha, aviso: tipo.largura > LARGURA_RECOMENDADA ? `A imagem tem ${tipo.largura} px de largura. Acima de ${LARGURA_RECOMENDADA} px vale reduzir; no e-mail ela aparece reduzida.` : null };
}

export async function obterImagem(env, id) {
  return env.DB.prepare('SELECT * FROM email_imagens WHERE id = ?').bind(Number(id)).first();
}

export async function fichaPorChave(env, chave) {
  return env.DB.prepare('SELECT * FROM email_imagens WHERE chave = ?').bind(String(chave || '')).first();
}

export async function lerBytes(env, chave) {
  if (!env.EMAIL_IMAGENS) return null;
  return env.EMAIL_IMAGENS.get(String(chave || ''), { type: 'arrayBuffer' });
}

// ---------------------------------------------------------------------------
// Onde a imagem é usada. Registro aberto: cada parte que guarda conteúdo de
// e-mail (modelos, cabeçalho padrão, campanhas com e-mail próprio) procura a
// chave no que guarda. Devolve rótulos legíveis ("Modelo: Convite workshop").
// ---------------------------------------------------------------------------
async function usoEmModelos(env, chave) {
  const rs = await env.DB.prepare('SELECT nome FROM email_modelos WHERE arquivado = 0 AND corpo LIKE ? ORDER BY nome').bind(`%${chave}%`).all();
  return (rs.results || []).map((r) => `Modelo: ${r.nome}`);
}
async function usoNaConfig(env, chave) {
  const r = await env.DB.prepare("SELECT chave FROM email_config WHERE valor LIKE ?").bind(`%${chave}%`).all();
  return (r.results || []).map((x) => (x.chave === 'cabecalho_padrao' ? 'Cabeçalho padrão' : `Configuração (${x.chave})`));
}
export const consultasDeUsoImagem = [usoEmModelos, usoNaConfig];

export async function usosDaImagem(env, chave) {
  const listas = await Promise.all(consultasDeUsoImagem.map((c) => c(env, chave)));
  return listas.flat();
}

export async function listarImagens(env, { busca = '' } = {}) {
  const b = String(busca || '').trim().toLowerCase();
  const rs = (await env.DB.prepare(
    `SELECT * FROM email_imagens WHERE apagada_em IS NULL ${b ? 'AND lower(nome) LIKE ?' : ''} ORDER BY criada_em DESC, id DESC`,
  ).bind(...(b ? [`%${b}%`] : [])).all()).results || [];
  return Promise.all(rs.map(async (f) => ({ ...f, usos: await usosDaImagem(env, f.chave) })));
}

export async function renomearImagem(env, id, nome) {
  const f = await obterImagem(env, id);
  if (!f || f.apagada_em) throw new ErroImagem('Imagem não encontrada.', 404);
  const n = nomeLimpo(nome);
  if (!n) throw new ErroImagem('Escreva um nome para a imagem.');
  await env.DB.prepare('UPDATE email_imagens SET nome = ? WHERE id = ?').bind(n, f.id).run();
  return obterImagem(env, f.id);
}

/** Apaga da biblioteca. Imagem em uso é recusada; os bytes ficam no KV. */
export async function apagarImagem(env, id) {
  const f = await obterImagem(env, id);
  if (!f || f.apagada_em) throw new ErroImagem('Imagem não encontrada.', 404);
  const usos = await usosDaImagem(env, f.chave);
  if (usos.length) {
    const e = new ErroImagem(`Não dá para apagar: a imagem está em uso em ${usos.join(', ')}. Troque a imagem lá antes.`, 409);
    e.usos = usos;
    throw e;
  }
  await env.DB.prepare('UPDATE email_imagens SET apagada_em = ? WHERE id = ?').bind(agora(), f.id).run();
  return { ok: true };
}
