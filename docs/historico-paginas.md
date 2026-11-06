# Histórico das páginas

Qual versão de cada página estava no ar em cada período. Serve para ler o
dash: a linha de uma página (ex.: `/`) junta todas as versões que passaram
por aquele endereço, e durante um teste A/B metade das visitas viu a variante
B **sem a URL mudar**.

Atualizar a cada troca de página ou teste A/B: data, página, o que mudou,
commit. Os testes também ficam na aba Testes A/B do dash (tabela `ab_tests`).

## Home (`/`), funil `sessao-estrategica`

| Período | O que estava no ar | Commit |
|---|---|---|
| até 17/09/2026 | Home antiga ("Plano de Ação para faturar R$ 400 mil") | anterior a `20a2791` |
| 17/09 a 06/11/2026 | Ex-/se-v2: hero "Descubra em 35 minutos qual dos 2 gargalos está travando o seu atacado" | `20a2791` |
| 17/09 a 06/10/2026 | **A/B** home × /se-v3 (mesma copy, foto do Felipe ocupando o hero no celular). A: 36 leads / 1.116 visitas. B: 36 / 1.115. Empate exato; A mantida | — |
| 19/10 a 06/11/2026 | **A/B** home × /se-v4. A: 38 leads / 1.540 visitas (2,47%). B: 41 / 1.524 (2,69%). Empate estatístico; B escolhida como desempate | `d382d6e` (se-v4) |
| desde 06/11/2026 | Ex-/se-v4: hero "Por que só chega varejo no seu atacado?" + bolinhas com os 4 vídeos de depoimento. /se-v4 manda para `/` (301) | `d59a48c` |
| desde 06/11/2026 (noite) | Mesma home, com o marca-texto em "seu atacado" (antes em "varejo") e o logo centralizado no celular | este commit |
| a partir do cadastro na aba A/B | **A/B** home × /se-v5: no lugar do botão, a pergunta do Felipe (foto pequena) "Onde o seu atacado trava hoje?" com 2 respostas que abrem o chat já respondido; a escolha vai para o card do ClickUp. Só no celular, a B também esconde o subtítulo, para os botões caberem na primeira tela. Meta sugerida: 21 dias e 40 leads por versão | este commit |

## Workshop gratuito (`/workshop-gratuito`), funil `workshop`

| Período | O que estava no ar | Commit |
|---|---|---|
| desde 29/09/2026 | LP perene, hero "A conta que faz um atacado crescer tem dois lados" | `3a95896` |
| 29/09 a 15/10/2026 | **A/B** selos × stories de depoimento no hero (/workshop-gratuito-v2). Sem vencedor | `aad61ba` |
| 19/10 a 03/11/2026 | **A/B** × /workshop-gratuito-v3 (hero "varejo disfarçado"). A: 53 leads / 433 visitas. B: 52 / 446. Venceu a A | `688587f` |
| desde 06/11/2026 19h31 | **A/B** × /workshop-gratuito-v4: primeira tela enxuta, título "O lojista pede o catálogo e some?", aula de 18/11 19h e formulário aberto no hero. Vai até 18/11 (não há outra aula em 2026) | `777655e`, `4fdae9a`, `5875619` |
