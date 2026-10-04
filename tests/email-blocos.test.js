// Documento de blocos do e-mail (issue 393): conversão fiel do formato antigo,
// limpeza do HTML, campos, imagens pela chave, cabeçalho e validação.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import { d1 } from './_fluxos-banco.js';
import { montarEmail } from '../functions/api/_email-render.js';
import { lerDocumento, converterLegado, limparHtml, normalizarDocumento } from '../functions/api/_email-blocos.js';
import { validarModelo, converterModelos } from '../functions/api/_email-modelos.js';
import { exemplos } from '../functions/api/_email-campos.js';

const cfg = { rodape: 'Seteads Ltda.' };
const CHAVE = 'a'.repeat(32);
const doc = (blocos, extra = {}) => ({ formato: 'blocos', versao: 1, cab: { modo: 'padrao', fundo: '' }, fundo: { fora: '#f3f1ec', conteudo: '#ffffff' }, blocos, ...extra });
const modelo = (corpo, canal = 'marketing') => ({ canal, nome: 'M', assunto: 'Oi, {{primeiro_nome}}', previa: '', corpo });

test('conversão do formato antigo: parágrafos viram um texto, botão vira botão, mesmo texto e links', () => {
  const antigo = 'Oi, **{{primeiro_nome}}**!\nLinha 2.\n\nVeja [o site](https://a.com).\n\n[[Quero | https://b.com/x]]\n\nAté.';
  const d = converterLegado(antigo);
  assert.deepEqual(d.blocos.map((b) => b.tipo), ['texto', 'botao', 'texto']);
  assert.equal(d.blocos[0].html, '<p>Oi, <b>{{primeiro_nome}}</b>!<br>Linha 2.</p><p>Veja <a href="https://a.com">o site</a>.</p>');
  assert.deepEqual([d.blocos[1].texto, d.blocos[1].link, d.blocos[1].fundo], ['Quero', 'https://b.com/x', '#1f1f1f']);
  assert.equal(d.cab.modo, 'padrao');
  // O texto puro sai igual ao do formato antigo.
  const { texto } = montarEmail(modelo(antigo), cfg, { valores: exemplos('marketing') });
  assert.equal(texto.split('\n--\n')[0], 'Oi, Ana!\nLinha 2.\n\nVeja o site (https://a.com).\n\nQuero: https://b.com/x\n\nAté.\n');
});

test('limpeza do HTML do texto: só o que o e-mail aceita', () => {
  assert.equal(limparHtml('<p onclick="x">Oi <script>alert(1)</script><strong>a</strong> <em>b</em> <span style="c">d</span></p>'), '<p>Oi <b>a</b> <i>b</i> d</p>');
  assert.equal(limparHtml('<a href="javascript:alert(1)">x</a>'), '<a href="javascript:alert(1)">x</a>', 'o link inválido é barrado na validação, não aqui');
  assert.equal(limparHtml('<ul><li>um<li>dois</ul>'), '<ul><li>um</li><li>dois</li></ul>');
  assert.equal(limparHtml('a < b'), 'a &lt; b');
});

test('campos: preenchidos, mantidos para a Bulk API e marcados na prévia', () => {
  const d = doc([{ tipo: 'titulo', texto: 'Oi, {{primeiro_nome}}' }, { tipo: 'botao', texto: 'Ir', link: '{{link_x}}' }]);
  let { html } = montarEmail(modelo(JSON.stringify(d)), cfg, { valores: { primeiro_nome: 'Ana<b>' } });
  assert.match(html, /Oi, Ana&lt;b&gt;/);
  ({ html } = montarEmail(modelo(JSON.stringify(d)), cfg, { valores: null }));
  assert.match(html, /Oi, \{\{primeiro_nome\}\}/);
  assert.match(html, /href="\{\{link_x\}\}"/);
  ({ html } = montarEmail(modelo(JSON.stringify(d)), cfg, { valores: {}, marcar: true }));
  assert.match(html, /<mark[^>]*>\{\{primeiro_nome\}\}<\/mark>/);
  assert.match(html, /href="#"/);
});

test('imagem pela chave, no domínio de quem envia; largura e link', () => {
  const d = doc([{ tipo: 'imagem', img: { chave: CHAVE, ext: 'png', w: 1200, h: 630 }, alt: 'Banner de {{primeiro_nome}}', largura: 'px', px: 300, link: 'https://a.com' }]);
  const { html, texto } = montarEmail(modelo(JSON.stringify(d)), cfg, { valores: exemplos('marketing'), site: 'https://atacadoexponencial.com' });
  assert.match(html, new RegExp(`<a href="https://a.com"[^>]*><img src="https://atacadoexponencial.com/email/i/${CHAVE}.png" width="300" alt="Banner de Ana"`));
  assert.match(texto, /\[Banner de Ana\] https:\/\/a\.com/);
  // Chave que não é da biblioteca é descartada.
  assert.equal(lerDocumento(JSON.stringify(doc([{ tipo: 'imagem', img: { chave: '../x', ext: 'png' } }]))).blocos[0].img, null);
});

