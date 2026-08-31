# unificando-promptcraft

CLI instalável via `npx` que monta um prompt de "Engenheiro de Prompt" concatenando um prompt-base fixo com o texto cru que o usuário digita. O resultado é impresso no stdout, pronto pra ser colado ou "pipado" em qualquer CLI de LLM.

## Instalação

Não é necessário instalar — basta usar via `npx`:

```bash
npx unificando-promptcraft "sua ideia de prompt"
```

## Uso

### 1. Prompt solto, sem relação com projeto

```bash
npx unificando-promptcraft "quero um prompt pra gerar resumo de reunião"
```

Imprime o template no stdout. Cola em qualquer lugar, ou usa pipe.

### 2. Prompt que precisa de contexto do projeto atual

```bash
npx unificando-promptcraft --project "gera os testes unitários dessa função de pagamento"
```

Adiciona instrução pro LLM de destino explorar a arquitetura do projeto atual antes de gerar o prompt.

### 3. Salvando o resultado depois

```bash
npx unificando-promptcraft --save
# cola o texto que o LLM de destino gerou, Ctrl+D pra confirmar
```

Persiste o resultado como `.md` no diretório atual.

## Flags

| Flag | Tipo | Descrição |
|---|---|---|
| `[texto]` (posicional) | string | Texto cru do prompt a ser melhorado |
| `--project` | boolean | Ativa o bloco `<arquitetura>` no template |
| `--save` | boolean | Muda o modo de operação: em vez de gerar, lê stdin e salva `.md` |
| `--title "texto"` | string | Override do título usado no arquivo salvo (só com `--save`) |
| `-h`, `--help` | boolean | Mostra ajuda e sai |
| `-v`, `--version` | boolean | Mostra versão do pacote e sai |

## Compatibilidade com CLIs de LLM

O pacote só imprime texto no stdout. Como esse texto chega até o LLM de destino depende de cada CLI aceitar ou não entrada via pipe/stdin.

| CLI | Comando | Aceita pipe? | Status |
|---|---|---|---|
| Claude Code | `claude` | Sim | Validado |
| Gemini CLI | `gemini` | Sim | Validado |
| Outras CLIs | — | — | Fallback: copiar e colar manualmente |

### Exemplos de uso por CLI

**Claude Code:**
```bash
npx unificando-promptcraft "ideia crua" | claude
```

**Gemini CLI:**
```bash
npx unificando-promptcraft "ideia crua" | gemini
```

**Fallback universal (qualquer CLI ou chat web):**
```bash
npx unificando-promptcraft "ideia crua"
```

## Licença

MIT
