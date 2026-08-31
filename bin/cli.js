#!/usr/bin/env node
const { parseArgs } = require('../src/args');
const { loadBasePrompt } = require('../src/loadBasePrompt');
const { buildTemplate } = require('../src/buildTemplate');
const { saveMarkdown } = require('../src/saveMarkdown');

async function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log('Uso: unificando-promptcraft "texto" [--project] | --save [--title "..."]');
    return;
  }

  if (args.save) {
    const content = await readStdin();
    const filePath = saveMarkdown(content, { titleOverride: args.title });
    console.log(`Salvo em: ${filePath}`);
    return;
  }

  if (!args.text) {
    console.error('Erro: forneça um texto ou use --save.');
    process.exitCode = 1;
    return;
  }

  const basePrompt = loadBasePrompt();
  const output = buildTemplate(basePrompt, args.text, { project: args.project });
  console.log(output);
}

main();
