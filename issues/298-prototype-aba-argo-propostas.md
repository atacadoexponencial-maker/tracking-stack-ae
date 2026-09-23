# 298: Protótipo — aba interna "Propostas" da aba Argo

**Tipo:** Protótipo
**Página:** Aba Argo do dash (`public/dash/index.html`, `#secao-argo`) — spec `spec-argo-aprovar-propostas.md`, módulos 1, 2 e 3

## Descrição

Desenhar, com dados fictícios e sem backend, as abas internas Controle/Propostas, o contador de pendentes, a linha "N propostas aguardando você" na faixa, os cartões de proposta pendente (com confirmação na linha) e o histórico com todos os selos de situação e o botão Desfazer.

## Pronto quando

Abrindo a aba Argo localmente dá para trocar entre Controle e Propostas e ver pendentes e histórico com todos os estados da spec (inclusive vazio, versão desatualizada e parada geral ligada), no computador e no celular — e a usuária aprovou o visual.

## Onde o protótipo vive

O protótipo é a **tela de verdade** em `public/dash/index.html`, desenhada a
partir de um contrato de dados fixado aqui. Os dados fictícios **não entram no
repositório**: o proxy local de leitura (scratchpad da sessão) responde
`GET /api/argo/propostas` com um arquivo de exemplo. Assim a issue 301 só
precisa criar o endpoint real — a tela já estará pronta e aprovada.

Tudo numa branch `argo-propostas`, **sem merge na `main` até a 301**: a tela
chamaria um endpoint que ainda não existe em produção.

### Contrato de `GET /api/argo/propostas` (a 301 implementa)

O backend entrega tudo pronto — a tela não calcula situação, vencimento nem
contagem (thin client):

```json
{
  "parada_geral": false,
  "pendentes": [{
    "id": "41", "versao": 2,
    "acao": "pausar_campanha_trafego", "acao_rotulo": "Pausar campanha",
    "alvo_nome": "Post do Instagram: Me mandaram estudar antes de...",
    "qtd_anuncios": null,
    "motivo": "gasto 7d R$ 32,59 e CPV R$ 0,74 ...",
    "numeros": [{"rotulo": "Gasto 7d", "valor": "R$ 32,59"}, {"rotulo": "Custo por visita", "valor": "R$ 0,74", "referencia": "corte R$ 0,25"}],
    "verificacao": "A campanha deve aparecer pausada e o gasto dela parar.",
    "criada_em": "2026-09-23T11:50:40Z", "vence_em": "2026-09-24T11:50:00Z",
    "vezes_proposta": 3, "primeira_vez_em": "2026-09-19T11:50:00Z"
  }],
  "historico": [{
    "id": "38", "versao": 1, "acao_rotulo": "Pausar anúncio", "alvo_nome": "...",
    "qtd_anuncios": 2, "motivo": "...", "numeros": [],
    "situacao": "executada_conferida",
    "situacao_rotulo": "Executada e conferida",
    "situacao_detalhe": "pausada em 23/09 às 10:12",
    "decidida_por": "painel", "decidida_em": "...", "por_que": null,
    "execucao": {"antes": "ACTIVE", "depois": "PAUSED", "conferencia": "conferido"},
    "desfeita": null, "pode_desfazer": true
  }]
}
```

`situacao` ∈ `aguardando_execucao`, `executada_conferida`,
`executada_nao_conferida`, `nao_executou`, `rejeitada`, `vencida`, `desfeita`.

## Cenários

### Happy Path
1. A gestora abre `/dash/#argo`: vê a faixa de estado e as pílulas
   **Controle** (ativa) e **Propostas 2**.
2. A faixa mostra "2 propostas aguardando você"; clicar leva a Propostas e o
   endereço vira `#argo?v=propostas`.
3. Cada pendente mostra ação, alvo, motivo, números, "como vamos saber se
   funcionou", quando foi proposta e até quando vale, e os botões.
