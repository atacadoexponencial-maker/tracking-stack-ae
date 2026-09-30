# 355: Revisão de acabamento, DESIGN.md e ir ao ar

**Tipo:** Implementação
**Página:** Dash inteiro (19 abas) e `DESIGN.md`
**Spec:** `spec.md` (Módulo 20 e regras transversais)

## Descrição

Fechar o projeto: revisar o acabamento das 19 abas em desktop e celular contra o contrato de direção (`.impeccable/surfaces/public-dash-index-html.md`) e corrigir o que destoar do vocabulário da Visão geral; reescrever `DESIGN.md` a partir do que foi construído (tokens, componentes, regras nomeadas), trocando "Noite Sempre" pela regra do papel e anotando que painel de clientes e site continuam escuros até nova decisão; mover `spec.md` para `docs/specs-arquivadas/`; levar o branch para a `main` (produção builda da main).

## Pronto quando

- Qualquer aba aberta em produção mostra o mesmo vocabulário de componentes da Visão geral; nenhuma sobra do mundo escuro no dash.
- Nas 19 abas, em desktop e celular, nada rola de lado, foco de teclado é visível e "reduzir movimento" desliga toda animação.
- Cor semântica só em estado; alta e queda sempre com ▲ ▼; números comparáveis em algarismos tabulares alinhados à direita.
- `DESIGN.md` descreve exatamente o que está no ar, sem regra antiga; painel de clientes e site continuam como estavam.
- `spec.md` não está mais na raiz; está em `docs/specs-arquivadas/`.

## Resultado (30/09/2026)

Feito no branch e levado à `main`:
- Revisão de acabamento por leitura do CSS (nenhum token, gradiente ou canto antigo restou: grep zero) e na preview com dados simulados (Visão geral desktop e 390px, Leads, Vendas, Disparos, Argo, Instagram em erro).
- `DESIGN.md` reescrito a partir do que está no ar: "O Catálogo de Atacado", regra do Papel no lugar da "Noite Sempre", seção "Superfícies escuras" registrando que site e painel de clientes continuam como estavam.
- `spec.md` movida para `docs/specs-arquivadas/spec-redesign-dash-etiqueta.md`.
- Pendências que ficam com ela, em produção com a chave real: conferir números iguais aos de antes para o mesmo filtro, foco por Tab, "reduzir movimento" e o visual de cada aba com dados reais (Greenn, Meta Ads, Email, Workshops, Grupos, Links, Bloqueios, Funis do relatório, A/B, Jornada, Eventos, Saúde, Instagram foram verificados só por CSS ou em estado de erro).
