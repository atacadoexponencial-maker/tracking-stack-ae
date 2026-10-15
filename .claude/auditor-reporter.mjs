// Adaptador do auditor do fluxo (~/.claude/skills/auditor): o auditor lê o
// resultado no formato JSON do Vitest, e este projeto testa com node --test.
// Usado só pelo comandoTeste de .claude/auditor.json.
export default async function* reporter(source) {
  const porArquivo = new Map();
  for await (const ev of source) {
    if (ev.type !== 'test:pass' && ev.type !== 'test:fail') continue;
    const d = ev.data;
    if (d.details?.type === 'suite') continue;
    const status = ev.type === 'test:fail' ? 'failed' : d.skip || d.todo ? 'skipped' : 'passed';
    const arq = d.file || '';
    if (!porArquivo.has(arq)) porArquivo.set(arq, []);
    porArquivo.get(arq).push({ title: d.name, status });
  }
  yield JSON.stringify({ testResults: [...porArquivo].map(([name, assertionResults]) => ({ name, assertionResults })) });
}
