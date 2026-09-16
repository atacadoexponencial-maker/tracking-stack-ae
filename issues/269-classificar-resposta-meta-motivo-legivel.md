# 269: Classificar a resposta do Meta em categoria e motivo legível

**Tipo:** Implementação
**Página:** Módulo 2 — Reenvio automático (sistema)
**Spec:** spec-capi-reenvio-monitoramento.md

## Descrição

Regra única no servidor que transforma a resposta (ou a ausência de resposta) do Meta numa categoria — credencial, evento recusado, falha passageira, expirou — e na frase em português correspondente. É usada pelo registro da primeira tentativa, pelo reenvio e pelo painel.

## Comportamentos cobertos

- Traduzir resposta do Meta em motivo legível (credencial; credencial não configurada; expirou; esgotou; evento recusado; falha passageira)
- Meta responde aceito, mas informa que o evento já tinha sido recebido

## Critérios de aceite relacionados

- 4, 6, 7, 8, 13, 21

## Plano

Desenho único das issues 268–288: `docs/superpowers/plans/2026-09-16-capi-reenvio-monitoramento.md`.

## Arquivos

- **Criar:** `functions/api/_meta-envio.js` — classificarRespostaMeta e motivos legíveis
- **Criar:** `tests/meta-envio.test.js`

## Checklist

- [x] Credencial por status/código (não por type OAuthException)
- [x] Passageira: 5xx, 429, is_transient, códigos de limite, erro de rede
- [x] Evento recusado com a mensagem do Meta
- [x] Credencial ausente
- [x] Testes de cada categoria
