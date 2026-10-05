import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listarAnuncios, insightsPorAnuncio, conjuntosDosAnuncios, contaMeta } from '../functions/api/_argo-meta.js';

const resp = (corpo, status = 200) => ({ ok: status < 400, status, json: async () => corpo });

test('sem token: aviso, nunca lista vazia', async () => {
  assert.deepEqual(await listarAnuncios({}, async () => { throw new Error('não deveria chamar'); }),
    { ok: false, aviso: 'O token de anúncios do Meta não está configurado.' });
});

test('conta: variável sobrepõe a padrão, sem prefixo act_', () => {
  assert.equal(contaMeta({}), '4577256079174658');
  assert.equal(contaMeta({ META_ADS_ACCOUNT_ID: 'act_123' }), '123');
});

test('lista anúncios seguindo a paginação e normaliza', async () => {
  const urls = [];
  const fetchImpl = async (u) => {
    urls.push(u);
    if (urls.length === 1) return resp({ data: [{ id: 1, name: 'ad09', effective_status: 'ACTIVE', created_time: '2026-09-25T10:00:00-0300', adset: { id: 9, name: 'SE | LAL' }, campaign: { id: 5, name: 'c' } }], paging: { next: 'https://graph/next' } });
    return resp({ data: [{ id: 2, name: 'ad11', effective_status: 'PAUSED', adset: { id: 9, name: 'SE | LAL' } }] });
  };
  const r = await listarAnuncios({ META_ADS_ACCESS_TOKEN: 't' }, fetchImpl);
  assert.equal(r.ok, true);
  assert.equal(urls.length, 2);
  assert.ok(urls[0].includes('act_4577256079174658/ads'));
  assert.deepEqual(r.anuncios[0], { id: '1', nome: 'ad09', ativo: true, criado_em: '2026-09-25', conjunto_id: '9', conjunto_nome: 'SE | LAL', campanha_id: '5', campanha_nome: 'c' });
  assert.deepEqual(conjuntosDosAnuncios(r.anuncios), [{ id: '9', nome: 'SE | LAL', campanha_nome: 'c', ativo: true }]);
});

test('erro do Meta vira aviso, sem vazar a URL', async () => {
  const r = await listarAnuncios({ META_ADS_ACCESS_TOKEN: 't' }, async () => resp({ error: { message: 'token https://graph...access_token=t' } }, 400));
  assert.deepEqual(r, { ok: false, aviso: 'Não foi possível ler os anúncios do Meta agora.' });
});

test('insights por anúncio: gasto em centavos, filtro por id, lista vazia de ids não chama', async () => {
  let url = '';
  const r = await insightsPorAnuncio({ META_ADS_ACCESS_TOKEN: 't' }, { desde: '2026-09-28', ate: '2026-10-04', ids: ['1'] }, async (u) => {
    url = u;
    return resp({ data: [{ ad_id: '1', ad_name: 'ad09', adset_id: '9', adset_name: 'x', spend: '412.37', impressions: '1000', clicks: '20' }] });
  });
  assert.equal(r.linhas[0].gasto_centavos, 41237);
  assert.ok(decodeURIComponent(url).includes('"field":"ad.id"'));
  assert.deepEqual(await insightsPorAnuncio({ META_ADS_ACCESS_TOKEN: 't' }, { desde: 'a', ate: 'b', ids: [] }, async () => { throw new Error('x'); }), { ok: true, linhas: [] });
});
