// Campos dos modelos de e-mail (spec-email-proprio.md, módulo 2; issue 378).
// Cada canal tem a própria lista: {{link_reuniao}} só existe no transacional.
// O exemplo preenche a prévia e o e-mail de teste.
//
// Prefixo "_": o Cloudflare Pages não transforma o arquivo em rota.

export const CAMPOS = {
  transacional: [
    { campo: 'nome', rotulo: 'Nome completo', exemplo: 'Ana Lima' },
    { campo: 'primeiro_nome', rotulo: 'Primeiro nome', exemplo: 'Ana' },
    { campo: 'email', rotulo: 'E-mail', exemplo: 'ana.lima@exemplo.com' },
    { campo: 'tipo_reuniao', rotulo: 'Tipo de reunião', exemplo: 'Sessão estratégica' },
    { campo: 'data_reuniao', rotulo: 'Data da reunião', exemplo: 'terça, 07/10' },
    { campo: 'hora_reuniao', rotulo: 'Hora da reunião', exemplo: '15:00' },
    { campo: 'link_reuniao', rotulo: 'Link da reunião', exemplo: 'https://meet.google.com/abc-defg-hij' },
    { campo: 'link_remarcar', rotulo: 'Link para remarcar', exemplo: 'https://atacadoexponencial.com/agenda/remarcar' },
  ],
  marketing: [
    { campo: 'nome', rotulo: 'Nome completo', exemplo: 'Ana Lima' },
    { campo: 'primeiro_nome', rotulo: 'Primeiro nome', exemplo: 'Ana' },
    { campo: 'email', rotulo: 'E-mail', exemplo: 'ana.lima@exemplo.com' },
    { campo: 'funil', rotulo: 'Funil de entrada', exemplo: 'Workshop gratuito' },
  ],
};

export const CANAIS = Object.keys(CAMPOS);

/** {{ nome }} e {{nome}} são o mesmo campo. Não casa {{{ pm:unsubscribe }}}. */
export const MARCADOR = /(?<!\{)\{\{(?!\{)\s*([^{}]*?)\s*\}\}(?!\})/g;

export const nomesDoCanal = (canal) => (CAMPOS[canal] || []).map((c) => c.campo);

/** Valores de exemplo do canal: { campo: exemplo }. */
export const exemplos = (canal) => Object.fromEntries((CAMPOS[canal] || []).map((c) => [c.campo, c.exemplo]));

/** Campos usados no texto que o canal não conhece, sem repetição, na ordem em que aparecem. */
export function desconhecidos(texto, canal) {
  const conhecidos = nomesDoCanal(canal);
  const vistos = [];
  for (const [, nome] of String(texto ?? '').matchAll(MARCADOR)) {
    if (!conhecidos.includes(nome) && !vistos.includes(nome)) vistos.push(nome);
  }
  return vistos;
}

function distancia(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[a.length][b.length];
}

/** Campo do canal mais parecido com `nome`, ou null quando nenhum chega perto. */
export function sugerir(nome, canal) {
  const alvo = String(nome).toLowerCase();
  let melhor = null;
  for (const c of nomesDoCanal(canal)) {
    const dist = distancia(alvo, c);
    if (dist <= Math.max(2, Math.floor(c.length / 3)) && (!melhor || dist < melhor.dist)) melhor = { campo: c, dist };
  }
  return melhor ? melhor.campo : null;
}
