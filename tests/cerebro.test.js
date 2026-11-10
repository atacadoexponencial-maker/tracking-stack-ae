// Aba Cérebro (série S9 do gestor-ae, issue S9-04): guarda da rota e aviso de coleta atrasada.
// Os testes de rota rodam com `env` sem `ARGO_DATABASE_URL` de propósito: se a guarda sair
// da primeira linha, a chamada estoura no banco e o 401 esperado vira outro status.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet } from '../functions/api/cerebro.js';
import { montarResposta, ATRASO_HORAS } from '../functions/api/_cerebro.js';

const ENV = { DASH_KEY: 'chave-do-dash-789' };
const pedir = (query = '') => new Request('https://atacadoexponencial.com/api/cerebro' + query);

test('CA-S9-11 — Sem senha, o painel não abre', async () => {
  for (const q of ['', '?key=', '?key=errada', '?key=chave-do-dash-78', '?key=CHAVE-DO-DASH-789']) {
    const resposta = await onRequestGet({ request: pedir(q), env: ENV });
    assert.equal(resposta.status, 401, q);
    const corpo = await resposta.json();
    assert.equal(corpo.painel, undefined, q);
    assert.deepEqual(Object.keys(corpo), ['erro'], q);
  }
  const semChaveNoAmbiente = await onRequestGet({ request: pedir('?key=qualquer'), env: {} });
  assert.equal(semChaveNoAmbiente.status, 401);
});

test('CA-S9-13 — A data da última coleta fica visível', () => {
  const painel = { semanas: [], historico: [] };
  const atrasada = montarResposta({ painel, gerado_em: '2026-11-12T06:00:00Z' }, new Date('2026-11-14T13:00:00Z'));
  assert.equal(atrasada.gerado_em, '2026-11-12T06:00:00.000Z');
  assert.equal(atrasada.atrasada, true);
  assert.deepEqual(atrasada.painel, painel);
  const emDia = montarResposta({ painel, gerado_em: '2026-11-14T06:00:00Z' }, new Date('2026-11-14T13:00:00Z'));
  assert.equal(emDia.atrasada, false);
  assert.equal(ATRASO_HORAS, 26);
  const semColeta = montarResposta(null, new Date('2026-11-14T13:00:00Z'));
  assert.deepEqual(semColeta, { painel: null, gerado_em: null, atrasada: true });
});
