# 65: Validação de campos do formulário de aplicação

**Tipo:** Implementação
**Página:** Página de Aplicação (`/aplicacao-mentoria`)

## Descrição

Implementar a validação client-side (apenas de formato) dos 8 campos do formulário: Nome inválido se vazio ou < 2 caracteres ("Digite seu nome."); WhatsApp com máscara de telefone brasileiro enquanto digita e inválido com < 10 dígitos ("Digite um WhatsApp válido com DDD."); Email inválido se vazio ou fora do formato nome@dominio ("Digite um email válido."); Instagram inválido se vazio ("Digite o @ da sua marca."); Faturamento inválido se nenhuma faixa escolhida ("Escolha a faixa de faturamento."); Cargo inválido se nenhuma opção escolhida ("Escolha o seu cargo."); Principal desafio e Maior objetivo inválidos com < 2 caracteres ("Conta um pouquinho pra gente."). Mensagens de erro aparecem junto ao campo e somem quando o campo é corrigido; clicar em enviar com campos inválidos bloqueia o envio, exibe as mensagens, leva o foco ao primeiro campo inválido e preserva todos os valores já preenchidos. Reutilizar os padrões de validação/máscara já existentes no componente de formulário de lead do site.

## Plano

### Padrões e código reutilizados (pesquisa feita na base)

- **Validadores e mensagens de erro:** copiar dos steps do `src/components/LeadChat.astro` (linhas 201–207), que já validam exatamente os mesmos campos com as mesmas regras/mensagens da spec:
  - `nome`: `v.trim().length >= 2` → "Digite seu nome."
  - `telefone`: `v.replace(/\D/g, '').length >= 10` → **usar a mensagem da spec literalmente: "Digite um WhatsApp válido com DDD."** (a do LeadChat grafa "Whatsapp"; a spec/issue grafa "WhatsApp" — prevalece a spec)
  - `email`: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())` → "Digite um email válido."
  - `instagram`: `v.trim().length >= 1` → "Digite o @ da sua marca."
  - `justificativa` e `objetivo`: `v.trim().length >= 2` → "Conta um pouquinho pra gente."
- **Selects (novos, sem equivalente no LeadChat, que usa botões de escolha):** válido quando `select.value !== ''` (a option placeholder tem `value=""`):
  - `faturamento` → "Escolha a faixa de faturamento."
  - `cargo` → "Escolha o seu cargo."
- **Máscara de telefone brasileiro:** NÃO existe em nenhum lugar da base (LeadChat só valida dígitos; LeadFormModal usa `type="tel"` puro) — é código novo nesta issue. Implementar no listener de `input` do campo `telefone`: extrair dígitos com `replace(/\D/g, '')`, limitar a 11, formatar `(DD) XXXX-XXXX` (10 dígitos) / `(DD) XXXXX-XXXX` (11 dígitos), sempre recalculando a partir dos dígitos (assim apagar caracteres funciona naturalmente).
- **Onde mora a lógica:** não há utilitário compartilhado (`src/utils` não existe); o padrão do projeto é script inline por página/componente (LeadFormModal, LeadChat e lives-semanais-v1 duplicam a lógica entre si). Seguir o padrão: tudo no `<script>` da própria página, sem criar módulo novo.
- **Por que NÃO usar `checkValidity()/reportValidity()`** (padrão do LeadFormModal e do lives-semanais-v1): a spec exige mensagem customizada por campo, visível junto ao campo, que some ao corrigir, e foco no primeiro inválido — o balão nativo do navegador não atende (mensagem genérica, um campo por vez, some sozinho). A validação aqui é manual, no padrão dos `validate`/`errorMsg` do LeadChat.
- **Elemento de erro por campo:** adicionar um `<small class="aplicacao__field-erro" hidden>` dentro de cada `label.aplicacao__field`, após o input/select (a spec pede erro "junto ao campo"). O `<p id="aplicacao-erro">` existente fica intocado — reservado para o erro geral de envio da issue 66.

### Estrutura do script (pensada para a issue 66 plugar o envio)

Um único handler de `submit` no `#aplicacao-form-el`:

