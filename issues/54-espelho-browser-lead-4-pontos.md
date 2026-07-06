# 54: Espelho browser do evento Lead nos 4 pontos de captura

**Tipo:** Implementação
**Página:** Módulo: Espelho browser do evento Lead (4 pontos de captura)

## Descrição

Nos quatro pontos que hoje enviam o evento Lead ao servidor (`/tracker`) com um `event_id`, disparar **também** a cópia do navegador — `fbq('track', 'Lead', {}, { eventID })` — reutilizando o **mesmo** `event_id` já gerado. Nenhum fluxo de envio existente muda e nenhum dado a mais é coletado.

## Arquivos afetados

- `src/components/LeadChat.astro` (chat de captura, ~linha 359)
- `src/components/LeadFormModal.astro` (modal de formulário, ~linha 122)
- `src/pages/lives-semanais-v1.astro` (formulário da LP da live, ~linha 142)
- `src/pages/calculadora-atacado/index.astro` (captura da calculadora, ~linha 83)

## Comportamentos

- Em cada ponto, ao concluir a captura, o evento Lead é disparado pelo navegador com o mesmo `event_id` enviado ao servidor.
- O disparo do navegador é protegido: se o Pixel não estiver disponível (bloqueado ou não carregado), o envio ao servidor segue normalmente e o visitante não vê erro.
- O envio ao servidor permanece exatamente como hoje (mesmo payload, mesmo destino, mesmo `event_id`) — a cópia do navegador serve apenas para deduplicação no Meta.
- Nenhum dado pessoal adicional é anexado à cópia do navegador — os dados do lead seguem indo apenas pela via do servidor.

## Dependências

- Issues 52 (proxy first-party) e 53 (Pixel inicializado no layout base) precisam estar prontas — sem o Pixel carregado, `fbq` não existe.

## Achados da pesquisa (plan)

- **Nenhum dos 4 pontos tem variável de `event_id` hoje** — o id é gerado **inline** dentro do `JSON.stringify` do fetch, com o mesmo padrão nos quatro: `'lead-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)`. Para compartilhar o id entre `fbq` e `/tracker`, é preciso **extrair para uma const `eventId`** antes do fetch e usá-la nos dois lugares.
- **Todos os 4 pontos rodam em páginas com BaseLayout** (logo `window.fbq` existe como stub que enfileira, mesmo antes do `fbevents.js` carregar):
  - `LeadChat.astro` é usado em `src/pages/index.astro`, `src/pages/vsl.astro` e `src/pages/consultoria-gratuita-atacado.astro` — todas com BaseLayout.
  - `LeadFormModal.astro` é usado em `src/pages/workshop-gratuito-atacado.astro` — com BaseLayout.
  - `src/pages/lives-semanais-v1.astro` e `src/pages/calculadora-atacado/index.astro` usam BaseLayout diretamente.
- O BaseLayout já faz `fbq('init', '915637492681788')` e o PageView com `eventID` (linhas 46–57) — o padrão da chamada de Lead segue o mesmo formato.
- Os `<script>` dos 4 arquivos são processados como TypeScript pelo Astro e `fbq` não é tipado em `window` — usar `(window as any).fbq` na chamada.

## Cenários

### Happy Path

Visitante conclui a captura em qualquer dos 4 pontos → o código gera `const eventId = 'lead-' + Date.now() + '-' + Math.random()...'` (o mesmo id inline de hoje, só extraído para variável) → dispara `fbq('track', 'Lead', {}, { eventID: eventId })` protegido → em seguida faz o `fetch('/tracker', ...)` exatamente como hoje, com `event_id: eventId` no payload. Meta recebe as duas cópias com o mesmo id e deduplica.

### Edge Cases

