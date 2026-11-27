// Issue S13-01: ROAS em destaque na subaba "Tráfego e página" da Imersão 2027,
// com o mesmo número do bloco de resultado (faturamento total ÷ investimento).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { calcularVisao, metasEfetivas } from '../functions/api/_imersao.js';

const em = (iso) => Math.floor(Date.parse(`${iso}-03:00`) / 1000);

globalThis.window = globalThis.window || {};
new Function(readFileSync(new URL('../public/dash/imersao.js', import.meta.url), 'utf8'))();
const IM = globalThis.window.Imersao;
const CTX = {
  esc: (s) => String(s ?? ''),
  fmtInt: (n) => Number(n || 0).toLocaleString('pt-BR'),
  fmtPct: (n, c = 1) => Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: c, minimumFractionDigits: c }) + '%',
  fmtNum: (n, c = 2) => Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: c }),
  money: (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
};

test('CA-S13-01: o segundo card da aba de tráfego é o ROAS, em destaque, igual ao do resultado', () => {
  const vendas = [
    { id: 'a', produto: 'ingresso', valor: 300, pago_em: em('2026-11-17T10:00:00'), email: 'a@x.com', situacao: 'paga' },
    { id: 'b', produto: 'ingresso', valor: 300, pago_em: em('2026-11-18T10:00:00'), email: 'b@x.com', situacao: 'paga' },
    { id: 'c', produto: 'bump', valor: 297, pago_em: em('2026-11-18T10:00:00'), email: 'b@x.com', situacao: 'paga' },
  ];
  const dados = { vendas, trafego: { investimento: 400, impressoes: 1000, cliques: 10 }, visualizacoes: null, inicios_checkout: null, anuncios: [], meet: null };
  const r = calcularVisao(dados, metasEfetivas({}), em('2026-11-20T15:00:00'));
  // (300 + 300 + 297) ÷ 400 = 2,2425 → 2,24
  assert.equal(r.trafego.roas, 2.24);
  assert.equal(r.trafego.roas, r.resultado.roas);

  IM._definir({ ordem: 'vendas', aba: 'trafego' });
  const raiz = { innerHTML: '' };
  IM.desenhar(raiz, r, CTX);
  const html = raiz.innerHTML;
  const cards = [...html.matchAll(/data-im-card="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(cards[1], 'ROAS');
  const i = html.indexOf('data-im-card="ROAS"');
  const card = html.slice(html.lastIndexOf('<div class="etiqueta', i), html.indexOf('data-im-card=', i + 15));
  assert.match(card, /etiqueta heroi/);
  assert.match(card, /2,24/);
});