```
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const firstInvalid = validateAll();      // valida os 8 campos, mostra/esconde os erros por campo
  if (firstInvalid) { firstInvalid.focus(); return; }
  // issue 66: envio ao /tracker + estado "Enviando…" + redirect entram AQUI, sem mexer na validação
});
```

- `FIELDS`: array de `{ name, validate(v), errorMsg }` (mesmo shape dos steps do LeadChat), na ordem do form — garante que o "primeiro inválido" é o primeiro na ordem visual.
- `validateAll()`: percorre `FIELDS`, atualiza o `<small>` de cada campo e devolve o primeiro elemento inválido (ou `null`).
- Correção em tempo real: listener de `input` nos inputs de texto e `change` nos selects que revalida só aquele campo e esconde a mensagem quando ele fica válido (não exibe erro novo enquanto digita — erro só aparece no submit; depois do primeiro submit o campo se atualiza ao corrigir).
- Máscara: listener de `input` extra só no `telefone` (roda antes da revalidação).
- `preventDefault()` sempre — valores preenchidos nunca se perdem porque a página nunca recarrega.
- Marcar `aria-invalid="true"` no campo inválido (e remover ao corrigir) para acessibilidade.

## Cenários

### Happy Path

1. Visitante preenche o nome ("Maria"), digita o WhatsApp e vê a máscara se formar enquanto digita: "11987654321" vira "(11) 98765-4321".
2. Preenche email válido, instagram, escolhe uma faixa de faturamento e um cargo nos selects, escreve desafio e objetivo com 2+ caracteres.
3. Nenhuma mensagem de erro aparece em momento algum (erros só aparecem no submit).
4. Clica em "ENVIAR APLICAÇÃO →": a validação passa, nenhum erro é exibido e o fluxo segue para o ponto de envio (nesta issue, nada acontece após a validação — o envio é a issue 66; o submit nativo continua bloqueado pelo `preventDefault`).

### Edge Cases

- **Telefone colado com +55 ou pontuação** ("+55 (11) 98765-4321"): a máscara descarta não-dígitos e mantém só os 11 primeiros dígitos — o "55" do código do país entra como se fosse DDD e o visitante vê o resultado formatado na hora para corrigir. A validação segue valendo por contagem de dígitos (≥ 10); nunca lança erro durante a digitação, só no submit.
- **Telefone fixo (10 dígitos)**: válido — máscara `(11) 3456-7890`, validação `>= 10` aceita.
- **Telefone com 9 dígitos ou menos**: inválido no submit → "Digite um WhatsApp válido com DDD." junto ao campo.
- **Apagar caracteres no telefone**: máscara recalculada a partir dos dígitos restantes — sem parêntese/hífen "órfão" travado.
- **Campos só com espaços** (nome "  ", desafio " "): `trim()` antes de medir — inválidos.
- **Email sem TLD** ("maria@gmail"): regex exige ponto após o domínio — inválido, "Digite um email válido.".
- **Vários campos inválidos ao enviar**: todas as mensagens aparecem ao mesmo tempo, cada uma junto ao seu campo; o foco vai só para o PRIMEIRO inválido na ordem do form; valores já digitados permanecem intactos.
- **Corrigir um campo após o submit com erro**: ao digitar/selecionar valor válido, a mensagem daquele campo some na hora (listener de `input`/`change`); as dos demais campos inválidos permanecem.
- **Selects intocados no submit**: `value === ''` (option placeholder) → "Escolha a faixa de faturamento." / "Escolha o seu cargo.".
- **Enter em um input de texto**: dispara o submit do form — cai no mesmo handler (mesma validação), sem comportamento paralelo.
- **JS desabilitado**: sem validação e sem máscara (scripts não rodam) — mesma limitação já aceita no LeadChat/LeadFormModal; o envio (issue 66) também é JS, então nenhum lead inválido entra no fluxo por esse caminho.

