# 72: Roteamento por faixa de investimento no funil trafego-atacado

**Tipo:** Implementação
**Página:** /aplicacao-trafego-atacado (backend: functions/tracker.js)

## Descrição

No funil `trafego-atacado`, o redirect pós-envio passa a depender da faixa escolhida em "Quanto você investe em tráfego pago por mês?":

- **"Ainda não invisto" ou "Até R$ 1.500/mês"** → WhatsApp do time (mesmo número do diagnóstico), com mensagem pré-preenchida própria: "Olá! Acabei de preencher a aplicação de tráfego para marcas atacado e quero entender o melhor caminho para o meu momento." — via nova env `LEAD_REDIRECT_WHATSAPP_TRAFEGO`; fallback: `LEAD_REDIRECT_WHATSAPP` (mesmo número, mensagem do diagnóstico).
- **Demais faixas (a partir de "De R$ 1.500 a R$ 3.000/mês")** → Calendly, como hoje (`LEAD_REDIRECT_CALENDLY_TRAFEGO` ou o link padrão).

Sem marcação extra no ClickUp — a faixa já fica gravada em 💵 Investimento em Tráfego. Decisão 100% no backend (thin client), roteando pelo texto da faixa (mesmo padrão do roteamento por faturamento).

## Cenários

### Happy Path
1. Lead preenche o form em /aplicacao-trafego-atacado com investimento "De R$ 3.000 a R$ 10.000/mês" → recebe redirect para o Calendly.
2. Lead preenche com "Ainda não invisto" → recebe redirect para o wa.me com a mensagem própria.

### Edge Cases
- Campo `investimento` ausente/vazio no payload (não deveria acontecer — é obrigatório no form): cai no Calendly (comportamento igual ao atual, não perde lead qualificado).
- Env `LEAD_REDIRECT_WHATSAPP_TRAFEGO` não setada: usa `LEAD_REDIRECT_WHATSAPP` (mesmo número, mensagem genérica); se essa também faltar, o front usa o fallback `/obrigada`.
- Matching por texto minúsculo (`não invisto` / `até r$ 1.500`) não colide com "De R$ 1.500 a R$ 3.000/mês".

### Cenário de Erro
- Nenhum caminho de erro novo: o redirect é uma string na resposta do /tracker; captação (ClickUp/CRM/pixels) independe dele.

## Arquivos
- **Modificar:** `functions/tracker.js` — ramo `trafego-atacado` do roteamento pós-captação + comentário do bloco.

## Dependências Externas
- Env `LEAD_REDIRECT_WHATSAPP_TRAFEGO` no Cloudflare Pages (produção): `https://wa.me/<numero>?text=<mensagem urlencoded>` — setar pela usuária com o mesmo número de `LEAD_REDIRECT_WHATSAPP`.

## Checklist
- [x] Ramo por investimento no tracker.js (baixo → WhatsApp, demais → Calendly)
- [x] Comentário do bloco de roteamento atualizado
- [x] `node --check` no tracker.js + matching das 5 faixas testado (2 → WhatsApp, 3 → Calendly, vazio → Calendly)
- [ ] Env `LEAD_REDIRECT_WHATSAPP_TRAFEGO` setada em produção (usuária)
- [ ] Pós-deploy: lead de teste nas duas faixas confirma os dois destinos
