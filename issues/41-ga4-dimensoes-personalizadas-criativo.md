# 41: Registrar dimensões personalizadas no GA4 (`funnel`, `utm_content`)
**Tipo:** Implementação (config manual no painel do GA4 — sem código)
**Página:** Tracking / integração GA4 (breakdown por criativo)

## Descrição
Registrar no GA4 dimensões personalizadas com escopo de evento para os params enviados pela issue 40, para que `funnel` e `utm_content` fiquem disponíveis como dimensões nos relatórios e explorações (sem isso, o param é recebido mas não é consultável).

## Contexto / Reuso (NÃO reconstruir)
- Depende da issue 40 estar no ar (os params precisam estar sendo enviados).
- O GA4 só passa a acumular a dimensão a partir do momento em que ela é criada — **não é retroativo**. Criar assim que a issue 40 subir.
- Property/stream é o do `GA4_MEASUREMENT_ID` já configurado (`G-3C24BQVR59`).

## O que fazer (no painel do GA4)
1. Admin → Definições personalizadas → **Criar dimensão personalizada**.
2. Criar, com **escopo = Evento**, uma dimensão para cada param da issue 40 que se queira consultar. Mínimo exigido:
   - Nome: `funnel` — Parâmetro do evento: `funnel`
   - Nome: `utm_content` — Parâmetro do evento: `utm_content`
3. Opcional (se quiser filtrar por eles no GA4): `utm_source`, `utm_medium`, `utm_campaign`, `utm_term` com os params homônimos.
4. Aguardar processamento do GA4 (pode levar 24–48h para popular) e validar em Explorar: montar uma exploração de evento `generate_lead` segmentada por `utm_content`/`funnel`.

## Critérios de aceite
- Dimensões `funnel` e `utm_content` (escopo Evento) existem no GA4 e batem com os nomes dos params enviados pelo `tracker.js`.
- Em Explorar/Tempo real, um `generate_lead` de teste aparece com o `utm_content` correto (ex.: `ad03_captacao-lives-semanais`).
- Nenhuma alteração de código necessária nesta issue.

## Arquivos
- Nenhum (configuração no painel do GA4). Registrar no fim os nomes exatos das dimensões criadas em `docs/` ou na memória do projeto, se útil.

## Fora de escopo
- Envio dos params (issue 40).
- Dashboard interno puxando esses números via Data API.
