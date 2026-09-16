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

// A Evolution grava o `date_time` no relógio de BRASÍLIA mas carimba "Z" como
// se fosse UTC (confirmado em 2026-09-16: os 197 eventos desde 28/07 chegaram
// exatamente 10.800 s depois do instante declarado). Lido ao pé da letra, todo
// evento ficava 3h no passado — o EntrouGrupo ia ao Meta antes do próprio
// clique no anúncio, e as entradas das 00h–03h caíam no dia anterior.
//
// Em vez de assumir o fuso errado para sempre, a leitura é conferida contra o
// horário de recebimento (relógio do Worker, confiável): vale a interpretação
// literal ou a corrigida em +3h, a que não estiver no futuro e for a mais
// próxima do recebimento. Se a Evolution um dia corrigir o carimbo, a leitura
// literal volta a vencer sozinha.
const FOLGA_FUTURO_MS = 2 * 60 * 1000;

function instanteConferido(iso, recebidoEmMs) {
  if (!iso || !Number.isFinite(recebidoEmMs)) return iso;
  const literal = Date.parse(iso);
  const candidatos = [literal, literal - OFFSET_SEGUNDOS * 1000]
    .filter((ms) => ms <= recebidoEmMs + FOLGA_FUTURO_MS);
  if (!candidatos.length) return null;
  return new Date(Math.max(...candidatos)).toISOString();
}

function paraIso(valor, recebidoEmMs) {
  if (valor === undefined || valor === null || valor === '') return null;
  const n = Number(valor);
  if (Number.isFinite(n) && n > 0) {
    const ms = String(Math.trunc(n)).length <= 10 ? n * 1000 : n;
    return new Date(ms).toISOString();
  }
  if (typeof valor !== 'string' || !TEM_FUSO.test(valor.trim())) return null;
  const ms = Date.parse(valor);
  // Só a string passa pela conferência: unix é UTC por definição, e é a string
  // que chega com o "Z" falso.
  return Number.isFinite(ms) ? instanteConferido(new Date(ms).toISOString(), recebidoEmMs) : null;
}

// '5511888888888:12@s.whatsapp.net' → '5511888888888'. O sufixo ":N" identifica
// o aparelho; sem tirá-lo, alguém que sai pelo celular secundário seria contado
// como "removido por outra pessoa".
function numeroDe(jid) {
  return String(jid || '').split('@')[0].split(':')[0];
}

// A Evolution manda cada item de `participants` de duas formas: string (JID
// puro — formato assumido no plano original e usado pelos testes antigos) ou
// objeto `{ id, phoneNumber, admin }` (formato REAL, confirmado com payload de
// produção em 2026-07-27: `{ id: "...@lid", phoneNumber: "55...@s.whatsapp.net",
// admin: null }`). Aceitamos as duas.
//
// Quando é objeto, `participantJid` grava o TELEFONE (`phoneNumber`) quando
// existe, caindo para o `id` (que no payload real vem como "@lid", um
// identificador opaco da Evolution) só na ausência dele — é o telefone que
// depois cruza com os leads, o "@lid" sozinho não serve pra nada no dashboard.
//
// Para decidir "saiu" vs "removido" comparamos o `author` contra TODOS os
// identificadores da pessoa (id/@lid e phoneNumber), não só o que foi
// escolhido para gravar: no payload real capturado o `author` veio como
// "@lid", mas nada garante que a Evolution não mande o `author` em formato de
// telefone num outro evento — e aí só bateria contra o phoneNumber.
//
// `participantsData` é ignorado de propósito: é um campo com bug da própria
// Evolution, que grava `phoneNumber: "[object Object]"` dentro dele.
function identificadoresDe(p) {
  if (p && typeof p === 'object') {
    const id = p.id ? String(p.id) : '';
    const telefone = p.phoneNumber ? String(p.phoneNumber) : '';
    const participantJid = telefone || id;
    const ids = [id, telefone].filter(Boolean);
    return { participantJid, ids };
  }
  const s = String(p || '');
  return { participantJid: s, ids: [s] };
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
  // Fallback arredondado ao MINUTO (revisão 2026-09-13). O occurred_at faz
  // parte da chave de dedup (idx_wge_dedup: grupo+pessoa+ação+instante); com o
  // horário de recebimento ao milissegundo, uma reentrega do n8n segundos
  // depois tinha instante diferente e virava segunda linha — inflando entradas
  // e, no sync EntrouGrupo, tentando uma segunda conversão. Ao minuto, as
  // reentregas do mesmo evento colidem e o INSERT OR IGNORE faz o serviço.
  const occurredAt = paraIso(raw.date_time, recebidoEmMs)
    || new Date(Math.floor(recebidoEmMs / 60000) * 60000).toISOString();

  const linhas = participantes.map((p) => {
    const { participantJid, ids } = identificadoresDe(p);
    let action;
    if (acao === 'add') {
      action = 'entrou';
    } else if (!autor || ids.some((id) => numeroDe(autor) === numeroDe(id))) {
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
