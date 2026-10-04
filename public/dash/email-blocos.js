// Editor de e-mail por blocos (spec-editor-email.md, módulos 1, 2, 3 na parte do
// modelo e 5). PROTÓTIPO da issue 389: tudo roda no navegador com dados de
// exemplo; nada é salvo nem enviado. A prévia aqui é montada no próprio
// navegador só para o desenho; no editor de verdade (394) quem monta o e-mail
// é o servidor (_email-render.js), e a prévia vem dele.
//
// Aberto por Marketing › E-mail › Modelos › "Ver o editor novo (protótipo)".
(function () {
  'use strict';

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MARCADOR = /(?<!\{)\{\{(?!\{)\s*([^{}]*?)\s*\}\}(?!\})/g;

  // ---------------------------------------------------------------------------
  // Catálogo
  // ---------------------------------------------------------------------------
  const CAMPOS = [
    ['primeiro_nome', 'Primeiro nome', 'Ana'], ['nome', 'Nome completo', 'Ana Lima'],
    ['email', 'E-mail', 'ana.lima@exemplo.com'], ['funil', 'Funil de entrada', 'Workshop gratuito'],
  ];
  const EXEMPLO = Object.fromEntries(CAMPOS.map(([c, , v]) => [c, v]));
  const MARCA = [['#161513', 'Carvão'], ['#f5f0eb', 'Bege assinatura'], ['#ffffff', 'Branco'], ['#b8ada1', 'Taupe']];

  const IC = {
    titulo: '<path d="M5 6h14M12 6v13M9 19h6"/>',
    texto: '<path d="M4 7h16M4 12h16M4 17h10"/>',
    imagem: '<rect x="3" y="5" width="18" height="14" rx="1.5"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/>',
    botao: '<rect x="3" y="8" width="18" height="8" rx="1.5"/><path d="M8 12h8"/>',
    divisoria: '<path d="M3 12h18"/>',
    espaco: '<path d="M12 4v16M8 8l4-4 4 4M8 16l4 4 4-4"/>',
    imgtexto: '<rect x="3" y="6" width="8" height="12" rx="1"/><path d="M14 8h7M14 12h7M14 16h5"/>',
    subir: '<path d="M12 19V5M6 11l6-6 6 6"/>', descer: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    copiar: '<rect x="8" y="8" width="12" height="12" rx="1.5"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>',
    apagar: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    alca: '<circle cx="9" cy="6" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="18" r="1.2"/>',
    mais: '<path d="M12 5v14M5 12h14"/>', voltar: '<path d="M15 6l-6 6 6 6"/>',
    desfazer: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 010 10h-3"/>', refazer: '<path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 000 10h3"/>',
    computador: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20h8M12 16v4"/>', celular: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/>',
    so_texto: '<path d="M5 6h14M5 10h14M5 14h9M5 18h11"/>',
  };
  const ic = (k) => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[k]}</svg>`;

  const TIPOS = {
    titulo: { rotulo: 'Título', desc: 'Frase curta em destaque' },
    texto: { rotulo: 'Texto', desc: 'Parágrafos com negrito, itálico, link e lista' },
    imagem: { rotulo: 'Imagem', desc: 'Foto, banner ou GIF, com link opcional' },
    botao: { rotulo: 'Botão', desc: 'Chamada para clicar, com link' },
    imgtexto: { rotulo: 'Imagem com texto', desc: 'Imagem de um lado e texto do outro' },
    divisoria: { rotulo: 'Divisória', desc: 'Linha fina separando partes' },
    espaco: { rotulo: 'Espaço', desc: 'Respiro vertical' },
  };

  // Imagens de exemplo da biblioteca (o desenho da biblioteca é a issue 390).
  const svgImg = (w, h, fundo, cor, texto) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="${fundo}"/><text x="50%" y="50%" fill="${cor}" font-family="Arial" font-size="${Math.round(h / 9)}" font-weight="700" text-anchor="middle" dominant-baseline="middle">${texto}</text></svg>`);
  const BIBLIOTECA = [
    { id: 'logo', nome: 'Logo Atacado Exponencial', url: '/email/logo.png', w: 600, h: 140, peso: '18 KB' },
    { id: 'workshop', nome: 'Banner workshop 05-11', url: svgImg(1200, 630, '#161513', '#f5f0eb', 'WORKSHOP AO VIVO · 05/11'), w: 1200, h: 630, peso: '212 KB' },
    { id: 'felipe', nome: 'Felipe no palco', url: svgImg(800, 800, '#b8ada1', '#161513', 'FELIPE SANTOS'), w: 800, h: 800, peso: '164 KB' },
    { id: 'gif', nome: 'Contagem animada (GIF)', url: svgImg(600, 200, '#f5f0eb', '#161513', 'GIF ANIMADO'), w: 600, h: 200, peso: '640 KB', gif: true },
    { id: 'logo-branca', nome: 'Logo branca', url: svgImg(600, 140, '#1e1e1e', '#ffffff', 'atacado exponencial'), w: 600, h: 140, peso: '9 KB' },
  ];
  const imagem = (id) => BIBLIOTECA.find((i) => i.id === id) || null;

  // Cabeçalho: uma faixa no topo montada com os mesmos blocos do corpo. O padrão
  // vem da Configuração (desenhado na 390); "Personalizado" usa os blocos do
  // próprio modelo, marcados com zona "cab" (sempre no começo da lista).
  const CAB_PADRAO = { fundo: '', blocos: [{ tipo: 'imagem', img: 'logo', alt: 'Atacado Exponencial', largura: 'px', px: 150, alinh: 'esquerda', link: 'https://atacadoexponencial.com' }] };

  let seq = 0;
  const novoId = () => `b${Date.now().toString(36)}${(seq++).toString(36)}`;
  function blocoNovo(tipo) {
    const b = { id: novoId(), tipo };
    if (tipo === 'titulo') Object.assign(b, { texto: '', tam: 'grande', alinh: 'esquerda', cor: '#161513' });
    if (tipo === 'texto') Object.assign(b, { html: '', alinh: 'esquerda', cor: '#222222', corLink: '#161513' });
    if (tipo === 'imagem') Object.assign(b, { img: null, alt: '', largura: 'toda', px: 200, alinh: 'centro', link: '' });
    if (tipo === 'botao') Object.assign(b, { texto: 'Quero minha vaga', link: '', estilo: 'cheio', alinh: 'esquerda', fundo: '#161513', corTexto: '#ffffff' });
    if (tipo === 'imgtexto') Object.assign(b, { img: null, alt: '', html: '', lado: 'esquerda', link: '', cor: '#222222', corLink: '#161513' });
    if (tipo === 'divisoria') Object.assign(b, { cor: '#e5e2da' });
    if (tipo === 'espaco') Object.assign(b, { altura: 'medio' });
    return b;
  }

  function exemplo() {
    const b = (tipo, extra) => Object.assign(blocoNovo(tipo), extra);
    return {
      nome: 'Convite workshop 05/11', assunto: '{{primeiro_nome}}, sua vaga no workshop de quarta', previa: 'Três horas para destravar a primeira compra do seu atacado.',
      cab: { modo: 'padrao', fundo: '' },
      fundo: { fora: '#f3f1ec', conteudo: '#ffffff' },
      blocos: [
        b('imagem', { img: 'workshop', alt: 'Workshop ao vivo no dia 05/11', link: 'https://atacadoexponencial.com/workshop-gratuito' }),
        b('titulo', { texto: 'Oi, {{primeiro_nome}}! Quarta tem workshop ao vivo' }),
        b('texto', { html: '<p>Na <b>quarta, 05/11, às 20h</b>, o Felipe abre o método que as marcas atacadistas usam para vender para lojistas todo mês.</p><ul><li>Como montar o catálogo da primeira compra</li><li>O que dizer no primeiro contato com o lojista</li></ul>' }),
        b('botao', { texto: 'Quero minha vaga', link: 'https://atacadoexponencial.com/workshop-gratuito', alinh: 'centro' }),
        b('espaco', { altura: 'pequeno' }),
        b('divisoria'),
        b('imgtexto', { img: 'felipe', alt: 'Felipe Santos', html: '<p><b>Quem conduz:</b> Felipe Santos, que ajudou mais de 300 marcas a sair do varejo e entrar no atacado.</p>' }),
        b('texto', { html: '<p>Te espero lá,<br>Felipe</p>' }),
      ],
    };
  }

  // ---------------------------------------------------------------------------
  // Montagem do e-mail (só para a prévia do protótipo)
  // ---------------------------------------------------------------------------
  const FONTE = "font-family:Arial,Helvetica,sans-serif";
  const preencher = (s) => String(s ?? '').replace(MARCADOR, (t, n) => (n in EXEMPLO ? esc(EXEMPLO[n]) : `<mark style="background:#fbe3e0;color:#b3261e">{{${esc(n)}}}</mark>`));
  const preencherTexto = (s) => String(s ?? '').replace(MARCADOR, (t, n) => (n in EXEMPLO ? EXEMPLO[n] : `{{${n}}}`));
  const ALTURA = { pequeno: 12, medio: 24, grande: 48 };
  const ALINH = { esquerda: 'left', centro: 'center', direita: 'right' };

  // Texto rico: só o que o e-mail aceita (p, br, b, i, a, ul, li), estilos inline.
  function htmlTexto(html, cor, corLink) {
    const d = document.createElement('div');
    d.innerHTML = limpar(html);
    d.querySelectorAll('p').forEach((p) => p.setAttribute('style', 'margin:0 0 14px'));
    d.querySelectorAll('ul').forEach((u) => u.setAttribute('style', 'margin:0 0 14px;padding-left:22px'));
    d.querySelectorAll('li').forEach((l) => l.setAttribute('style', 'margin:0 0 6px'));
    d.querySelectorAll('a').forEach((a) => a.setAttribute('style', `color:${corLink};text-decoration:underline`));
    return preencher(d.innerHTML).replace(/&amp;(?=[a-z]+;)/g, '&') || `<span style="color:${cor};opacity:.5">Texto vazio</span>`;
  }

  function imagemHtml(b, maxW) {
    const im = imagem(b.img);
    if (!im) return `<div style="border:1px dashed #c9c2b6;padding:28px 12px;text-align:center;${FONTE};font-size:13px;color:#8a837a">Escolha uma imagem</div>`;
    const w = b.largura === 'metade' ? Math.round(maxW / 2) : b.largura === 'original' ? Math.min(im.w, maxW) : b.largura === 'px' ? Math.min(Number(b.px) || 200, maxW) : maxW;
    const img = `<img src="${esc(im.url)}" width="${w}" alt="${esc(preencherTexto(b.alt))}" style="display:block;width:100%;max-width:${w}px;height:auto;border:0;${b.alinh === 'centro' ? 'margin:0 auto' : b.alinh === 'direita' ? 'margin-left:auto' : ''}">`;
    return b.link ? `<a href="${esc(b.link)}" target="_blank">${img}</a>` : img;
  }

  function blocoHtml(b) {
    const pad = 'padding:0 28px 16px';
    if (b.tipo === 'titulo') return `<td style="${pad};${FONTE};text-align:${ALINH[b.alinh]};color:${b.cor};font-size:${b.tam === 'grande' ? 26 : 20}px;line-height:1.25;font-weight:700">${preencher(esc(b.texto)) || '<span style="opacity:.5">Título vazio</span>'}</td>`;
    if (b.tipo === 'texto') return `<td style="${pad};${FONTE};text-align:${ALINH[b.alinh]};color:${b.cor};font-size:15px;line-height:1.6">${htmlTexto(b.html, b.cor, b.corLink)}</td>`;
    if (b.tipo === 'imagem') return `<td style="${pad}">${imagemHtml(b, 544)}</td>`;
    if (b.tipo === 'botao') {
      const cheio = b.estilo === 'cheio';
      const larga = b.alinh === 'toda';
      return `<td style="${pad};text-align:${larga ? 'center' : ALINH[b.alinh]}"><a href="${esc(b.link || '#')}" target="_blank" style="display:${larga ? 'block' : 'inline-block'};${FONTE};font-size:15px;font-weight:700;text-decoration:none;padding:13px 26px;border-radius:3px;${cheio ? `background:${b.fundo};color:${b.corTexto};border:2px solid ${b.fundo}` : `background:transparent;color:${b.fundo};border:2px solid ${b.fundo}`}">${preencher(esc(b.texto)) || 'Botão'}</a></td>`;
    }
    if (b.tipo === 'divisoria') return `<td style="padding:4px 28px 20px"><div style="border-top:1px solid ${b.cor};font-size:0;line-height:0">&nbsp;</div></td>`;
    if (b.tipo === 'espaco') return `<td style="height:${ALTURA[b.altura]}px;font-size:0;line-height:0">&nbsp;</td>`;
    if (b.tipo === 'imgtexto') {
      const img = `<td class="eb-col" width="50%" valign="top" style="padding:0 ${b.lado === 'esquerda' ? '10px 0 0' : '0 0 10px'}">${imagemHtml({ ...b, largura: 'toda', alinh: 'centro' }, 262)}</td>`;
      const txt = `<td class="eb-col" width="50%" valign="top" style="${FONTE};font-size:15px;line-height:1.6;color:${b.cor};padding:0 ${b.lado === 'esquerda' ? '0 0 10px' : '10px 0 0'}">${htmlTexto(b.html, b.cor, b.corLink)}</td>`;
      return `<td style="${pad}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${b.lado === 'esquerda' ? img + txt : txt + img}</tr></table></td>`;
    }
    return '<td></td>';
  }

  const doCab = (b) => b.zona === 'cab';
  // Blocos que aparecem: os do cabeçalho só quando ele é personalizado.
  const visiveis = () => E.blocos.filter((b) => !doCab(b) || E.cab.modo === 'proprio');
  const blocosCab = () => E.blocos.filter(doCab);
  const blocosCorpo = () => E.blocos.filter((b) => !doCab(b));
  function ordenar() { E.blocos = [...blocosCab(), ...blocosCorpo()]; }

  const linhaBloco = (b, sel) => `<tr data-b="${b.id}" draggable="true" class="${b.id === sel ? 'eb-sel' : ''}">${blocoHtml(b)}</tr>`;
  function cabecalhoHtml(E, sel) {
    const marca = sel === 'cab' ? ' eb-sel' : '';
    if (E.cab.modo === 'sem') return `<tr data-cabeca class="eb-sem-cab${marca}"><td style="padding:8px 28px;${FONTE};font-size:12px;color:#8a837a;text-align:center;border-bottom:1px dashed #d9d3c9">Sem cabeçalho · clique para mudar (esta faixa só aparece na prévia)</td></tr>`;
    const proprio = E.cab.modo === 'proprio';
    const fundo = proprio ? E.cab.fundo : CAB_PADRAO.fundo;
    const bg = fundo ? `background:${fundo};` : '';
    const blocos = proprio ? blocosCab() : CAB_PADRAO.blocos;
    // A faixa: respiro em cima, os blocos (com o fundo da faixa) e respiro embaixo.
    const linhas = blocos.map((b) => (proprio ? linhaBloco(b, sel) : `<tr data-cabeca class="${marca.trim()}">${blocoHtml(b)}</tr>`))
      .map((tr) => tr.replace(/<td style="/g, `<td style="${bg}`)).join('');
    const vazio = proprio && !blocos.length ? `<tr data-vazio-cab><td style="${bg}padding:18px 28px;${FONTE};font-size:13px;color:#8a837a;text-align:center;border:1px dashed #d9d3c9">Cabeçalho vazio: arraste um bloco para cá ou use o "+" na lista</td></tr>` : '';
    return `<tr data-cabeca class="${marca.trim()}"><td style="${bg}height:20px;font-size:0;line-height:0">&nbsp;</td></tr>${linhas}${vazio}<tr><td style="${bg}height:4px;font-size:0;line-height:0">&nbsp;</td></tr><tr><td style="height:16px;font-size:0;line-height:0">&nbsp;</td></tr>`;
  }

  function montar(E, sel) {
    const blocos = blocosCorpo().map((b) => linhaBloco(b, sel)).join('');
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0}[data-b],[data-cabeca]{cursor:pointer}[data-b]:hover>td{outline:1px dashed #b8ada1;outline-offset:-1px}.eb-sel>td{outline:2px solid #161513!important;outline-offset:-2px}
[data-b]{cursor:grab}.eb-antes>td{box-shadow:inset 0 4px 0 #161513}.eb-depois>td{box-shadow:inset 0 -4px 0 #161513}.eb-troca img{outline:4px solid #161513;outline-offset:-4px}.eb-arrastando{opacity:.4}
.eb-vazio-alvo td{outline:2px dashed #161513;outline-offset:-6px}
@media (max-width:480px){.eb-col{display:block!important;width:100%!important;padding:0 0 12px!important}}</style></head>
<body style="background:${E.fundo.fora}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${E.fundo.fora}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:${E.fundo.conteudo};border:1px solid #e5e2da;border-radius:4px;overflow:hidden">
${cabecalhoHtml(E, sel)}${blocos || `<tr data-vazio><td style="padding:40px 28px;text-align:center;${FONTE};color:#8a837a">Nenhum bloco ainda. Arraste um bloco da paleta para cá.</td></tr>`}
<tr><td style="padding:16px 28px 24px;border-top:1px solid #eeeae2;${FONTE};font-size:12px;line-height:1.5;color:#888888">Atacado Exponencial · rodapé comum da Configuração<br><br><a href="#" style="color:#888888">Não quero mais receber estes e-mails</a></td></tr>
</table></td></tr></table></body></html>`;
  }

  // Versão só texto, gerada dos blocos (spec, módulo 5).
  function soTexto(E) {
    const txt = (html) => { const d = document.createElement('div'); d.innerHTML = limpar(html).replace(/<\/p>|<br>|<\/li>/g, '\n').replace(/<li>/g, '• '); d.querySelectorAll('a').forEach((a) => { a.textContent = `${a.textContent} (${a.getAttribute('href')})`; }); return d.textContent.trim(); };
    const cab = E.cab.modo === 'proprio' ? blocosCab() : E.cab.modo === 'padrao' ? CAB_PADRAO.blocos : [];
    const partes = [...cab, ...blocosCorpo()].map((b) => {
      if (b.tipo === 'titulo') return preencherTexto(b.texto).toUpperCase();
      if (b.tipo === 'texto') return preencherTexto(txt(b.html));
      if (b.tipo === 'imagem') return b.img ? `[${preencherTexto(b.alt) || 'imagem'}]${b.link ? ` ${b.link}` : ''}` : '';
      if (b.tipo === 'botao') return `${preencherTexto(b.texto)}: ${b.link}`;
      if (b.tipo === 'imgtexto') return `${b.img ? `[${preencherTexto(b.alt) || 'imagem'}]\n` : ''}${preencherTexto(txt(b.html))}`;
      if (b.tipo === 'divisoria') return '----------';
      return '';
    }).filter(Boolean);
    return partes.join('\n\n') + '\n\n--\nAtacado Exponencial · rodapé comum da Configuração\nPara não receber mais estes e-mails: (link de descadastro)';
  }

  // ---------------------------------------------------------------------------
  // Texto rico: o que entra no estado é só o que o e-mail aceita.
  // ---------------------------------------------------------------------------
  function limpar(html) {
    const d = document.createElement('div');
    d.innerHTML = html || '';
    const OK = { P: 'p', BR: 'br', B: 'b', STRONG: 'b', I: 'i', EM: 'i', A: 'a', UL: 'ul', LI: 'li', DIV: 'p' };
    const andar = (no) => {
      [...no.childNodes].forEach((f) => {
        if (f.nodeType === 3) return;
        if (f.nodeType !== 1) { f.remove(); return; }
        andar(f);
        const t = OK[f.tagName];
        if (!t) { f.replaceWith(...f.childNodes); return; }
        const n = document.createElement(t);
        if (t === 'a') n.setAttribute('href', f.getAttribute('href') || '');
        n.append(...f.childNodes);
        f.replaceWith(n);
      });
    };
    andar(d);
    return d.innerHTML.replace(/<p><\/p>/g, '');
  }

  // ---------------------------------------------------------------------------
  // Avisos (spec, módulo 1): no bloco e na lista do topo. Só "modelo sem bloco"
  // impede salvar; os outros avisam.
  // ---------------------------------------------------------------------------
  const linkOk = (u) => /^https?:\/\/[^\s.]+\.[^\s]+$/.test(String(u).trim()) || /^\{\{\s*[a-z_]+\s*\}\}$/.test(String(u).trim());
  function luminancia(hex) {
    const n = hex.replace('#', '');
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  const contraste = (a, b) => { const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  function camposRuins(...textos) {
    const ruins = new Set();
    textos.forEach((t) => { for (const m of String(t ?? '').matchAll(MARCADOR)) if (!(m[1] in EXEMPLO)) ruins.add(m[1]); });
    return [...ruins];
  }
  function avisosDoBloco(b) {
    const a = [];
    const links = [];
    if (b.tipo === 'titulo' && !b.texto.trim()) a.push('Título vazio');
    if ((b.tipo === 'texto' || b.tipo === 'imgtexto') && !limpar(b.html).replace(/<[^>]+>/g, '').trim()) a.push('Texto vazio');
    if (b.tipo === 'imagem' || b.tipo === 'imgtexto') {
      if (!b.img) a.push('Imagem não escolhida');
      else if (!b.alt.trim()) a.push('Imagem sem texto alternativo');
      if (b.link) links.push(b.link);
    }
    if (b.tipo === 'botao') {
      if (!b.link.trim()) a.push('Botão sem link'); else links.push(b.link);
      if (b.estilo === 'cheio' && contraste(b.fundo, b.corTexto) < 4.5) a.push(`Pouco contraste entre o texto e o fundo do botão (${contraste(b.fundo, b.corTexto).toFixed(1)}:1; o mínimo de leitura é 4,5:1)`);
    }
    // Texto contra o fundo onde ele está (faixa do cabeçalho ou área do conteúdo).
    if (['titulo', 'texto', 'imgtexto'].includes(b.tipo) && b.cor) {
      const fundo = (b.zona === 'cab' && E.cab.fundo) || E.fundo.conteudo;
      const minimo = b.tipo === 'titulo' ? 3 : 4.5;
      if (/^#[0-9a-f]{6}$/i.test(fundo) && contraste(b.cor, fundo) < minimo) a.push(`Pouco contraste entre o texto e o fundo (${contraste(b.cor, fundo).toFixed(1)}:1; o mínimo de leitura é ${minimo === 3 ? '3' : '4,5'}:1). Troque a cor do texto ou do fundo`);
    }
    if (b.html) { const d = document.createElement('div'); d.innerHTML = b.html; d.querySelectorAll('a').forEach((x) => links.push(x.getAttribute('href') || '')); }
    links.filter((u) => !linkOk(u)).forEach((u) => a.push(`Link inválido: "${u || 'vazio'}"`));
    camposRuins(b.texto, b.html, b.alt, b.link).forEach((c) => a.push(`Campo desconhecido: {{${c}}}`));
    return a;
  }

  // ---------------------------------------------------------------------------
  // Tela
  // ---------------------------------------------------------------------------
  let E, salvo, sel, desfazer, refazer, tamanho, ctx, U, ultimoCampo, recentes = [];
  let raiz, voltarLista, previaTimer, digitandoTimer;
  let arrastandoTipo = null; // tipo vindo da paleta (o dado só é legível ao soltar)

  const snap = () => JSON.stringify(E);
  const sujo = () => snap() !== salvo;
  function guardar() {
    desfazer.push(snap());
    if (desfazer.length > 80) desfazer.shift();
    refazer = [];
  }
  // Digitação vira um passo de desfazer só depois de uma pausa.
  function guardarDigitando() {
    if (!digitandoTimer) guardar();
    clearTimeout(digitandoTimer);
    digitandoTimer = setTimeout(() => { digitandoTimer = null; }, 800);
  }
  function mudou({ pilha = true } = {}) {
    if (pilha) desenharPilha();
    agendarPrevia();
    desenharAvisos();
    raiz.querySelector('[data-sujo]').hidden = !sujo();
  }

  function prototipo(el, opcoes) {
    raiz = el; ctx = opcoes.ctx; U = opcoes.util; voltarLista = opcoes.voltar;
    E = exemplo(); salvo = snap(); sel = E.blocos[1].id; desfazer = []; refazer = []; tamanho = 'computador'; ultimoCampo = null;
    el.innerHTML = `
      <div class="em-proto" role="note"><span class="em-proto__selo">Protótipo</span><span>Editor novo por blocos, com dados de exemplo. Nada aqui é salvo nem enviado.</span></div>
      <div class="em-barra"><button class="btn sec em-voltar" type="button" data-voltar>${ic('voltar')} Modelos</button>
        <div class="ag-acoes"><span class="mini eb-sujo" data-sujo hidden>Mudanças não salvas</span>
          <button class="ag-icone" type="button" data-desfazer aria-label="Desfazer (Ctrl+Z)" title="Desfazer (Ctrl+Z)">${ic('desfazer')}</button>
          <button class="ag-icone" type="button" data-refazer aria-label="Refazer (Ctrl+Y)" title="Refazer (Ctrl+Y)">${ic('refazer')}</button>
          <button class="btn sec" type="button" data-teste>Mandar teste</button><button class="btn sec" type="button" data-dup>Duplicar</button><button class="btn" type="button" data-salvar>Salvar</button></div></div>
      <div class="eb">
        <div class="eb-editor">
          <form class="ag-form" onsubmit="return false">
            <div class="linha"><label>Nome<input type="text" data-e="nome" maxlength="100"></label>
              <label>Canal<input type="text" value="Marketing (news.)" disabled></label></div>
            <label>Assunto<input type="text" data-e="assunto" maxlength="200"></label>
            <label>Texto de pré-visualização<input type="text" data-e="previa" maxlength="200"></label>
          </form>
          <div class="eb-avisos" id="eb-avisos" aria-live="polite"></div>
          <section class="eb-secao" aria-labelledby="eb-blocos-t"><h3 class="ag-h3" id="eb-blocos-t">Cabeçalho e blocos <span class="mini">arraste pela alça ou use as setas</span></h3>
            <ol class="eb-pilha" id="eb-pilha"></ol></section>
          <section class="eb-secao" aria-labelledby="eb-fundo-t"><h3 class="ag-h3" id="eb-fundo-t">Fundo do e-mail</h3><div id="eb-fundo" class="eb-duas"></div></section>
          <section class="eb-secao eb-campos" aria-labelledby="eb-campos-t"><h3 class="ag-h3" id="eb-campos-t">Campos <span class="mini">clique para inserir onde está o cursor</span></h3>
            <div class="ag-etiquetas">${CAMPOS.map(([c, r]) => `<button type="button" class="ag-etiqueta eb-campo" data-campo="${c}" title="${esc(r)}">{{${c}}}</button>`).join('')}</div></section>
        </div>
        <div class="eb-previa">
          <div class="em-barra em-barra--previa"><span class="ag-campo__rotulo">Prévia com dados de exemplo <span class="mini">clique num bloco para editar</span></span>
            <div class="em-tamanho" role="group" aria-label="Tamanho da prévia">
              <button type="button" class="ag-icone" data-tam="computador" aria-pressed="true" aria-label="Computador" title="Computador">${ic('computador')}</button>
              <button type="button" class="ag-icone" data-tam="celular" aria-pressed="false" aria-label="Celular" title="Celular">${ic('celular')}</button>
              <button type="button" class="ag-icone" data-tam="texto" aria-pressed="false" aria-label="Versão só texto" title="Versão só texto">${ic('so_texto')}</button></div></div>
          <div class="eb-paleta" role="group" aria-label="Blocos para arrastar até o e-mail"><span class="mini">Arraste para o e-mail:</span>${Object.entries(TIPOS).map(([k, t]) => `<button type="button" class="eb-paleta__item" draggable="true" data-paleta="${k}" title="Arraste até o ponto do e-mail, ou clique para pôr no fim">${ic(k)} ${t.rotulo}</button>`).join('')}</div>
          <div class="eb-caixa" id="eb-caixa"></div>
          <div class="eb-moldura" id="eb-moldura"><p class="eb-dica mini">Arraste um bloco para mudar de lugar, solte uma imagem do computador ou um bloco da paleta.</p><iframe id="eb-frame" title="Prévia do e-mail" scrolling="no"></iframe><pre class="eb-texto" id="eb-texto" hidden></pre></div>
        </div>
      </div>`;

    el.querySelectorAll('[data-e]').forEach((i) => {
      i.value = E[i.dataset.e];
      i.addEventListener('focus', () => { ultimoCampo = i; });
      i.addEventListener('input', () => { guardarDigitando(); E[i.dataset.e] = i.value; mudou({ pilha: false }); });
    });
    el.querySelector('[data-voltar]').onclick = (ev) => {
      if (!sujo()) return voltarLista();
      ctx.pedirConfirmacao(ev.currentTarget, 'Sair sem salvar? As mudanças deste modelo se perdem.', () => { voltarLista(); return true; }, [{ valor: true, rotulo: 'Descartar e sair' }]);
    };
    el.querySelector('[data-salvar]').onclick = () => {
      if (!blocosCorpo().length) return U.avisar('Não dá para salvar um modelo sem nenhum bloco. Adicione pelo menos um.', 'erro');
      salvo = snap(); mudou({ pilha: false });
      U.avisar('Protótipo: nada foi salvo. No editor de verdade, este modelo é usado em "Boas-vindas do workshop" (fluxo) e o aviso aparece antes de salvar.');
    };
    el.querySelector('[data-teste]').onclick = () => U.avisar('Protótipo: no editor de verdade, o teste sai com o que está na tela, mesmo sem salvar.');
    el.querySelector('[data-dup]').onclick = () => U.avisar('Protótipo: duplicar leva blocos, cabeçalho e cores para uma cópia.');
    el.querySelector('[data-desfazer]').onclick = () => voltar(desfazer, refazer);
    el.querySelector('[data-refazer]').onclick = () => voltar(refazer, desfazer);
    el.querySelectorAll('[data-tam]').forEach((b) => { b.onclick = () => { tamanho = b.dataset.tam; el.querySelectorAll('[data-tam]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); desenharPrevia(); }; });
    el.querySelectorAll('[data-campo]').forEach((b) => {
      b.addEventListener('mousedown', (ev) => ev.preventDefault()); // não tira o foco do campo
      b.onclick = () => inserirCampo(b.dataset.campo);
    });
    const frame = el.querySelector('#eb-frame');
    frame.addEventListener('load', () => {
      const doc = frame.contentDocument;
      if (!doc) return;
      doc.addEventListener('click', (ev) => {
        ev.preventDefault();
        if (ev.target.closest('[data-cabeca], [data-vazio-cab]')) { selecionar('cab'); const c = raiz.querySelector('[data-card="cab"]'); if (c) c.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return; }
        const tr = ev.target.closest('[data-b]');
        if (tr) { selecionar(tr.dataset.b); const card = raiz.querySelector(`[data-card="${tr.dataset.b}"]`); if (card) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
      });
      ligarArrastarNaPrevia(doc);
      ajustarAltura();
      // A altura acompanha o e-mail (imagens carregando, celular): sem rolagem dupla.
      const RO = frame.contentWindow && frame.contentWindow.ResizeObserver;
      if (RO && doc.body) new RO(ajustarAltura).observe(doc.body);
    });
    document.removeEventListener('keydown', teclas);
    document.addEventListener('keydown', teclas);
    el.querySelectorAll('[data-paleta]').forEach((b) => {
      b.addEventListener('dragstart', (ev) => { ev.dataTransfer.effectAllowed = 'copy'; ev.dataTransfer.setData('text/plain', 'bloco:' + b.dataset.paleta); arrastandoTipo = b.dataset.paleta; });
      b.addEventListener('dragend', () => { arrastandoTipo = null; });
      b.onclick = () => { inserirBloco(b.dataset.paleta, E.blocos.length, { zona: 'corpo' }); };
    });

    desenharCabecalho();
    desenharFundo();
    desenharPilha();
    desenharAvisos();
    desenharPrevia();
  }

  function teclas(ev) {
    if (!raiz || !raiz.isConnected) { document.removeEventListener('keydown', teclas); return; }
    if (!(ev.ctrlKey || ev.metaKey)) return;
    const k = ev.key.toLowerCase();
    if (ev.target.closest && ev.target.closest('[contenteditable="true"], input, textarea') && (k === 'z' || k === 'y')) {
      // dentro de um campo, o desfazer do próprio campo vale primeiro
      return;
    }
    if (k === 'z' && !ev.shiftKey) { ev.preventDefault(); voltar(desfazer, refazer); }
    if (k === 'y' || (k === 'z' && ev.shiftKey)) { ev.preventDefault(); voltar(refazer, desfazer); }
  }

  function voltar(de, para) {
    if (!de.length) return U.avisar('Nada para ' + (de === desfazer ? 'desfazer.' : 'refazer.'));
    para.push(snap());
    E = JSON.parse(de.pop());
    if (sel !== 'cab' && !E.blocos.some((b) => b.id === sel)) sel = null;
    raiz.querySelectorAll('[data-e]').forEach((i) => { i.value = E[i.dataset.e]; });
    desenharCabecalho(); desenharFundo(); mudou();
  }

  // --- cabeçalho (modo do modelo; o padrão é desenhado na 390) ---
  function desenharCabecalho() {
    const alvo = raiz.querySelector('#eb-cab');
    if (!alvo) return;
    const c = E.cab;
    const MODOS = [['padrao', 'Padrão da Configuração'], ['proprio', 'Personalizado'], ['sem', 'Sem cabeçalho']];
    alvo.innerHTML = `<div class="ag-subvistas" role="radiogroup" aria-label="Cabeçalho deste modelo">${MODOS.map(([k, r]) => `<button type="button" class="ag-subvista" role="radio" data-cab-modo="${k}" aria-checked="${c.modo === k}" aria-pressed="${c.modo === k}">${r}</button>`).join('')}</div>
      ${c.modo === 'padrao' ? '<p class="mini">Usa o cabeçalho da Configuração (hoje, a logo à esquerda). Mudar lá muda todos os modelos que usam o padrão.</p><div><button type="button" class="btn sec" data-cab-personalizar>Personalizar a partir do padrão</button></div>' : ''}
      ${c.modo === 'sem' ? '<p class="mini">O e-mail começa direto no primeiro bloco do corpo.</p>' : ''}
      ${c.modo === 'proprio' ? `<p class="mini">Monte a faixa com os mesmos blocos do corpo: logo, texto, links, botão, imagem com texto. Os blocos do cabeçalho aparecem logo abaixo deste cartão; arraste blocos entre o cabeçalho e o corpo à vontade.</p>
        ${seletorCor('Fundo da faixa', c.fundo || '', 'cab-fundo', true)}` : ''}`;
    const personalizar = () => {
      if (!blocosCab().length) {
        E.blocos.unshift(...CAB_PADRAO.blocos.map((b) => ({ ...JSON.parse(JSON.stringify(b)), id: novoId(), zona: 'cab' })));
        if (!c.fundo) c.fundo = CAB_PADRAO.fundo;
      }
      c.modo = 'proprio';
    };
    alvo.querySelectorAll('[data-cab-modo]').forEach((b) => {
      b.onclick = () => { guardar(); if (b.dataset.cabModo === 'proprio') personalizar(); else c.modo = b.dataset.cabModo; mudou(); };
    });
    const bp = alvo.querySelector('[data-cab-personalizar]');
    if (bp) bp.onclick = () => { guardar(); personalizar(); mudou(); U.avisar('Cabeçalho personalizado: começou igual ao padrão. Edite, adicione ou tire blocos.'); };
    ligarCor(alvo, 'cab-fundo', (v) => { c.fundo = v; });
  }

  function desenharFundo() {
    const alvo = raiz.querySelector('#eb-fundo');
    alvo.innerHTML = seletorCor('Em volta do e-mail', E.fundo.fora, 'fundo-fora') + seletorCor('Área do conteúdo', E.fundo.conteudo, 'fundo-conteudo');
    ligarCor(alvo, 'fundo-fora', (v) => { E.fundo.fora = v; });
    ligarCor(alvo, 'fundo-conteudo', (v) => { E.fundo.conteudo = v; });
  }

  // --- pilha de blocos ---
  function resumo(b) {
    const t = (html) => limpar(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (b.tipo === 'titulo') return b.texto || 'vazio';
    if (b.tipo === 'texto') return t(b.html) || 'vazio';
    if (b.tipo === 'imagem') return imagem(b.img) ? imagem(b.img).nome : 'sem imagem';
    if (b.tipo === 'botao') return `${b.texto || 'sem texto'} → ${b.link || 'sem link'}`;
    if (b.tipo === 'imgtexto') return `${imagem(b.img) ? imagem(b.img).nome : 'sem imagem'} · ${t(b.html) || 'sem texto'}`;
    if (b.tipo === 'divisoria') return 'linha';
    if (b.tipo === 'espaco') return { pequeno: 'pequeno', medio: 'médio', grande: 'grande' }[b.altura];
    return '';
  }
  const rotuloBloco = (b) => {
    const iguais = visiveis().filter((x) => x.tipo === b.tipo);
    return iguais.length > 1 ? `${TIPOS[b.tipo].rotulo} ${iguais.indexOf(b) + 1}` : TIPOS[b.tipo].rotulo;
  };

  function cartaoBloco(b, primeiro, ultimo) {
    const av = avisosDoBloco(b);
    const aberto = b.id === sel;
    return `<li class="eb-card${aberto ? ' eb-card--aberto' : ''}${av.length ? ' eb-card--aviso' : ''}${doCab(b) ? ' eb-card--do-cab' : ''}" data-card="${b.id}">
        <div class="eb-card__topo" draggable="true" data-arrastar="${b.id}">
          <span class="eb-alca" aria-hidden="true" title="Arraste para mudar de lugar">${ic('alca')}</span>
          <button type="button" class="eb-card__abrir" data-sel="${b.id}" aria-expanded="${aberto}">
            <span class="eb-card__tipo">${ic(b.tipo)} ${esc(rotuloBloco(b))}</span>
            <span class="eb-card__resumo">${esc(preencherTexto(resumo(b)))}</span></button>
          ${av.length ? `<span class="carimbo alerta eb-card__selo" title="${esc(av.join(' · '))}">Revisar</span>` : ''}
          <span class="eb-card__acoes">
            <button type="button" class="ag-icone" data-mover="-1" data-id="${b.id}" aria-label="Subir ${esc(rotuloBloco(b))}"${primeiro ? ' disabled' : ''}>${ic('subir')}</button>
            <button type="button" class="ag-icone" data-mover="1" data-id="${b.id}" aria-label="Descer ${esc(rotuloBloco(b))}"${ultimo ? ' disabled' : ''}>${ic('descer')}</button>
            <button type="button" class="ag-icone" data-duplicar="${b.id}" aria-label="Duplicar ${esc(rotuloBloco(b))}">${ic('copiar')}</button>
            <button type="button" class="ag-icone" data-apagar="${b.id}" aria-label="Apagar ${esc(rotuloBloco(b))}">${ic('apagar')}</button></span>
        </div>
        ${aberto ? `<div class="eb-card__corpo">${av.length ? `<ul class="eb-card__avisos">${av.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}${campos(b)}</div>` : ''}
      </li>`;
  }

  function desenharPilha() {
    const p = raiz.querySelector('#eb-pilha');
    const inserir = (pos, zona) => `<li class="eb-inserir"><button type="button" class="eb-inserir__b" data-inserir="${pos}" data-zona="${zona}" aria-label="Adicionar bloco ${zona === 'cab' ? 'no cabeçalho' : 'no corpo'}">${ic('mais')}</button></li>`;
    const cab = E.cab;
    const proprio = cab.modo === 'proprio';
    const nCab = blocosCab().length;
    const resumoCab = cab.modo === 'sem' ? 'sem cabeçalho' : cab.modo === 'padrao' ? 'padrão da Configuração · logo' : `personalizado · ${nCab} ${nCab === 1 ? 'bloco' : 'blocos'}`;
    const cartaoCab = `<li class="eb-card eb-card--cab${sel === 'cab' ? ' eb-card--aberto' : ''}${cab.modo === 'sem' ? ' eb-card--sem' : ''}" data-card="cab">
        <div class="eb-card__topo"><span class="eb-alca eb-alca--fixa" aria-hidden="true" title="O cabeçalho fica sempre no topo">${ic('imagem')}</span>
          <button type="button" class="eb-card__abrir" data-sel="cab" aria-expanded="${sel === 'cab'}"><span class="eb-card__tipo">Cabeçalho</span><span class="eb-card__resumo">${esc(resumoCab)}</span></button>
          <span class="eb-card__acoes">${cab.modo === 'sem'
            ? '<button type="button" class="btn sec eb-cab-volta" data-cab-volta>Pôr de volta</button>'
            : `<button type="button" class="ag-icone" data-cab-tirar aria-label="Tirar o cabeçalho deste e-mail" title="Tirar o cabeçalho">${ic('apagar')}</button>`}</span></div>
        ${sel === 'cab' ? '<div class="eb-card__corpo"><div id="eb-cab"></div></div>' : ''}</li>`;
    const lista = (blocos, zona) => blocos.map((b, i) => inserir(E.blocos.indexOf(b), zona) + cartaoBloco(b, i === 0, i === blocos.length - 1)).join('');
    const cabs = blocosCab(), corpo = blocosCorpo();
    const fimCab = cabs.length ? E.blocos.indexOf(cabs[cabs.length - 1]) + 1 : 0;
    p.innerHTML = cartaoCab
      + (proprio ? `<li class="eb-zona eb-zona--cab"><ol class="eb-zona__lista">${lista(cabs, 'cab')}<li class="eb-fim eb-fim--cab"><button type="button" class="btn sec" data-inserir="${fimCab}" data-zona="cab">${ic('mais')} Adicionar ao cabeçalho</button></li></ol></li>` : '')
      + '<li class="eb-zona__rotulo">Corpo do e-mail</li>'
      + lista(corpo, 'corpo')
      + `<li class="eb-fim"><button type="button" class="btn sec" data-inserir="${E.blocos.length}" data-zona="corpo">${ic('mais')} Adicionar bloco</button></li>`;

    p.querySelectorAll('[data-sel]').forEach((b) => { b.onclick = () => selecionar(sel === b.dataset.sel ? null : b.dataset.sel); });
    const tirar = p.querySelector('[data-cab-tirar]');
    if (tirar) tirar.onclick = () => { guardar(); E.cab.antes = E.cab.modo; E.cab.modo = 'sem'; mudou(); U.avisar('Cabeçalho tirado deste e-mail. "Pôr de volta" ou Ctrl+Z desfaz.'); };
    const volta = p.querySelector('[data-cab-volta]');
    if (volta) volta.onclick = () => { guardar(); E.cab.modo = E.cab.antes && E.cab.antes !== 'sem' ? E.cab.antes : 'padrao'; mudou(); };
    if (sel === 'cab') desenharCabecalho();
    p.querySelectorAll('[data-mover]').forEach((b) => { b.onclick = () => mover(b.dataset.id, Number(b.dataset.mover)); });
    p.querySelectorAll('[data-duplicar]').forEach((b) => { b.onclick = () => { guardar(); const i = E.blocos.findIndex((x) => x.id === b.dataset.duplicar); const c = { ...JSON.parse(JSON.stringify(E.blocos[i])), id: novoId() }; E.blocos.splice(i + 1, 0, c); sel = c.id; mudou(); U.avisar('Bloco duplicado logo abaixo.'); }; });
    p.querySelectorAll('[data-apagar]').forEach((b) => { b.onclick = () => { guardar(); const i = E.blocos.findIndex((x) => x.id === b.dataset.apagar); const nome = rotuloBloco(E.blocos[i]); E.blocos.splice(i, 1); if (sel === b.dataset.apagar) sel = null; mudou(); U.avisar(`${nome} apagado. Ctrl+Z desfaz.`); }; });
    p.querySelectorAll('[data-inserir]').forEach((b) => { b.onclick = (ev) => abrirTipos(ev.currentTarget, Number(b.dataset.inserir), b.dataset.zona); });
    ligarArrastar(p);
    const b = E.blocos.find((x) => x.id === sel);
    if (b) ligarCampos(p.querySelector(`[data-card="${b.id}"] .eb-card__corpo`), b);
  }

  function selecionar(id) { sel = id; desenharPilha(); agendarPrevia(); }
  function mover(id, d) {
    const b = E.blocos.find((x) => x.id === id);
    const zona = doCab(b) ? blocosCab() : blocosCorpo();
    const k = zona.indexOf(b) + d;
    if (k < 0 || k >= zona.length) return;
    const i = E.blocos.indexOf(b), j = E.blocos.indexOf(zona[k]);
    guardar();
    [E.blocos[i], E.blocos[j]] = [E.blocos[j], E.blocos[i]];
    mudou();
    const bt = raiz.querySelector(`[data-mover="${d}"][data-id="${id}"]`);
    if (bt && !bt.disabled) bt.focus();
  }

  function ligarArrastar(p) {
    let arrastando = null;
    p.querySelectorAll('[data-arrastar]').forEach((h) => {
      h.addEventListener('dragstart', (ev) => { arrastando = h.dataset.arrastar; ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData('text/plain', arrastando); h.closest('.eb-card').classList.add('eb-card--arrastando'); });
      h.addEventListener('dragend', () => { arrastando = null; p.querySelectorAll('.eb-card').forEach((c) => c.classList.remove('eb-card--arrastando', 'eb-alvo-antes', 'eb-alvo-depois')); });
    });
    p.querySelectorAll('.eb-card:not(.eb-card--cab), .eb-card--cab').forEach((c) => {
      c.addEventListener('dragover', (ev) => {
        if (!arrastando) return;
        ev.preventDefault();
        const r = c.getBoundingClientRect();
        const antes = ev.clientY < r.top + r.height / 2;
        p.querySelectorAll('.eb-card').forEach((x) => x.classList.remove('eb-alvo-antes', 'eb-alvo-depois'));
        c.classList.add(antes ? 'eb-alvo-antes' : 'eb-alvo-depois');
      });
      c.addEventListener('drop', (ev) => {
        ev.preventDefault();
        if (!arrastando || arrastando === c.dataset.card) return;
        const antes = c.classList.contains('eb-alvo-antes');
        guardar();
        const de = E.blocos.findIndex((x) => x.id === arrastando);
        const [b] = E.blocos.splice(de, 1);
        if (c.dataset.card === 'cab') { b.zona = 'cab'; E.blocos.unshift(b); if (E.cab.modo !== 'proprio') E.cab.modo = 'proprio'; ordenar(); mudou(); return; }
        const alvoB = E.blocos.find((x) => x.id === c.dataset.card);
        if (doCab(alvoB)) b.zona = 'cab'; else delete b.zona;
        let para = E.blocos.indexOf(alvoB);
        if (!antes) para += 1;
        E.blocos.splice(para, 0, b);
        ordenar();
        mudou();
      });
    });
  }

  // Lista de tipos para adicionar bloco (no lugar do botão, como o menu do dash).
  function abrirTipos(botao, pos, zona = 'corpo') {
    fecharTipos();
    const m = document.createElement('div');
    m.className = 'eb-tipos';
    m.setAttribute('role', 'menu');
    m.innerHTML = `<p class="mini">Adicionar ${zona === 'cab' ? 'ao cabeçalho' : 'bloco'}</p>${Object.entries(TIPOS).map(([k, t]) => `<button type="button" role="menuitem" data-tipo="${k}">${ic(k)}<span><b>${t.rotulo}</b><span class="mini">${t.desc}</span></span></button>`).join('')}`;
    botao.closest('li').appendChild(m);
    m.querySelector('button').focus();
    m.addEventListener('keydown', (ev) => {
      const itens = [...m.querySelectorAll('[data-tipo]')];
      const i = itens.indexOf(document.activeElement);
      if (ev.key === 'Escape') { fecharTipos(); botao.focus(); }
      if (ev.key === 'ArrowDown') { ev.preventDefault(); itens[(i + 1) % itens.length].focus(); }
      if (ev.key === 'ArrowUp') { ev.preventDefault(); itens[(i - 1 + itens.length) % itens.length].focus(); }
    });
    m.querySelectorAll('[data-tipo]').forEach((b) => {
      b.onclick = () => { fecharTipos(); inserirBloco(b.dataset.tipo, pos, { focar: true, zona }); };
    });
    setTimeout(() => document.addEventListener('click', foraTipos), 0);
  }
  function inserirBloco(tipo, pos, { focar = false, extra = null, zona = 'corpo' } = {}) {
    guardar();
    const n = Object.assign(blocoNovo(tipo), extra || {});
    if (zona === 'cab') { n.zona = 'cab'; E.cab.modo = 'proprio'; }
    E.blocos.splice(pos, 0, n);
    ordenar();
    sel = n.id;
    mudou();
    const card = raiz.querySelector(`[data-card="${n.id}"]`);
    if (card) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    if (focar) { const f = raiz.querySelector(`[data-card="${n.id}"] input, [data-card="${n.id}"] [contenteditable]`); if (f) f.focus(); }
    return n;
  }

  // Arrastar e soltar dentro da prévia (o e-mail): reordenar blocos, soltar um
  // bloco da paleta e soltar imagem do computador (em cima de uma imagem, troca;
  // entre blocos, cria um bloco de imagem ali).
  function ligarArrastarNaPrevia(doc) {
    let movendo = null;
    const limpar = () => doc.querySelectorAll('.eb-antes, .eb-depois, .eb-troca, .eb-vazio-alvo').forEach((x) => x.classList.remove('eb-antes', 'eb-depois', 'eb-troca', 'eb-vazio-alvo'));
    // Onde cai: índice na pilha e, para arquivo, o bloco de imagem embaixo do ponteiro.
    const alvo = (ev) => {
      const tr = ev.target.closest && ev.target.closest('[data-b]');
      if (!tr) {
        const vazioCab = ev.target.closest && ev.target.closest('[data-vazio-cab]');
        if (vazioCab) return { pos: 0, zona: 'cab', tr: vazioCab, vazio: true };
        const vazio = ev.target.closest && ev.target.closest('[data-vazio]');
        if (vazio) return { pos: E.blocos.length, zona: 'corpo', tr: vazio, vazio: true };
        // Em cima da faixa do cabeçalho padrão ou acima de tudo: começo do corpo.
        const primeiro = doc.querySelector('[data-b]');
        const antesDoPrimeiro = primeiro && ev.clientY < primeiro.getBoundingClientRect().top;
        if (antesDoPrimeiro) { const b0 = E.blocos.find((b) => b.id === primeiro.dataset.b); return { pos: E.blocos.indexOf(b0), zona: doCab(b0) ? 'cab' : 'corpo', tr: primeiro, antes: true }; }
        const ultimos = doc.querySelectorAll('[data-b]');
        return { pos: E.blocos.length, zona: 'corpo', tr: ultimos[ultimos.length - 1], antes: false };
      }
      const r = tr.getBoundingClientRect();
      const antes = ev.clientY < r.top + r.height / 2;
      const b = E.blocos.find((x) => x.id === tr.dataset.b);
      const i = E.blocos.indexOf(b);
      const sobreImagem = ev.target.tagName === 'IMG' && (b.tipo === 'imagem' || b.tipo === 'imgtexto');
      return { pos: antes ? i : i + 1, zona: doCab(b) ? 'cab' : 'corpo', tr, antes, bloco: b, sobreImagem };
    };
    const tipoDoArraste = (ev) => {
      const tipos = [...(ev.dataTransfer?.types || [])];
      if (tipos.includes('Files')) return 'arquivo';
      if (movendo) return 'mover';
      if (arrastandoTipo) return 'paleta';
      return null;
    };
    doc.addEventListener('dragstart', (ev) => {
      const tr = ev.target.closest && ev.target.closest('[data-b]');
      if (!tr) return;
      movendo = tr.dataset.b;
      ev.dataTransfer.effectAllowed = 'move';
      ev.dataTransfer.setData('text/plain', 'mover:' + movendo);
      tr.classList.add('eb-arrastando');
    });
    doc.addEventListener('dragend', () => { movendo = null; limpar(); doc.querySelectorAll('.eb-arrastando').forEach((x) => x.classList.remove('eb-arrastando')); });
    doc.addEventListener('dragover', (ev) => {
      const t = tipoDoArraste(ev);
      if (!t) return;
      ev.preventDefault();
      ev.dataTransfer.dropEffect = t === 'mover' ? 'move' : 'copy';
      limpar();
      const a = alvo(ev);
      if (a.vazio) { a.tr.classList.add('eb-vazio-alvo'); return; }
      if (t === 'arquivo' && a.sobreImagem) { a.tr.classList.add('eb-troca'); return; }
      if (a.tr) a.tr.classList.add(a.antes ? 'eb-antes' : 'eb-depois');
    });
    doc.addEventListener('dragleave', (ev) => { if (!ev.relatedTarget) limpar(); });
    doc.addEventListener('drop', (ev) => {
      const t = tipoDoArraste(ev);
      if (!t) return;
      ev.preventDefault();
      const a = alvo(ev);
      limpar();
      if (t === 'mover') {
        const de = E.blocos.findIndex((b) => b.id === movendo);
        let para = a.pos;
        movendo = null;
        const mesmaFaixa = de >= 0 && (doCab(E.blocos[de]) ? 'cab' : 'corpo') === a.zona;
        if (de < 0 || (mesmaFaixa && (para === de || para === de + 1))) return;
        guardar();
        const [b] = E.blocos.splice(de, 1);
        if (para > de) para -= 1;
        if (a.zona === 'cab') b.zona = 'cab'; else delete b.zona;
        E.blocos.splice(para, 0, b);
        ordenar();
        sel = b.id;
        mudou();
        return;
      }
      if (t === 'paleta') {
        const tipo = (ev.dataTransfer.getData('text/plain') || '').replace(/^bloco:/, '') || arrastandoTipo;
        arrastandoTipo = null;
        if (TIPOS[tipo]) inserirBloco(tipo, a.pos, { focar: true, zona: a.zona });
        return;
      }
      const f = ev.dataTransfer.files[0];
      lerImagem(f, (nova) => {
        if (a.sobreImagem) { guardar(); a.bloco.img = nova.id; sel = a.bloco.id; mudou(); return; }
        inserirBloco('imagem', a.pos, { extra: { img: nova.id }, zona: a.zona });
      });
    });
  }

  function foraTipos(ev) { if (!ev.target.closest('.eb-tipos')) fecharTipos(); }
  function fecharTipos() { document.querySelectorAll('.eb-tipos').forEach((m) => m.remove()); document.removeEventListener('click', foraTipos); }

  // --- campos de cada tipo ---
  function alinhamento(atual, chave, opcoes) {
    const R = { esquerda: 'Esquerda', centro: 'Centro', direita: 'Direita', toda: 'Largura toda' };
    return `<div class="ag-campo"><span class="ag-campo__rotulo">Alinhamento</span><div class="ag-subvistas" role="radiogroup" aria-label="Alinhamento">${opcoes.map((o) => `<button type="button" class="ag-subvista" role="radio" data-${chave}="${o}" aria-checked="${o === atual}" aria-pressed="${o === atual}">${R[o]}</button>`).join('')}</div></div>`;
  }
  function ligarAlinhamento(alvo, chave, fn) {
    alvo.querySelectorAll(`[data-${chave}]`).forEach((b) => {
      b.onclick = () => {
        guardar(); fn(b.getAttribute(`data-${chave}`));
        alvo.querySelectorAll(`[data-${chave}]`).forEach((x) => { x.setAttribute('aria-pressed', String(x === b)); x.setAttribute('aria-checked', String(x === b)); });
        mudou({ pilha: false });
      };
    });
  }
  function opcoesRadio(rotulo, atual, chave, ops) {
    return `<div class="ag-campo"><span class="ag-campo__rotulo">${rotulo}</span><div class="ag-subvistas" role="radiogroup" aria-label="${rotulo}">${ops.map(([v, r]) => `<button type="button" class="ag-subvista" role="radio" data-${chave}="${v}" aria-checked="${v === atual}" aria-pressed="${v === atual}">${r}</button>`).join('')}</div></div>`;
  }

  // Cor: paleta livre, código, atalhos da marca e últimas usadas (spec, módulo 2).
  function seletorCor(rotulo, valor, chave, permiteSem) {
    const v = valor || '';
    const sw = (c, nome) => `<button type="button" class="eb-amostra" data-cor-${chave}="${c}" style="background:${c}" aria-label="${esc(nome)} ${c}" title="${esc(nome)} ${c}"></button>`;
    return `<div class="ag-campo eb-cor"><span class="ag-campo__rotulo">${rotulo}</span>
      <div class="eb-cor__linha"><input type="color" value="${v || '#ffffff'}" data-cor-paleta-${chave} aria-label="${rotulo}: escolher na paleta"><input type="text" class="eb-cor__hex" value="${v}" maxlength="7" data-cor-hex-${chave} aria-label="${rotulo}: código da cor" placeholder="${permiteSem ? 'sem fundo' : '#000000'}" spellcheck="false">
        ${permiteSem ? `<button type="button" class="ag-link-linha mini" data-cor-${chave}="">Sem fundo</button>` : ''}</div>
      <div class="eb-cor__amostras"><span class="mini">Marca</span>${MARCA.map(([c, n]) => sw(c, n)).join('')}${recentes.length ? `<span class="mini">Últimas</span>${recentes.map((c) => sw(c, 'Usada há pouco')).join('')}` : ''}</div></div>`;
  }
  function ligarCor(alvo, chave, fn) {
    const aplicar = (c, { lembrar = true } = {}) => {
      guardarDigitando(); fn(c);
      const hex = alvo.querySelector(`[data-cor-hex-${chave}]`);
      const pal = alvo.querySelector(`[data-cor-paleta-${chave}]`);
      if (hex && document.activeElement !== hex) hex.value = c;
      if (pal && c) pal.value = c;
      if (lembrar && c && !MARCA.some(([m]) => m === c)) { recentes = [c, ...recentes.filter((x) => x !== c)].slice(0, 6); }
      mudou({ pilha: false });
    };
    const pal = alvo.querySelector(`[data-cor-paleta-${chave}]`);
    if (pal) { pal.addEventListener('input', () => aplicar(pal.value, { lembrar: false })); pal.addEventListener('change', () => aplicar(pal.value)); }
    const hex = alvo.querySelector(`[data-cor-hex-${chave}]`);
    if (hex) hex.addEventListener('input', () => { const v = hex.value.trim(); if (/^#[0-9a-f]{6}$/i.test(v)) aplicar(v.toLowerCase()); });
    alvo.querySelectorAll(`[data-cor-${chave}]`).forEach((b) => { b.onclick = () => aplicar(b.getAttribute(`data-cor-${chave}`)); });
  }

  // Escolha de imagem: "Subir imagem" e "Escolher da biblioteca" sempre à vista;
  // sem imagem, a área aceita arrastar o arquivo. Na biblioteca, o primeiro
  // quadrado também sobe.
  function escolhaImagem(id, chave) {
    const im = imagem(id);
    return `<div class="ag-campo"><span class="ag-campo__rotulo">Imagem</span>
      ${im
        ? `<div class="eb-img-escolhida" data-solta-${chave}><img src="${esc(im.url)}" alt=""><span><b>${esc(im.nome)}</b><span class="mini">${im.w} × ${im.h} px · ${im.peso}${im.gif ? ' · GIF animado' : ''}</span></span></div>`
        : `<div class="eb-solta" data-solta-${chave}>${ic('imagem')}<span><b>Arraste uma imagem aqui</b><span class="mini">JPG, PNG, GIF ou WebP, até 1 MB · largura ideal de 600 a 1200 px</span></span></div>`}
      <div class="eb-img-acoes"><button type="button" class="btn" data-subir-${chave}>${ic('mais')} ${im ? 'Subir outra imagem' : 'Subir imagem'}</button>
        <button type="button" class="btn sec" data-escolher-${chave} aria-expanded="false">Escolher da biblioteca</button></div>
      <div class="eb-biblio" data-biblio-${chave} hidden>
        <p class="mini eb-biblio__topo">Biblioteca de imagens · clique numa imagem para usar</p>
        <div class="eb-biblio__grade"><button type="button" class="eb-biblio__item eb-biblio__subir" data-subir-${chave}>${ic('mais')}<span>Subir imagem</span></button>${BIBLIOTECA.map((x) => `<button type="button" class="eb-biblio__item${x.id === id ? ' eb-biblio__item--atual' : ''}" data-img-${chave}="${x.id}" aria-label="${esc(x.nome)}"><img src="${esc(x.url)}" alt=""><span>${esc(x.nome)}</span></button>`).join('')}</div></div></div>`;
  }
  function ligarEscolhaImagem(alvo, chave, fn) {
    const bt = alvo.querySelector(`[data-escolher-${chave}]`);
    const caixa = alvo.querySelector(`[data-biblio-${chave}]`);
    if (!bt) return;
    bt.onclick = () => { caixa.hidden = !caixa.hidden; bt.setAttribute('aria-expanded', String(!caixa.hidden)); if (!caixa.hidden) caixa.querySelector('[data-img-' + chave + ']').focus(); };
    alvo.querySelectorAll(`[data-img-${chave}]`).forEach((b) => { b.onclick = () => { guardar(); fn(b.getAttribute(`data-img-${chave}`)); mudou(); }; });
    const subir = (f) => lerImagem(f, (nova) => {
      guardar(); fn(nova.id);
      if (chave === 'cab') desenharCabecalho();
      mudou();
    });
    alvo.querySelectorAll(`[data-subir-${chave}]`).forEach((b) => {
      b.onclick = () => {
        const inp = document.createElement('input');
        inp.type = 'file';
        inp.accept = 'image/jpeg,image/png,image/gif,image/webp';
        inp.onchange = () => subir(inp.files[0]);
        inp.click();
      };
    });
    const zona = alvo.querySelector(`[data-solta-${chave}]`);
    if (zona) {
      zona.addEventListener('dragover', (ev) => { if ([...ev.dataTransfer.types].includes('Files')) { ev.preventDefault(); zona.classList.add('eb-solta--sobre'); } });
      zona.addEventListener('dragleave', () => zona.classList.remove('eb-solta--sobre'));
      zona.addEventListener('drop', (ev) => { ev.preventDefault(); zona.classList.remove('eb-solta--sobre'); subir(ev.dataTransfer.files[0]); });
    }
  }

  // Subir: a imagem entra na biblioteca e `pronta` recebe a ficha. No protótipo
  // ela fica só neste navegador (não sobe para o servidor).
  function lerImagem(f, pronta) {
    if (!f) return;
    if (!/^image\/(jpeg|png|gif|webp)$/.test(f.type)) return U.avisar('Formato não aceito. Use JPG, PNG, GIF ou WebP.', 'erro');
    if (f.size > 1024 * 1024) return U.avisar(`A imagem tem ${(f.size / 1024 / 1024).toFixed(1).replace('.', ',')} MB e o limite é 1 MB. Exporte menor e tente de novo.`, 'erro');
    const leitor = new FileReader();
    leitor.onload = () => {
      const img = new Image();
      img.onload = () => {
        const nova = { id: novoId(), nome: f.name.replace(/\.[^.]+$/, ''), url: leitor.result, w: img.naturalWidth, h: img.naturalHeight, peso: `${Math.max(1, Math.round(f.size / 1024))} KB`, gif: f.type === 'image/gif' };
        BIBLIOTECA.unshift(nova);
        pronta(nova);
        U.avisar(nova.w > 1200 ? `Imagem na biblioteca e no e-mail. Ela tem ${nova.w} px de largura: acima de 1200 px, vale reduzir (no e-mail ela aparece reduzida).` : 'Imagem na biblioteca e no e-mail.');
      };
      img.src = leitor.result;
    };
    leitor.readAsDataURL(f);
  }

  function textoRico(html, chave) {
    return `<div class="ag-campo"><span class="ag-campo__rotulo">Texto</span>
      <div class="eb-rico__barra" role="toolbar" aria-label="Formatação do texto">
        <button type="button" class="ag-icone eb-fmt" data-fmt="bold" aria-label="Negrito" title="Negrito (Ctrl+B)"><b>N</b></button>
        <button type="button" class="ag-icone eb-fmt" data-fmt="italic" aria-label="Itálico" title="Itálico (Ctrl+I)"><i>I</i></button>
        <button type="button" class="ag-icone eb-fmt eb-fmt--txt" data-fmt="link" aria-label="Transformar em link" title="Transformar o trecho em link">Link</button>
        <button type="button" class="ag-icone eb-fmt eb-fmt--txt" data-fmt="unlink" aria-label="Tirar o link" title="Tirar o link do trecho">Tirar link</button>
        <button type="button" class="ag-icone eb-fmt eb-fmt--txt" data-fmt="insertUnorderedList" aria-label="Lista com marcadores" title="Lista com marcadores">Lista</button></div>
      <div class="eb-rico" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Texto do bloco" data-rico="${chave}">${limpar(html) || '<p><br></p>'}</div>
      <div class="eb-link" data-link-caixa hidden><input type="url" placeholder="https:// ou {{campo}}" aria-label="Endereço do link"><button type="button" class="btn sec" data-link-ok>Aplicar</button><button type="button" class="ag-link-linha" data-link-nao>Cancelar</button></div></div>`;
  }
  function ligarTextoRico(corpo, fn) {
    const r = corpo.querySelector('[data-rico]');
    if (!r) return;
    r.addEventListener('focus', () => { ultimoCampo = r; });
    r.addEventListener('input', () => { guardarDigitando(); fn(limpar(r.innerHTML)); mudou({ pilha: false }); atualizarResumo(); });
    let faixa = null;
    const caixa = corpo.querySelector('[data-link-caixa]');
    corpo.querySelectorAll('[data-fmt]').forEach((b) => {
      b.addEventListener('mousedown', (ev) => ev.preventDefault());
      b.onclick = () => {
        r.focus();
        if (b.dataset.fmt === 'link') {
          const s = window.getSelection();
          if (!s.rangeCount || s.isCollapsed) return U.avisar('Selecione o trecho que vai virar link.', 'erro');
          faixa = s.getRangeAt(0).cloneRange();
          caixa.hidden = false;
          caixa.querySelector('input').value = '';
          caixa.querySelector('input').focus();
          return;
        }
        document.execCommand(b.dataset.fmt, false, null);
        r.dispatchEvent(new Event('input'));
      };
    });
    if (caixa) {
      const aplicar = () => {
        const url = caixa.querySelector('input').value.trim();
        caixa.hidden = true;
        r.focus();
        if (faixa) { const s = window.getSelection(); s.removeAllRanges(); s.addRange(faixa); }
        if (url) { document.execCommand('createLink', false, url); r.dispatchEvent(new Event('input')); }
      };
      caixa.querySelector('[data-link-ok]').onclick = aplicar;
      caixa.querySelector('input').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); aplicar(); } if (ev.key === 'Escape') { caixa.hidden = true; r.focus(); } });
      caixa.querySelector('[data-link-nao]').onclick = () => { caixa.hidden = true; r.focus(); };
    }
  }

  function campos(b) {
    const inp = (rot, chave, extra = '') => `<label>${rot}<input type="text" data-b-campo="${chave}" value="${esc(b[chave])}" ${extra}></label>`;
    if (b.tipo === 'titulo') return `${inp('Texto do título', 'texto', 'maxlength="150"')}
      ${opcoesRadio('Tamanho', b.tam, 'b-tam', [['grande', 'Grande'], ['medio', 'Médio']])}
      ${alinhamento(b.alinh, 'b-alinh', ['esquerda', 'centro'])}${seletorCor('Cor', b.cor, 'b-cor')}`;
    if (b.tipo === 'texto') return `${textoRico(b.html, b.id)}${alinhamento(b.alinh, 'b-alinh', ['esquerda', 'centro'])}
      <div class="eb-duas">${seletorCor('Cor do texto', b.cor, 'b-cor')}${seletorCor('Cor dos links', b.corLink, 'b-corlink')}</div>`;
    if (b.tipo === 'imagem') return `${escolhaImagem(b.img, 'b-img')}
      <label>Texto alternativo <span class="mini">o que aparece se a imagem não carregar e o que o leitor de tela lê</span><input type="text" data-b-campo="alt" value="${esc(b.alt)}" maxlength="200"></label>
      ${opcoesRadio('Largura', b.largura, 'b-larg', [['toda', 'Largura toda'], ['metade', 'Metade'], ['original', 'Tamanho original'], ['px', 'Personalizada']])}
      ${b.largura === 'px' ? `<label>Largura <span class="mini" data-b-px-rot>${b.px} px</span><input type="range" min="40" max="544" step="2" value="${b.px}" data-b-px></label>` : ''}
      ${b.largura === 'toda' ? '' : alinhamento(b.alinh, 'b-alinh', ['esquerda', 'centro', 'direita'])}
      <label>Link ao clicar <span class="mini">opcional</span><input type="url" data-b-campo="link" value="${esc(b.link)}" placeholder="https://"></label>`;
    if (b.tipo === 'botao') return `${inp('Texto do botão', 'texto', 'maxlength="60"')}
      <label>Link <span class="mini">aceita campo, ex.: {{link_reuniao}} no transacional</span><input type="url" data-b-campo="link" value="${esc(b.link)}" placeholder="https://"></label>
      ${opcoesRadio('Estilo', b.estilo, 'b-estilo', [['cheio', 'Cheio'], ['contorno', 'Contorno']])}
      ${alinhamento(b.alinh, 'b-alinh', ['esquerda', 'centro', 'toda'])}
      <div class="eb-duas">${seletorCor(b.estilo === 'cheio' ? 'Cor de fundo' : 'Cor do contorno e do texto', b.fundo, 'b-fundo')}${b.estilo === 'cheio' ? seletorCor('Cor do texto', b.corTexto, 'b-cortexto') : ''}</div>`;
    if (b.tipo === 'imgtexto') return `${escolhaImagem(b.img, 'b-img')}
      <label>Texto alternativo da imagem<input type="text" data-b-campo="alt" value="${esc(b.alt)}" maxlength="200"></label>
      ${opcoesRadio('Imagem fica', b.lado, 'b-lado', [['esquerda', 'À esquerda'], ['direita', 'À direita']])}
      ${textoRico(b.html, b.id)}<div class="eb-duas">${seletorCor('Cor do texto', b.cor, 'b-cor')}${seletorCor('Cor dos links', b.corLink, 'b-corlink')}</div>
      <p class="mini">No celular, a imagem fica em cima e o texto embaixo.</p>`;
    if (b.tipo === 'divisoria') return seletorCor('Cor da linha', b.cor, 'b-cor');
    if (b.tipo === 'espaco') return opcoesRadio('Altura', b.altura, 'b-altura', [['pequeno', 'Pequeno'], ['medio', 'Médio'], ['grande', 'Grande']]);
    return '';
  }

  function atualizarResumo() {
    const b = E.blocos.find((x) => x.id === sel);
    const c = b && raiz.querySelector(`[data-card="${b.id}"] .eb-card__resumo`);
    if (c) c.textContent = preencherTexto(resumo(b));
  }

  function ligarCampos(corpo, b) {
    if (!corpo) return;
    corpo.querySelectorAll('[data-b-campo]').forEach((i) => {
      i.addEventListener('focus', () => { ultimoCampo = i; });
      i.addEventListener('input', () => { guardarDigitando(); b[i.dataset.bCampo] = i.value; mudou({ pilha: false }); atualizarResumo(); });
      i.addEventListener('change', () => desenharPilhaMantendoFoco(i.dataset.bCampo));
    });
    const radio = (chave, prop, redesenhar) => {
      corpo.querySelectorAll(`[data-${chave}]`).forEach((x) => {
        x.onclick = () => {
          guardar(); b[prop] = x.getAttribute(`data-${chave}`);
          if (redesenhar) return mudou();
          corpo.querySelectorAll(`[data-${chave}]`).forEach((y) => { y.setAttribute('aria-pressed', String(y === x)); y.setAttribute('aria-checked', String(y === x)); });
          mudou({ pilha: false }); atualizarResumo();
        };
      });
    };
    const px = corpo.querySelector('[data-b-px]');
    if (px) px.addEventListener('input', () => { guardarDigitando(); b.px = Number(px.value); corpo.querySelector('[data-b-px-rot]').textContent = `${px.value} px`; mudou({ pilha: false }); });
    radio('b-tam', 'tam'); radio('b-larg', 'largura', true); radio('b-estilo', 'estilo', true); radio('b-lado', 'lado'); radio('b-altura', 'altura');
    ligarAlinhamento(corpo, 'b-alinh', (v) => { b.alinh = v; });
    ligarCor(corpo, 'b-cor', (v) => { b.cor = v; });
    ligarCor(corpo, 'b-corlink', (v) => { b.corLink = v; });
    ligarCor(corpo, 'b-fundo', (v) => { b.fundo = v; });
    ligarCor(corpo, 'b-cortexto', (v) => { b.corTexto = v; });
    ligarEscolhaImagem(corpo, 'b-img', (id) => { b.img = id; if (!b.alt) b.alt = ''; });
    ligarTextoRico(corpo, (html) => { b.html = html; });
  }
  // Depois de sair de um campo, os avisos do cartão se atualizam sem perder o lugar.
  function desenharPilhaMantendoFoco() {
    const ativo = document.activeElement;
    if (ativo && ativo.closest && ativo.closest('#eb-pilha')) return setTimeout(() => { if (!raiz.querySelector('#eb-pilha').contains(document.activeElement)) desenharPilha(); }, 0);
    desenharPilha();
  }

  function inserirCampo(c) {
    const alvo = ultimoCampo && ultimoCampo.isConnected ? ultimoCampo : null;
    if (!alvo) return U.avisar('Clique no texto onde o campo deve entrar e depois no campo.', 'erro');
    const t = `{{${c}}}`;
    alvo.focus();
    if (alvo.isContentEditable) document.execCommand('insertText', false, t);
    else { alvo.setRangeText(t, alvo.selectionStart ?? alvo.value.length, alvo.selectionEnd ?? alvo.value.length, 'end'); alvo.dispatchEvent(new Event('input')); }
  }

  // --- avisos do topo ---
  function desenharAvisos() {
    const alvo = raiz.querySelector('#eb-avisos');
    const itens = [];
    if (!blocosCorpo().length) itens.push({ txt: 'O corpo do e-mail não tem nenhum bloco. Sem bloco, não dá para salvar.', id: null });
    camposRuins(E.assunto, E.previa).forEach((c) => itens.push({ txt: `Assunto ou pré-visualização: campo desconhecido {{${c}}}`, id: null }));
    visiveis().forEach((b) => avisosDoBloco(b).forEach((a) => itens.push({ txt: `${doCab(b) ? 'Cabeçalho, ' : ''}${rotuloBloco(b)}: ${a}`, id: b.id })));
    alvo.innerHTML = itens.length ? `<div class="aviso alerta eb-avisos__caixa"><b>Antes de salvar, confira:</b><ul>${itens.map((i) => `<li>${i.id ? `<button type="button" class="ag-link-linha" data-ir-bloco="${i.id}">${esc(i.txt)}</button>` : esc(i.txt)}</li>`).join('')}</ul></div>` : '';
    alvo.querySelectorAll('[data-ir-bloco]').forEach((b) => { b.onclick = () => { selecionar(b.dataset.irBloco); raiz.querySelector(`[data-card="${b.dataset.irBloco}"]`).scrollIntoView({ block: 'center', behavior: 'smooth' }); }; });
  }

  // --- prévia ---
  function agendarPrevia() { clearTimeout(previaTimer); previaTimer = setTimeout(desenharPrevia, 120); }
  function desenharPrevia() {
    const moldura = raiz.querySelector('#eb-moldura');
    const frame = raiz.querySelector('#eb-frame');
    const texto = raiz.querySelector('#eb-texto');
    raiz.querySelector('#eb-caixa').innerHTML = `<div class="eb-entrada"><span class="eb-entrada__de"><b>Felipe Santos | Atacado Exponencial</b> <span class="mini">felipe@news.atacadoexponencial.com</span></span><span class="eb-entrada__assunto"><b>${esc(preencherTexto(E.assunto) || '(sem assunto)')}</b> <span class="mini">${esc(preencherTexto(E.previa))}</span></span></div>`;
    moldura.classList.toggle('eb-moldura--celular', tamanho === 'celular');
    texto.hidden = tamanho !== 'texto';
    frame.hidden = tamanho === 'texto';
    if (tamanho === 'texto') { texto.textContent = soTexto(E); return; }
    const y = frame.contentWindow ? frame.contentWindow.scrollY : 0;
    frame.srcdoc = montar(E, sel);
    frame.addEventListener('load', () => { if (frame.contentWindow) frame.contentWindow.scrollTo(0, y); }, { once: true });
  }
  function ajustarAltura() {
    const frame = raiz.querySelector('#eb-frame');
    const doc = frame.contentDocument;
    if (doc && doc.body) frame.style.height = Math.max(420, doc.body.scrollHeight) + 'px';
  }

  window.EmailBlocos = { prototipo };
})();
