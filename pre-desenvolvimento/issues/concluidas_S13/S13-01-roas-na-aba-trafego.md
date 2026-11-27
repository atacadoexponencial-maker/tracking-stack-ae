# S13-01: ROAS na aba de tráfego da Imersão 2027

**Tipo:** Avulsa
**Spec:** nenhuma (issue avulsa, combinada na triagem)
**Depende de:** nenhuma
**Risco:** não

## Descrição

O ROAS (faturamento total até agora ÷ investido em anúncios) só aparecia no bloco "Evento e
pós". Ele passa a ter um card em destaque na subaba "Tráfego e página", logo depois do
"Investido até agora", com o mesmo número do bloco de resultado.

## Pronto quando

A subaba "Tráfego e página" mostra o card ROAS em destaque, ao lado do investido.

## Critérios de aceite

- **CA-S13-01** (automática) — ROAS na aba de tráfego. Dado faturamento de ingressos e bump e um investimento em anúncios, quando a subaba "Tráfego e página" é desenhada, então o segundo card é "ROAS", em destaque, com faturamento total ÷ investimento, igual ao ROAS do bloco de resultado.

## Suposições

Nenhuma.

## Perguntas em aberto

Nenhuma.

## Arquivos

- **Modificar:** `functions/api/_imersao.js` — `trafego.roas`, o mesmo valor de `resultado.roas`.
- **Modificar:** `public/dash/imersao.js` — card "ROAS" em destaque depois do investido.
- **Modificar:** `public/dash/index.html` — nova versão do `imersao.js` (cache de 4h).
- **Criar:** `tests/imersao-roas.test.js`
