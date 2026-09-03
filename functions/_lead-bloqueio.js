// Regras de bloqueio de lead falso, num lugar só.
//
// Mesmo padrão do _bots.js: prefixo "_" para o Cloudflare Pages não transformar
// o arquivo em rota, e uma lista única que a escrita consulta — nada de uma
// cópia da regra no /tracker e outra no painel.
//
// A diferença para o _bots.js é o que cada um olha. O detectBot() julga o
// User-Agent: pega crawler que se identifica. Isto aqui julga o e-mail
// submetido, e existe porque um script que manda UA de Chrome passa liso pelo
// outro. Foi o caso de 02/09/2026: 29 envios de leadflow17883715252372738@
// gmail.com no mesmo minuto, direto no /tracker, sem sessão.
//
// Bloqueio NÃO é descarte. O lead barrado vai inteiro para `leads_bloqueados`
// (migration 0035) e pode ser devolvido pela aba Bloqueios do dash. Uma regra
// por e-mail é lista negra: no dia em que o script trocar o prefixo, ele volta
// a passar. Serve como corte do que está sangrando, não como defesa.

const REGRAS = [
  {
    motivo: 'E-mail contém "leadflow"',
    casa: (email) => email.includes('leadflow'),
  },
];

/**
 * Devolve o motivo do bloqueio, ou string vazia se o e-mail está liberado.
 * String em vez de booleano porque o motivo é gravado junto do lead barrado —
 * sem ele, a aba Bloqueios mostraria uma lista de e-mails sem explicação.
 */
export function motivoBloqueio(email) {
  const e = (email || '').toLowerCase().trim();
  if (!e) return '';
  for (const regra of REGRAS) {
    if (regra.casa(e)) return regra.motivo;
  }
  return '';
}
