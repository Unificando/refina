const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { parseArgs } = require('../src/args');
const { buildTemplate } = require('../src/buildTemplate');
const { loadBasePrompt } = require('../src/loadBasePrompt');
const { saveMarkdown } = require('../src/saveMarkdown');
const { runPrompt, RunError } = require('../src/runPrompt');
const { main } = require('../bin/cli');
const pkg = require('../package.json');

test('parseArgs: junta posicionais em text e reconhece flags', () => {
  const args = parseArgs(['ideia', 'crua', '--project']);
  assert.equal(args.text, 'ideia crua');
  assert.equal(args.project, true);
  assert.equal(args.save, false);
});

test('parseArgs: --title consome o próximo argumento', () => {
  const args = parseArgs(['--save', '--title', 'Meu Titulo']);
  assert.equal(args.save, true);
  assert.equal(args.title, 'Meu Titulo');
  assert.equal(args.text, null);
});

test('parseArgs: -h e -v', () => {
  assert.equal(parseArgs(['-h']).help, true);
  assert.equal(parseArgs(['-v']).version, true);
});

test('loadBasePrompt: retorna o conteúdo do prompt-base empacotado', () => {
  const base = loadBasePrompt();
  assert.equal(typeof base, 'string');
  assert.ok(base.trim().length > 0);
});

test('buildTemplate: embute a descrição e omite <arquitetura> por padrão', () => {
  const out = buildTemplate('BASE', 'texto do usuario');
  assert.ok(out.includes('<descricao>\ntexto do usuario\n</descricao>'));
  assert.ok(!out.includes('<arquitetura>'));
});

test('buildTemplate: --project ativa o bloco <arquitetura>', () => {
  const out = buildTemplate('BASE', 'x', { project: true });
  assert.ok(out.includes('<arquitetura>'));
});

