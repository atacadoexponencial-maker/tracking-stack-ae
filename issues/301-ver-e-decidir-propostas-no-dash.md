# 301: Ver e decidir propostas no dash

**Tipo:** Implementação
**Página:** Aba Argo — spec `spec-argo-aprovar-propostas.md`, módulos 1, 2, 3 e 6

## Descrição

Ligar o protótipo 298 aos dados reais: pendentes e histórico de 30 dias, aprovar e rejeitar (com "por quê?") presos à versão vista, recusar decisão sobre proposta já decidida, vencida ou desatualizada, avisar sobre parada geral, e ajustar os textos da aba Controle para o Propor funcional. A tela só registra a decisão; ninguém executa ainda.

## Pronto quando

Uma proposta real gerada pela issue 300 aparece na aba Propostas, pode ser aprovada ou rejeitada, e a decisão fica gravada e aparece no histórico como "Aprovada — aguardando execução" ou "Rejeitada"; decidir uma versão antiga é recusado.

## Cenários

### Happy Path
1. A aba Propostas lê `GET /api/argo/propostas` (contrato da issue 298) e mostra
   as propostas reais gravadas pela 300 (hoje: ids 6 e 7).
2. Aprovar → confirmação na linha → `POST /api/argo/propostas` com
   `{id, versao, decisao: "aprovar"}`; a proposta sai das pendentes e aparece no
   histórico como "Aprovada — aguardando execução".
3. Rejeitar → "por quê?" opcional → mesmo POST com `decisao: "rejeitar"` e
   `por_que`; histórico mostra "Rejeitada" e "volta a ser avaliada a partir de
   <decidida + 3 dias>".

### Edge Cases
- Versão mudou (o Argo rodou no intervalo): 409 "O Argo atualizou esta
  proposta…"; a lista recarrega mostrando a versão nova.
- Já decidida por outra pessoa: 409 com quem e quando; a lista recarrega.
- Venceu: 409 "Esta proposta venceu…"; recarrega.
- Parada geral ligada: aprovar continua possível (a confirmação já avisa).
- "Pausar anúncio" em Executar ainda vira proposta (issue 300): a faixa lista
  essa ação em "Propõe", nunca em "Executa sozinho".
- Controle: `propor` e `pausar_anuncio` passam a ter consumidor no contrato, e o
  aviso "Propor ainda não chega a ninguém" some.

### Cenário de Erro
- Rede/servidor fora: "Não dá para afirmar se gravou — recarregue e confira";
  o botão volta para tentar de novo. Nunca mostra "aprovada" sem 200.
- Corpo inválido (id/versão ausentes, decisão desconhecida, por quê > 300): 400.

## Banco de Dados

Sem migration nova (colunas da 0002). Lê `argo.propostas` e
`argo.config_conta.parada_geral`; grava `decisao`, `decidida_por = 'painel'`,
`decidida_em`, `por_que` com guarda `versao = $v AND decisao IS NULL AND
vence_em > now()`.

## Arquivos

- **Criar:** `functions/api/_argo-propostas.js` — puro e testável:
  `montarPropostas({pendentes, historico, parada_geral})` (rótulos, números
  formatados, verificação, situação e detalhe) e `validarDecisao(corpo)`.
- **Criar:** `functions/api/argo/propostas.js` — GET (pendentes válidas +
  resolvidas dos últimos 30 dias, teto 100) e POST (grava a decisão com a
  guarda; 409 explicado). Auth `recusarSemChave` na primeira linha.
- **Criar:** `tests/argo-propostas.test.js`.
- **Modificar:** `functions/api/_argo-config.js` — `pausar_anuncio` em
  `ACOES_COM_CONSUMIDOR`, `propor` em `ESTADOS_COM_CONSUMIDOR`, e
  `EXECUTAR_AINDA_PROPOE = ['pausar_anuncio']` no contrato.
- **Modificar:** `tests/argo-config.test.js` — ajustes do contrato.
- **Modificar:** `public/dash/index.html` — `argoRegistrarDecisao` faz o POST
  real e recarrega a lista; faixa trata `executar_ainda_propoe` como "Propõe";
  linha da ação avisa "Executar ainda vira proposta".

## Checklist

- [x] `_argo-propostas.js` + testes
- [x] Endpoint GET/POST com guarda de versão, decisão e validade
- [x] Contrato da grade atualizado (+ testes)
- [x] Tela ligada ao POST, com os três 409 e o erro de rede
- [x] Faixa e linha da ação tratam Executar-que-ainda-propõe
- [x] `npm test` verde
- [x] Conferido localmente com `wrangler pages dev` contra a Neon real — GET real e os 409/400/401; nenhuma decisão real gravada (aguarda ok da usuária)
