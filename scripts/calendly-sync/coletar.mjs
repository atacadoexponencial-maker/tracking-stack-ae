// Coletor do Calendly: as "Consultoria Individual" e seus convidados
// (spec-reunioes-calendly.md, issue S2-01). Só lê; quem grava é o endpoint.
//
// `fetch` vem por parâmetro para o teste trocar o Calendly por um simulado.
// Qualquer resposta que não seja 2xx lança erro: o sync.mjs não posta nada
// nesse caso, e a cópia guardada fica como estava.

const BASE = 'https://api.calendly.com';
// Único tipo de evento que é reunião comercial (SUP-S2-05).
export const NOME_CONSULTORIA = 'Consultoria Individual';

async function lerJson(fetch, token, url) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Calendly ${r.status} em ${url.split('?')[0]}`);
  return r.json();
}

// Segue `pagination.next_page` até o fim.
async function todasAsPaginas(fetch, token, url) {
  const itens = [];
  for (let proxima = url; proxima;) {
    const pagina = await lerJson(fetch, token, proxima);
    itens.push(...(pagina.collection || []));
    proxima = pagina.pagination && pagina.pagination.next_page;
  }
  return itens;
}

/**
 * Consultorias com início entre `desde` e `ate` (ISO), ativas e canceladas.
 * Devolve [{ uri, status, start_time, convidados: [...] }] no formato que
 * /api/sync/calendly recebe.
 */
export async function coletarConsultorias({ token, desde, ate, fetch = globalThis.fetch }) {
  const eu = await lerJson(fetch, token, `${BASE}/users/me`);
  const q = new URLSearchParams({
    organization: eu.resource.current_organization,
    min_start_time: desde,
    max_start_time: ate,
    count: '100',
  });
  const eventos = await todasAsPaginas(fetch, token, `${BASE}/scheduled_events?${q}`);
  const consultorias = [];
  for (const ev of eventos) {
    if ((ev.name || '').trim() !== NOME_CONSULTORIA) continue;
    const convidados = await todasAsPaginas(fetch, token, `${ev.uri}/invitees?count=100`);
    consultorias.push({
      uri: ev.uri,
      status: ev.status,
      start_time: ev.start_time,
      convidados: convidados.map((c) => ({
        uri: c.uri,
        email: c.email,
        created_at: c.created_at,
        status: c.status,
        invitee_scheduled_by: c.invitee_scheduled_by || null,
        rescheduled: !!c.rescheduled,
      })),
    });
  }
  return consultorias;
}
