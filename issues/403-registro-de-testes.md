# 403: Registro de testes funcionando

**Tipo:** Implementação
**Página:** Aba Argo › Testes (spec `spec-relatorio-semanal-argo.md`, módulo 2)

## Descrição

Tornar real o registro de testes aprovado no protótipo 401: cadastro dos quatro tipos de teste, ligação com anúncios, conjuntos ou páginas da conta e com os A/B de página existentes, ciclo de vida (planejado, rodando, concluído, abandonado), histórico de mudanças da ficha e busca.

## Pronto quando

Ela registra um teste real da conta, escolhe os anúncios ou a página de cada lado na lista, inicia, conclui ou abandona com motivo, e acha o teste pela busca. Uma mudança de hipótese, métrica ou critério depois do início aparece no histórico do teste com a data. Tudo continua lá ao recarregar.

## Cenários

### Happy Path
A aba Testes lê `GET /api/argo/testes` (testes com histórico, já montados no servidor) e grava por `POST /api/argo/testes` com `acao` = `criar`, `editar`, `iniciar`, `concluir` ou `abandonar`. Para escolher os lados, o formulário lê `GET /api/argo/testes-alvos`: anúncios e conjuntos da conta (Graph API do Meta, ativos e pausados) e os testes A/B de página do dash (D1).

### Edge Cases
- Mudar hipótese, métrica ou critério de teste que já começou: grava uma linha em destaque no histórico com o antes e o depois.
- Concluir sem aprendizado ou abandonar sem motivo: 400 (a tabela também recusa).
- Iniciar teste que não está planejado, concluir teste planejado, mexer em teste fechado: 409 com a mensagem.
- Teste de página sem A/B escolhido, ou de conta sem os dois lados: 400.
- Meta fora do ar na lista de alvos: a lista vem vazia com o aviso, e o formulário diz que não deu para ler a conta (o A/B continua disponível).

### Cenário de Erro
Neon fora: 500 com mensagem; a aba mostra o aviso no lugar da lista.

## Banco de Dados

- `argo.testes` e `argo.testes_historico` (migration `gestor-ae/migrations/argo/0009_registro_testes.sql`, aplicada em 04/10).

## Arquivos

- **Criar:** `gestor-ae/migrations/argo/0009_registro_testes.sql`.
- **Criar:** `functions/api/_argo-testes.js`: regra pura (validar cada ação, montar o teste, mudanças que vão para o histórico, transições permitidas).
- **Criar:** `functions/api/_argo-meta.js`: leitura da Graph API para o Argo (lista de anúncios e conjuntos, insights por anúncio ou conjunto num intervalo), com `fetch` injetável.
- **Criar:** `functions/api/argo/testes.js` e `functions/api/argo/testes-alvos.js`.
- **Criar:** `tests/argo-testes.test.js` e `tests/argo-meta.test.js`.
- **Modificar:** `public/dash/argo-testes.js`: ligado à API, sem dados de exemplo.
- **Modificar:** `public/dash/index.html`: passa `{ argoApi }` ao abrir a vista.

## Checklist

- [x] Migration 0009 aplicada no Neon
- [x] `_argo-testes.js` e `_argo-meta.js` testados
- [x] `GET/POST /api/argo/testes` e `GET /api/argo/testes-alvos` com guarda de chave
- [x] Tela ligada à API
- [x] Conferido com o Neon e o Meta reais (registrar, editar com histórico, iniciar, concluir, abandonar; teste apagado no fim)

## Implementação (04/10/2026)

Migration 0009 aplicada no Neon. `_argo-testes.js` (validação, transições, histórico, leitura), `_argo-meta.js` (Graph API: anúncios e insights por anúncio, só leitura), `argo/testes.js`, `argo/testes-alvos.js` e a tela ligada à API. Conferido com Neon, Meta e D1 reais: 103 anúncios e 39 conjuntos listados, registrar com busca na lista, validação de campos, mesmo alvo nos dois lados recusado (exceto oferta), editar critério depois do início vai em destaque para o histórico, concluir, iniciar teste fechado dá 409. Testes de teste apagados.
