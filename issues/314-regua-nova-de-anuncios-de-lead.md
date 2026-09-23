# 314: Régua nova de anúncios de lead

**Tipo:** Implementação
**Página:** Monitor de anúncios na VPS + grade da aba Controle — spec `spec-argo-regua-editavel.md`, módulo 2; spec `spec-argo-aprovar-propostas.md`, módulo 5 (Executar)

## Descrição

Julgar anúncio de lead só depois de gastar multiplicador × CPL médio do funil nos últimos 30 dias e atingir as impressões mínimas; sem lead → candidato; com lead → segunda avaliação por MQL no funil julgado por MQL. Relatório com o CPL usado e o piso que faltou para cada não julgado. Liberar "Executar" em "Pausar anúncio".

## Pronto quando

Numa rodada real o `ad12_depoimentos-jaque-322_vd` é julgado pela régua nova e o Slack explica por quê, com o CPL médio de cada funil; salvar "Pausar anúncio" em Executar passa a ser aceito e o monitor pausa sozinho um candidato.

## Status

- [x] Entregue em 23/09: funil do anúncio pela campanha (`/api/argo/leads-por-anuncio` devolve `funis` e `campanhas`); piso = multiplicador × CPL médio do funil + impressões mínimas; sem lead → candidato; com lead → MQL. Executar liberado depois da 316.