- **`fbq` indisponível** (bloqueador removeu o stub, ou página fora do BaseLayout): o disparo é guardado por `typeof (window as any).fbq === 'function'` — se não for função, pula silenciosamente e o fetch ao `/tracker` segue normal.
- **Envio duplo / retry do formulário**: nos 3 formulários o botão é desabilitado no submit (`submitBtn.disabled = true`) e no chat o `submit()` só roda uma vez ao fim do fluxo; se ainda assim houver reenvio, cada tentativa gera um `eventId` novo e consistente entre browser e servidor — o par continua deduplicável, sem id órfão.
- **Página sem BaseLayout**: hoje não existe (os 4 pontos estão cobertos — ver achados acima), mas a guarda de `typeof` garante que o código não quebra se o componente for reutilizado em página sem o Pixel.
- **Custom data vazio**: o payload de custom data do `fbq` é `{}` — nenhum dado pessoal (nome, email, telefone) vai pela via do browser; dados do lead seguem indo só pelo `/tracker`.

### Cenário de Erro

O disparo do browser **nunca pode quebrar o envio server-side**: a chamada `fbq` fica envolta em `try { ... } catch {}` além da guarda de `typeof`, e é feita **antes/independente** do `fetch('/tracker')` — qualquer exceção do Pixel é engolida e o fetch acontece do mesmo jeito. O inverso também vale: falha do fetch (já tratada hoje com try/catch próprio) não afeta o disparo do browser, que já ocorreu.

## Arquivos

Somente estes 4 arquivos. Em cada um, a mudança são ~3 linhas no mesmo padrão: (1) extrair o id inline para `const eventId`, (2) disparo protegido do `fbq` logo antes do fetch, (3) usar `eventId` no payload do fetch.

Padrão do disparo protegido (idêntico nos 4):

```ts
const eventId = 'lead-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
try { if (typeof (window as any).fbq === 'function') (window as any).fbq('track', 'Lead', {}, { eventID: eventId }); } catch (e) { /* espelho browser nunca bloqueia o envio */ }
```

- **Modificar:** `src/components/LeadChat.astro` — na função `submit()`, inserir o bloco acima após `let redirect = '';` (linha ~357, antes do `try` do fetch) e trocar a linha ~364 `event_id: 'lead-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),` por `event_id: eventId,`.
- **Modificar:** `src/components/LeadFormModal.astro` — no handler de `submit` do form, inserir o bloco após `let redirect = '/video-workshop-instagram';` (linha ~120, antes do `try`) e trocar a linha ~127 do `event_id` inline por `event_id: eventId,`.
- **Modificar:** `src/pages/lives-semanais-v1.astro` — no handler de `submit`, inserir o bloco após `let redirect = '/obrigada';` (linha ~140, antes do `try`) e trocar a linha ~147 do `event_id` inline por `event_id: eventId,`.
- **Modificar:** `src/pages/calculadora-atacado/index.astro` — no handler de `submit`, inserir o bloco após `btn.textContent = 'Carregando…';` (linha ~79, antes do `try` do fetch na linha ~82) e trocar o `event_id` inline da linha ~86 por `event_id: eventId,`.

## Checklist

- [x] `src/components/LeadChat.astro`: `eventId` extraído + `fbq('track','Lead',{},{eventID})` protegido antes do fetch + `event_id: eventId` no payload
- [x] `src/components/LeadFormModal.astro`: idem
- [x] `src/pages/lives-semanais-v1.astro`: idem
- [x] `src/pages/calculadora-atacado/index.astro`: idem
- [x] Nenhum dado pessoal na chamada `fbq` — custom data é `{}` em todos os pontos
- [x] Payload do `/tracker` inalterado exceto pela origem do `event_id` (mesma string, agora via variável)
- [x] Guarda `typeof (window as any).fbq === 'function'` + `try/catch` presente nos 4 pontos
- [x] Verificar no browser (Network): submit de um form gera 1 requisição do Pixel (Lead) e 1 POST `/tracker` com o **mesmo** `event_id` — verificado via Playwright na calculadora (fbq `["track","Lead",{},{eventID:"lead-1783350001464-b1zy4r"}]` + `/tracker` com o mesmo id; interceptados para não enviar lead de teste a Meta/Supabase)
- [x] Verificar com Pixel bloqueado (adblock/DevTools): submit segue funcionando, `/tracker` recebe o Lead, sem erro no console — verificado via Playwright com `window.fbq = undefined`: `/tracker` chamado, navegação ok, zero erros
