function parseArgs(argv) {
  const result = {
    text: null,
    project: false,
    save: false,
    title: null,
    help: false,
    version: false,
    raw: false,
    llm: null,
  };
  const positional = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--project') result.project = true;
    else if (arg === '--save') result.save = true;
    else if (arg === '--raw') result.raw = true;
    else if (arg === '--llm') {
      const maybeValue = argv[i + 1];
      if (maybeValue && !maybeValue.startsWith('-')) { result.llm = maybeValue; i++; }
    }
    else if (arg === '--title') { result.title = argv[i + 1] || null; i++; }
    else if (arg === '-h' || arg === '--help') result.help = true;
    else if (arg === '-v' || arg === '--version') result.version = true;
    else positional.push(arg);
  }

  result.text = positional.join(' ') || null;
  return result;
}

module.exports = { parseArgs };