### Cenário de Erro

- **Submit com o form inteiro vazio**: envio bloqueado (`preventDefault` + retorno antecipado), as 8 mensagens aparecem (cada uma junto ao seu campo), o foco vai para o campo `nome` (primeiro inválido) e nada é enviado ao backend — nenhuma chamada de rede acontece nesta issue.
- **Elemento de erro ausente no DOM** (regressão de markup): o script usa guards no padrão do site (`if (form && ...)`) e busca o `<small>` relativo ao campo; se não achar, não lança exceção — a validação continua bloqueando o submit inválido mesmo sem exibir a mensagem daquele campo.

## Arquivos

- **Modificar:** `src/pages/aplicacao-mentoria.astro` — único arquivo tocado:
  1. Markup: adicionar `<small class="aplicacao__field-erro" hidden></small>` dentro de cada um dos 8 `label.aplicacao__field`, após o input/select.
  2. `<style>`: adicionar a regra `.aplicacao__field-erro { color: hsl(var(--destructive)); font-size: 0.8rem; }` (mesmo token do `.aplicacao__erro` existente).
  3. `<script>` (novo, no fim do arquivo, padrão dos scripts inline do site): array `FIELDS` com os validadores/mensagens copiados do LeadChat + os dois selects, função `validateAll()`, máscara de telefone no `input` do campo `telefone`, listeners de `input`/`change` para limpar erro ao corrigir e handler único de `submit` com `preventDefault` + foco no primeiro inválido, deixando o ponto de inserção comentado para a issue 66.

Nenhum arquivo criado. `LeadChat.astro`, `LeadFormModal.astro` e `lives-semanais-v1.astro` são só referência de padrão — não sofrem alteração. Backend não é tocado (validação de formato é client-side; o backend já tem as próprias defesas).

## Checklist

- [x] Adicionar `<small class="aplicacao__field-erro" hidden>` em cada um dos 8 campos do form, dentro do `label`, após o input/select
- [x] Estilo `.aplicacao__field-erro` com `hsl(var(--destructive))` no `<style>` escopado
- [x] `<script>` com array `FIELDS` na ordem do form usando os validadores do LeadChat: nome ≥ 2 chars (trim), telefone ≥ 10 dígitos, email pela regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`, instagram não vazio, justificativa/objetivo ≥ 2 chars (trim)
- [x] Validação dos selects: `faturamento` e `cargo` inválidos quando `value === ''`
- [x] Mensagens de erro EXATAS da spec: "Digite seu nome." / "Digite um WhatsApp válido com DDD." / "Digite um email válido." / "Digite o @ da sua marca." / "Escolha a faixa de faturamento." / "Escolha o seu cargo." / "Conta um pouquinho pra gente." (desafio e objetivo)
- [x] Máscara de telefone brasileiro no `input` do campo `telefone`: só dígitos, máx. 11, formata `(DD) XXXX-XXXX` / `(DD) XXXXX-XXXX`, recalculada a cada tecla (apagar funciona)
- [x] Handler único de `submit` com `e.preventDefault()`: valida tudo, exibe as mensagens dos inválidos, foca o primeiro inválido e retorna; com tudo válido, apenas não faz nada (comentário marcando onde a issue 66 pluga o envio)
- [x] Erro de campo some assim que o campo é corrigido (listener `input` nos textos, `change` nos selects); `aria-invalid` acompanha o estado
- [x] Valores preenchidos preservados após submit bloqueado (sem reload, sem reset)
- [x] `<p id="aplicacao-erro">` existente permanece intocado (reservado ao erro de envio da issue 66)
- [x] Nenhum outro arquivo modificado; sem atributos `required` nativos (mensagens são as customizadas)
- [x] `npm run build` passa; teste manual: submit vazio mostra os 8 erros e foca o nome; corrigir um campo apaga só o erro dele; form válido não exibe erro