test('cabeçalho: padrão (logo de hoje ou o da configuração), personalizado e sem', () => {
  const corpo = [{ tipo: 'texto', html: '<p>Corpo</p>' }];
  let { html } = montarEmail(modelo(JSON.stringify(doc(corpo))), cfg, { valores: {} });
  assert.match(html, /email\/logo\.png" width="150"/);

  const cfgPadrao = { ...cfg, cabecalho_padrao: JSON.stringify({ fundo: '#161513', blocos: [{ tipo: 'titulo', texto: 'Atacado Exponencial', cor: '#ffffff' }] }) };
  ({ html } = montarEmail(modelo(JSON.stringify(doc(corpo))), cfgPadrao, { valores: {} }));
  assert.match(html, /background:#161513;padding:0 28px 16px[^"]*color:#ffffff[^"]*">Atacado Exponencial/);
  assert.doesNotMatch(html, /logo\.png/);

  const proprio = doc([{ tipo: 'titulo', texto: 'Só deste modelo', zona: 'cab' }, ...corpo], { cab: { modo: 'proprio', fundo: '#f5f0eb' } });
  ({ html } = montarEmail(modelo(JSON.stringify(proprio)), cfgPadrao, { valores: {} }));
  assert.match(html, /background:#f5f0eb[^"]*">Só deste modelo/);
  assert.ok(html.indexOf('Só deste modelo') < html.indexOf('Corpo'), 'o cabeçalho vem antes do corpo');

  ({ html } = montarEmail(modelo(JSON.stringify(doc(corpo, { cab: { modo: 'sem', fundo: '' } }))), cfgPadrao, { valores: {} }));
  assert.doesNotMatch(html, /Atacado Exponencial|logo\.png/);
});

test('normalizar: tipos desconhecidos saem, cores inválidas viram padrão, cabeçalho vem antes', () => {
  const d = normalizarDocumento(doc([{ tipo: 'texto', html: '<p>a</p>', cor: 'vermelho' }, { tipo: 'video' }, { tipo: 'titulo', texto: 'c', zona: 'cab' }]));
  assert.deepEqual(d.blocos.map((b) => [b.tipo, b.zona || '']), [['titulo', 'cab'], ['texto', '']]);
  assert.equal(d.blocos[1].cor, '#222222');
});

test('validação do modelo: precisa de bloco no corpo, botão com link, links com https e campos do canal', () => {
  const v = (blocos) => () => validarModelo(modelo(doc(blocos)));
  assert.throws(v([]), /pelo menos um bloco no corpo/);
  assert.throws(v([{ tipo: 'titulo', texto: 'Só cabeçalho', zona: 'cab' }]), /pelo menos um bloco no corpo/);
  assert.throws(v([{ tipo: 'botao', texto: 'Ir', link: '' }]), /^Error: Botão: o botão precisa de um link/);
  assert.throws(v([{ tipo: 'texto', html: '<p><a href="javascript:x()">a</a></p>' }]), /Texto: link sem https/);
  assert.throws(v([{ tipo: 'texto', html: '<p>{{nmoe}}</p>' }]), /\{\{nmoe\}\} não existe/);
  const ok = validarModelo(modelo(doc([{ tipo: 'texto', html: '<p>Oi</p>' }, { tipo: 'botao', texto: 'Ir', link: 'https://a.com' }])));
  assert.equal(JSON.parse(ok.corpo).blocos.length, 2);
});

test('conversão dos modelos guardados: uma vez só, sem mexer em atualizado_em', async () => {
  const db = new DatabaseSync(':memory:');
  for (const f of ['0050_email.sql', '0051_email_modelos.sql']) db.exec(readFileSync(new URL(`../migrations/${f}`, import.meta.url), 'utf8'));
  db.prepare('DELETE FROM email_modelos').run();
  db.prepare("INSERT INTO email_modelos (nome, canal, assunto, previa, corpo, arquivado, criado_em, atualizado_em) VALUES ('A', 'transacional', 'a', '', 'Oi.\n\n[[Entrar | {{link_reuniao}}]]', 0, 1, 5), ('B', 'marketing', 'b', '', '', 0, 1, 6)").run();
  const env = { DB: d1(db) };
  assert.deepEqual(await converterModelos(env), { total: 2, convertidos: 1 });
  assert.deepEqual(await converterModelos(env), { total: 2, convertidos: 0 });
  const a = db.prepare("SELECT corpo, atualizado_em FROM email_modelos WHERE nome = 'A'").get();
  assert.equal(a.atualizado_em, 5);
  assert.deepEqual(JSON.parse(a.corpo).blocos.map((b) => b.tipo), ['texto', 'botao']);
  // Depois de convertido, o e-mail sai com o mesmo texto.
  const { texto } = montarEmail({ canal: 'transacional', assunto: 'a', previa: '', corpo: a.corpo }, { rodape: '' }, { valores: exemplos('transacional') });
  assert.equal(texto, 'Oi.\n\nEntrar: https://meet.google.com/abc-defg-hij\n');
});
