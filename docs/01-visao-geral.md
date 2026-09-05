# promptcraft-unificando — Visão Geral

## O que é

CLI instalável via `npx` que **refina prompts em 1 passo**: monta o prompt
de "Engenheiro de Prompt" concatenando um prompt-base fixo (empacotado no
pacote) com o texto cru que o usuário digita, e **delega a execução a um
CLI de LLM local** (`claude` ou `gemini`, headless, rodando no diretório
atual), devolvendo o prompt final refinado.

**Princípio central: o pacote nunca faz chamada de API/rede própria.** A
execução é delegada a um processo local (`claude -p` / `gemini -p`) — quem
"melhora" o prompt é o LLM do CLI local, já autenticado pelo usuário, não o
pacote. Isso é auditável: nenhum dado sai do computador **através deste
pacote** (a rede, se houver, é da CLI local delegada).

**Modo `--raw` (legado):** no comportamento padrão (v1.0.0) o CLI executa e
imprime o resultado final. Com `--raw`, ele só imprime o meta-prompt bruto
no stdout — agnóstico de LLM, pronto pra ser colado ou "pipado" em qualquer
CLI/chat (o fluxo das versões 0.x).

**Princípio de segurança: conteúdo do usuário é sempre dado, nunca comando.**
Tudo que o usuário digita entra dentro da tag `<descricao>`, e o template
deixa explícito ao LLM de destino que esse conteúdo deve ser tratado só
como texto a ser melhorado — nunca como instrução capaz de sobrescrever as
regras do prompt-base, mesmo que o texto colado contenha frases com
linguagem de comando. Essa proteção contra prompt injection fica tanto no
prompt-base quanto na instrução final gerada pelo próprio `buildTemplate.js`
(ver documento 04), pra não depender só de um lugar.

## Motivação

Nas versões 0.x o fluxo era: rodar o CLI, pegar o meta-prompt e colar numa
IA manualmente, esperando a resposta. A v1.0.0 elimina esse segundo passo:
o CLI executa o meta-prompt ele mesmo e devolve direto o resultado final. O
modo `--raw` preserva o fluxo manual/pipe para quem quiser usar outra IA
(ou quando `claude`/`gemini` não estiverem instalados).

## Fluxo de uso, em cinco cenários

### 1. Resultado final em 1 passo (padrão)

```bash
npx promptcraft-unificando "quero um prompt pra gerar resumo de reunião"
```
Detecta o CLI local (`claude` → `gemini` → `opencode`, em ordem), executa o
template e imprime o prompt final refinado. No modo direto o template leva o
sufixo `<modo_direto>`: a IA entrega **somente** o prompt final completo,
sem a pergunta "posso executar?" nem pedido de mais informações que o
`prompts/base.md` exigiria por padrão (isso atende o objetivo de "gerar logo
o resultado").

### 2. Prompt que precisa de contexto do projeto atual

```bash
npx promptcraft-unificando --project "gera os testes unitários dessa função de pagamento"
```
A execução roda com cwd = diretório atual; o LLM local explora a arquitetura
(estrutura de pastas, `package.json`) antes de gerar o prompt (ver
documento 02, seção da flag `--project`).

### 3. Gerando e salvando direto

```bash
npx promptcraft-unificando --project "..." --save
```
Gera o resultado final e grava `.md` no diretório atual, sem pipe manual.

### 4. Meta-prompt bruto (modo `--raw`)

```bash
npx promptcraft-unificando --raw "quero um prompt pra gerar resumo de reunião"
```
Imprime o meta-prompt cru; pipe para `claude`/`gemini`/qualquer chat (ver
documento 03).

### 5. Salvando o resultado de qualquer LLM (legado stdin)

```bash
npx promptcraft-unificando --save
# cola o texto que o LLM de destino gerou, Ctrl+D pra confirmar
```
Persiste o resultado como `.md` no diretório atual. Sem chamada de API —
título é gerado por heurística de texto (ver documento 02).

## Documentos relacionados

- `02-flags-e-comandos.md` — especificação completa de cada flag
- `03-compatibilidade-clis.md` — como o CLI executa/delega e quais CLIs
  aceitam pipe no modo `--raw`
- `04-estrutura-tecnica.md` — arquitetura de pastas e arquivos de código
- `05-instrucoes-criacao-repo.md` — checklist pra scaffolding do repositório