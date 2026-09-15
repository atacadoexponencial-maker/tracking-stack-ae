# 234: Protótipo do contrato de GET /api/feedback-marketing

**Tipo:** Protótipo
**Página:** Módulo 2 — Endpoint de feedback de marketing (`GET /api/feedback-marketing`)
**Spec:** spec-feedback-marketing.md

## Descrição

Criar a rota `GET /api/feedback-marketing` devolvendo uma resposta com dados fixos que define o formato final do contrato (período, gerado em, investido geral, blocos por tipo de medição, bloco "sem funil", totais, frescor e avisos), para o agente poder ser desenhado em cima dele.

## Comportamentos cobertos

- Período: data inicial/final, quantidade de dias, rótulo ("14/09" ou "12/09 a 14/09"), indicador de padrão e de parcial
- Gerado em (Brasília) e investido geral
- Bloco por funil: nome, tipo, posição, investido, campanhas (nome, valor, forma de reconhecimento), métricas, custo por resultado (vazio sem denominador), avisos
- Formato das métricas de cada tipo: lead + MQL (novos leads, MQLs, CPL), manual ("não calculado" com motivo "contagem manual"), venda na Greenn (compras, CPA, quebra por origem)
- Bloco "sem funil" com investido, campanhas com motivo, leads por opção, MQLs, sem CPL e indicador de vazio
- Totais, frescor das fontes, avisos gerais e nota do critério de MQL
- Valores em reais com duas casas; vazio distinto de zero

## Cenários

### Happy Path
1. O agente chama `GET /api/feedback-marketing`.
2. Recebe `200` com o JSON fixo do contrato: `periodo`, `gerado_em`, `investido_geral`, `blocos` (um de cada tipo, na ordem do cadastro inicial), `sem_funil`, `totais`, `frescor`, `nota_mql` e `avisos`.

### Edge Cases
- **Vazio ≠ zero:** `null` = sem denominador (ex.: CPL do bloco sem lead); `{ "calculado": false, "motivo": "contagem manual" }` = métrica que a consulta não calcula (tipo Manual). `0` só quando é zero de verdade.
- **Sem investimento e com resultado:** custo `0` acompanhado de `sem_investimento: true`.
- **"sem funil" sem CPL:** o bloco não tem a chave `custo_por_resultado`.
- **Valores monetários:** números em reais com duas casas (ex.: `42.1` = R$ 42,10); a formatação é do agente.
- Datas do período em `AAAA-MM-DD` (dia de Brasília); `gerado_em` em ISO com `-03:00`.

### Cenário de Erro
- Método diferente de GET: a rota só exporta `onRequestGet`; o Pages responde 405 sozinho e nada é alterado.
- Autenticação, parâmetros de período e dados reais **não** entram neste protótipo (issues 253–265).

## Contrato (formato da resposta)

```
periodo        { inicio, fim, dias, rotulo, padrao, parcial }
gerado_em      "2026-09-15T08:30:00-03:00"
investido_geral number
blocos[]       { nome, tipo: lead_mql|manual|venda_greenn, posicao, investido, sem_investimento,
                 campanhas[{ nome, valor, reconhecida_por: manual|trecho|automatica|impulsionamento }],
                 metricas, custo_tipo: CPL|CPA, custo_por_resultado, avisos[] }
  lead_mql     metricas { novos_leads, mqls }                  custo_por_resultado number|null
  manual       metricas { novos_leads: {calculado:false, motivo} } custo_por_resultado {calculado:false, motivo}
  venda_greenn metricas { compras_realizadas, compras_por_origem { trafego_pago, disparo, outra_origem, sem_rastreio } }
sem_funil      { investido, campanhas[{ nome, valor, motivo }], novos_leads, leads_por_opcao[{ opcao, novos_leads }], mqls, vazio }
totais         { investido_geral, novos_leads, mqls, compras_realizadas }
frescor        { investimento_atualizado_em, crm_lido, greenn_ultimo_evento_em }
nota_mql       texto
avisos[]       frases prontas
```

## Banco de Dados

Não se aplica (dados fixos).

## Arquivos

- **Criar:** `functions/api/feedback-marketing.js` — `onRequestGet` devolvendo o JSON fixo do contrato (mesmo helper `json()` dos demais endpoints).

## Reuso (pesquisado na base)

- Padrão de rota e helper `json()` de `functions/api/bloqueios.js` / `links.js`.
- Convenção "`null` = sem denominador, o dashboard escreve —" de `_greenn-metricas.js` e `_cpl-calculo.js`.

## Checklist

- [x] Rota `GET /api/feedback-marketing` criada (só `onRequestGet`)
- [x] `periodo` com inicio, fim, dias, rotulo, padrao, parcial
- [x] `gerado_em` em Brasília e `investido_geral`
- [x] Bloco lead_mql com novos_leads, mqls, CPL e campanhas com forma de reconhecimento
- [x] Bloco manual com "não calculado" / "contagem manual"
- [x] Bloco venda_greenn com compras, CPA e quebra por origem (soma = total)
- [x] Exemplo de bloco sem denominador com custo `null`
- [x] Bloco `sem_funil` com campanhas+motivo, leads por opção, MQLs, sem CPL, `vazio`
- [x] `totais`, `frescor`, `nota_mql` e `avisos`
