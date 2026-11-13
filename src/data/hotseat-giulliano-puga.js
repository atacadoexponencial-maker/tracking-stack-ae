// Hotseat especial com Giulliano Puga (segunda, 16/11/2026, 20h às 22h, Meet).
// Marketing interno: a resposta não vira lead, vai só para uma planilha.
//
// Fonte única das perguntas: a página monta o formulário daqui e o servidor
// (functions/api/hotseat-giulliano-puga.js) confere as respostas pelas mesmas
// listas antes de gravar. Mesmo precedente de aplicacao-plano-ao-vivo.js.
//
// A ordem do array é a ordem das colunas na planilha (depois de Data/hora).
// Sem prazo de encerramento (decisão dela em 11/11).

// Mesmo desenho da aplicação do plano ao vivo (pedido dela em 11/11). Em 12/11
// ela tirou nome, WhatsApp e e-mail (é só para mentorados, o @ da marca já
// identifica quem respondeu) e pediu as três perguntas numa tela só.
export const TOTAL_ETAPAS = 1;
export const ENDPOINT = '/api/hotseat-giulliano-puga';

export const PERGUNTAS = [
  { name: 'instagram', etapa: 1, tipo: 'texto', rotulo: 'Qual é o @ do Instagram da sua marca?', coluna: 'Instagram da marca', placeholder: '@suamarca' },
  {
    name: 'participa', etapa: 1, tipo: 'uma', rotulo: 'Você se compromete a participar ao vivo na segunda, 16/11, das 20h às 22h?', coluna: 'Vai participar',
    opcoes: ['Sim, eu vou', 'Não consigo'],
  },
  {
    name: 'analise', etapa: 1, tipo: 'uma', rotulo: 'Quer que a sua marca concorra a uma análise do Giulliano Puga?', coluna: 'Quer análise',
    opcoes: ['Sim, quero', 'Só vou assistir'],
  },
];

// Limite de tamanho por resposta de texto (o servidor recusa acima disso).
export const MAX_TEXTO = 120;

const EMAIL = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/i;
export const emailValido = (v) => EMAIL.test(String(v ?? '').trim());

export const cabecalhoDe = (perguntas) => ['Data/hora', ...perguntas.map((p) => p.coluna), 'Origem'];
export const CABECALHO = cabecalhoDe(PERGUNTAS);

// Números do convidado: respostas que ele mesmo mandou (11/11).
export const TEXTOS = {
  selo: 'Exclusivo para mentorados',
  titulo: 'Mentoria em Grupo com Giulliano Puga, da Labellamafia',
  subtitulo: 'Ele analisa marcas de atacado ao vivo com a gente. A sua pode ser uma delas.',
  numeros: [
    { valor: '+ de R$ 1 bilhão', rotulo: 'em vendas no mundo' },
    { valor: '46 países', rotulo: 'ao mesmo tempo' },
    { valor: 'R$ 100 milhões', rotulo: 'no atacado, só no Brasil' },
    { valor: '700 revendedores', rotulo: 'ativos no Brasil' },
  ],
  quando: 'Segunda, 16/11 · 20h às 22h · Google Meet',
  ctaCapa: 'Quero participar',
  formTitulo: 'Confirmação',
  cta: 'Confirmar presença',
  privacidade: 'Suas respostas ficam só com a equipe.',
  obrigado: {
    titulo: 'Presença confirmada',
    texto: 'Anota aí: segunda, 16/11, das 20h às 22h, no Google Meet.',
    analise: 'Se a sua marca for escolhida para a análise, a equipe avisa você.',
  },
};

/**
 * Confere as respostas pela lista de perguntas da página (a dos mentorados ou
 * a do grupo gratuito, em mentoria-giulliano-puga.js). O formato do telefone é
 * conferido à parte pela regra única do servidor (functions/_telefone.js).
 * Devolve { ok: true, valores } ou { ok: false, campo } com o primeiro inválido.
 */
export function validar(perguntas, respostas) {
  const r = respostas && typeof respostas === 'object' ? respostas : {};
  const valores = {};
  for (const p of perguntas) {
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

export const validarResposta = (respostas) => validar(PERGUNTAS, respostas);
