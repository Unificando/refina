const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { parseArgs } = require('../src/args');
const { buildTemplate } = require('../src/buildTemplate');
const { loadBasePrompt } = require('../src/loadBasePrompt');
const { saveMarkdown } = require('../src/saveMarkdown');

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
