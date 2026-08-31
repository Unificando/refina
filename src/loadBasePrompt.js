const fs = require('fs');
const path = require('path');

function loadBasePrompt() {
  const bundledPath = path.join(__dirname, '..', 'prompts', 'base.md');
  return fs.readFileSync(bundledPath, 'utf-8');
}

module.exports = { loadBasePrompt };
