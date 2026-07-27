// Traduz o payload de GROUP_PARTICIPANTS_UPDATE da Evolution em linhas de
// whatsapp_group_events. Função PURA: sem I/O, sem D1, sem env — é o que permite
// testá-la com `node --test` sem subir nada.
//
// Prefixo "_" no nome: o Cloudflare Pages não transforma em rota (mesmo
// mecanismo de functions/webhook/_core.js).

// America/Sao_Paulo não tem horário de verão desde 2019, então o deslocamento é
// fixo. Se um dia voltar, este é o único ponto a mudar.
const OFFSET_SEGUNDOS = -3 * 3600;

const pad = (n) => String(n).padStart(2, '0');

// 'YYYY-MM-DD' no fuso de Brasília. O dia é calculado UMA vez, na escrita, e
// gravado: assim a agregação por dia não depende do fuso de quem consulta.
export function diaLocal(isoUtc) {
  const ms = Date.parse(isoUtc);
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms + OFFSET_SEGUNDOS * 1000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function diaLocalDeUnix(unixSeconds) {
  return diaLocal(new Date(unixSeconds * 1000).toISOString());
}

// A Evolution manda o instante ora como ISO, ora como unix (segundos ou ms).
//
// Nunca vimos um payload real da Evolution com string de data — todos os
// testes usam um payload sintético terminado em "Z" (maiúsculo ou minúsculo,
// ambos válidos em ISO 8601 e aceitos pelo `Date.parse`). Se algum dia a
// Evolution mandar uma string SEM fuso explícito (ex.: "2026-07-27 22:00:00"
// ou "2026-07-27T22:00:00"), `Date.parse` a interpreta como UTC, e `diaLocal`
// subtrai mais 3h por cima — todo evento entre 00:00 e 03:00 de Brasília
// cairia no dia anterior, em silêncio, e `day_local` é gravado e imutável.
// Por isso: string sem fuso explícito é rejeitada (retorna null) e
// `classificarEvento` cai no fallback do horário de recebimento, que é
// aproximado mas nunca sistematicamente errado.
const TEM_FUSO = /(?:[Zz]|[+-]\d{2}:\d{2})$/;

function paraIso(valor) {
  if (valor === undefined || valor === null || valor === '') return null;
  const n = Number(valor);
  if (Number.isFinite(n) && n > 0) {
    const ms = String(Math.trunc(n)).length <= 10 ? n * 1000 : n;
    return new Date(ms).toISOString();
  }
  if (typeof valor !== 'string' || !TEM_FUSO.test(valor.trim())) return null;
  const ms = Date.parse(valor);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

// '5511888888888:12@s.whatsapp.net' → '5511888888888'. O sufixo ":N" identifica
// o aparelho; sem tirá-lo, alguém que sai pelo celular secundário seria contado
// como "removido por outra pessoa".
function numeroDe(jid) {
  return String(jid || '').split('@')[0].split(':')[0];
}

export function classificarEvento(raw, recebidoEmMs) {
  if (!raw || typeof raw !== 'object') return null;

  const nome = String(raw.event || '').toUpperCase().replace(/[^A-Z0-9]+/g, '_');
  if (nome !== 'GROUP_PARTICIPANTS_UPDATE') return null;

  const data = raw.data || {};
  const groupJid = String(data.id || '');
  if (!groupJid.endsWith('@g.us')) return null;

  const acao = String(data.action || '').toLowerCase();
  // promote/demote mudam o papel de quem já está no grupo — não são entrada nem
  // saída, e contá-los inflaria o número.
  if (acao !== 'add' && acao !== 'remove') return null;

  const participantes = (Array.isArray(data.participants) ? data.participants : []).filter(Boolean);
  if (!participantes.length) return null;

  const autor = data.author ? String(data.author) : null;
  const occurredAt = paraIso(raw.date_time) || new Date(recebidoEmMs).toISOString();

  const linhas = participantes.map((p) => {
    const participantJid = String(p);
    let action;
    if (acao === 'add') {
      action = 'entrou';
    } else if (!autor || numeroDe(autor) === numeroDe(participantJid)) {
      // Sem autor não dá para distinguir; "saiu" é o caso esmagadoramente mais
      // comum num grupo aberto, e é o mais conservador (não acusa remoção).
      action = 'saiu';
    } else {
      action = 'removido';
    }
    return { participantJid, action, actorJid: autor };
  });

  return { groupJid, occurredAt, dayLocal: diaLocal(occurredAt), linhas };
}
