// Leitura estatística do teste A/B, isolada e PURA: sem I/O, sem D1, sem env.
//
// O que este módulo protege: parar um teste no instante em que ele "dá 95%"
// infla a taxa de falso positivo de 5% para mais de 30% (o chamado peeking).
// Por isso o veredito NÃO é função só do valor-p: ele exige que os alvos
// declarados na CRIAÇÃO do teste (leads por variante e dias) tenham sido
// atingidos. Enquanto não forem, o estado é 'rodando', doa a quem doer.
//
// Prefixo "_": o Cloudflare Pages não transforma o arquivo em rota.

// Amostra mínima para a checagem de SRM valer alguma coisa. Abaixo disso,
// desequilíbrio é o normal do início do teste, não sinal de defeito.
const MIN_AMOSTRA_SRM = 100;
// Nível do veredito e do alarme de SRM. O SRM é mais frouxo (0,01) de
// propósito: ele roda a cada carregamento do painel, e a 0,05 daria alarme
// falso em 1 de cada 20 leituras.
const ALFA_VEREDITO = 0.05;
const ALFA_SRM = 0.01;

// Φ(z) pela aproximação de Abramowitz & Stegun 26.2.17 (erro < 7,5e-8).
// Implementada aqui porque JS não tem função de erro na biblioteca padrão e
// puxar uma dependência para cinco linhas de polinômio não se justifica.
export function cdfNormalPadrao(z) {
  const B = [0.319381530, -0.356563782, 1.781477937, -1.821255978, 1.330274429];
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const densidade = Math.exp((-z * z) / 2) / Math.sqrt(2 * Math.PI);
  let soma = 0;
  for (let i = 0; i < B.length; i++) soma += B[i] * Math.pow(t, i + 1);
  const cauda = densidade * soma;
  return z > 0 ? 1 - cauda : cauda;
}

// Teste z de duas proporções com variância combinada (pooled), bicaudal.
// nA/nB = visitas; cA/cB = conversões.
export function testeDuasProporcoes(nA, cA, nB, cB) {
  // Sem amostra dos dois lados não existe comparação. p = 1 significa
  // "nenhuma evidência de diferença", que é exatamente o caso.
  if (!(nA > 0) || !(nB > 0)) return { z: 0, p: 1 };

  const combinada = (cA + cB) / (nA + nB);
  // Ninguém converteu, ou converteram todos: a variância é zero e a divisão
  // estouraria. Nos dois casos não há diferença a detectar.
  if (combinada <= 0 || combinada >= 1) return { z: 0, p: 1 };

  const erroPadrao = Math.sqrt(combinada * (1 - combinada) * (1 / nA + 1 / nB));
  const z = (cB / nB - cA / nA) / erroPadrao;
  // A aproximação de Φ tem erro de até 7,5e-8, o que pode empurrar o
  // resultado para fora do intervalo válido (z = 0 devolve p = 1,000000001).
  // Probabilidade não passa de 1 nem fica abaixo de 0: quem consome isso
  // compara com 0,05, e devolver valor fora do domínio é entregar lixo com
  // cara de número.
  const p = Math.min(1, Math.max(0, 2 * (1 - cdfNormalPadrao(Math.abs(z)))));
  return { z, p };
}

// Sample Ratio Mismatch: a divisão observada bate com a configurada?
// Qui-quadrado com 1 grau de liberdade. Split torto ocorre em 6-10% dos
// testes A/B (bug, bot, cache) e invalida o resultado em silêncio — sem esta
// checagem, o painel mostraria com toda a confiança um número que não vale.
export function checarSrm(nA, nB, pesoA) {
  const total = nA + nB;
  const peso = Number(pesoA);
  if (total < MIN_AMOSTRA_SRM || !Number.isFinite(peso) || peso <= 0 || peso >= 100) {
    return { chi2: 0, p: 1, alerta: false };
  }

  const esperadoA = (total * peso) / 100;
  const esperadoB = total - esperadoA;
  const chi2 =
    Math.pow(nA - esperadoA, 2) / esperadoA + Math.pow(nB - esperadoB, 2) / esperadoB;
  // Com 1 grau de liberdade, P(χ² > x) = 2·(1 − Φ(√x)). Mesmo motivo do
  // testeDuasProporcoes: o erro da aproximação de Φ pode empurrar o
  // resultado para fora de [0, 1], e probabilidade não sai desse intervalo.
  const p = Math.min(1, Math.max(0, 2 * (1 - cdfNormalPadrao(Math.sqrt(chi2)))));
  return { chi2, p, alerta: p < ALFA_SRM };
}

export function avaliarTeste({ teste, a, b, agora }) {
  const metaLeads = Number(teste?.meta_leads_variante) || 0;
  const metaDias = Number(teste?.meta_dias) || 0;
  const inicio = Number(teste?.started_at) || 0;

  const diasCorridos = inicio ? Math.max(0, Math.floor((agora - inicio) / 86400)) : 0;
  const menorLeads = Math.min(a.leads, b.leads);
  const faltamLeads = Math.max(0, metaLeads - menorLeads);
  const faltamDias = Math.max(0, metaDias - diasCorridos);

  const { z, p } = testeDuasProporcoes(a.visitas, a.leads, b.visitas, b.leads);
  const srm = checarSrm(a.visitas, b.visitas, a.peso);

  let estado = 'rodando';
  let vencedor = null;
  // Os DOIS alvos, não um ou outro: leads de sobra em 5 dias medem dia da
  // semana, e 14 dias com 3 leads não medem nada.
  if (faltamLeads === 0 && faltamDias === 0) {
    if (p < ALFA_VEREDITO) {
      estado = 'conclusivo';
      vencedor = b.leads / b.visitas > a.leads / a.visitas ? 'b' : 'a';
    } else {
      estado = 'sem-diferenca';
    }
  }

  return { estado, vencedor, z, p, srm, metaLeads, metaDias, diasCorridos, faltamDias, faltamLeads };
}
