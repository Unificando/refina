const fs = require('fs');
const path = require('path');

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function saveMarkdown(content, { titleOverride } = {}) {
  const firstLine = content.split('\n').find((l) => l.trim().length > 0) || 'prompt-sem-titulo';
  const title = titleOverride || firstLine.trim();
  const filename = `${slugify(title)}-${timestamp()}.md`;
  const filePath = path.join(process.cwd(), filename);
  const fileContent = `# ${title}\n\n${content}`;
  fs.writeFileSync(filePath, fileContent, 'utf-8');
  return filePath;
}

module.exports = { saveMarkdown };
