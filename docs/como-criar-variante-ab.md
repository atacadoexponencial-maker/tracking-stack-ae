# Como criar uma variante de teste A/B

## 1. Crie a página da variante

O arquivo precisa estar exatamente em `src/pages/ab/<slug>/b.astro`, onde
`<slug>` é o identificador do teste cadastrado no painel.

**Variação pontual** (mesma página, copy diferente) — reusa os componentes:

```astro
---
import BaseLayout from '../../../layouts/BaseLayout.astro';
import Hero from '../../../components/sections/Hero.astro';
// ...as mesmas seções da página original
---
<BaseLayout noindex>
  <Hero headline="A nova headline que está sendo testada" />
  <!-- ...o resto igual à original -->
</BaseLayout>
```

**Página inteira nova** — escreva o que quiser, só mantenha o `noindex`:

```astro
---
import BaseLayout from '../../../layouts/BaseLayout.astro';
---
<BaseLayout noindex>
  <!-- layout completamente diferente -->
</BaseLayout>
```

O `noindex` não é opcional: sem ele, o Google poderia indexar a variante como
página separada e ela competiria com a original nos resultados de busca.

## 2. Cadastre o teste no painel

Aba **Testes A/B** do dashboard → **Novo teste**. O identificador precisa ser
o mesmo `<slug>` da pasta.

## 3. Confira a variante antes de ligar

O painel mostra o link de preview de cada teste em rascunho. Ele abre a
variante direto, e marca sua sessão para ficar fora da contagem.

## 4. Ative

O teste só começa a repartir tráfego depois de ativado, e a mudança leva até
1 minuto para valer em todos os servidores de borda.

## O que NÃO fazer

- **Não mexa na página A enquanto o teste roda.** Mudar a original no meio do
  caminho compara duas coisas que não existiram ao mesmo tempo.
- **Não encerre antes dos alvos.** O painel diz `Ainda rodando` por um motivo:
  parar assim que o número fica bonito transforma 5% de chance de erro em mais
  de 30%.
- **Não rode dois testes na mesma página.** O endpoint recusa, mas vale saber
  por quê: os efeitos se misturam e nenhum dos dois resultados vale.
