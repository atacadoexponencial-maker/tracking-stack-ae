# Lições aprendidas

Regras que nasceram de uma falha real em uma issue. O `/spec` e o `/plan` leem as dez
primeiras, as recorrentes na frente. Este arquivo é escrito pelo auditor
(`auditor.mjs licao ...`); não edite à mão.

| ID | Lição | Origem | Falha | Voltou a acontecer em |
|---|---|---|---|---|
| L-01 | Antes da primeira issue com teste num projeto, confira se o comando de teste do auditor é o do projeto (ex.: node --test precisa de .claude/auditor.json com comandoTeste), senão todo critério aparece como não rodado. | S1-02 | critério sem prova em CA-S1-01 | — |
| L-02 | Passo de dados que depende do código no ar (carga inicial, backfill) precisa de um caminho planejado para rodar antes do commit, ex.: direto no banco com a mesma função; senão o checklist trava o auditor. | S2-01 | checklist incompleto em issues/S2-01-coleta-diaria-calendly.md | — |
| L-03 | Conferir tela nova contra a API de produção antes do deploy grava resposta velha no cache de período fechado: usar a marca de versão nova só depois do deploy, ou conferir com período que inclui hoje. | S4-06 | teste-manual: conferência local com a API de produção antes do deploy guardou a resposta antiga de /api/agenda/taxas?v=s4 no cache de período fechado; no ar, MQL e SQL apareceram vazios até trocar para v=s4b | — |
