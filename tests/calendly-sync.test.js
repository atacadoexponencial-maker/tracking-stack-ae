// Coleta diária das consultorias do Calendly (issue S2-01): coletor da VPS com
// um Calendly simulado (fetch trocado) e o endpoint /api/sync/calendly contra
// SQLite real com a migration 0063.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import { d1 } from './_fluxos-banco.js';
import { rodarSync } from '../scripts/calendly-sync/sync.mjs';
import * as syncCalendly from '../functions/api/sync/calendly.js';

const ENDPOINT = 'https://x/api/sync/calendly';
const API = 'https://api.calendly.com';
const ORG = `${API}/organizations/org1`;

let db, env, calendly, chamadasEndpoint, log;

// Calendly simulado: `calendly.eventos` é a lista de agendamentos (cada um com
// seus convidados); `calendly.falha` faz toda resposta virar 500.
function fetchSimulado(url, opcoes = {}) {
  if (url === ENDPOINT) {
    chamadasEndpoint++;
    return syncCalendly.onRequestPost({
      request: new Request(url, { method: 'POST', headers: opcoes.headers, body: opcoes.body }),
      env,
    });
  }
  if (calendly.falha) return Promise.resolve(new Response('erro', { status: 500 }));
  const resp = (corpo) => Promise.resolve(Response.json(corpo));
  if (url === `${API}/users/me`) return resp({ resource: { current_organization: ORG } });
  if (url.startsWith(`${API}/scheduled_events?`)) {
    return resp({ collection: calendly.eventos.map(({ convidados, ...ev }) => ev), pagination: { next_page: null } });
  }
  const ev = calendly.eventos.find((e) => url.startsWith(`${e.uri}/invitees`));
  if (ev) return resp({ collection: ev.convidados, pagination: { next_page: null } });
  return Promise.resolve(new Response('não achei', { status: 404 }));
}

const consultoria = (id, convidados, extra = {}) => ({
  uri: `${API}/scheduled_events/${id}`, name: 'Consultoria Individual', status: 'active',
  start_time: '2026-10-14T13:00:00.000000Z', ...extra, convidados,
});
const convidado = (id, extra = {}) => ({
  uri: `${API}/scheduled_events/x/invitees/${id}`, email: `${id}@gmail.com`, status: 'active',
  created_at: '2026-10-11T15:00:00.000000Z', invitee_scheduled_by: null, rescheduled: false, ...extra,
});

const rodar = () => rodarSync({
  env: { CALENDLY_TOKEN: 't', SYNC_SECRET: 's', SYNC_ENDPOINT: ENDPOINT },
  fetch: fetchSimulado, agora: Date.parse('2026-10-19T08:00:00Z'), log: (l) => log.push(l),
});
const linhas = () => db.prepare('SELECT * FROM calendly_consultorias ORDER BY invitee_uri').all();

beforeEach(() => {
  db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../migrations/0063_calendly_consultorias.sql', import.meta.url), 'utf8'));
  env = { SYNC_SECRET: 's', DB: d1(db) };
  calendly = { eventos: [], falha: false };
  chamadasEndpoint = 0;
  log = [];
});

test('CA-S2-01: a coleta guarda as consultorias do Calendly e deixa o workshop de fora', async () => {
  calendly.eventos = [
    consultoria('c1', [
      convidado('ana', { email: ' Ana@Gmail.com ' }),
      convidado('bia', { invitee_scheduled_by: `${API}/users/equipe` }),
    ]),
    { uri: `${API}/scheduled_events/w1`, name: 'Workshop Atacado Exponencial', status: 'active',
      start_time: '2026-10-15T22:00:00Z', convidados: [convidado('carla')] },
  ];
  assert.equal(await rodar(), 0);
  const l = linhas();
  assert.equal(l.length, 2);
  const [ana, bia] = l;
  assert.equal(ana.email, 'ana@gmail.com');
  assert.equal(ana.agendou_em, Date.parse('2026-10-11T15:00:00Z') / 1000);
  assert.equal(ana.inicio, Date.parse('2026-10-14T13:00:00Z') / 1000);
  assert.equal(ana.situacao, 'ativa');
  assert.equal(ana.marcada_pela_equipe, 0);
  assert.equal(bia.marcada_pela_equipe, 1);
  assert.ok(!l.some((x) => x.email.startsWith('carla')), 'workshop não entra');
});

test('CA-S2-02: rodar a coleta de novo não duplica', async () => {
  calendly.eventos = [consultoria('c1', [convidado('ana'), convidado('bia')])];
  await rodar();
  await rodar();
  assert.equal(linhas().length, 2);
});

test('CA-S2-03: cancelamento no Calendly chega à cópia', async () => {
  calendly.eventos = [consultoria('c1', [convidado('ana')])];
  await rodar();
  assert.equal(linhas()[0].situacao, 'ativa');
  calendly.eventos = [consultoria('c1', [convidado('ana', { status: 'canceled' })])];
  await rodar();
  assert.equal(linhas().length, 1);
  assert.equal(linhas()[0].situacao, 'cancelada');
});

test('CA-S2-03: evento cancelado inteiro cancela o convidado, remarcação fica marcada', async () => {
  calendly.eventos = [
    consultoria('c1', [convidado('ana')], { status: 'canceled' }),
    consultoria('c2', [convidado('bia', { status: 'canceled', rescheduled: true })]),
  ];
  await rodar();
  const [ana, bia] = linhas();
  assert.equal(ana.situacao, 'cancelada');
  assert.equal(bia.situacao, 'cancelada');
  assert.equal(bia.remarcada, 1);
});

test('CA-S2-04: Calendly fora do ar não apaga o que já existe e a falha vai para o log', async () => {
  calendly.eventos = [consultoria('c1', [convidado('ana'), convidado('bia')])];
  await rodar();
  const antes = linhas();
  chamadasEndpoint = 0;
  log = [];
  calendly.falha = true;
  assert.equal(await rodar(), 1);
  assert.equal(chamadasEndpoint, 0, 'não chama o endpoint');
  assert.deepEqual(linhas(), antes);
  assert.match(log.join('\n'), /ERRO coleta: Calendly 500/);
});
