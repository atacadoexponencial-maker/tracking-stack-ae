// Mentoria em Grupo com Giulliano Puga (segunda, 16/11/2026, 20h às 22h, Meet):
// inscrição do GRUPO GRATUITO. Duas marcas serão selecionadas para participar
// (pedido dela em 13/11). A página dos mentorados é /hotseat-giulliano-puga.
//
// Mesma página e mesmo formulário, com nome, WhatsApp e e-mail (aqui a equipe
// não conhece quem responde). Não vira lead: vai só para a planilha.
// A ordem do array é a ordem das colunas na planilha (depois de Data/hora).
// Sem prazo de encerramento.

import { TEXTOS as BASE, cabecalhoDe, validar } from './hotseat-giulliano-puga.js';

export const TOTAL_ETAPAS = 1;
export const ENDPOINT = '/api/mentoria-giulliano-puga';

export const PERGUNTAS = [
  { name: 'nome', etapa: 1, tipo: 'texto', rotulo: 'Seu nome', coluna: 'Nome', placeholder: 'Nome', autocomplete: 'name' },
  { name: 'telefone', etapa: 1, tipo: 'telefone', rotulo: 'WhatsApp', coluna: 'WhatsApp', placeholder: 'WhatsApp com DDD', autocomplete: 'tel' },
  { name: 'email', etapa: 1, tipo: 'email', rotulo: 'E-mail', coluna: 'E-mail', placeholder: 'voce@email.com', autocomplete: 'email' },
  { name: 'instagram', etapa: 1, tipo: 'texto', rotulo: 'Instagram da marca', coluna: 'Instagram da marca', placeholder: '@suamarca' },
  {
    name: 'participa', etapa: 1, tipo: 'uma', rotulo: 'Se for selecionada, você se compromete a participar ao vivo na segunda, 16/11, das 20h às 22h?', coluna: 'Vai participar',
    opcoes: ['Sim, eu vou', 'Não consigo'],
  },
];

export const CABECALHO = cabecalhoDe(PERGUNTAS);

export const TEXTOS = {
  ...BASE,
  selo: '2 vagas para o grupo gratuito',
  subtitulo: 'Vamos selecionar duas marcas do grupo gratuito para participar ao vivo. Inscreva a sua.',
  ctaCapa: 'Quero concorrer',
  formTitulo: 'Inscrição',
  cta: 'Enviar inscrição',
  obrigado: {
    titulo: 'Inscrição recebida',
    texto: 'Se a sua marca for uma das duas selecionadas, a equipe avisa pelo WhatsApp.',
  },
};

export const validarResposta = (respostas) => validar(PERGUNTAS, respostas);
