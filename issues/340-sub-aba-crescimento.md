# 340: Tela Instagram no ar com a sub-aba Crescimento

**Tipo:** Implementação
**Página:** Dash → Marketing → Instagram, módulos 2, 3, 4, 4b, 5 e 9 da spec `spec-central-marketing-instagram.md`

## Descrição

Colocar em produção o grupo Marketing no menu e a tela Instagram lendo da Neon:
cabeçalho com perfil, "atualizado há" e aviso de coleta atrasada, filtro de
datas, sub-abas, e a sub-aba Crescimento completa (cartões com orgânico e pago e
comparação com o período anterior, bloco de seguidores com ganhos, perdidos,
saldo e total, e o gráfico diário com seletor de métrica e marcação de dias com
publicação), mais os estados de carregamento, erro e "coleta ainda não rodou".

## Pronto quando

- No dash em produção, depois da chave de acesso, Marketing → Instagram abre em
  Crescimento com os números reais da Neon.
- Trocar o período muda todos os números e gráficos; a comparação usa o período
  anterior de mesmo tamanho, e mostra "sem comparação" quando não há dado.
- Alcance, visualizações e interações mostram orgânico e anúncios separados;
  visitas ao perfil, toques no link e seguidores levam o selo "inclui anúncios".
- Dias sem coleta aparecem como lacuna, não como zero; o aviso de início do
  histórico de seguidores aparece.
- Link direto para a tela e para uma sub-aba funciona.
- Se a Neon não responder, o bloco mostra erro com "tentar de novo" e os outros
  seguem visíveis.
- As outras sub-abas existem no menu de sub-abas, mesmo que ainda vazias.

## Observações

- Depende de 336 (tela e contrato) e 337 (dados).
- Nenhum cálculo no navegador: orgânico, saldo, variações e totais chegam prontos
  do endpoint (thin client).
- A leitura segue o padrão da aba Argo (`functions/api/_argo-db.js`), com
  credencial própria de só leitura na área `marketing`.
