# unificando-promptcraft — Visão Geral

## O que é

CLI instalável via `npx`, que monta um prompt de "Engenheiro de Prompt"
concatenando um prompt-base fixo (empacotado no pacote) com o texto cru que
o usuário digita. O resultado é impresso no stdout, pronto pra ser colado
ou "pipado" em qualquer CLI de LLM.

**Princípio central: o pacote nunca faz chamada de API/rede.** Ele só lê
arquivo local, concatena texto e imprime. Quem efetivamente "melhora" o
prompt é o LLM de destino (Claude Code, Gemini CLI, ou qualquer chat),
ao processar o texto gerado — não o pacote em si. Isso é auditável: nenhum
dado sai do computador do usuário através deste pacote.

**Princípio de segurança: conteúdo do usuário é sempre dado, nunca comando.**
Tudo que o usuário digita entra dentro da tag `<descricao>`, e o template
deixa explícito ao LLM de destino que esse conteúdo deve ser tratado só
como texto a ser melhorado — nunca como instrução capaz de sobrescrever as
regras do prompt-base, mesmo que o texto colado contenha frases com
linguagem de comando. Essa proteção contra prompt injection fica tanto no
prompt-base quanto na instrução final gerada pelo próprio `buildTemplate.js`
(ver documento 04), pra não depender só de um lugar.

## Motivação

Hoje esse fluxo é manual: copiar o prompt-base de "Engenheiro de Prompt",
colar num chat, digitar a ideia crua, esperar a resposta. Automatizar a
montagem do texto elimina o passo de copiar/colar o prompt-base toda vez,
mantendo o usuário no controle de qual LLM processa o resultado.

## Fluxo de uso, em três cenários

### 1. Prompt solto, sem relação com projeto

```bash
npx unificando-promptcraft "quero um prompt pra gerar resumo de reunião"
```
Imprime o template no stdout. Cola em qualquer lugar, ou usa pipe (ver
documento 03).

### 2. Prompt que precisa de contexto do projeto atual

```bash
npx unificando-promptcraft --project "gera os testes unitários dessa função de pagamento"
```
Adiciona instrução pro LLM de destino explorar a arquitetura do projeto
atual antes de gerar o prompt (assume que o LLM de destino já tem acesso a
filesystem — ver documento 02, seção da flag `--project`).

### 3. Salvando o resultado depois

```bash
npx unificando-promptcraft --save
# cola o texto que o LLM de destino gerou, Ctrl+D pra confirmar
```
Persiste o resultado como `.md` no diretório atual. Sem chamada de API —
título é gerado por heurística de texto (ver documento 02).

## Documentos relacionados

- `02-flags-e-comandos.md` — especificação completa de cada flag
- `03-compatibilidade-clis.md` — quais CLIs de LLM aceitam pipe, e como
- `04-estrutura-tecnica.md` — arquitetura de pastas e arquivos de código
- `05-instrucoes-criacao-repo.md` — checklist pra scaffolding do repositório
