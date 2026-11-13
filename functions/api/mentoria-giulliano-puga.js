// Mentoria em Grupo com Giulliano Puga (16/11/2026): inscrição de quem não é
// mentorado (grupo gratuito e stories).
// Duas marcas serão selecionadas para participar (pedido dela em 13/11).
//
// Mesmo processamento da página dos mentorados (./hotseat-giulliano-puga.js):
// confere as respostas, padroniza o telefone e acrescenta uma linha na planilha.
// Não vira lead: nada vai para /tracker, CRM, ClickUp, Meta, GA4 ou ManyChat.

import { processarCom, PLANILHA } from './hotseat-giulliano-puga.js';
import { validarResposta, PERGUNTAS, CABECALHO } from '../../src/data/mentoria-giulliano-puga.js';

// Mesmo arquivo da planilha dos mentorados, em uma aba própria. A aba é criada
// no primeiro envio (criarAba), porque em 13/11 não havia como criar um arquivo
// novo. Para trocar por outro arquivo, basta mudar `planilha` e `aba`.
const GRUPO_GRATUITO = {
  nome: 'mentoria-giulliano-puga', validar: validarResposta, perguntas: PERGUNTAS, cabecalho: CABECALHO,
  planilha: PLANILHA, aba: 'Grupo gratuito', // atualizarCabecalho: a coluna Faturamento entrou em 13/11, depois do primeiro envio.
  opcoes: { criarAba: true, atualizarCabecalho: true },
};

export const processarResposta = (contexto) => processarCom(GRUPO_GRATUITO, contexto);

export async function onRequestPost(context) {
  return processarResposta(context);
}
