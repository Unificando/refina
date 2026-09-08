#!/usr/bin/env node
const fs = require('fs');
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

// Remove BOM UTF-8 (\\uFEFF) que alguns editores/CLIs (ex: pbpaste) deixam no
// início do stream — não pode ir parar dentro da tag <descricao>.
function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

async function main(argv, deps = {}) {
  const stdout = deps.stdout || ((s) => process.stdout.write(s));
  const stderr = deps.stderr || ((s) => process.stderr.write(s));
  const doReadStdin = deps.readStdin || readStdin;
  const doRunPrompt = deps.runPrompt || runPrompt;
  // stdin é pipe quando NÃO é um TTY (ex: `cat x.md | npx ...`, heredoc).
  const stdinIsTTY = deps.isStdinTTY !== undefined ? deps.isStdinTTY : process.stdin.isTTY;

  const args = parseArgs(argv);

  if (args.help) {
    stdout('Uso: promptcraft-unificando ["texto" | --file <arquivo> | stdin via pipe] [--project] [--raw] [--save] [--llm claude|gemini|auto]\n');
    return 0;
  }

  if (args.version) {
    stdout(`${pkg.version}\n`);
    return 0;
  }

  // Modo legado: --save sem texto lê stdin até EOF e salva o .md cru.
  // Com --file presente o --save é o de "gerar e salvar", nunca o legado.
  if (args.save && !args.text && !args.file) {
    const content = await doReadStdin();
    const filePath = saveMarkdown(content, { titleOverride: args.title });
    stdout(`Salvo em: ${filePath}\n`);
    return 0;
  }

  if (args.text && args.file) {
    stderr('Erro: use o texto posicional OU --file, não ambos.\n');
    return 1;
  }

  // Resolve a fonte do texto na ordem: --file > posicional > stdin pipeado.
  let text = args.text;
  if (!text && args.file) {
    try {
      text = stripBom(fs.readFileSync(args.file, 'utf8'));
    } catch (err) {
      stderr(`Erro: não foi possível ler o arquivo "${args.file}": ${err.message}\n`);
      return 1;
    }
  }
  if (!text && !stdinIsTTY && !args.save) {
    // stdin pipeado (cat/heredoc/pbpaste) vira o texto do prompt — livre de
    // interpretação do shell. --save sem texto nunca cai aqui (é o legado).
    text = stripBom(await doReadStdin());
  }

  if (!text || !text.trim()) {
    stderr('Erro: forneça um texto, use --file ou pipeie o conteúdo via stdin.\n');
    return 1;
  }

  const basePrompt = loadBasePrompt();
  // direct = modo direto (padrão): sufixo <modo_direto> instrui a IA a não
  // pedir confirmação nem informações; --raw usa o template legado byte a byte.
  const template = buildTemplate(basePrompt, text, { project: args.project, direct: !args.raw });

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