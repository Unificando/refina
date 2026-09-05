#!/usr/bin/env node
const { parseArgs } = require('../src/args');
const { loadBasePrompt } = require('../src/loadBasePrompt');
const { buildTemplate } = require('../src/buildTemplate');
const { saveMarkdown } = require('../src/saveMarkdown');
const { runPrompt } = require('../src/runPrompt');
const pkg = require('../package.json');

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(data));
  });
}

async function main(argv, deps = {}) {
  const stdout = deps.stdout || ((s) => process.stdout.write(s));
  const stderr = deps.stderr || ((s) => process.stderr.write(s));
  const doReadStdin = deps.readStdin || readStdin;
  const doRunPrompt = deps.runPrompt || runPrompt;

  const args = parseArgs(argv);

  if (args.help) {
    stdout('Uso: promptcraft-unificando "texto" [--project] [--raw] [--save] [--llm claude|gemini|auto]\n');
    return 0;
  }

  if (args.version) {
    stdout(`${pkg.version}\n`);
    return 0;
  }

  // Modo legado: --save sem texto lê stdin até EOF e salva o .md.
  if (args.save && !args.text) {
    const content = await doReadStdin();
    const filePath = saveMarkdown(content, { titleOverride: args.title });
    stdout(`Salvo em: ${filePath}\n`);
    return 0;
  }

  if (!args.text) {
    stderr('Erro: forneça um texto ou use --save.\n');
    return 1;
  }

  const basePrompt = loadBasePrompt();
  // direct = modo direto (padrão): sufixo <modo_direto> instrui a IA a não
  // pedir confirmação nem informações; --raw usa o template legado byte a byte.
  const template = buildTemplate(basePrompt, args.text, { project: args.project, direct: !args.raw });

  // --raw: mantém o comportamento legado — entrega o meta-prompt cru para
  // pipe manual em qualquer LLM, sem executar nada.
  if (args.raw) {
    if (args.save) {
      const filePath = saveMarkdown(template, { titleOverride: args.title });
      stdout(`Salvo em: ${filePath}\n`);
    } else {
      stdout(template);
    }
    return 0;
  }

  // Modo padrão (v1.0.0): delega o template a um CLI de LLM local (claude/gemini)
  // e devolve o prompt final já refinado.
  let result;
  try {
    result = await doRunPrompt(template, { llm: args.llm || process.env.PROMPTCRAFT_LLM || 'auto' });
  } catch (err) {
    stderr(`${err.message}\n`);
    return 1;
  }

  if (args.save) {
    const filePath = saveMarkdown(result.stdout, { titleOverride: args.title });
    stdout(`Salvo em: ${filePath}\n`);
  } else {
    stdout(result.stdout);
  }
  return 0;
}

module.exports = { main };

if (require.main === module) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((err) => {
      process.stderr.write(`${err && err.message ? err.message : err}\n`);
      process.exitCode = 1;
    });
}