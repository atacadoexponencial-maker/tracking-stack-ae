# 270: Registrar a situação das conversões do site após a primeira tentativa

**Tipo:** Implementação
**Página:** Módulo 1 — Registro da conversão para reenvio (sistema)
**Spec:** spec-capi-reenvio-monitoramento.md

## Descrição

Depois da primeira tentativa de envio de Lead e dos demais eventos de conversão do site, gravar a situação (aceita, aguardando reenvio ou falhou de vez) com identificador, horário original e conteúdo preservados, sem mudar o momento do envio. Bots, leads bloqueados, eventos internos e PageView continuam fora.

## Comportamentos cobertos

- Primeira tentativa aceita pelo Meta
- Primeira tentativa recusada por credencial
- Credencial do Meta não configurada no momento do envio
- Primeira tentativa com falha passageira
- Primeira tentativa recusada por problema do próprio evento
- Evento de bot
- Lead bloqueado
- Evento interno (clique em CTA, início de formulário, etapa de formulário)
- PageView
- Falha ao registrar a situação

## Critérios de aceite relacionados

- 1, 8, 10

## Plano

Desenho único das issues 268–288: `docs/superpowers/plans/2026-09-16-capi-reenvio-monitoramento.md`.

## Arquivos

- **Criar:** migration `migrations/0041_meta_envios.sql`
- **Criar:** `functions/api/_meta-fila.js` — registrarPrimeiraTentativa
- **Modificar:** `functions/tracker.js` — registrar situação; sendToMeta devolve payload sem credencial

## Checklist

- [x] Tabela meta_envios com UNIQUE(origem, event_id) e índices
- [x] Registro em waitUntil só para conversões reais (sem bot, bloqueado, interno, PageView)
- [x] Falha ao registrar vai só ao log
