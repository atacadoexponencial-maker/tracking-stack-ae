# Notificação de prova social na `/lives-semanais-v2`

**Data:** 2026-07-31
**Status:** desenho aprovado, pronto para implementação

## Problema

A `/lives-semanais-v2` não tem formulário: os CTAs mandam direto para
`/grupo-da-live`. A página precisa transmitir que outras pessoas estão entrando
no grupo agora, para reduzir a hesitação de quem chega e encontra a página parada.

## Decisão: conteúdo 100% fictício

Foram avaliadas quatro fontes (evento real sem nome, evento real com nome,
fictício, e misto). A escolha foi **100% fictício**.

Consequências assumidas:

- **Nenhum dado pessoal real vai à página.** Exibir o primeiro nome de um lead
  numa página pública seria publicar dado pessoal sem consentimento para esse fim
  — o lead consentiu em ser contatado, não em virar prova social. Com conteúdo
  fictício essa exposição deixa de existir.
- **Cada balão afirma um fato específico que não aconteceu.** Registrado aqui
  como decisão consciente de marketing da responsável pelo site, não como
  efeito colateral despercebido.

Como nada vem do banco, a feature **não tem backend**: sem API, sem D1, sem cron.
Roda inteira no navegador.

## Componentes

### 1. Catálogo — `src/data/prova-social.js`

Lista de ~25 primeiros nomes brasileiros, femininos e masculinos. Mesma
convenção de `src/data/materiais.js`: catálogo em `.js` puro, fora do
componente, para trocar ou acrescentar nome ser edição de uma linha.

Só primeiros nomes: sem sobrenome e sem cidade. Nome completo somado a cidade
descreveria uma pessoa específica, e por acaso pode existir.

### 2. Componente — `src/components/ProvaSocialLive.astro`

Usado **apenas** na `/lives-semanais-v2`. Nenhuma outra página muda.

**Texto:** `<Nome> acabou de entrar no grupo · há X minutos`, com X sorteado
entre 2 e 15.

**Cadência:**

| Momento | Comportamento |
|---|---|
| Primeira aparição | 20–30s após o carregamento (sorteado) |
| Seguintes | a cada 45–90s (sorteado a cada vez) |
| Duração na tela | 5s, some sozinho |

O intervalo **sorteado** é o ponto da feature. Intervalo fixo é percebido como
padrão em duas repetições e denuncia o script; variar é o que faz parecer
movimento real.

**Sem repetição na sessão:** a ordem dos nomes é embaralhada no carregamento e
consumida em fila. Ver o mesmo nome duas vezes em três minutos é o que mais
entrega a encenação. Esgotada a fila, ela é reembaralhada.

**Aparência:** balão no canto inferior esquerdo, entrando com um deslize curto.

### 3. Restrições de tela

- **No celular, não pode cobrir o CTA.** A notificação não compete com o botão
  que é a razão de existir da página.
- **Respeita `prefers-reduced-motion`:** quem configurou o sistema para menos
  animação recebe o balão sem o deslize (ele aparece e some, sem movimento).

## Fora de escopo

- Qualquer evento de tracking. O balão não é medido.
- Qualquer chamada de rede.
- As demais páginas do site.
- Uso de entradas reais de `whatsapp_group_events`.
