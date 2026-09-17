# 295: Blocos de credenciais e horário na aba "Saúde das integrações"

**Tipo:** Implementação
**Página:** Módulo 3 — Exibição das proteções no dashboard
**Spec:** spec-protecoes-integracoes.md

## Descrição

Renomear a aba e mostrar credenciais (com "Checar agora") e horário por fonte (com detalhe dos suspeitos), com a faixa de estado considerando as proteções.

## Critérios de aceite relacionados

- 13
- 20

## Arquivos

- **Modificar:** `functions/api/meta-saude.js` — credenciais, horários, estado combinado, view=horario-detalhe, POST checar-credenciais
- **Modificar:** `public/dash/index.html` — nome da aba e blocos

## Checklist

- [x] Cada bloco falha sozinho
- [x] Não se aplica recolhido
- [x] Detalhe sem dado pessoal
