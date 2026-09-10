# @unificando/refina

[![npm version](https://img.shields.io/npm/v/@unificando/refina.svg)](https://www.npmjs.com/package/@unificando/refina)
[![license](https://img.shields.io/npm/l/@unificando/refina.svg)](./LICENSE)
[![GitHub Packages](https://img.shields.io/badge/GitHub%20Packages-%40unificando%2Frefina-2b3137?logo=github)](https://github.com/Unificando/refina/pkgs/npm/refina)

CLI instalável via `npx` que **refina prompts em 1 passo**: monta o prompt de "Engenheiro de Prompt" a partir do texto cru que você digita e delega a execução a um CLI de LLM local (`claude` ou `gemini`), devolvendo o **prompt final já refinado**. Sem API key e sem chamada de rede vinda do próprio pacote — a execução acontece no seu computador, via processo local.

## Pré-requisitos

- Node.js >= 18
- Um destes CLIs instalados e autenticados no PATH:
  - [Claude Code](https://docs.anthropic.com/en/docs/claude-code) — `claude`
  - [Gemini CLI](https://github.com/google-gemini/gemini-cli) — `gemini`
  - [opencode](https://opencode.ai/) — `opencode` (3º concorrente no auto-detect; não validado nesta release)

> Sem um desses, use `--raw` para obter o meta-prompt bruto e pipar manualmente em qualquer IA.

## Instalação

Não é necessário instalar — basta usar via `npx`:

```bash
npx @unificando/refina "sua ideia de prompt"
```

Instalação global opcional expõe o comando `unificando-refina`:

```bash
npm install -g @unificando/refina
unificando-refina "sua ideia de prompt"
```

### Instalar pelo GitHub Packages

O pacote também é publicado no [GitHub Packages da organização](https://github.com/Unificando/refina/pkgs/npm/refina), com o mesmo nome `@unificando/refina`, conteúdo e versão. Para puxá-lo de lá em vez do npmjs.com, autentique o registry do GitHub num `.npmrc` (na home ou no projeto):

```
@unificando:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=SEU_GITHUB_TOKEN
```

O token precisa do escopo `read:packages`. Para uso rápido sem autenticar, prefira o `npx @unificando/refina` do npmjs.com acima.

## Uso

### 1. Resultado final em 1 passo (padrão)

```bash
npx @unificando/refina "quero um prompt pra gerar resumo de reunião"
```

Executa o template no `claude`/`gemini`/`opencode` local e imprime o prompt
refinado pronto. No modo padrão, o template inclui um sufixo `<modo_direto>`
que instrui a IA a **entregar logo o prompt final completo, sem pedir
confirmação ("posso executar?") nem solicitar mais informações**.

### 2. Com contexto do projeto atual

```bash
npx @unificando/refina --project "gera os testes unitários dessa função de pagamento"
```

A execução roda no diretório atual, então o LLM local explora a arquitetura do projeto (estrutura de pastas, `package.json`) antes de refinar o prompt.

### 3. Gerando e salvando o resultado direto

```bash
npx @unificando/refina --project "..." --save
```

Gera o resultado final e grava direto num `.md` no diretório atual — sem pipe manual.

### 4. Modo legado: meta-prompt bruto (para pipar em qualquer LLM)

```bash
npx @unificando/refina --raw "quero um prompt pra gerar resumo de reunião"
npx @unificando/refina --raw "..." | claude
```

Com `--raw`, o CLI só imprime o meta-prompt cru (sem executar nada). O fluxo de pipe com qualquer CLI/chat das versões 0.x continua funcionando.

### 5. Salvando o resultado de qualquer LLM (legado stdin)

```bash
npx @unificando/refina --save
# cola o texto que o LLM de destino gerou, Ctrl+D pra confirmar
```

Persiste o conteúdo como `.md` no diretório atual.

### 6. Passando prompts longos com segurança

O jeito `"texto entre aspas"` é frágil para prompts grandes com markdown,
code fences e caracteres especiais. **Aspas duplas corrompem**: o shell
interpola `$var` e executa `` `comandos` `` (command substitution). **Aspas
simples quebram** no primeiro apóstrofo (`someone's`, `user's`). Para esses
casos use uma fonte que o shell não interpreta:

```bash
# De um arquivo (recomendado para prompts longos)
npx @unificando/refina --file prompt.md --project --save

# Pipe de um arquivo (stdin não é um terminal → vira o texto)
cat prompt.md | npx @unificando/refina

# Heredoc (multilinha literal, sem escape de $ ou backticks)
npx @unificando/refina --project <<'EOF'
escreva um prompt para auditar meu repositório:
1. varredura de secrets
2. teste de autenticação
```text
blocos de código com backticks funcionam sem escape
```
EOF

# Clipboard (macOS)
pbpaste | npx @unificando/refina
```

Regras rápidas: texto posicional **ou** `--file`, não ambos; sem texto nem
`--file`, o conteúdo do stdin pipeado vira o prompt; `--save` sem texto nem
`--file` continua sendo o modo legado que salva o stdin como `.md` cru.
BOM UTF-8 inicial é removido automaticamente.

## Flags

| Flag | Tipo | Descrição |
|---|---|---|
| `[texto]` (posicional) | string | Texto cru do prompt a ser melhorado |
| `--file <arquivo>` | string | Lê o texto do prompt de um arquivo (UTF-8; ideal para prompts longos/multilinha) |
| `--project` | boolean | Ativa o bloco `<arquitetura>` no template (o LLM local explora o cwd) |
| `--raw` | boolean | Modo legado: imprime o meta-prompt bruto em vez de executar |
| `--llm <cli>` | string | Força o CLI: `claude`, `gemini` ou `auto` (default: claude → gemini) |
| `--save` | boolean | Grava o resultado em `.md` (com texto/`--file`: gera e salva; sem texto nem `--file`: lê stdin como legado) |
| `--title "texto"` | string | Override do título usado no arquivo salvo (só com `--save`) |
| `-h`, `--help` | boolean | Mostra ajuda e sai |
| `-v`, `--version` | boolean | Mostra versão do pacote e sai |

## Variáveis de ambiente

| Variável | Default | Descrição |
|---|---|---|
| `PROMPTCRAFT_LLM` | `auto` | Força o CLI (mesmo efeito do `--llm`; a flag tem precedência) |
| `PROMPTCRAFT_TIMEOUT_MS` | `600000` (`900000` com `--project`) | Timeout (ms) da execução do CLI local; sobrepõe o default do modo. Aumente para prompts longos ou repositórios grandes. |

Durante a execução, o progresso é reportado no **stderr** (`▸ Refinando via "claude"…`, ticks a cada 15s, `✓ prompt gerado em Ns`). O stdout continua sendo apenas o prompt final refinado, então pipe e `--save` seguem intactos.

## Compatibilidade com CLIs de LLM

O pacote **executa** via CLI local (`claude`/`gemini`) no modo padrão. No modo `--raw`, ele só imprime o meta-prompt no stdout, e você pipeia para o que quiser.

| CLI | Modo padrão (execução headless) | Modo `--raw` (pipe) | Status |
|---|---|---|---|
| Claude Code | `claude -p` | `... \| claude` | Validado (v2.x) |
| Gemini CLI | `gemini -p` | `... \| gemini` | Validado (v0.58) |
| opencode | `opencode run --format text` | `... \| opencode run` | Documentado, não validado nesta release |
| Outras CLIs | — | copiar e colar (fallback universal) | — |

## Licença

MIT