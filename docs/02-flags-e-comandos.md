# promptcraft-unificando — Flags e Comandos

## Sintaxe geral

```
npx promptcraft-unificando [texto] [flags]
npx promptcraft-unificando --file <arquivo> [flags]
npx promptcraft-unificando [flags]  # texto lido do stdin quando pipeado (cat |, heredoc, pbpaste)
```

O texto a ser melhorado pode vir de **uma** destas três fontes: argumento
posicional (`[texto]`), conteúdo de um arquivo (`--file`) ou **stdin
pipeado** (stdin não é um terminal). Detalhes e precedência na seção
"Precedência da fonte do texto".

## Tabela de flags

| Flag | Tipo | Obrigatória | Default | Descrição |
|---|---|---|---|---|
| `[texto]` (posicional) | string | Não, se vier de `--file` ou do stdin pipeado | — | Texto cru do prompt a ser melhorado |
| `--file <arquivo>` | string | Não, se o texto vier do posicional ou stdin | — | Lê o texto do prompt de um arquivo (UTF-8) |
| `--project` | boolean | Não | `false` | Ativa o bloco `<arquitetura>` no template (ver seção abaixo) |
| `--raw` | boolean | Não | `false` | Modo legado: imprime o meta-prompt bruto em vez de executar |
| `--llm <cli>` | string | Não | `auto` | Força o CLI de execução: `claude`, `gemini`, `opencode` ou `auto` |
| `--save` | boolean | Não | `false` | Grava `.md` — com texto/`--file`: gera e salva; sem texto nem `--file`: lê stdin (legado) |
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

## Precedência da fonte do texto

Quando o texto pode vir de mais de um lugar, a ordem de decisão é:

1. **Ambíguo:** `[texto]` **e** `--file` juntos → erro e exit 1 (as duas
   fontes explícitas conflitam; o stdin não é lido).
2. **`--file <arquivo>`:** o conteúdo do arquivo é o texto (erro claro e
   exit 1 se o arquivo não puder ser lido). **`--file` desliga o modo
   legado do `--save`:** com `--file`, `--save` sempre significa "gerar e
   salvar o `.md`" (do resultado refinado ou do meta-prompt cru, com
   `--raw`), nunca "ler stdin".
3. **`[texto]` posicional:** se presente e sem `--file`, é o texto.
4. **Stdin pipeado:** sem texto posicional e sem `--file`, **se o stdin não
   é um terminal** (pipe: `cat arquivo.md |`, heredoc, `pbpaste |`), todo o
   stdin até EOF é o texto.
5. **Sem nenhuma das fontes** (ou fonte vazia) → erro e exit 1 com a
   mensagem `forneça um texto, use --file ou pipeie o conteúdo via stdin`.

**`--save` sem texto e sem `--file` nunca entra na regra 4** — é o modo
legado (regra da seção anterior) e tem prioridade.

> **Por que isso importa (shell quoting):** prompts longos com markdown,
> code fences (backticks), `$`, aspas e quebras de linha **quebram ou são
> corrompidos** quando passados entre aspas no shell — aspas duplas
> interpolam `$var` e executam `` `comando` `` (command substitution); aspas
> simples quebram no primeiro apóstrofo (`someone's`). Para esse tipo de
> prompt, prefira `--file`, pipe ou heredoc — nenhum deles interpreta o
> conteúdo (ver seção da flag `--file` e a documentação).

- **`--project`:** só tem efeito na geração (com ou sem `--raw`); junto com
  `--save` sem texto, é ignorado.
- **`--title`:** só tem efeito junto com `--save`. Sem `--save`, é ignorada.
- **`--llm` inválido:** erro de validação e exit 1. **`--llm claude` sem
  claude instalado (nem gemini):** erro claro (`LLM_NOT_FOUND`) e exit 1,
  com dica de usar `--raw`.

## Detalhamento por flag

### `--file <arquivo>`

Lê o conteúdo do arquivo (UTF-8) como o texto do prompt — a forma mais
robusta para prompts longos, multilinha, com markdown/code fences e
caracteres especiais, porque **nenhum caractere é interpretado**: o shell
não interpola `$`, não executa backticks e não quebra em apóstrofos.

```bash
npx promptcraft-unificando --file prompt.md            # refina e imprime
npx promptcraft-unificando --file prompt.md --save      # refina e salva o .md
npx promptcraft-unificando --file prompt.md --raw       # meta-prompt cru no stdout
npx promptcraft-unificando --file prompt.md --project   # com exploração da arquitetura
```

Regras:

- Combina com `--raw`, `--save`, `--project` e `--title` normalmente.
  Com `--save`, gera-e-salva (nunca o modo legado de stdin).
- Juntar com texto posicional é erro (exit 1).
- Arquivo inexistente/inacessível → erro claro com o caminho e exit 1.
- Arquivo vazio (só espaços) → mesmo erro de "nenhum texto".
- Caminho começando com `-`: o parser trata como flag. Use `./` na frente
  (`--file ./-prompt.md`).
- BOM UTF-8 inicial (`.md` criado em alguns editores) é removido
  automaticamente.

**Alternativas equivalentes** (mesma garantia de "nenhum caractere
interpretado"), quando o texto já está em outro lugar ou você prefere não
criar arquivo:

```bash
cat prompt.md | npx promptcraft-unificando            # pipe
pbpaste | npx promptcraft-unificando                  # clipboard (macOS)
npx promptcraft-unificando <<'EOF'
seu prompt multilinha
com ```code``` e $vars sem escape
EOF
```

**Atenção ao `--save` no pipe:** sem `--file` nem texto, `--save` com stdin
pipeado **não refina** — é o modo legado, que salva o conteúdo do stdin
como `.md` cru. Para refinar via pipe e salvar, use `--file` ou pipeie e
deixe o `--save` de fora (o refinado sai no stdout).

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

Três comportamentos:

1. **Com texto posicional ou `--file`:** executa (ou gera o meta-prompt, com
   `--raw`) e grava o resultado direto num `.md` no cwd — sem pipe manual.
   A presença de `--file` desliga o modo legado (item 2) mesmo que não
   haja texto posicional.
2. **Sem texto e sem `--file`:** modo legado — lê todo o `stdin` até EOF,
   extrai um título (primeira linha não vazia, a não ser que `--title`
   tenha sido passado), gera slug + timestamp (`YYYYMMDD-HHmm`) e escreve o
   `.md` no cwd.
3. **Com `--raw`:** com texto/`--file`, o meta-prompt cru é o que vai pro
   `.md` (combinam-se as regras 1 e 2 conforme a presença de texto).

Se o conteúdo já abrir com H1 (caso do resultado final refinado), o título
é extraído sem duplicar o `#` no arquivo.

Uso:
```bash
npx promptcraft-unificando "texto" --save         # gera e salva
npx promptcraft-unificando --file prompt.md --save # lê o arquivo, gera e salva
npx promptcraft-unificando --raw "texto" --save   # meta-prompt cru em .md
npx promptcraft-unificando --save                 # lê stdin até EOF (legado)
pbpaste | npx promptcraft-unificando --save       # macOS — legado: salva o clipboard cru
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