# 48: Notificação interna no WhatsApp (Novo lead / Voltou ao CRM)

**Tipo:** Implementação
**Página:** ClickUp direto — remover n8n (transversal)

## Descrição

Após criar/atualizar a task, enviar ao número do comercial (Evolution API, best-effort) a mensagem "Novo lead no CRM 🎉" (task criada) ou "Voltou ao CRM 🎉" (task existente), no formato do fluxo n8n atual. Nunca bloqueia nem atrasa a resposta do `/tracker`.

## Cenários

### Happy Path
1. Ao criar (issue 45) → `sendEvolutionMessage(EVOLUTION_APIKEY_NOTIF, EVOLUTION_NUMERO_NOTIF, textoNovo)`.
2. Ao encontrar/comentar (issue 46) → mesma função com `textoVoltou`.
3. Formato (fiel ao n8n):
   ```
   *Novo lead no CRM 🎉*      (ou *Voltou ao CRM 🎉*)

   *Nome:* {nome}
   *Número:* {phoneE164}
   *Whatsapp:* https://wa.me/{digitos}
   *Email:* {email}
   *Instagram:* {instagram}
   *Faturamento:* {faturamento}
   ```

### Edge Cases
- `EVOLUTION_*` de notificação não configuradas → pula silenciosamente (não é obrigatório para a criação da task).
- Instagram/faturamento vazios → linha fica vazia (fiel ao n8n).

### Cenário de Erro
- Falha no envio → engolida (try/catch em `sendEvolutionMessage`). A task já foi criada/comentada; a notificação é best-effort.

## Arquivos

- **Modificar:** `functions/tracker.js` — chamar `sendEvolutionMessage(...)` (helper da issue 47) nos ramos criar/existente do `sendToClickUp`, montando o texto conforme o caso.

## Dependências Externas

- Evolution API — `POST {EVOLUTION_API_URL}` header `apikey`, body `{ number, text }`.

## Checklist

- [x] Texto "Novo lead no CRM 🎉" no ramo criação
- [x] Texto "Voltou ao CRM 🎉" no ramo existente
- [x] Enviar via `sendEvolutionMessage` com `EVOLUTION_APIKEY_NOTIF` / `EVOLUTION_NUMERO_NOTIF`
- [x] Best-effort: nunca bloqueia nem lança
