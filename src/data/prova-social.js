// Nomes exibidos no balão de prova social da /lives-semanais-v2 (issue 184).
//
// O conteúdo é FICTÍCIO por decisão de projeto (spec 2026-07-31): nenhum dado de
// lead real vai para a página. Publicar o primeiro nome de um lead seria expor
// dado pessoal sem consentimento para esse fim — quem preencheu um formulário
// consentiu em ser contatado, não em virar prova social numa página pública.
//
// Vive fora do componente, como src/data/materiais.js: trocar ou acrescentar
// nome é editar uma linha aqui, sem tocar na lógica do balão.
//
// Só PRIMEIRO nome, sem sobrenome e sem cidade. Nome completo somado a cidade
// descreveria uma pessoa específica — que por acaso pode existir de verdade.
export const NOMES_PROVA_SOCIAL = [
  'Fernanda', 'Juliana', 'Patrícia', 'Camila', 'Aline',
  'Renata', 'Vanessa', 'Simone', 'Débora', 'Larissa',
  'Cristiane', 'Priscila', 'Tatiane', 'Michele', 'Rafaela',
  'Bruna', 'Carolina', 'Adriana', 'Luciana', 'Sandra',
  'Rodrigo', 'Marcelo', 'Thiago', 'Anderson', 'Fábio',
];
