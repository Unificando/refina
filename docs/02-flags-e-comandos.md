# unificando-promptcraft — Flags e Comandos

## Sintaxe geral

```
npx unificando-promptcraft [texto] [flags]
```

## Tabela de flags

| Flag | Tipo | Obrigatória | Default | Descrição |
|---|---|---|---|---|
| `[texto]` (posicional) | string | Sim, exceto em `--save` | — | Texto cru do prompt a ser melhorado |
| `--project` | boolean | Não | `false` | Ativa o bloco `<arquitetura>` no template (ver seção abaixo) |
| `--save` | boolean | Não | `false` | Muda o modo de operação: em vez de gerar, lê stdin e salva `.md` |
| `--title "texto"` | string | Não | heurística automática | Override do título usado no arquivo salvo (só tem efeito com `--save`) |
| `-h`, `--help` | boolean | Não | — | Mostra ajuda e sai |
| `-v`, `--version` | boolean | Não | — | Mostra versão do pacote e sai |

## Regras de combinação

- `--save` e `[texto]` posicional são **mutuamente exclusivos**. Se ambos
  forem passados, o CLI deve emitir erro explicando que `--save` opera
  sobre stdin, não sobre argumento posicional.
- `--project` só tem efeito no modo geração (sem `--save`). Se usado junto
  com `--save`, deve ser ignorado silenciosamente ou gerar aviso — decisão
  de implementação, não crítica.
- `--title` só tem efeito junto com `--save`. Sem `--save`, é ignorada com
  aviso.

## Detalhamento por flag

### `--project`

Opt-in (desligado por padrão). Quando ativa, adiciona ao template um bloco:

```
<arquitetura>
Antes de gerar o prompt final, explore a estrutura de pastas e o
package.json (ou equivalente) do projeto atual nesta sessão, para entender
a stack, as dependências e a arquitetura antes de aplicar as regras de
engenharia de prompt ao conteúdo de <descricao>.
</arquitetura>
```

**Premissa assumida:** o LLM de destino já roda com acesso a filesystem
(ex: Claude Code aberto na pasta do projeto). O pacote **não faz scan de
árvore nem lê `package.json`** — isso é delegado ao LLM de destino. Ver
documento `04-estrutura-tecnica.md` para o motivo dessa decisão.

### `--save`

Muda completamente o modo de operação do CLI:
1. Lê todo o conteúdo de `stdin` até EOF.
2. Extrai um título: primeira linha não vazia do texto colado, a não ser
   que `--title` tenha sido passado explicitamente.
3. Gera slug do título + timestamp (`YYYYMMDD-HHmm`) pra nome de arquivo.
4. Escreve um `.md` no diretório onde o comando foi executado (cwd), com o
   título como H1 e o conteúdo colado abaixo.

Uso:
```bash
npx unificando-promptcraft --save
# ou
pbpaste | npx unificando-promptcraft --save   # macOS, lendo do clipboard
```

### `--title`

Override manual do título, pra quando a heurística de "primeira linha" não
produzir um nome de arquivo bom o suficiente.

```bash
npx unificando-promptcraft --save --title "Prompt de resumo de reunião"
```

## Configuração do prompt-base

Não é uma flag. O prompt-base usado em toda geração é sempre
`prompts/base.md`, empacotado dentro do próprio pacote — sem override
local nem variável de ambiente. Isso mantém o comportamento previsível e
auditável: o conteúdo que roda é sempre exatamente o que está publicado no
pacote/repositório, sem depender de arquivo externo na máquina do usuário.

Ajustar o prompt-base exige editar `prompts/base.md`, dar bump de versão e
publicar novamente (`npm publish`).
