# 407: Análise escrita pela IA, com checagem antes de publicar

**Tipo:** Implementação
**Página:** Aba Argo › Relatório da semana (spec `spec-relatorio-semanal-argo.md`, módulos 4 e 7)

## Descrição

A IA passa a escrever o resumo, a leitura das ações, a leitura dos testes e os pontos de atenção a partir só do pacote de fatos, citando as etiquetas; a checagem automática confere números, citações, formato, amostra, leitura antecipada, causa sem veredito, semana atípica e fonte indisponível; reprovou, a IA tenta mais uma vez; reprovou de novo, sai só a parte calculada; violações isoladas viram relatório parcial. O registro de checagem fica visível na aba.

## Pronto quando

O relatório da semana mostra a análise escrita com etiquetas que levam ao fato, fato e leitura com aparência diferente, e a situação "verificada". Uma análise forçada com número inventado ou com vencedor declarado em teste não pronto é barrada: aparece "parcial" (bloco removido e dito qual) ou "não passou na checagem", e ela vê no registro cada violação. Nenhum texto que reprovou aparece no relatório.

## Cenários

### Happy Path
`analisarPacote` manda à IA só os fatos (`claude-opus-5-5`, structured outputs com esquema fixo, thinking adaptativo, esforço alto, fallback do servidor ligado para recusa). A checagem confere a resposta; passou, os blocos vão ao ar com etiquetas que abrem o fato e a marca de fato, leitura ou sem conclusão.

### Edge Cases
- Reprovou: segunda tentativa recebe a lista de violações. Reprovou de novo: blocos com violação saem (parcial); sem o resumo, sai só a parte calculada (não passou).
- Recusa do modelo, resposta cortada ou JSON inválido: contam como reprovação de formato.
- Número dentro de nome de anúncio (ad13) não conta como número; contagens até 10 não precisam estar nos fatos; porcentagem só casa com porcentagem e reais com reais.

### Cenário de Erro
Sem `ANTHROPIC_API_KEY` ou API fora: o relatório sai só com a parte calculada (`sem_analise`) e o cabeçalho diz por quê.

## Arquivos

- **Criar:** `functions/api/_argo-relatorio-instrucoes.js` (instruções versionadas e esquema), `_argo-relatorio-checagem.js` (guardrails), `_argo-relatorio-analise.js` (chamada ao modelo e decisão).
- **Criar:** `tests/argo-relatorio-checagem.test.js`.
- **Modificar:** `package.json` (dependência `@anthropic-ai/sdk`).

## Dependências Externas

- `@anthropic-ai/sdk` — chamada à API do Claude (SDK oficial).

## Checklist

- [x] Esquema fixo da resposta com citações por frase
- [x] Checagem: números, citações, formato, amostra, leitura antecipada, causa sem veredito, semana atípica, fonte indisponível, restrição
- [x] Segunda tentativa com as violações; parcial e não passou
- [x] Registro de checagem visível na aba
- [x] Testado com respostas simuladas (17 testes) e com um modelo simulado sobre o pacote real (tentativa 1 reprovou por número inventado, tentativa 2 removeu a sugestão com número inexistente: parcial)
- [ ] Rodar com a IA de verdade: falta cadastrar `ANTHROPIC_API_KEY` no Pages (decisão da gestora sobre o custo)

## Implementação (04/10/2026)

Não há chave de API da Anthropic no projeto (a do Hermes é um token OAuth de assinatura, que não deve ser usado num servidor). Sem a chave, o relatório funciona só com a parte calculada e diz isso no topo.
