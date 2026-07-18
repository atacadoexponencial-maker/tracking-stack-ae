# 127: Validação e orientação de digitação nos formulários

**Tipo:** Implementação
**Página:** Todas as LPs de captura

## Descrição

Nivelar validação de telefone (10–11 dígitos BR com DDD OU internacional com "+",
8–15 dígitos E.164), máscara de telefone guiando a digitação (liberada quando começa
com "+"), e detector de typo de domínio de email ("ghotmail.com" → "hotmail.com",
caso real de 16/07) com correção em 1 toque — sem nunca bloquear o envio.

## Arquivos

- **Criar:** src/scripts/lead-validacao.ts (módulo compartilhado: telefoneValido, máscara, sugerirEmail)
- **Modificar:** LeadFormModal.astro (validação tel + máscara + sugestão), lives-semanais-v1.astro (idem), LeadChat.astro (regra compartilhada + máscara + confirmação de typo no fluxo do chat), AplicacaoForm.astro (regra + máscara compartilhadas + sugestão)
