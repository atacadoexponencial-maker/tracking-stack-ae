# 277: Aba "Saúde do Meta": acesso, período, atualizar e falha ao carregar

**Tipo:** Implementação
**Página:** Módulo 3 — Área "Saúde do Meta" (dashboard)
**Spec:** spec-capi-reenvio-monitoramento.md

## Descrição

Ligar a aba ao servidor: carrega o período padrão, respeita o acesso do dashboard, recusa período acima de 92 dias, recarrega com "Atualizar" e mostra a mensagem de falha mantendo o filtro.

## Comportamentos cobertos

- Abrir a aba
- Abrir a aba sem acesso ao dashboard
- Mudar o período
- Período maior que o máximo permitido
- Atualizar os dados
- Falha ao carregar

## Critérios de aceite relacionados

- 16, 21

## Plano

Desenho único das issues 268–288: `docs/superpowers/plans/2026-09-16-capi-reenvio-monitoramento.md`.

## Arquivos

- **Criar:** `functions/api/meta-saude.js`
- **Modificar:** `public/dash/index.html` — R["saude-meta"], atualizar, erro

## Checklist

- [x] DASH_KEY
- [x] Período máximo 92 dias
- [x] Botão Atualizar
- [x] Mensagem de falha ao carregar
