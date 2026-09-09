import { prefixo64 } from './_ip.js';

// Regras de bloqueio de lead falso, num lugar só.
//
// Mesmo padrão do _bots.js: prefixo "_" para o Cloudflare Pages não transformar
// o arquivo em rota, e uma lista única que a escrita consulta — nada de uma
// cópia da regra no /tracker e outra no painel.
//
// A diferença para o _bots.js é o que cada um olha. O detectBot() julga o
// User-Agent: pega crawler que se identifica. Isto aqui julga o REMETENTE do
// lead — o e-mail submetido e o IP de origem — e existe porque um script que
// manda UA de Chrome passa liso pelo outro. Foi o caso de 02/09/2026: 29 envios
// de leadflow17883715252372738@gmail.com no mesmo minuto, direto no /tracker,
// sem sessão.
//
// Bloqueio NÃO é descarte. O lead barrado vai inteiro para `leads_bloqueados`
// (migration 0035) e pode ser devolvido pela aba Bloqueios do dash. Toda regra
// aqui é lista negra: no dia em que o script trocar o prefixo do e-mail ou o
// servidor de saída, ele volta a passar. Serve como corte do que está
// sangrando, não como defesa.

const REGRAS_EMAIL = [
  {
    motivo: 'E-mail contém "leadflow"',
    casa: (email) => email.includes('leadflow'),
  },
];

// Blocos IPv6 /64 barrados inteiros, não endereços soltos: um /64 é o que um
// único assinante recebe, então quem tem o bloco troca de sufixo à vontade
// (::200 vira ::201) sem trocar de dono. Barrar o endereço exato seria uma
// regra que o bot dribla sem nem saber que existia.
//
// 2605:a143:2218:7058:: — 61 leads falsos entre 15/08 e 08/09/2026, TODOS na
// lives-semanais-v1, todos no padrão ana/joao/carla/maria/pedro + 3 dígitos
// @gmail.com, UA de Chrome fixo, sem UTM e sem referrer, um a cada ~30-70min
// 24h por dia. Nenhum lead legítimo saiu desse bloco em todo o histórico da
// base — conferido antes de escrever esta linha.
const REGRAS_IP = [
  {
    motivo: 'IP no bloco 2605:a143:2218:7058::/64 (bot de lead falso)',
    prefixo64: '2605:a143:2218:7058',
  },
];


/**
 * Devolve o motivo do bloqueio, ou string vazia se o lead está liberado.
 * String em vez de booleano porque o motivo é gravado junto do lead barrado —
 * sem ele, a aba Bloqueios mostraria uma lista de e-mails sem explicação.
 *
 * O `ip` é opcional: quem só tem o e-mail em mãos continua chamando com um
 * argumento e recebe apenas o veredito das regras de e-mail.
 */
export function motivoBloqueio(email, ip) {
  const e = (email || '').toLowerCase().trim();
  if (e) {
    for (const regra of REGRAS_EMAIL) {
      if (regra.casa(e)) return regra.motivo;
    }
  }
  const p64 = prefixo64(ip);
  if (p64) {
    for (const regra of REGRAS_IP) {
      if (p64 === regra.prefixo64) return regra.motivo;
    }
  }
  return '';
}
