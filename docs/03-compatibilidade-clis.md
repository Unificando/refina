# @unificando/refina — Compatibilidade com CLIs de LLM

O pacote tem dois modos: **execução automática** (padrão, v1.0.0), que
chama o CLI de LLM local de forma headless; e o **modo `--raw`** (legado),
que só imprime o meta-prompt no stdout pra ser pipado. Este documento
tabela o que foi validado em cada modo.

## Execução automática (v1.0.0)

Quando `[texto]` é passado sem `--raw`, o pacote delega o template a um CLI
de LLM local, headless, com cwd = diretório atual:

| CLI | Comando headless | Status |
|---|---|---|
| Claude Code | `claude -p --output-format text --permission-mode plan --no-session-persistence` | Validado (v2.1.x) |
| Gemini CLI | `gemini -p "" --approval-mode plan --skip-trust` | Validado (v0.58) |
| opencode | `opencode run --format text` | Documentado, **não validado** nesta release (CLI ausente na máquina de validação) |

Premissas:
- O template vai por **stdin**; o prompt final refinado sai no stdout.
- `--permission-mode plan` / `--approval-mode plan` = tools **read-only**
  (basta pro bloco `<arquitetura>` ler a estrutura do projeto), sem travar
  esperando aprovação. O pacote **não** usa flags do tipo
  `--dangerously-skip-permissions`. `opencode run --format text` segue a
  mesma ideia (não-interativo, texto puro no stdout).
- O CLI precisa estar **autenticado** de antemão; se a primeira execução
  pedir login, o processo falha com stderr claro, repassado pelo pacote.
- Detecção: `claude` primeiro, senão `gemini`, senão `opencode` — ou
  forçar com `--llm`/`PROMPTCRAFT_LLM`.
- Timeout padrão de 600s (900s com `--project`), ajustável via `PROMPTCRAFT_TIMEOUT_MS`.
- **Modo direto:** no modo padrão o template inclui o sufixo `<modo_direto>`,
  que instrui a IA a entregar somente o prompt final (sem a pergunta
  "posso executar?" que o prompt-base pede por padrão). Se alguma CLI
  ignorar o sufixo, o resultado pode terminar com pergunta — use `--raw` +
  pipe para ter controle total do fluxo.

### Exemplos

```bash
npx @unificando/refina "ideia crua"
npx @unificando/refina --project "ideia que depende do repo atual"
npx @unificando/refina --llm gemini "ideia crua"
```

> Se alguma versão do `gemini -p` rejeitar o prompt vazio (`-p ""`), o
> fallback documentado é usar `--raw` + pipe (seção abaixo) — o template
> vai então como prompt/primeira mensagem da CLI.

## Modo `--raw`: pipe manual

Com `--raw`, o pacote só imprime texto no stdout. Como esse texto chega até
o LLM de destino depende de cada CLI aceitar ou não entrada via
pipe/stdin. Esta tabela documenta o que foi validado.

| CLI | Comando | Aceita pipe? | Comportamento | Status |
|---|---|---|---|---|
| Claude Code | `claude` | Sim | Abre sessão interativa com o texto como primeira mensagem; sessão continua aberta | Validado |
| Gemini CLI | `gemini` ou `gemini -p "..."` | Sim | Headless: processa, imprime resposta única no stdout, **encerra o processo** | Validado |
| Codex CLI | `codex` (nome pode variar) | Não verificado | — | Testar antes de documentar como suportado |
| Outras CLIs de LLM | — | Não verificado | — | Fallback universal: copiar a saída e colar manualmente |

## Exemplos de uso por CLI (modo `--raw`)

### Claude Code
```bash
npx @unificando/refina --raw "ideia crua" | claude
```

### Gemini CLI
```bash
npx @unificando/refina --raw "ideia crua" | gemini
```
ou, equivalente:
```bash
gemini -p "$(npx @unificando/refina --raw 'ideia crua')"
```

### Fallback universal (qualquer CLI ou chat web)
```bash
npx @unificando/refina --raw "ideia crua"
```
Sem pipe nenhum — só imprime o template no terminal. Copia manualmente e
cola onde quiser (chat web, outra CLI, editor).

## O que falta validar

- **opencode (OpenAI/outros)** — modo `--raw` e execução automática
  (`opencode run --format text`), se aceita stdin da mesma forma; ajustar
  args se alguma versão divergir.
- Codex CLI (OpenAI) — modo `--raw`, se aceita stdin da mesma forma.
- Windows: execução automática usa `shell: true` (shims `.cmd`) — precisa
  de validação em máquina Windows.