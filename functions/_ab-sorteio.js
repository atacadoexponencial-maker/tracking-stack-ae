// Escolha da variante do teste A/B, isolada e PURA: sem I/O, sem D1, sem env.
// Mesmo padrão de functions/_links-destino.js.
//
// O sorteio é DETERMINÍSTICO em cima do session_id, não Math.random(). Duas
// razões: (1) requisições simultâneas do mesmo visitante poderiam receber
// variantes diferentes antes do cookie existir; (2) a variante continua a
// mesma se o cookie de variante se perder, porque ela é uma função do
// visitante — o cookie é só atalho.
//
// Prefixo "_": o Cloudflare Pages não transforma o arquivo em rota.

// FNV-1a de 32 bits. Escolhido por ser curto, sem dependência e com
// distribuição boa o bastante para repartir tráfego — não é hash
// criptográfico, e não precisa ser.
export function hashSessao(sessionId, slug) {
  const texto = `${sessionId}:${slug}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Devolve 'a' em toda situação duvidosa (teste inexistente, fora do ar,
// malformado, sem sessão). 'a' é a página que já estava no ar, então falhar
// para 'a' é falhar para o comportamento atual do site — nunca para uma tela
// quebrada.
export function escolherVariante(teste, sessionId) {
  if (!teste || teste.status !== 'ativo' || !sessionId) return 'a';

  const lista = Array.isArray(teste.variantes) ? teste.variantes : [];
  const a = lista.find((v) => v && v.chave === 'a');
  const b = lista.find((v) => v && v.chave === 'b');
  if (!a || !b) return 'a';

  const pesoA = Number(a.peso);
  const pesoB = Number(b.peso);
  if (!Number.isFinite(pesoA) || !Number.isFinite(pesoB)) return 'a';
  // Pesos que não somam 100 significam configuração inconsistente (só deveria
  // ser possível por escrita manual no banco — a API valida na gravação).
  // Repartir tráfego com regra torta estragaria o teste em silêncio.
  if (pesoA + pesoB !== 100) return 'a';

  // O slug entra no hash para que dois testes seguidos não mandem exatamente
  // as mesmas pessoas para o mesmo lado — o que faria o segundo teste herdar
  // qualquer viés do primeiro.
  return hashSessao(sessionId, teste.slug) % 100 < pesoB ? 'b' : 'a';
}
