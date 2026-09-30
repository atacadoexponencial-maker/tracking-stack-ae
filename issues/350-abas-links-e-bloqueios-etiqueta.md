# 350: Abas Links e Bloqueios na direção "Etiqueta"

**Tipo:** Implementação
**Página:** Dash, abas Links e Bloqueios
**Spec:** `spec.md` (Módulos 11 e 12)

## Descrição

Reestilizar as duas abas com os componentes da fundação: Links com etiquetas "No ar agora", tabela de destinos com selo `ar` no vigente e formulário "Novo destino"/"Editar destino" com botões primário, secundário e perigo; Bloqueios com tabela de leads bloqueados (motivo em selo, botão "Devolver ao CRM") e estado vazio que ensina. Inclui a correção de comportamento da spec: apagar um destino confirma na própria linha, sem diálogo do navegador.

## Pronto quando

- Na preview, Links e Bloqueios aparecem no mundo claro com os mesmos dados de produção.
- Criar um destino o coloca na tabela sem recarregar; editar muda o título do bloco para "Editar destino".
- Apagar um destino pede confirmação dentro da própria linha e nunca abre `confirm()` do navegador.
- Devolver um lead ao CRM some com a linha e mostra aviso de sucesso; sem bloqueados, o estado vazio aparece.
