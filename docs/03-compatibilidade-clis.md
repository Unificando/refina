# unificando-promptcraft — Compatibilidade com CLIs de LLM

O pacote só imprime texto no stdout. Como esse texto chega até o LLM de
destino depende de cada CLI aceitar ou não entrada via pipe/stdin. Esta
tabela documenta o que foi validado.

## Matriz de compatibilidade

| CLI | Comando | Aceita pipe? | Comportamento | Status |
|---|---|---|---|---|
| Claude Code | `claude` | Sim | Abre sessão interativa com o texto como primeira mensagem; sessão continua aberta | Validado (comportamento conhecido da ferramenta) |
| Gemini CLI | `gemini` ou `gemini -p "..."` | Sim | Modo headless: processa, imprime resposta única no stdout, **encerra o processo** | Validado via documentação oficial (google-gemini/gemini-cli) |
| Codex CLI | `codex` (nome pode variar) | Não verificado | — | Testar antes de documentar como suportado |
| Outras CLIs de LLM | — | Não verificado | — | Fallback universal: copiar a saída e colar manualmente |

## Exemplos de uso por CLI

### Claude Code
```bash
npx unificando-promptcraft "ideia crua" | claude
```
Abre uma sessão nova já processando o prompt. Se você quiser continuar
iterando naquela mesma conversa depois, a sessão permanece ativa
normalmente.

### Gemini CLI
```bash
npx unificando-promptcraft "ideia crua" | gemini
```
ou, equivalente:
```bash
gemini -p "$(npx unificando-promptcraft 'ideia crua')"
```
Diferença importante em relação ao Claude Code: o processo do Gemini CLI
**encerra depois de uma resposta**. Não há sessão contínua — se quiser
refinar mais, é preciso rodar de novo ou copiar a resposta pra outro lugar.

### Fallback universal (qualquer CLI ou chat web)
```bash
npx unificando-promptcraft "ideia crua"
```
Sem pipe nenhum — só imprime o template no terminal. Copia manualmente e
cola onde quiser (chat web, outra CLI, editor).

## O que falta validar

- Codex CLI (OpenAI) — se aceita stdin da mesma forma.
- Qualquer outra CLI agêntica que o usuário venha a adotar no futuro.

Recomendação: antes de documentar uma nova CLI como "suportada" nesta
tabela, validar com um teste real (`echo "teste" | <comando-da-cli>`) e
observar se ela processa como prompt ou trava esperando TTY.
