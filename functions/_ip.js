// Normalização de endereço IP para comparação com listas de bloqueio.
//
// Existe como módulo próprio porque DOIS julgamentos diferentes precisam da
// mesma conta e não podem depender um do outro: o `_lead-bloqueio.js` decide
// se um LEAD é falso e o `_bots.js` decide se uma VISITA é bot. Antes o
// prefixo64() morava dentro do _lead-bloqueio; fazer o _bots importar de lá
// amarraria "quem é bot" a "quem manda lead falso", que são perguntas
// distintas. A conta de rede é de ambos e não é de nenhum — fica aqui.
//
// Prefixo "_": o Cloudflare Pages não transforma o arquivo em rota.

/**
 * Prefixo /64 normalizado de um IPv6 (os 4 primeiros hextets, sem zeros à
 * esquerda, minúsculo), ou '' para IPv4 e para qualquer forma que não dê para
 * comparar com segurança.
 *
 * Normaliza porque o mesmo bloco pode chegar escrito de mais de um jeito
 * ("...:7058::200" e "...:7058:0:0:0:200"); comparar as strings cruas deixaria
 * a regra passar dependendo de como o proxy resolveu abreviar.
 *
 * Um "::" nos 4 primeiros hextets significa que o prefixo foi comprimido e não
 * dá para saber quantos grupos ele engoliu — nesse caso devolve '' e o IP
 * passa. Regra de bloqueio que chuta erra contra o visitante real.
 */
export function prefixo64(ip) {
  const s = (ip || '').trim().toLowerCase();
  if (!s.includes(':')) return '';           // IPv4
  if (s.startsWith('::')) return '';         // prefixo comprimido: indecidível
  const grupos = s.split(':');
  if (grupos.length < 4) return '';
  const quatro = grupos.slice(0, 4);
  if (quatro.some((g) => g === '')) return ''; // "::" caiu dentro do prefixo
  return quatro.map((g) => g.replace(/^0+(?=.)/, '')).join(':');
}

/**
 * Prefixo /24 de um IPv4 (os 3 primeiros octetos), ou '' para IPv6 e para
 * qualquer coisa que não seja um IPv4 completo e numérico.
 *
 * O /24 é a menor unidade que um provedor de hosting costuma alocar inteira a
 * um cliente, e é o recorte certo para os scanners: eles trocam o último
 * octeto a cada rajada (45.148.10.12, .40, .201, .246) sem trocar de dono.
 *
 * Exige os QUATRO octetos, todos numéricos e em 0-255, justamente para não
 * casar por acidente com um pedaço de string que apenas se pareça com IP.
 */
export function prefixo24(ip) {
  const s = (ip || '').trim();
  if (!s || s.includes(':')) return '';      // vazio ou IPv6
  const octetos = s.split('.');
  if (octetos.length !== 4) return '';
  for (const o of octetos) {
    if (!/^\d{1,3}$/.test(o) || Number(o) > 255) return '';
  }
  return octetos.slice(0, 3).join('.');
}
