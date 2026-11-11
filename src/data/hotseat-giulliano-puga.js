// Hotseat especial com Giulliano Puga (segunda, 16/11/2026, 20h às 22h, Meet).
// Marketing interno: a resposta não vira lead, vai só para uma planilha.
//
// Fonte única das perguntas: a página monta o formulário daqui e o servidor
// (functions/api/hotseat-giulliano-puga.js) confere as respostas pelas mesmas
// listas antes de gravar. Mesmo precedente de aplicacao-plano-ao-vivo.js.
//
// A ordem do array é a ordem das colunas na planilha (depois de Data/hora).
// Sem prazo de encerramento (decisão dela em 11/11).

export const PERGUNTAS = [
  { name: 'nome', tipo: 'texto', rotulo: 'Seu nome', coluna: 'Nome', placeholder: 'Nome', autocomplete: 'name' },
  { name: 'telefone', tipo: 'telefone', rotulo: 'WhatsApp', coluna: 'WhatsApp', placeholder: 'WhatsApp com DDD', autocomplete: 'tel' },
  { name: 'email', tipo: 'email', rotulo: 'E-mail', coluna: 'E-mail', placeholder: 'voce@email.com', autocomplete: 'email' },
  { name: 'instagram', tipo: 'texto', rotulo: 'Instagram da marca', coluna: 'Instagram da marca', placeholder: '@suamarca' },
  {
    name: 'participa', tipo: 'uma', rotulo: 'Você se compromete a participar ao vivo?', coluna: 'Vai participar',
    opcoes: ['Sim, eu vou', 'Não consigo'],
  },
  {
    name: 'analise', tipo: 'uma', rotulo: 'Quer que a sua marca concorra a uma análise do Giulliano Puga?', coluna: 'Quer análise',
    opcoes: ['Sim, quero', 'Só vou assistir'],
  },
];

// Limite de tamanho por resposta de texto (o servidor recusa acima disso).
export const MAX_TEXTO = 120;

const EMAIL = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/i;
export const emailValido = (v) => EMAIL.test(String(v ?? '').trim());

export const CABECALHO = ['Data/hora', ...PERGUNTAS.map((p) => p.coluna), 'Origem'];

// Números do convidado: respostas que ele mesmo mandou (11/11).
export const TEXTOS = {
  selo: 'Hotseat especial',
  titulo: 'Hotseat com Giulliano Puga, da Labellamafia',
  subtitulo: 'Ele levou a Labellamafia a 46 países e analisa marcas de atacado ao vivo com a gente. A sua pode ser uma delas.',
  numeros: [
    { valor: '+ de R$ 1 bilhão', rotulo: 'em vendas no mundo' },
    { valor: '46 países', rotulo: 'operando ao mesmo tempo' },
    { valor: 'R$ 100 milhões', rotulo: 'no atacado, só no Brasil' },
    { valor: '700 clientes', rotulo: 'ativos na carteira de atacado do Brasil' },
  ],
  quando: 'Segunda, 16/11 · 20h às 22h',
  onde: 'Google Meet · ao vivo',
  formTitulo: 'Confirme a sua presença',
  cta: 'Confirmar presença',
  nota: 'Leva menos de 1 minuto.',
  privacidade: 'Suas respostas ficam só com a equipe.',
  obrigado: {
    titulo: 'Presença confirmada',
    texto: 'Anota aí: segunda, 16/11, das 20h às 22h, no Google Meet.',
    analise: 'Se a sua marca for escolhida para a análise, a equipe avisa pelo WhatsApp.',
  },
};

/**
 * Confere as respostas (mesmas listas da página). O formato do telefone é
 * conferido à parte pela regra única do servidor (functions/_telefone.js).
 * Devolve { ok: true, valores } ou { ok: false, campo } com o primeiro inválido.
 */
export function validarResposta(respostas) {
  const r = respostas && typeof respostas === 'object' ? respostas : {};
  const valores = {};
  for (const p of PERGUNTAS) {
    const v = String(r[p.name] ?? '').trim();
    if (p.tipo === 'uma') {
      if (!p.opcoes.includes(v)) return { ok: false, campo: p.name };
    } else if (v.length < 2 || v.length > MAX_TEXTO || (p.tipo === 'email' && !emailValido(v))) {
      return { ok: false, campo: p.name };
    }
    valores[p.name] = v;
  }
  return { ok: true, valores };
}
