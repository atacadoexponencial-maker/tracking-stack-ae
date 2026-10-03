// Montagem do e-mail a partir do modelo (issue 378): formatação, escape,
// layout por canal, texto puro e campos preenchidos ou mantidos.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { montarEmail, linksDoCorpo, AVISO_RODAPE, DESCADASTRO } from '../functions/api/_email-render.js';
import { desconhecidos, sugerir, exemplos } from '../functions/api/_email-campos.js';

const cfg = { rodape: 'Seteads Ltda.\nSão Paulo, SP' };
const modelo = (canal, corpo, extra = {}) => ({ canal, assunto: 'Oi, {{primeiro_nome}}', previa: 'Às {{ hora_reuniao }}', corpo, ...extra });

test('formatação: negrito, link, botão e parágrafos', () => {
  const corpo = 'Oi, **{{primeiro_nome}}**!\nSegunda linha.\n\nVeja [o site](https://atacadoexponencial.com).\n\n[[Entrar | {{link_reuniao}}]]';
  const { html } = montarEmail(modelo('transacional', corpo), cfg, { valores: exemplos('transacional') });
  assert.match(html, /<p style="margin:0 0 16px">Oi, <b>Ana<\/b>!<br>Segunda linha\.<\/p>/);
  assert.match(html, /<a href="https:\/\/atacadoexponencial\.com" style="[^"]*">o site<\/a>/);
  assert.match(html, /<a href="https:\/\/meet\.google\.com\/abc-defg-hij" style="display:inline-block[^"]*">Entrar<\/a>/);
});

test('HTML digitado vira texto (escape antes da formatação)', () => {
  const { html, assunto } = montarEmail(modelo('marketing', '<script>alert(1)</script> **<b>x</b>**', { assunto: '<i>oi</i>' }), cfg, { valores: {} });
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt; <b>&lt;b&gt;x&lt;\/b&gt;<\/b>/);
  assert.match(html, /<title>&lt;i&gt;oi&lt;\/i&gt;<\/title>/);
  assert.equal(assunto, '<i>oi</i>'); // o assunto é texto puro; quem exibe escapa
});

test('valor do campo também é escapado', () => {
  const { html } = montarEmail(modelo('marketing', 'Oi, {{nome}}'), cfg, { valores: { nome: '<b>Ana</b>' } });
  assert.match(html, /Oi, &lt;b&gt;Ana&lt;\/b&gt;/);
});

test('layout: logo, prévia escondida, rodapé; marketing ganha o descadastro', () => {
  const t = montarEmail(modelo('transacional', 'Oi'), cfg, { valores: exemplos('transacional'), site: 'https://x.dev' });
  assert.match(t.html, /<img src="https:\/\/x\.dev\/email\/logo\.png"/);
  assert.match(t.html, /display:none[^>]*>Às 15:00<\/div>/);
  assert.match(t.html, /Seteads Ltda\.<br>São Paulo, SP/);
  assert.doesNotMatch(t.html, /pm:unsubscribe/);
  assert.deepEqual(t.avisos, []);
  const m = montarEmail(modelo('marketing', 'Oi'), cfg, { valores: exemplos('marketing') });
  assert.ok(m.html.includes(`<a href="${DESCADASTRO}"`));
  assert.ok(m.texto.includes(DESCADASTRO));
});

test('rodapé vazio gera aviso, sem impedir', () => {
  const t = montarEmail(modelo('transacional', 'Oi'), { rodape: '' }, { valores: {} });
  assert.deepEqual(t.avisos, [AVISO_RODAPE]);
  assert.match(t.html, /<\/html>$/);
});

test('texto puro: sem marcação, com links e rodapé', () => {
  const { texto } = montarEmail(modelo('transacional', 'Oi, **{{primeiro_nome}}**.\n\nVeja [o site](https://a.com).\n\n[[Entrar | {{link_reuniao}}]]'), cfg, { valores: exemplos('transacional') });
  assert.equal(texto, 'Oi, Ana.\n\nVeja o site (https://a.com).\n\nEntrar: https://meet.google.com/abc-defg-hij\n\n--\nSeteads Ltda.\nSão Paulo, SP\n');
});

test('valores = null mantém os marcadores (Bulk API), normalizando espaços', () => {
  const e = montarEmail(modelo('transacional', 'Oi, {{ primeiro_nome }}\n\n[[Entrar | {{ link_reuniao }}]]'), cfg);
  assert.equal(e.assunto, 'Oi, {{primeiro_nome}}');
  assert.equal(e.previa, 'Às {{hora_reuniao}}');
  assert.match(e.html, /Oi, \{\{primeiro_nome\}\}/);
  assert.match(e.html, /href="\{\{link_reuniao\}\}"/);
  assert.match(e.texto, /Entrar: \{\{link_reuniao\}\}/);
});

test('prévia: campo desconhecido marcado; no link vira #', () => {
  const { html } = montarEmail(modelo('marketing', 'Oi, {{nmoe}}\n\n[[Ver | {{link_reuniao}}]]'), cfg, { valores: exemplos('marketing'), marcar: true });
  assert.match(html, /<mark[^>]*>\{\{nmoe\}\}<\/mark>/);
  assert.match(html, /<a href="#"/);
});

test('campos: desconhecidos por canal e sugestão do mais parecido', () => {
  assert.deepEqual(desconhecidos('{{ nome }} {{nmoe}} {{nmoe}} {{link_reuniao}}', 'marketing'), ['nmoe', 'link_reuniao']);
  assert.deepEqual(desconhecidos('{{link_reuniao}} {{{ pm:unsubscribe }}}', 'transacional'), []);
  assert.equal(sugerir('nmoe', 'marketing'), 'nome');
  assert.equal(sugerir('primeironome', 'marketing'), 'primeiro_nome');
  assert.equal(sugerir('xyzabc', 'marketing'), null);
});

test('links do corpo com o trecho', () => {
  assert.deepEqual(linksDoCorpo('a [x](http://a.com) b\n\n[[Ir | www.b.com ]]'), [
    { trecho: '[x](http://a.com)', url: 'http://a.com' },
    { trecho: '[[Ir | www.b.com ]]', url: 'www.b.com' },
  ]);
});
