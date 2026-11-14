// Cadastro antes do checkout da Imersão (spec-popup-checkout-imersao.md, série
// S10, issue S10-04): as regras da janela (src/scripts/cadastro-imersao.js), a
// gravação na planilha (/api/imersao-cadastro) e o que a página liga a quê.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { criarCadastro, destinoCheckout, MENSAGENS } from '../src/scripts/cadastro-imersao.js';
import { processarCadastro, CABECALHO } from '../functions/api/imersao-cadastro.js';

const PAGINA = readFileSync(new URL('../src/pages/imersao-planejamento-atacado.astro', import.meta.url), 'utf8');
const CHECKOUT = 'https://pay.zouti.com.br/checkout?product_offer_id=prod_offer_iflx36w3lb48e111fap57z';
const UTMS = 'utm_source=facebookads&utm_medium=cpc&utm_campaign=imersao-ingresso&utm_content=video-felipe&utm_term=dona-de-marca';
const VALIDO = { nome: 'Maria Teste', email: 'maria@exemplo.com', telefone: '(11) 98765-4321' };
// Mesma regra de src/scripts/lead-validacao.ts (o Node não importa .ts).
const telefoneValido = (v) => {
  const d = String(v).replace(/\D/g, '');
  return String(v).trim().startsWith('+') ? d.length >= 8 && d.length <= 15 : d.length >= 10 && d.length <= 11;
};

/** Uma aba do navegador: guarda própria, envios e navegações anotados. */
function aba({ busca = '', guarda = new Map(), enviar } = {}) {
  const envios = [];
  const idas = [];
  const cadastro = criarCadastro({
    checkoutUrl: CHECKOUT,
    busca,
    armazenamento: { getItem: (k) => guarda.get(k) ?? null, setItem: (k, v) => guarda.set(k, v) },
    telefoneValido,
    enviar: enviar || (async (dados) => { envios.push(dados); }),
    navegar: (url) => idas.push(url),
    esperaMs: 40,
  });
  return { cadastro, envios, idas, guarda };
}

