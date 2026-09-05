# promptcraft-unificando — Flags e Comandos

## Sintaxe geral

```
npx promptcraft-unificando [texto] [flags]
```

## Tabela de flags

| Flag | Tipo | Obrigatória | Default | Descrição |
|---|---|---|---|---|
| `[texto]` (posicional) | string | Sim, exceto em `--save` sem texto | — | Texto cru do prompt a ser melhorado |
| `--project` | boolean | Não | `false` | Ativa o bloco `<arquitetura>` no template (ver seção abaixo) |
| `--raw` | boolean | Não | `false` | Modo legado: imprime o meta-prompt bruto em vez de executar |
| `--llm <cli>` | string | Não | `auto` | Força o CLI de execução: `claude`, `gemini`, `opencode` ou `auto` |
| `--save` | boolean | Não | `false` | Grava `.md` — com texto: gera e salva; sem texto: lê stdin (legado) |
| `--title "texto"` | string | Não | heurística automática | Override do título usado no arquivo salvo (só com `--save`) |
| `-h`, `--help` | boolean | Não | — | Mostra ajuda e sai |
| `-v`, `--version` | boolean | Não | — | Mostra versão do pacote e sai |

## Regras de combinação (v1.0.0)

- **Modo padrão:** `[texto]` sem `--raw` → monta o template (com sufixo
  `<modo_direto>`, que instrui a IA a entregar somente o prompt final, sem
  pedir confirmação nem informações), executa no CLI local
  (`claude` → `gemini` → `opencode` em ordem de detecção, ou o escolhido
  via `--llm`/`PROMPTCRAFT_LLM`) e imprime o **resultado final**.
- **`--raw`:** desliga a execução — imprime ou salva o meta-prompt cru.
  `--raw` + `--llm` → `--llm` é ignorado (não há execução).
- **`--save` com texto:** `promptcraft-unificando "texto" --save` gera o
  resultado (ou o meta-prompt, se com `--raw`) e grava `.md` direto, sem
  pipe. *Mudança em relação às versões 0.x, onde `--save` e texto eram
  mutuamente exclusivos (o incidente do "arquivo vazio").*
- **`--save` sem texto:** modo legado — lê todo o `stdin` até EOF e grava
  `.md`.
- **`--project`:** só tem efeito na geração (com ou sem `--raw`); junto com
  `--save` sem texto, é ignorado.
- **`--title`:** só tem efeito junto com `--save`. Sem `--save`, é ignorada.
- **`--llm` inválido:** erro de validação e exit 1. **`--llm claude` sem
  claude instalado (nem gemini):** erro claro (`LLM_NOT_FOUND`) e exit 1,
  com dica de usar `--raw`.

## Detalhamento por flag

### `--project`

Quando ativa, adiciona ao template um bloco:

```
<arquitetura>
Antes de gerar o prompt final, explore a estrutura de pastas e o
package.json (ou equivalente) do projeto atual nesta sessão, para entender
a stack, as dependências e a arquitetura antes de aplicar as regras de
engenharia de prompt ao conteúdo de <descricao>.
</arquitetura>
```

**Premissa assumida:** a exploração acontece com acesso a filesystem. No
modo padrão (execução), o CLI local roda com cwd = diretório atual, então
ele **de fato** enxerga a árvore e o `package.json`. No modo `--raw`, vale
a premissa antiga: o LLM de destino (ex: Claude Code aberto na pasta) é
quem explora. O pacote **não faz scan de árvore nem lê `package.json`** —
isso é delegado, em ambos os modos.

### `--raw`

Modo legado (versões 0.x): não executa nada. Imprime o meta-prompt bruto
no stdout (base + `<arquitetura>` se `--project` + `<descricao>` + instrução
final), pronto pra pipar em qualquer CLI de LLM. Com `--save`, grava o
meta-prompt cru num `.md`.

### `--llm`

Força qual CLI local executar o template: `claude`, `gemini`, `opencode`
ou `auto` (detecção automática: `claude` primeiro, senão `gemini`, senão
`opencode`). Sem efeito com `--raw`. A variável `PROMPTCRAFT_LLM` tem o
mesmo efeito, com a flag tendo precedência. Se nem o escolhido nem o
fallback existirem, erro com mensagem clara (código `LLM_NOT_FOUND`).
`opencode` entrou na release como terceiro concorrente e ainda não foi
validado em máquina real (ver documento 03).

### `--save`

Dois comportamentos:

1. **Com texto posicional:** executa (ou gera o meta-prompt, com `--raw`) e
   grava o resultado direto num `.md` no cwd — sem pipe manual.
2. **Sem texto:** modo legado — lê todo o `stdin` até EOF, extrai um título
   (primeira linha não vazia, a não ser que `--title` tenha sido passado),
   gera slug + timestamp (`YYYYMMDD-HHmm`) e escreve o `.md` no cwd.

Se o conteúdo já abrir com H1 (caso do resultado final refinado), o título
é extraído sem duplicar o `#` no arquivo.

Uso:
```bash
npx promptcraft-unificando "texto" --save       # gera e salva
npx promptcraft-unificando --raw "texto" --save # meta-prompt cru em .md
npx promptcraft-unificando --save               # lê stdin até EOF
pbpaste | npx promptcraft-unificando --save     # macOS, lendo do clipboard
```

### `--title`

Override manual do título, pra quando a heurística de "primeira linha" não
produzir um nome de arquivo bom o suficiente.

```bash
npx promptcraft-unificando "texto" --save --title "Prompt de resumo de reunião"
```

## Variáveis de ambiente

| Variável | Default | Descrição |
|---|---|---|
| `PROMPTCRAFT_LLM` | `auto` | Mesmo efeito do `--llm`; a flag tem precedência |
| `PROMPTCRAFT_TIMEOUT_MS` | `120000` | Timeout (ms) da execução do CLI local; erro `RUN_TIMEOUT` se estourar |

## Configuração do prompt-base

Não é uma flag. O prompt-base usado em toda geração é sempre
`prompts/base.md`, empacotado dentro do próprio pacote — sem override
local nem variável de ambiente. Isso mantém o comportamento previsível e
auditável: o conteúdo que roda é sempre exatamente o que está publicado no
pacote/repositório, sem depender de arquivo externo na máquina do usuário.

Ajustar o prompt-base exige editar `prompts/base.md`, dar bump de versão e
publicar novamente (`npm publish`).