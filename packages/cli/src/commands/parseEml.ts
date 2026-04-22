import { readFile } from 'node:fs/promises';
import type { Command } from 'commander';
import { parseEml } from '@mailhooks/sdk';
import { emit, fail, wrapError, type OutputFlags } from '../output.js';

export function registerParseEmlCommand(program: Command): void {
  program
    .command('parse-eml')
    .argument('[file]', 'Path to EML file (if omitted, reads stdin)')
    .description('Parse an EML file into structured JSON')
    .action(async function (this: Command, file: string | undefined) {
      const flags = this.optsWithGlobals() as OutputFlags;
      try {
        const input = file ? await readFile(file) : await readStdin();
        if (!input.length) {
          fail('No EML content provided (pass a file path or pipe to stdin)', 'no_input', 2);
        }
        const parsed = await parseEml(input);
        emit(parsed, flags);
      } catch (err) {
        const wrapped = wrapError(err);
        fail(wrapped.error, wrapped.code);
      }
    });
}

async function readStdin(): Promise<Buffer> {
  if (process.stdin.isTTY) return Buffer.alloc(0);
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}
