// Validação/máscara compartilhada dos formulários de captura (issue 127).
// Telefone: aceita BR com DDD (10–11 dígitos) OU internacional começando com
// "+" (8–15 dígitos, padrão E.164) — lead morando fora do Brasil é aceito.
// Email: valida formato + sugere correção de typos de domínios comuns
// (caso real: "@ghotmail.com"). A sugestão nunca bloqueia o envio.

export const TELEFONE_ERRO =
  'Digite um WhatsApp válido com DDD — ou comece com + para número de fora do Brasil.';

export function telefoneValido(v: string): boolean {
  const bruto = (v || '').trim();
  const digitos = bruto.replace(/\D/g, '');
  if (bruto.startsWith('+')) return digitos.length >= 8 && digitos.length <= 15;
  return digitos.length >= 10 && digitos.length <= 11;
}

export function mascararTelefone(valor: string): string {
  const bruto = valor || '';
  if (bruto.trim().startsWith('+')) {
    // Internacional: livre — mantém o + e só limita a dígitos/espaços.
    return '+' + bruto.trim().slice(1).replace(/[^\d ]/g, '').slice(0, 18);
  }
  const d = bruto.replace(/\D/g, '').slice(0, 11);
  if (!d) return '';
  if (d.length <= 2) return '(' + d;
  const resto = d.slice(2);
  const corte = d.length === 11 ? 5 : 4;
  return `(${d.slice(0, 2)}) ${resto.length > corte ? resto.slice(0, corte) + '-' + resto.slice(corte) : resto}`;
}

export function aplicarMascaraTelefone(input: HTMLInputElement) {
  input.addEventListener('input', () => { input.value = mascararTelefone(input.value); });
}

const DOMINIOS = [
  'gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'yahoo.com.br',
  'icloud.com', 'live.com', 'uol.com.br', 'bol.com.br', 'terra.com.br',
];

function distancia(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 2) return 3;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => {
    const row = new Array(n + 1).fill(0); row[0] = i; return row;
  });
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[m][n];
}

export function sugerirEmail(email: string): string | null {
  const m = /^([^@\s]+)@([^@\s]+)$/.exec((email || '').trim().toLowerCase());
  if (!m) return null;
  const dominio = m[2];
  if (DOMINIOS.includes(dominio)) return null;
  let melhor: string | null = null;
  let melhorD = 3; // aceita distância de edição 1 ou 2
  for (const d of DOMINIOS) {
    const dd = distancia(dominio, d);
    if (dd < melhorD) { melhorD = dd; melhor = d; }
  }
  return melhor ? `${m[1]}@${melhor}` : null;
}

// Dica clicável "Será que não é ...?" abaixo do campo — corrige com um toque.
export function aplicarSugestaoEmail(input: HTMLInputElement) {
  const dica = document.createElement('p');
  dica.hidden = true;
  dica.style.cssText =
    'margin:0.3rem 0 0;font-size:0.8rem;color:inherit;opacity:0.85;cursor:pointer;text-decoration:underline;';
  input.insertAdjacentElement('afterend', dica);
  const revisar = () => {
    const sug = sugerirEmail(input.value);
    if (sug && sug !== input.value.trim().toLowerCase()) {
      dica.textContent = `Será que não é ${sug}? Toque aqui para corrigir.`;
      dica.hidden = false;
    } else {
      dica.hidden = true;
    }
  };
  input.addEventListener('blur', revisar);
  input.addEventListener('input', () => { if (!dica.hidden) revisar(); });
  dica.addEventListener('click', () => {
    const sug = sugerirEmail(input.value);
    if (sug) input.value = sug;
    dica.hidden = true;
  });
}