/** Os links de compra da página: [atributos da tag <a>]. */
const botoes = [...PAGINA.matchAll(/<a class="ipa-botao[^>]*>/g)].map((m) => m[0]);

test('CA-S10-01: botão do topo rola até o preço e não abre o cadastro', () => {
  const topo = botoes.filter((b) => b.includes('data-ir-preco'));
  assert.equal(topo.length, 1);
  assert.match(topo[0], /href="#ingresso"/);
  assert.doesNotMatch(topo[0], /data-checkout/);
  // A janela só abre em clique de [data-checkout].
  assert.match(PAGINA, /closest\?\.\('\[data-checkout\]'\)/);
});

test('CA-S10-02: os outros botões abrem o cadastro e a pessoa fica na página', () => {
  const compra = botoes.filter((b) => !b.includes('data-ir-preco'));
  assert.equal(compra.length, 5);
  for (const b of compra) assert.match(b, /href=\{HREF_COMPRA\} data-checkout/);
  const { cadastro, idas, envios } = aba();
  assert.equal(cadastro.aoComprar(), 'janela');
  assert.deepEqual(idas, []);
  assert.deepEqual(envios, []);
});

test('CA-S10-03: quem já se cadastrou na visita vai direto ao checkout', async () => {
  const guarda = new Map();
  const primeira = aba({ guarda });
  await primeira.cadastro.confirmar(VALIDO);
  // Voltou para a página (recarregou): mesma aba, mesma guarda.
  const volta = aba({ guarda });
  assert.equal(volta.cadastro.aoComprar(), 'checkout');
  assert.deepEqual(volta.idas, [CHECKOUT]);
  assert.deepEqual(volta.envios, []);
});

test('CA-S10-04: cadastro completo leva ao checkout da Zouti do ingresso', async () => {
  const { cadastro, idas, envios } = aba();
  const r = await cadastro.confirmar(VALIDO);
  assert.equal(r.ok, true);
  assert.deepEqual(idas, [CHECKOUT]);
  assert.equal(envios.length, 1);
  assert.match(PAGINA, /const CHECKOUT_URL = 'https:\/\/pay\.zouti\.com\.br\/checkout\?product_offer_id=prod_offer_iflx36w3lb48e111fap57z';/);
});

test('CA-S10-05: campo vazio ou inválido não envia e diz qual corrigir', async () => {
  const casos = [
    [{ ...VALIDO, nome: ' ' }, 'nome'],
    [{ ...VALIDO, email: 'maria.exemplo.com' }, 'email'],
    [{ ...VALIDO, telefone: '98765-4321' }, 'telefone'],
  ];
  for (const [valores, campo] of casos) {
    const { cadastro, idas, envios } = aba();
    const r = await cadastro.confirmar(valores);
    assert.deepEqual(r, { ok: false, campo, mensagem: MENSAGENS[campo] });
    assert.deepEqual(idas, [], campo);
    assert.deepEqual(envios, [], campo);
    assert.equal(cadastro.aoComprar(), 'janela', campo);
  }
  // O servidor também recusa, sem gravar (no telefone, a regra única do site:
  // só barra o que não tem como ser número).
  for (const [valores, campo] of [casos[0], casos[1], [{ ...VALIDO, telefone: '4321' }, 'telefone']]) {
    const linhas = [];
    const r = await processarCadastro({ request: pedido(valores), env: {}, gravar: async (_e, a) => linhas.push(a) });
    assert.equal(r.status, 400, campo);
    assert.equal((await r.json()).campo, campo);
    assert.equal(linhas.length, 0, campo);
  }
});

test('CA-S10-06: fechar a janela não grava nada e mantém a pessoa na página', () => {
  const { cadastro, idas, envios, guarda } = aba();
  cadastro.aoComprar(); // abriu; a pessoa fecha sem confirmar
  assert.deepEqual(idas, []);
  assert.deepEqual(envios, []);
  assert.equal(guarda.has('ipa_cadastro_feito'), false);
  assert.equal(cadastro.aoComprar(), 'janela'); // no próximo toque a janela abre de novo
  // Os três jeitos de fechar: botão, toque fora e Esc (o <dialog> fecha com Esc sozinho).
  assert.match(PAGINA, /<dialog class="ipa-cadastro"/);
  assert.match(PAGINA, /\[data-cadastro-fechar\]'\)\?\.addEventListener\('click', \(\) => janela\.close\(\)\)/);
  assert.match(PAGINA, /if \(evento\.target === janela\) janela\.close\(\);/);
});

test('CA-S10-07: gravação fora do ar ou travada não impede a ida ao checkout', async () => {
  const falha = aba({ enviar: async () => { throw new Error('fora do ar'); } });
  assert.equal((await falha.cadastro.confirmar(VALIDO)).ok, true);
  assert.deepEqual(falha.idas, [CHECKOUT]);

  const travada = aba({ enviar: () => new Promise(() => {}) }); // nunca responde
  const inicio = Date.now();
  await travada.cadastro.confirmar(VALIDO);
  assert.deepEqual(travada.idas, [CHECKOUT]);
  assert.ok(Date.now() - inicio < 3000);
  // Na página, a espera é a padrão do módulo: 2,5 s, abaixo dos 3 s do critério.
  assert.match(readFileSync(new URL('../src/scripts/cadastro-imersao.js', import.meta.url), 'utf8'), /esperaMs = 2500/);
  assert.doesNotMatch(PAGINA, /esperaMs/);
});

test('CA-S10-08: dois toques seguidos em confirmar gravam um cadastro só', async () => {
  const { cadastro, envios, idas } = aba();
  await Promise.all([cadastro.confirmar(VALIDO), cadastro.confirmar(VALIDO)]);
  assert.equal(envios.length, 1);
  assert.equal(idas.length, 1);
  await cadastro.confirmar(VALIDO); // voltou do checkout e confirmou de novo
  assert.equal(envios.length, 1);
});

test('CA-S10-10: as cinco UTMs da visita seguem para o checkout', async () => {
  const { cadastro, idas, guarda } = aba({ busca: `?${UTMS}&fbclid=abc` });
  await cadastro.confirmar(VALIDO);
  const destino = new URL(idas[0]);
  assert.equal(destino.origin + destino.pathname, 'https://pay.zouti.com.br/checkout');
  assert.equal(destino.searchParams.get('product_offer_id'), 'prod_offer_iflx36w3lb48e111fap57z');
  assert.deepEqual(
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].map((k) => destino.searchParams.get(k)),
    ['facebookads', 'cpc', 'imersao-ingresso', 'video-felipe', 'dona-de-marca'],
  );
  // Recarregou sem as UTMs no endereço: as da chegada continuam valendo.
  const volta = aba({ guarda });
  volta.cadastro.aoComprar();
  assert.equal(volta.idas[0], idas[0]);
});

test('CA-S10-11: nome, e-mail e WhatsApp não aparecem no endereço do checkout', async () => {
  const { cadastro, idas } = aba({ busca: `?${UTMS}` });
  await cadastro.confirmar(VALIDO);
  const destino = decodeURIComponent(idas[0]);
  assert.doesNotMatch(destino, /maria|teste|exemplo\.com|98765|4321/i);
  assert.equal(destinoCheckout(CHECKOUT, { utm_source: 'x', nome: 'Maria', email: 'maria@exemplo.com', telefone: '11987654321' }), `${CHECKOUT}&utm_source=x`);
});

// ---- Planilha -------------------------------------------------------------

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
function pedido(corpo, ua = UA) {
  return new Request('https://x/api/imersao-cadastro', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'user-agent': ua, 'cf-connecting-ip': '200.10.20.30' },
    body: JSON.stringify(corpo),
  });
}
const AGORA = Date.parse('2026-11-14T12:00:00-03:00'); // Lote 01, R$ 29

