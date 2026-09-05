const { spawn, spawnSync } = require('child_process');

const LLM_DEFS = {
  claude: {
    command: 'claude',
    args: ['-p', '--output-format', 'text', '--permission-mode', 'plan', '--no-session-persistence'],
  },
  gemini: {
    // -p '' (prompt vazio) + template via stdin (padrão "Appended to input on
    // stdin"); se uma versão rejeitar -p '', a saída é usar --raw + pipe.
    command: 'gemini',
    args: ['-p', '', '--approval-mode', 'plan', '--skip-trust'],
  },
  opencode: {
    // opencode run (não-interativo) + template via stdin. Não validado nesta
    // máquina (opencode não instalado) — se a invocação for incompatível com
    // alguma versão, o erro propaga claro (RUN_FAILED) e a alternativa é
    // `opencode run "<template>"` via argumento.
    command: 'opencode',
    args: ['run', '--format', 'text'],
  },
};

const LLM_NAMES = Object.keys(LLM_DEFS);

class RunError extends Error {
  constructor(message, { code = null, stdout = '', stderr = '', exitCode = null, command = null, args = [] } = {}) {
    super(message);
    this.name = 'RunError';
    this.code = code;
    this.stdout = stdout;
    this.stderr = stderr;
    this.exitCode = exitCode;
    this.command = command;
    this.args = args;
  }
}

// Primeira linha não vazia, truncada — evita stack trace gigante no erro.
function firstDetail(text, max = 500) {
  const line = String(text).split('\n').find((l) => l.trim().length > 0) || '';
  return line.length > max ? `${line.slice(0, max)}…` : line;
}

function probeExists(command, { env, isWin32 }) {
  try {
    const res = spawnSync(command, ['--version'], { stdio: 'ignore', timeout: 5000, shell: isWin32, env });
    return !res.error;
  } catch {
    return false;
  }
}

function detectLlm({ llm = 'auto', env = process.env, isWin32 = process.platform === 'win32' } = {}) {
  if (llm !== 'auto' && !LLM_DEFS[llm]) {
    throw new RunError(
      `Valor inválido para --llm: "${llm}". Opções: ${LLM_NAMES.join(', ')} ou auto.`,
      { code: 'LLM_INVALID' }
    );
  }
  const wanted = llm === 'auto' ? LLM_NAMES : [llm];
  for (const name of wanted) {
    if (probeExists(LLM_DEFS[name].command, { env, isWin32 })) {
      return { name, ...LLM_DEFS[name] };
    }
  }
  throw new RunError(
    `Nenhum CLI de LLM encontrado no PATH (procurados: ${wanted.join(', ')}). ` +
      `Instale \`claude\` ou \`gemini\` e autentique, ou use --raw para obter o meta-prompt bruto.`,
    { code: 'LLM_NOT_FOUND' }
  );
}

function buildArgs(definition) {
  // Ponto único de construção dos args do spawn. O template sempre vai por
  // stdin (child.stdin), nunca no argv — evita limite de tamanho de argv e
  // qualquer risco de interpolação. Se alguma versão do gemini rejeitar
  // `-p ''`, a alternativa documentada é --raw + pipe.
  return [...definition.args];
}

function runPrompt(
  template,
  {
    llm = 'auto',
    cwd = process.cwd(),
    commandOverride = null,
    timeoutMs,
    env = process.env,
    isWin32 = process.platform === 'win32',
  } = {}
) {
  const limit = timeoutMs || Number(env.PROMPTCRAFT_TIMEOUT_MS) || 120000;

  return new Promise((resolve, reject) => {
    let cmd;
    let args;

    if (commandOverride) {
      cmd = Array.isArray(commandOverride) ? commandOverride[0] : commandOverride.command;
      args = Array.isArray(commandOverride) ? commandOverride.slice(1) : commandOverride.args;
    } else {
      let definition;
      try {
        definition = detectLlm({ llm, env, isWin32 });
      } catch (err) {
        reject(err);
        return;
      }
      cmd = definition.command;
      args = buildArgs(definition);
    }

    const child = spawn(cmd, args, {
      cwd,
      env,
      shell: isWin32,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let settled = false;
    let timedOut = false;
    let killTimer = null;
    let drainTimer = null;

    const cleanup = () => {
      clearTimeout(timeoutTimer);
      if (killTimer) clearTimeout(killTimer);
      if (drainTimer) clearTimeout(drainTimer);
      // Fecha o lado do Node dos pipes: um órfão segurando o outro lado
      // seguraria o event loop e impediria o processo terminar.
      try { child.stdin.destroy(); } catch {}
      try { child.stdout.destroy(); } catch {}
      try { child.stderr.destroy(); } catch {}
    };
    const settle = (fn) => (value) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn(value);
    };

    // Timeout manual: SIGTERM → carência → SIGKILL. O timeout nativo do
    // spawn envia um único SIGTERM; se o filho o ignorar, a promise ficaria
    // pendente (e, pior, resolveria como sucesso se o processo saísse com 0
    // depois). Usamos 'exit' em vez de 'close': um processo órfão pode
    // segurar os pipes de stdio e atrasar o 'close' por tempo indefinido,
    // enquanto o 'exit' dispara assim que o processo morre (mesmo por sinal).
    const timeoutTimer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      killTimer = setTimeout(() => {
        if (child.exitCode === null) child.kill('SIGKILL');
      }, 2000);
    }, limit);

    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    // Filho pode fechar o stdin cedo (ex: erro imediato) — EPIPE não pode derrubar o processo.
    child.stdin.on('error', () => {});

    child.on('error', settle((err) => reject(new RunError(err.message, { code: err.code, command: cmd, args }))));
    // 'exit' + pequeno drain: o 'exit' dispara quando o processo termina mesmo
    // com órfãos nos pipes; o drain de 150ms dá tempo pro restante do stdout
    // chegar antes de capturar o resultado.
    child.on('exit', (exitCode, signal) => {
      drainTimer = setTimeout(() => {
        if (timedOut) {
          settle(() => reject(
            new RunError(
              `Tempo limite excedido (${limit}ms) executando ${cmd}. Ajuste com PROMPTCRAFT_TIMEOUT_MS.`,
              { code: 'RUN_TIMEOUT', stdout, stderr, exitCode, command: cmd, args }
            )
          ))();
          return;
        }
        if (exitCode === 0) {
          settle(() => resolve({ stdout, stderr, exitCode, command: cmd, args }))();
          return;
        }
        // Alguns CLIs (ex: claude) escrevem a mensagem de erro no stdout em
        // vez do stderr — usa stdout como fallback pro detalhe não ficar vazio.
        const detail = firstDetail(stderr) || firstDetail(stdout);
        settle(() => reject(
          new RunError(
            `Falha ao executar ${cmd} (exit ${exitCode}${signal ? `, sinal ${signal}` : ''}): ${detail}`,
            { code: 'RUN_FAILED', stdout, stderr, exitCode, command: cmd, args }
          )
        ))();
      }, 150);
    });

    try {
      child.stdin.write(template);
      child.stdin.end();
    } catch {
      // stdin já fechado; o error/exit do filho cobre o resultado.
    }
  });
}

module.exports = { detectLlm, runPrompt, buildArgs, RunError, LLM_DEFS, LLM_NAMES };