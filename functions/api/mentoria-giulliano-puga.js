// Mentoria em Grupo com Giulliano Puga (16/11/2026): inscrição de quem não é
// mentorado (grupo gratuito e stories).
// Duas marcas serão selecionadas para participar (pedido dela em 13/11).
//
// Mesmo processamento da página dos mentorados (./hotseat-giulliano-puga.js):
// confere as respostas, padroniza o telefone e acrescenta uma linha na planilha.
// Não vira lead: nada vai para /tracker, CRM, ClickUp, Meta, GA4 ou ManyChat.

import { processarCom } from './hotseat-giulliano-puga.js';
import { validarResposta, PERGUNTAS, CABECALHO } from '../../src/data/mentoria-giulliano-puga.js';

// Planilha própria, separada da dos mentorados (pedido dela em 13/11). Criada
// pela VPS com a conta de serviço, como marcelle@seteads.com (dona).
const GRUPO_GRATUITO = {
  nome: 'mentoria-giulliano-puga', validar: validarResposta, perguntas: PERGUNTAS, cabecalho: CABECALHO,
  planilha: '1a6l4mQIMlzi95TCX7NYcZjIXeJDGujAW9SLAflvfXEo', aba: 'Inscrições', opcoes: {},
};

export const processarResposta = (contexto) => processarCom(GRUPO_GRATUITO, contexto);

export async function onRequestPost(context) {
  return processarResposta(context);
}