test('CA-S10-12: cadastro vira linha com UTM completa, lote e preço do momento', async () => {
  // O que a janela envia, do jeito que a página monta.
  let enviado;
  const { cadastro } = aba({ busca: `?${UTMS}`, enviar: async (dados) => { enviado = dados; } });
  await cadastro.confirmar(VALIDO);

  const linhas = [];
  const r = await processarCadastro({ request: pedido(enviado), env: {}, agoraMs: AGORA, gravar: async (_e, a) => linhas.push(a) });
  assert.equal(r.status, 200);
  assert.equal(linhas.length, 1);
  assert.deepEqual(CABECALHO, ['Data/hora', 'Nome', 'E-mail', 'WhatsApp', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'Lote', 'Preço']);
  assert.deepEqual(linhas[0].cabecalho, CABECALHO);
  assert.deepEqual(linhas[0].linha, [
    '14/11/2026 12:00:00', 'Maria Teste', 'maria@exemplo.com', '5511987654321',
    'facebookads', 'cpc', 'imersao-ingresso', 'video-felipe', 'dona-de-marca',
    'Lote 01', 'R$ 29',
  ]);
  // Lote do momento: no dia 24/11 o cadastro entra como Lote 02.
  const depois = [];
  await processarCadastro({ request: pedido(enviado), env: {}, agoraMs: Date.parse('2026-11-24T10:00:00-03:00'), gravar: async (_e, a) => depois.push(a) });
  assert.deepEqual(depois[0].linha.slice(-2), ['Lote 02', 'R$ 35']);
});

test('CA-S10-13: visita sem UTM também é gravada, com as colunas de UTM vazias', async () => {
  let enviado;
  const { cadastro } = aba({ enviar: async (dados) => { enviado = dados; } });
  await cadastro.confirmar(VALIDO);
  const linhas = [];
  const r = await processarCadastro({ request: pedido(enviado), env: {}, agoraMs: AGORA, gravar: async (_e, a) => linhas.push(a) });
  assert.equal(r.status, 200);
  assert.deepEqual(linhas[0].linha.slice(4, 9), ['', '', '', '', '']);
  assert.equal(linhas[0].linha[3], '5511987654321');
});

test('CA-S10-32: a página não manda início de checkout próprio ao Meta', () => {
  assert.doesNotMatch(PAGINA, /InitiateCheckout/);
  assert.doesNotMatch(PAGINA, /checkout-venda|ligarCheckout|fbq\(/);
  assert.doesNotMatch(readFileSync(new URL('../src/scripts/cadastro-imersao.js', import.meta.url), 'utf8'), /InitiateCheckout|fbq|\/tracker/);
});