test('saveMarkdown: grava um .md com título e conteúdo', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcu-'));
  const cwd = process.cwd();
  process.chdir(dir);
  try {
    const filePath = saveMarkdown('primeira linha\ncorpo', { titleOverride: 'Titulo Teste' });
    assert.ok(filePath.endsWith('.md'));
    const content = fs.readFileSync(filePath, 'utf-8');
    assert.ok(content.startsWith('# Titulo Teste\n\n'));
    assert.ok(content.includes('primeira linha'));
  } finally {
    process.chdir(cwd);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('saveMarkdown: não duplica H1 quando o conteúdo já abre com #', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcu-'));
  const cwd = process.cwd();
  process.chdir(dir);
  try {
    const filePath = saveMarkdown('# Titulo Pronto\n\ncorpo do resultado');
    const content = fs.readFileSync(filePath, 'utf-8');
    assert.ok(content.startsWith('# Titulo Pronto\n\n'), `não pode duplicar H1: ${content.slice(0, 40)}`);
    assert.equal(content.match(/^# /gm).length, 1);
    assert.equal(path.basename(filePath).startsWith('titulo-pronto'), true);
  } finally {
    process.chdir(cwd);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('parseArgs: --raw', () => {
  assert.equal(parseArgs(['--raw']).raw, true);
  assert.equal(parseArgs(['texto']).raw, false);
});

test('parseArgs: --llm consome o próximo argumento; sem valor fica null', () => {
  assert.equal(parseArgs(['--llm', 'gemini']).llm, 'gemini');
  assert.equal(parseArgs(['--llm']).llm, null);
  // valor que parece flag não é engolido
  assert.equal(parseArgs(['--llm', '--raw']).llm, null);
  assert.equal(parseArgs(['--llm', '--raw']).raw, true);
});

test('runPrompt: commandOverride ecoa o template via stdin', async () => {
  const template = 'template de teste';
  const res = await runPrompt(template, {
    commandOverride: ['node', '-e', 'process.stdin.pipe(process.stdout)'],
    cwd: process.cwd(),
  });
  assert.equal(res.stdout, template);
  assert.equal(res.exitCode, 0);
  assert.equal(res.stderr, '');
});

test('runPrompt: exit != 0 rejeita com stderr', async () => {
  await assert.rejects(
    runPrompt('x', {
      commandOverride: ['node', '-e', 'process.stderr.write("boom"); process.exit(3)'],
    }),
    (err) => {
      assert.ok(err instanceof RunError);
      assert.equal(err.code, 'RUN_FAILED');
      assert.equal(err.exitCode, 3);
      assert.ok(err.message.includes('boom'));
      return true;
    }
  );
});

test('runPrompt: sem CLI local no PATH rejeita com LLM_NOT_FOUND', () => {
  const env = { ...process.env, PATH: '' };
  return assert.rejects(
    runPrompt('x', { llm: 'auto', env }),
    (err) => err instanceof RunError && err.code === 'LLM_NOT_FOUND'
  );
});

test('runPrompt: --llm inválido rejeita com LLM_INVALID', () => {
  return assert.rejects(
    runPrompt('x', { llm: 'inexistente' }),
    (err) => err instanceof RunError && err.code === 'LLM_INVALID'
  );
});

test('runPrompt: timeout rejeita com RUN_TIMEOUT', async () => {
  await assert.rejects(
    runPrompt('x', { commandOverride: ['node', '-e', 'setTimeout(() => {}, 10000)'], timeoutMs: 300 }),
    (err) => err instanceof RunError && err.code === 'RUN_TIMEOUT'
  );
});

test('runPrompt: timeout com filho imune a SIGTERM → SIGKILL e RUN_TIMEOUT (sem pendurar, sem resolver como sucesso)', async () => {
  const start = Date.now();
  await assert.rejects(
    runPrompt('x', {
      // `trap "" TERM` faz o sh ignorar SIGTERM; sem a escala para SIGKILL a
      // promise ficaria pendente e resolveria como sucesso quando o sleep
      // terminasse.
      commandOverride: ['sh', '-c', 'trap "" TERM; sleep 30'],
      timeoutMs: 300,
    }),
    (err) => err instanceof RunError && err.code === 'RUN_TIMEOUT'
  );
  assert.ok(Date.now() - start < 10000, `devia forçar SIGKILL (levou ${Date.now() - start}ms)`);
});

function makeDeps({ runPromptResult = { stdout: 'RESULTADO FINAL', stderr: '', exitCode: 0 }, readStdinValue = '', isStdinTTY = true } = {}) {
  const out = [];
  const err = [];
  const calls = { runPrompt: 0, templates: [] };
  const deps = {
    stdout: (s) => out.push(s),
    stderr: (s) => err.push(s),
    isStdinTTY,
    readStdin: async () => readStdinValue,
    runPrompt: async (template, opts) => {
      calls.runPrompt += 1;
      calls.templates.push(template);
      calls.opts = opts;
      return runPromptResult;
    },
  };
  return { deps, out, err, calls };
}

test('main: sem texto e sem --save → erro e exit 1', async () => {
  const { deps, err } = makeDeps();
  const code = await main([], deps);
  assert.equal(code, 1);
  assert.ok(err.join('').includes('Erro'));
});

test('main: --version imprime a versão do pacote', async () => {
  const { deps, out, calls } = makeDeps();
  const code = await main(['--version'], deps);
  assert.equal(code, 0);
  assert.equal(out.join(''), `${pkg.version}\n`);
  assert.equal(calls.runPrompt, 0);
});

test('main --help: imprime uso e não executa', async () => {
  const { deps, out, calls } = makeDeps();
  const code = await main(['--help'], deps);
  assert.equal(code, 0);
  assert.ok(out.join('').includes('Uso:'));
  assert.equal(calls.runPrompt, 0);
});

test('main: texto → executa runPrompt com o template e imprime só o resultado final', async () => {
  const { deps, out, calls } = makeDeps();
  const code = await main(['meu', 'texto'], deps);
  assert.equal(code, 0);
  assert.equal(calls.runPrompt, 1);
  assert.ok(calls.templates[0].includes('<descricao>\nmeu texto\n</descricao>'));
  assert.equal(out.join(''), 'RESULTADO FINAL');
});

test('main: texto --raw → imprime o meta-prompt cru sem executar', async () => {
  const { deps, out, calls } = makeDeps();
  const code = await main(['meu', 'texto', '--raw'], deps);
  assert.equal(code, 0);
  assert.equal(calls.runPrompt, 0);
  const joined = out.join('');
  assert.ok(joined.startsWith('À partir de agora você é um Engenheiro de prompt.'));
  assert.ok(joined.includes('<descricao>\nmeu texto\n</descricao>'));
});

test('main: texto --save → salva o resultado final .md direto (sem pipe)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcu-'));
  const cwd = process.cwd();
  process.chdir(dir);
  try {
    const { deps, out, err } = makeDeps({ runPromptResult: { stdout: '# Titulo Final\n\ncorpo', stderr: '', exitCode: 0 } });
    const code = await main(['meu', 'texto', '--save'], deps);
    assert.equal(code, 0);
    assert.ok(out.join('').includes('Salvo em:'));
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md'));
    assert.equal(files.length, 1);
    const content = fs.readFileSync(path.join(dir, files[0]), 'utf-8');
    assert.equal(content, '# Titulo Final\n\ncorpo');
  } finally {
    process.chdir(cwd);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('main: --save sem texto → modo legado, lê stdin e salva', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcu-'));
  const cwd = process.cwd();
  process.chdir(dir);
  try {
    const { deps, out, calls } = makeDeps({ readStdinValue: 'conteudo do stdin' });
    const code = await main(['--save'], deps);
    assert.equal(code, 0);
    assert.equal(calls.runPrompt, 0);
    assert.ok(out.join('').includes('Salvo em:'));
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md'));
    assert.equal(files.length, 1);
    const content = fs.readFileSync(path.join(dir, files[0]), 'utf-8');
    assert.ok(content.startsWith('# conteudo do stdin'));
  } finally {
    process.chdir(cwd);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('main: falha na execução → stderr com a mensagem e exit 1', async () => {
  const { deps, out, err } = makeDeps();
  deps.runPrompt = async () => {
    throw new RunError('Nenhum CLI de LLM encontrado', { code: 'LLM_NOT_FOUND' });
  };
  const code = await main(['texto'], deps);
  assert.equal(code, 1);
  assert.ok(err.join('').includes('Nenhum CLI de LLM encontrado'));
  assert.equal(out.join(''), '');
});

// --- Delta v1.0.0: <modo_direto> + opencode ---

test('buildTemplate: default não contém <modo_direto> (regressão legado)', () => {
  const out = buildTemplate('BASE', 'x');
  assert.ok(!out.includes('<modo_direto>'));
});

test('buildTemplate: direct=true adiciona <modo_direto> e menção na instrução final', () => {
  const out = buildTemplate('BASE', 'x', { direct: true });
  assert.ok(out.includes('<modo_direto>'));
  assert.ok(out.includes('Siga também a tag <modo_direto>'));
});

test('buildTemplate: direct + project juntos têm ambos os blocos', () => {
  const out = buildTemplate('BASE', 'x', { direct: true, project: true });
  assert.ok(out.includes('<arquitetura>'));
  assert.ok(out.includes('<modo_direto>'));
});

test('main: modo padrão passa template com <modo_direto> ao runPrompt', async () => {
  const { deps, calls } = makeDeps();
  const code = await main(['meu', 'texto'], deps);
  assert.equal(code, 0);
  assert.ok(calls.templates[0].includes('<modo_direto>'));
});

test('main: --raw não contém <modo_direto> (legado byte a byte)', async () => {
  const { deps, out } = makeDeps();
  const code = await main(['meu', 'texto', '--raw'], deps);
  assert.equal(code, 0);
  assert.ok(!out.join('').includes('<modo_direto>'));
});

test('runPrompt: --llm opencode sem CLI no PATH → LLM_NOT_FOUND', () => {
  const env = { ...process.env, PATH: '' };
  return assert.rejects(
    runPrompt('x', { llm: 'opencode', env }),
    (err) => err instanceof RunError && err.code === 'LLM_NOT_FOUND' && err.message.includes('opencode')
  );
});

// --- Delta: texto via stdin pipeado e via --file ---

test('parseArgs: --file consome o próximo argumento', () => {
  assert.equal(parseArgs(['--file', 'prompt.md']).file, 'prompt.md');
  assert.equal(parseArgs(['--file', '--raw']).file, null);
  assert.equal(parseArgs(['--file', '--raw']).raw, true);
});

test('parseArgs: posicionais e --file juntos (parser não rejeita; ambigüidade é do main)', () => {
  const args = parseArgs(['texto', '--file', 'f.md']);
  assert.equal(args.text, 'texto');
  assert.equal(args.file, 'f.md');
});

test('main: texto + --file → erro ambíguo e exit 1', async () => {
  const { deps, err, calls } = makeDeps();
  const code = await main(['ola', '--file', 'f.md'], deps);
  assert.equal(code, 1);
  assert.ok(err.join('').includes('não ambos'));
  assert.equal(calls.runPrompt, 0);
});

test('main: --file lê o arquivo e executa o runPrompt', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcu-'));
  const cwd = process.cwd();
  process.chdir(dir);
  try {
    const content = 'linha 1\n$VAR e `code`\n```text\nfence\n```\n';
    fs.writeFileSync('prompt.md', content);
    const { deps, out, calls } = makeDeps();
    const code = await main(['--file', 'prompt.md'], deps);
    assert.equal(code, 0);
    assert.equal(calls.runPrompt, 1);
    assert.ok(calls.templates[0].includes(`<descricao>\n${content}\n</descricao>`));
    assert.equal(out.join(''), 'RESULTADO FINAL');
  } finally {
    process.chdir(cwd);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('main: --file --raw imprime o meta-prompt cru com o conteúdo do arquivo', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcu-'));
  const cwd = process.cwd();
  process.chdir(dir);
  try {
    fs.writeFileSync('prompt.md', 'texto do arquivo');
    const { deps, out, calls } = makeDeps();
    const code = await main(['--file', 'prompt.md', '--raw'], deps);
    assert.equal(code, 0);
    assert.equal(calls.runPrompt, 0);
    const joined = out.join('');
    assert.ok(joined.includes('<descricao>\ntexto do arquivo\n</descricao>'));
    assert.ok(!joined.includes('<modo_direto>'));
  } finally {
    process.chdir(cwd);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('main: --file --save gera e salva o .md (não é modo legado)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcu-'));
  const cwd = process.cwd();
  process.chdir(dir);
  try {
    fs.writeFileSync('prompt.md', 'texto do arquivo');
    const { deps, out, calls } = makeDeps({ runPromptResult: { stdout: '# Titulo Final\n\ncorpo', stderr: '', exitCode: 0 } });
    const code = await main(['--file', 'prompt.md', '--save'], deps);
    assert.equal(code, 0);
    assert.equal(calls.runPrompt, 1, '--file suprime o modo legado de stdin');
    assert.ok(out.join('').includes('Salvo em:'));
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'prompt.md');
    assert.equal(files.length, 1);
    const content = fs.readFileSync(path.join(dir, files[0]), 'utf-8');
    assert.equal(content, '# Titulo Final\n\ncorpo');
  } finally {
    process.chdir(cwd);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('main: --file inexistente → erro claro e exit 1', async () => {
  const { deps, err, calls } = makeDeps();
  const code = await main(['--file', 'nao-existe.md'], deps);
  assert.equal(code, 1);
  assert.ok(err.join('').includes('nao-existe.md'));
  assert.ok(err.join('').includes('não foi possível ler'));
  assert.equal(calls.runPrompt, 0);
});

test('main: --file com arquivo vazio → erro de texto vazio', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcu-'));
  const cwd = process.cwd();
  process.chdir(dir);
  try {
    fs.writeFileSync('vazio.md', '');
    const { deps, err, calls } = makeDeps();
    const code = await main(['--file', 'vazio.md'], deps);
    assert.equal(code, 1);
    assert.ok(err.join('').includes('forneça um texto'));
    assert.equal(calls.runPrompt, 0);
  } finally {
    process.chdir(cwd);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('main: sem texto, stdin pipeado → lê stdin como texto e executa', async () => {
  const pipeText = 'texto via pipe\ncom $var e `code`\n```\nfence\n```';
  const { deps, calls } = makeDeps({ isStdinTTY: false, readStdinValue: pipeText });
  const code = await main([], deps);
  assert.equal(code, 0);
  assert.equal(calls.runPrompt, 1);
  assert.ok(calls.templates[0].includes(`<descricao>\n${pipeText}\n</descricao>`));
});

test('main: stdin pipeado vazio → erro e exit 1', async () => {
  const { deps, err, calls } = makeDeps({ isStdinTTY: false, readStdinValue: '' });
  const code = await main([], deps);
  assert.equal(code, 1);
  assert.ok(err.join('').includes('forneça um texto'));
  assert.equal(calls.runPrompt, 0);
});

test('main: --save + stdin pipeado continua legado (salva .md cru)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcu-'));
  const cwd = process.cwd();
  process.chdir(dir);
  try {
    const { deps, out, calls } = makeDeps({ isStdinTTY: false, readStdinValue: 'conteudo cru do stdin' });
    const code = await main(['--save'], deps);
    assert.equal(code, 0);
    assert.equal(calls.runPrompt, 0);
    assert.ok(out.join('').includes('Salvo em:'));
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md'));
    assert.equal(files.length, 1);
    const content = fs.readFileSync(path.join(dir, files[0]), 'utf-8');
    assert.ok(content.startsWith('# conteudo cru do stdin'));
  } finally {
    process.chdir(cwd);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('main: posicional tem precedência sobre stdin pipeado', async () => {
  const { deps, calls } = makeDeps({ isStdinTTY: false, readStdinValue: 'via stdin' });
  const code = await main(['posicional'], deps);
  assert.equal(code, 0);
  assert.equal(calls.runPrompt, 1);
  assert.ok(calls.templates[0].includes('<descricao>\nposicional\n</descricao>'));
  assert.ok(!calls.templates[0].includes('via stdin'));
});
