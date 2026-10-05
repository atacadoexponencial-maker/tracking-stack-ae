// Instruções da análise escrita do relatório semanal do Argo (issues 407 e 410).
//
// Versionadas: cada versão tem o texto de sistema e o formato da resposta.
// Qual versão vale é gravado em `argo.relatorio_config` (issue 410), e uma
// versão nova só entra depois de rodar nas semanas passadas sem piorar.
// Módulo puro.

// Formato fixo da resposta (structured outputs). Cada frase carrega as
// etiquetas dos fatos em que se apoia; a checagem confere tudo depois.
const FRASE = {
  type: 'object',
  additionalProperties: false,
  required: ['texto', 'citacoes', 'tipo'],
  properties: {
    texto: { type: 'string', description: 'Uma frase em português, sem etiquetas no meio do texto.' },
    citacoes: { type: 'array', items: { type: 'string' }, description: 'Etiquetas dos fatos (ex.: "F12") que sustentam a frase.' },
    tipo: { type: 'string', enum: ['fato', 'leitura', 'sem_conclusao'], description: 'fato: só repete o dado; leitura: interpretação; sem_conclusao: diz que não dá para concluir.' },
  },
};
const BLOCO = { type: 'array', items: FRASE };

export const ESQUEMA_ANALISE = {
  type: 'object',
  additionalProperties: false,
  required: ['resumo', 'leitura_acoes', 'leitura_testes', 'pontos_atencao', 'sugestoes', 'sem_sugestao_motivo'],
  properties: {
    resumo: BLOCO,
    leitura_acoes: BLOCO,
    leitura_testes: BLOCO,
    pontos_atencao: BLOCO,
    sugestoes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['tipo', 'funil', 'hipotese', 'mudar', 'metrica', 'criterio', 'minimo', 'porque', 'parecido'],
        properties: {
          tipo: { type: 'string', enum: ['criativo', 'publico', 'pagina', 'oferta'] },
          funil: { type: 'string' },
          hipotese: { type: 'string', description: '"Acreditamos que X porque Y."' },
          mudar: { type: 'string' },
          metrica: { type: 'string' },
          criterio: { type: 'string' },
          minimo: { type: 'string', description: 'Duração e amostra mínimas, por extenso.' },
          porque: FRASE,
          parecido: { type: 'string', description: 'Teste parecido já registrado (nome) e o que muda em relação a ele, ou "nenhum".' },
        },
      },
    },
    sem_sugestao_motivo: { type: 'string', description: 'Vazio quando há sugestões; senão, por que não há base para sugerir.' },
  },
};

const SISTEMA_V1 = `Você escreve a leitura semanal da conta de anúncios do Atacado Exponencial para a gestora de tráfego. A empresa vende mentoria e workshops para marcas que vendem no atacado (B2B de nicho). Os funis (SE = sessão estratégica, workshop gratuito, workshop pago, aplicação de mentoria) aparecem nos fatos com os nomes do cadastro.

Você recebe um PACOTE DE FATOS. Cada fato tem uma etiqueta (F1, F2...), um valor já escrito, período, fonte e marcas. É a única coisa que você sabe sobre a conta: não use conhecimento de fora sobre esta empresa, não invente contexto e não faça contas.

Regras que valem para toda frase:
1. Toda frase que fala de resultado, ação ou teste cita em "citacoes" as etiquetas dos fatos que a sustentam. Sem fato, sem frase.
2. Só escreva números que aparecem nos fatos, do jeito que aparecem. Não calcule diferenças, médias nem porcentagens: as variações prontas estão nos fatos "Variação de ...".
3. Fato com a marca "amostra_pequena": descreva o número, mas não tire conclusão dele (não diga que melhorou, piorou, venceu nem a causa). Use tipo "sem_conclusao" quando for o caso.
4. Fato com a marca "nao_pronto" (teste que ainda não atingiu os mínimos): nunca declare vencedor nem diga qual lado é melhor.
5. Para dizer que uma ação do Argo causou uma melhora ou piora, cite o fato de veredito dessa ação. Sem veredito, diga que ainda não dá para saber.
6. Se houver o fato "Semana atípica", o resumo cita esse fato quando comparar a semana com o histórico.
7. Fato "indisponível" ou de "Fontes com problema": diga o que ficou sem análise; não afirme nada sobre o dado que falta.
8. Fatos de "Contexto do negócio" com tipo restrição: nenhuma sugestão pode contrariar uma restrição.
9. Se não der para concluir, diga isso com tipo "sem_conclusao". É uma resposta boa, não uma falha.
10. Separe fato de leitura: tipo "fato" só repete o dado; tipo "leitura" é a sua interpretação.

Blocos:
- resumo: de 3 a 5 frases com o que mais importa na semana.
- leitura_acoes: o efeito das ações da semana, com base nos vereditos. Se não houve ação, diga isso em uma frase.
- leitura_testes: testes prontos para ler, rodando e concluídos. Sem testes, diga isso em uma frase.
- pontos_atencao: o que as réguas automáticas não pegam (por exemplo, custo subindo em todos os funis ao mesmo tempo, qualidade do lead caindo com o CPL estável, taxa de junção baixa, anúncio novo sem teste). De 0 a 4 frases.
- sugestoes: de 0 a 3 testes para as próximas semanas, com todos os campos. Antes de sugerir, olhe os fatos de "Testes já concluídos" e "Comentários da gestora": não repita um teste já feito sem dizer em "parecido" o que muda e por que o resultado poderia ser diferente agora, e não volte a uma sugestão descartada sem tratar do motivo. Se não houver base, deixe a lista vazia e explique em sem_sugestao_motivo.

Leve em conta os comentários da gestora sobre a semana anterior: não repita uma leitura que ela marcou como errada sem tratar do que ela disse.

Escreva em português do Brasil, direto, sem jargão de IA, sem travessão, sem exclamação. Frases curtas.`;

export const VERSOES_INSTRUCOES = Object.freeze({
  v1: { sistema: SISTEMA_V1, esquema: ESQUEMA_ANALISE, descricao: 'Primeira versão (04/10/2026).' },
});
export const VERSAO_PADRAO = 'v1';

/** O pacote como a análise lê: só fatos e a ordem, sem estrutura de tela. */
export function fatosParaAnalise(pacote) {
  const linhas = pacote.ordem.map((id) => {
    const f = pacote.fatos[id];
    return { id: f.id, grupo: f.grupo, nome: f.nome, valor: f.valor_texto, periodo: f.periodo, fonte: f.fonte, marcas: f.marcas };
  });
  return { semana: pacote.semana.rotulo, primeira_semana: pacote.primeira, fatos: linhas };
}

/** Mensagem do usuário: o pacote e, na segunda tentativa, o que a checagem reprovou. */
export function montarMensagem(pacote, tentativaAnterior = null) {
  const partes = [`PACOTE DE FATOS DA SEMANA (JSON):\n${JSON.stringify(fatosParaAnalise(pacote))}`];
  if (tentativaAnterior) {
    partes.push(`Sua resposta anterior foi reprovada na checagem automática. Violações:\n${tentativaAnterior.violacoes.map((v) => `- [${v.regra}] ${v.bloco}: ${v.motivo} Trecho: "${v.trecho}"`).join('\n')}\n\nReescreva a análise inteira corrigindo cada violação. Resposta anterior:\n${JSON.stringify(tentativaAnterior.saida)}`);
  }
  return partes.join('\n\n');
}
