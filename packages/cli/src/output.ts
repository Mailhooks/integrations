export interface OutputFlags {
  pretty?: boolean;
}

export function shouldPretty(flags: OutputFlags = {}): boolean {
  if (flags.pretty === true) return true;
  if (flags.pretty === false) return false;
  return Boolean(process.stdout.isTTY);
}

export function emit(data: unknown, flags: OutputFlags = {}): void {
  const indent = shouldPretty(flags) ? 2 : 0;
  process.stdout.write(JSON.stringify(data, null, indent) + '\n');
}

export function fail(message: string, code = 'error', exitCode = 1): never {
  process.stderr.write(JSON.stringify({ error: message, code }) + '\n');
  process.exit(exitCode);
}

export function wrapError(err: unknown): { error: string; code: string; status?: number } {
  const anyErr = err as {
    response?: { status?: number; data?: { message?: string; error?: string } };
    message?: string;
    code?: string;
  };
  if (anyErr?.response) {
    return {
      error: anyErr.response.data?.message ?? anyErr.response.data?.error ?? anyErr.message ?? 'Request failed',
      code: anyErr.code ?? 'http_error',
      status: anyErr.response.status,
    };
  }
  return {
    error: anyErr?.message ?? String(err),
    code: anyErr?.code ?? 'error',
  };
}
