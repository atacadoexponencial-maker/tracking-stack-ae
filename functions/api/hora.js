// GET /api/hora
//
// Devolve a hora do SERVIDOR em epoch de milissegundos. Existe por causa do
// contador de virada de lote da LP do Workshop Black Exponencial.
//
// Por que não usar o relógio do visitante: a LP é estática (`output: 'static'`)
// e até 2026-08-12 quem decidia o lote era o `Date.now()` do aparelho. Isso era
// um risco aceito enquanto só o PREÇO dependia disso — aparelho com data errada
// via o preço errado, e ponto. Um contador regressivo torna o mesmo erro
// escancarado: um celular adiantado dois dias anuncia "faltam 3 horas" para
// quem ainda tem dois dias, e um atrasado conta tempo que já acabou.
//
// Contrato: `{ "agora": 1786567890123 }` — número, epoch em ms, UTC.
//
// `no-store` é obrigatório: uma resposta cacheada devolveria a hora de quando
// foi gerada, que é exatamente o erro que este endpoint existe para evitar. Vale
// para o cache do navegador e para o da Cloudflare.
//
// Sem autenticação de propósito: a informação é pública (qualquer resposta HTTP
// já carrega o header `Date`) e o custo de uma chamada é desprezível.

export async function onRequestGet() {
  return new Response(JSON.stringify({ agora: Date.now() }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
