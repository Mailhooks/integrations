import { Command } from 'commander';
import { createRequire } from 'node:module';
import { registerAuthCommands } from './commands/auth.js';
import { registerEmailCommands } from './commands/emails.js';
import { registerListenCommand } from './commands/listen.js';
import { registerParseEmlCommand } from './commands/parseEml.js';
import { registerProfileCommands } from './commands/profiles.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { version: string };

const program = new Command();

program
  .name('mailhooks')
  .description('Mailhooks CLI — agent-friendly access to the Mailhooks email platform')
  .version(pkg.version)
  .option('--api-key <key>', 'Mailhooks API key (defaults to $MAILHOOKS_API_KEY or stored profile)')
  .option('--base-url <url>', 'Override API base URL (defaults to $MAILHOOKS_API_URL, stored profile, or https://mailhooks.dev/api)')
  .option('--profile <name>', 'Credential profile to use (defaults to $MAILHOOKS_PROFILE or the current profile)')
  .option('--pretty', 'Force pretty-printed JSON (default when stdout is a TTY; use --no-pretty to force compact)');

registerAuthCommands(program);
registerProfileCommands(program);
registerEmailCommands(program);
registerParseEmlCommand(program);
registerListenCommand(program);

try {
  await program.parseAsync(process.argv);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(JSON.stringify({ error: message, code: 'cli_error' }) + '\n');
  process.exit(1);
}
