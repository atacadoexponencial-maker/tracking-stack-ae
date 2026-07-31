# 184: Notificação de prova social na /lives-semanais-v2

**Tipo:** Implementação
**Página:** /lives-semanais-v2

## Descrição

Exibir na LP da live um balão de prova social com nomes fictícios ("Fernanda acabou de entrar no grupo · há 3 minutos"), aparecendo em intervalos sorteados, sem nenhum dado real e sem chamada de rede.

## Cenários

### Happy Path
A pessoa chega na página. Entre 20 e 30s aparece o primeiro balão no canto inferior esquerdo, fica 5s e some. Os seguintes aparecem a cada 45–90s, com nome diferente a cada vez.

### Edge Cases
- **Fila de nomes esgotada** (visita longa): reembaralha e recomeça, sem repetir nome em sequência.
- **`prefers-reduced-motion`:** o balão aparece e some sem o deslize.
- **Celular:** o balão fica acima do rodapé e não pode cobrir o CTA.
- **Aba em segundo plano:** os temporizadores do navegador atrasam sozinhos; nenhum tratamento especial, e um balão atrasado não causa dano.

### Cenário de Erro
Não há caminho de erro: sem rede, sem banco, sem estado persistido.

## Arquivos

- **Criar:** `src/data/prova-social.js` — catálogo de ~25 primeiros nomes brasileiros.
- **Criar:** `src/components/ProvaSocialLive.astro` — o balão, seu estilo e a lógica de cadência.
- **Modificar:** `src/pages/lives-semanais-v2.astro` — importar e usar o componente. Nenhuma outra página.

## Código reutilizável

- `src/data/materiais.js` — convenção de catálogo em `.js` puro fora do componente.
- `src/components/` — padrão de componente Astro com `<style>` no próprio arquivo.

## Checklist

- [x] Criar `src/data/prova-social.js` com os nomes (só primeiro nome, sem cidade)
- [x] Criar `src/components/ProvaSocialLive.astro`
- [x] Texto: `<Nome> acabou de entrar no grupo · há X minutos` (X sorteado de 2 a 15)
- [x] Primeira aparição em 20–30s; seguintes a cada 45–90s; 5s na tela
- [x] Embaralhar a fila e não repetir nome na mesma sessão
- [x] Respeitar `prefers-reduced-motion`
- [x] No celular, não cobrir o CTA
- [x] Usar o componente SÓ na `/lives-semanais-v2`
- [x] Nenhum evento de tracking e nenhuma chamada de rede
