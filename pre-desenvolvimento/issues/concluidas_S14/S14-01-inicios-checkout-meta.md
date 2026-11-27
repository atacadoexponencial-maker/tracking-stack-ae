# S14-01: Inícios de checkout do Meta no painel Imersão 2027

**Tipo:** Avulsa
**Spec:** nenhuma (issue avulsa, combinada na triagem)
**Depende de:** nenhuma
**Risco:** sim (migration no D1: coluna nova em `ad_spend`)

## Descrição

O checkout da Zouti envia o início de checkout direto ao Meta, sem passar pelo nosso sistema,
então "Page to checkout" e "Checkout to compra" ficavam em "—". A coleta diária do Meta passa
a gravar também os inícios de checkout atribuídos aos anúncios (coluna nova
`ad_spend.initiate_checkouts`), e a aba Imersão 2027 usa esse número, comparando só com o que
veio de anúncio: visitas com UTM da Imersão e ingressos vindos do tráfego pago.

## Pronto quando

A subaba "Tráfego e página" mostra "Page to checkout" e "Checkout to compra" com números.

## Critérios de aceite

- **CA-S14-01** (automática) — A coleta do Meta grava os inícios de checkout. Dado o Windsor devolvendo, por campanha e dia, o gasto e os inícios de checkout do pixel, quando a coleta roda, então cada linha de `ad_spend` guarda os inícios de checkout daquela campanha e dia (0 quando o campo vem vazio).
- **CA-S14-02** (automática) — Page to checkout e checkout to compra com o número do Meta. Dado inícios de checkout das campanhas da Imersão, visitas com e sem UTM da Imersão e ingressos com e sem UTM de tráfego pago, quando a aba é aberta com venda real, então page to checkout = inícios ÷ visitas de anúncio e checkout to compra = ingressos do tráfego pago ÷ inícios.
- **CA-S14-03** (automática) — Zero início de checkout e banco sem a coluna. Dado a coluna nova com 0 inícios nas campanhas da Imersão, quando a aba é aberta com venda real, então page to checkout mostra 0% e checkout to compra fica em "—" (não divide por zero); e dado um banco sem a coluna `initiate_checkouts`, o investimento continua aparecendo e as duas taxas ficam em "—".

## Suposições

| Suposição | Status |
|---|---|
| O campo do Windsor é `actions_offsite_conversion_fb_pixel_initiate_checkout` ("Website Checkouts Initiated"). | confirmada (lido no Windsor em 27/11/2026: 19 inícios nas campanhas da Imersão desde 16/11) |
| Os dias de 16/11 a 20/11 se completam na coleta de domingo, que usa janela de 28 dias. | confirmada (lida no código de `functions/api/sync/meta-ads.js`) |

## Perguntas em aberto

Nenhuma.

## Arquivos

- **Criar:** `migrations/0073_ad_spend_inicios_checkout.sql`
- **Modificar:** `functions/api/sync/meta-ads.js` — pede e grava os inícios de checkout (Windsor e Meta direta).
- **Modificar:** `functions/api/imersao/index.js` — lê a soma dos inícios de checkout das campanhas da Imersão.
- **Modificar:** `functions/api/_imersao.js` — taxas de checkout só com o que veio de anúncio quando o número é do Meta.
- **Criar:** `tests/imersao-checkout.test.js`
