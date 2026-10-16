// Formatação da descrição do tipo de agenda. Um único lugar para a página
// pública (/agendar/<tipo>) e a prévia do dash mostrarem o texto igual.
//
// Marcas, sem aninhar:
//   **negrito**   *itálico*   __sublinhado__
//   linha que começa com "- " vira item de lista com marcador
//
// Monta os nós um a um (nada de innerHTML), então o texto nunca vira HTML.

const MARCAS = /\*\*(.+?)\*\*|__(.+?)__|\*(.+?)\*/g;

/** Trechos de uma linha: [{ texto, estilo: '' | 'negrito' | 'italico' | 'sublinhado' }]. */
export function trechos(linha) {
  const saida = [];
  let ultimo = 0;
  for (const m of String(linha).matchAll(MARCAS)) {
    if (m.index > ultimo) saida.push({ texto: linha.slice(ultimo, m.index), estilo: '' });
    const estilo = m[1] !== undefined ? 'negrito' : m[2] !== undefined ? 'sublinhado' : 'italico';
    saida.push({ texto: m[1] ?? m[2] ?? m[3], estilo });
    ultimo = m.index + m[0].length;
  }
  if (ultimo < linha.length) saida.push({ texto: linha.slice(ultimo), estilo: '' });
  return saida;
}

const ITEM = /^\s*[-•]\s+/;

/** Blocos do texto: [{ tipo: 'texto', linhas: [...] } | { tipo: 'lista', itens: [...] }]. */
export function blocos(texto) {
  const saida = [];
  for (const linha of String(texto || '').replace(/\r\n?/g, '\n').split('\n')) {
    const tipo = ITEM.test(linha) ? 'lista' : 'texto';
    let atual = saida[saida.length - 1];
    if (!atual || atual.tipo !== tipo) { atual = tipo === 'lista' ? { tipo, itens: [] } : { tipo, linhas: [] }; saida.push(atual); }
    if (tipo === 'lista') atual.itens.push(linha.replace(ITEM, ''));
    else atual.linhas.push(linha);
  }
  // Linhas em branco encostadas numa lista não viram espaço extra.
  return saida
    .map((b) => {
      if (b.tipo !== 'texto') return b;
      const linhas = [...b.linhas];
      while (linhas.length && !linhas[0].trim()) linhas.shift();
      while (linhas.length && !linhas[linhas.length - 1].trim()) linhas.pop();
      return { tipo: 'texto', linhas };
    })
    .filter((b) => b.tipo === 'lista' || b.linhas.length);
}

const TAG = { negrito: 'strong', italico: 'em', sublinhado: 'u' };

function preencherLinha(doc, el, linha) {
  for (const t of trechos(linha)) {
    if (!t.estilo) { el.appendChild(doc.createTextNode(t.texto)); continue; }
    const forte = doc.createElement(TAG[t.estilo]);
    forte.textContent = t.texto;
    el.appendChild(forte);
  }
}

/** Troca o conteúdo de `el` pela descrição formatada. */
export function desenharDescricao(el, texto) {
  const doc = el.ownerDocument;
  el.replaceChildren();
  for (const b of blocos(texto)) {
    if (b.tipo === 'lista') {
      const ul = doc.createElement('ul');
      for (const item of b.itens) { const li = doc.createElement('li'); preencherLinha(doc, li, item); ul.appendChild(li); }
      el.appendChild(ul);
    } else {
      const p = doc.createElement('p');
      preencherLinha(doc, p, b.linhas.join('\n'));
      el.appendChild(p);
    }
  }
}