4. Clicar Aprovar troca os botões por "Pausar '<alvo>'? Confirmar · Não" na
   própria linha (`pedirConfirmacao`). No protótipo, Confirmar só mostra
   "gravado (protótipo)" — nada é enviado.
5. Rejeitar abre na linha o campo opcional "por quê?" e a confirmação.
6. Abaixo, o histórico em linhas compactas (mesmo padrão `<details>` do
   Registro), com selo por situação; clicar abre o detalhe; nas executadas que
   podem ser desfeitas aparece **Desfazer**, com confirmação na linha.
7. Voltar para Controle mostra a grade exatamente como estava, inclusive
   alterações não salvas.

### Edge Cases
- Zero pendentes: o contador some; a lista mostra "Nenhuma proposta aguardando
  você" com a última rodada; a linha da faixa some.
- Anúncio com nome repetido: "Pausar anúncio · 2 anúncios com este nome".
- Proposta repetida: selo "proposta pela 3ª vez desde 19/09".
- Motivo longo: cortado em 2 linhas com "ver tudo".
- Parada geral ligada: faixa de aviso no topo de Propostas e a confirmação de
  aprovar diz "Nada será executado enquanto a parada geral estiver ligada.
  Aprovar mesmo assim?".
- Link direto `#argo?v=propostas` e recarregar: abre em Propostas.
- Celular (390px): cartões empilham, botões em largura cheia.
- O fixture traz um exemplo de cada `situacao`, para ver todos os selos.

### Cenário de Erro
- Endpoint indisponível (hoje em produção, 404): a aba Propostas mostra o cartão
  de erro com "Tentar de novo" (padrão `.erro-carga` do dash) **e a aba
  Controle continua funcionando** — as duas leituras são independentes.
- Resposta sem `pendentes`/`historico`: tratado como erro, nunca como "zero
  propostas" (ausência não é "nada a decidir").

## Banco de Dados

Não se aplica nesta issue (a tabela `argo.propostas` já existe; colunas novas
de versão e execução ficam para a 300/302).

## Arquivos

- **Modificar:** `public/dash/index.html`
  - HTML de `#secao-argo`: pílulas Controle/Propostas (reusar `.tipo-pill` com
    `aria-pressed`), contêiner `#argo-vista-controle` envolvendo os dois cards
    atuais e contêiner `#argo-vista-propostas` novo.
  - CSS: cartão de proposta, selos de situação (reusar `.argo-resultado` e suas
    variantes `ok`/`falha`/`desconhecido`), linha de números, estado vazio.
  - JS: `carregarPropostasArgo()` (lê o endpoint com `argoApi` e `comFallback`),
    `desenharPropostasArgo(dados)`, `trocarVistaArgo(vista)`; confirmação com
    `pedirConfirmacao` (já existente); datas com `argoQuando` (já existente);
    `desenharFaixaArgo` ganha a linha "N propostas aguardando você".
  - Estado na URL: `escreverUrl`/`lerUrl` passam a guardar `v=propostas` quando
    a aba é `argo`.
- **Não versionado:** fixture `argo-propostas.json` e rota no proxy local, no
  scratchpad da sessão.

## Dependências Externas

Nenhuma.

## Checklist

- [x] Criar a branch `argo-propostas`
- [x] Pílulas Controle/Propostas com contador e troca sem recarregar
- [x] `v=propostas` no hash: link direto e recarregar funcionam
- [x] Linha "N propostas aguardando você" na faixa, levando a Propostas
- [x] Cartão de pendente com todos os campos do contrato
- [x] Aprovar e Rejeitar com confirmação na linha (rejeitar com "por quê?"); no protótipo nada é enviado
- [x] Aviso de parada geral na aprovação
- [x] Histórico compacto com os 7 selos, detalhe ao clicar e Desfazer com confirmação
- [x] Estado vazio e erro independente da aba Controle
- [x] Fixture com um exemplo de cada situação no proxy local
- [x] Prints em 1440px e 390px para a usuária aprovar (aprovação pendente)
- [x] `npm test` verde
