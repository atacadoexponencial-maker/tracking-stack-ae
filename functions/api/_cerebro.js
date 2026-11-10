// Aba Cérebro do dash (série S9 do gestor-ae, issue S9-04).
//
// O painel chega pronto da VPS: a coleta da observabilidade (3h) monta as semanas,
// a comparação, o histórico e os problemas e grava em `argo.cerebro_painel`. Aqui
// só se diz quando foi a coleta e se ela está atrasada. Só números, nenhuma conversa.

// A coleta roda às 3h; com mais de 26 horas, a de hoje não aconteceu.
export const ATRASO_HORAS = 26;

export function montarResposta(linha, agora = new Date()) {
  if (!linha) return { painel: null, gerado_em: null, atrasada: true };
  const gerado = new Date(linha.gerado_em);
  return {
    painel: linha.painel,
    gerado_em: gerado.toISOString(),
    atrasada: agora.getTime() - gerado.getTime() > ATRASO_HORAS * 3600 * 1000,
  };
}
