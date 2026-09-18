// A ÚNICA porta para o armazenamento dos arquivos agendados.
// Spec: docs/superpowers/specs/2026-09-18-disparos-midia-design.md
//
// Os bytes ficam no KV (binding MIDIA) e a ficha no D1. O R2 é a ferramenta
// certa para arquivo e não está habilitado na conta; o KV já está, e o teto de
// 25 MB por valor cobre todos os limites do próprio WhatsApp. Se um dia o
// volume pedir R2, é este arquivo que muda — nem o executor nem o painel
// sabem onde o arquivo mora.
//
// Prefixo "_": o Cloudflare Pages não transforma o arquivo em rota.

// Tetos práticos do WhatsApp, não do KV. Recusar aqui é mais gentil do que
// deixar a Evolution recusar às 12h da live.
export const TETOS = {
  image: 5 * 1024 * 1024,
  video: 16 * 1024 * 1024,
  audio: 16 * 1024 * 1024,
  document: 20 * 1024 * 1024,
};

// Lista FECHADA. Extensão fora daqui é recusada no upload, porque a Evolution
// deduz o mimetype pela extensão e, quando não reconhece, manda a string
// "false" — entregando um arquivo corrompido sem erro nenhum.
const EXTENSOES = {
  jpg: { mediatype: 'image', mimetype: 'image/jpeg' },
  jpeg: { mediatype: 'image', mimetype: 'image/jpeg' },
  png: { mediatype: 'image', mimetype: 'image/png' },
  webp: { mediatype: 'image', mimetype: 'image/webp' },
  gif: { mediatype: 'image', mimetype: 'image/gif' },
  mp4: { mediatype: 'video', mimetype: 'video/mp4' },
  mov: { mediatype: 'video', mimetype: 'video/quicktime' },
  mp3: { mediatype: 'audio', mimetype: 'audio/mpeg' },
  m4a: { mediatype: 'audio', mimetype: 'audio/mp4' },
  ogg: { mediatype: 'audio', mimetype: 'audio/ogg' },
  opus: { mediatype: 'audio', mimetype: 'audio/ogg' },
  wav: { mediatype: 'audio', mimetype: 'audio/wav' },
  pdf: { mediatype: 'document', mimetype: 'application/pdf' },
  docx: { mediatype: 'document', mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  xlsx: { mediatype: 'document', mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  csv: { mediatype: 'document', mimetype: 'text/csv' },
};

export const TIPOS_ACEITOS = Object.keys(EXTENSOES);

const TAMANHO_CHAVE = 32;

/**
 * Descobre o que é o arquivo pela EXTENSÃO do nome, não pelo mimetype que o
 * navegador informou: o navegador erra (e mente) com frequência, e é a
 * extensão que a Evolution vai usar do outro lado. O mimetype devolvido é o
 * nosso, canônico, usado só para servir o arquivo com o cabeçalho certo.
 */
export function classificar(nome) {
  const limpo = String(nome || '').trim();
  if (!limpo) return { erro: 'Arquivo sem nome.' };

  const ponto = limpo.lastIndexOf('.');
  if (ponto <= 0 || ponto === limpo.length - 1) {
    return { erro: 'O arquivo precisa ter extensão no nome (ex.: aviso.mp4).' };
  }

  const extensao = limpo.slice(ponto + 1).toLowerCase();
  const conhecida = EXTENSOES[extensao];
  if (!conhecida) {
    return { erro: `Tipo de arquivo não aceito (.${extensao}). Aceitos: ${TIPOS_ACEITOS.join(', ')}.` };
  }

  return { mediatype: conhecida.mediatype, mimetype: conhecida.mimetype, extensao };
}

export function validarTamanho(mediatype, bytes) {
  const teto = TETOS[mediatype];
  if (!teto) return { erro: `Tipo desconhecido: ${mediatype}.` };
  if (!Number.isFinite(bytes) || bytes <= 0) return { erro: 'Arquivo vazio.' };
  if (bytes > teto) {
    return { erro: `Arquivo de ${mb(bytes)} passa do limite de ${mb(teto)} para ${rotulo(mediatype)}.` };
  }
  return {};
}

const mb = (b) => `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
const rotulo = (m) => ({ image: 'imagem', video: 'vídeo', audio: 'áudio', document: 'documento' }[m] || m);

/** Chave aleatória de 32 hex. É a URL pública e a chave no KV. */
function novaChave() {
  const b = new Uint8Array(TAMANHO_CHAVE / 2);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

/**
 * Guarda os bytes no KV e a ficha no D1.
 *
 * Os bytes primeiro: uma ficha sem arquivo viraria um agendamento que falha na
 * hora do envio; um arquivo sem ficha é só lixo que o expurgo não conhece —
 * bem menos grave.
 */
export async function guardar(env, { bytes, nome, mimetype, mediatype }, agora) {
  const chave = novaChave();

  await env.MIDIA.put(chave, bytes, {
    metadata: { nome, mimetype, mediatype },
  });

  const r = await env.DB.prepare(
    `INSERT INTO whatsapp_group_media (chave, nome, mimetype, mediatype, tamanho, criada_em)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(chave, nome, mimetype, mediatype, bytes.byteLength ?? bytes.length, agora).run();

  return { id: r.meta.last_row_id, chave };
}

export async function ficha(env, id) {
  const n = parseInt(id, 10);
  if (!Number.isFinite(n)) return null;
  return env.DB.prepare('SELECT * FROM whatsapp_group_media WHERE id = ?').bind(n).first();
}

export async function fichaPorChave(env, chave) {
  return env.DB.prepare('SELECT * FROM whatsapp_group_media WHERE chave = ?')
    .bind(String(chave || '')).first();
}

/** Bytes do arquivo, ou null se a chave não existe mais. */
export async function lerBytes(env, chave) {
  return env.MIDIA.get(String(chave || ''), { type: 'arrayBuffer' });
}

export async function apagar(env, chave) {
  await env.MIDIA.delete(String(chave || ''));
}

/**
 * URL absoluta do arquivo. Absoluta porque quem baixa é o SERVIDOR da
 * Evolution, não o navegador de quem agendou — um caminho relativo não
 * significaria nada para ela.
 */
export function urlPublica(env, chave) {
  const base = String(env?.SITE_BASE_URL || 'https://atacadoexponencial.com').replace(/\/+$/, '');
  return `${base}/m/${chave}`;
}
