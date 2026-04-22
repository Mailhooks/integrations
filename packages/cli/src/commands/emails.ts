import { writeFile } from 'node:fs/promises';
import type { Command } from 'commander';
import { createClient } from '../client.js';
import { emit, fail, wrapError, type OutputFlags } from '../output.js';
import { buildFilter, type FilterFlags } from '../filter.js';

type GlobalFlags = OutputFlags & { apiKey?: string; baseUrl?: string };

function parseIntOption(raw: string): number {
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) throw new Error(`Expected integer, got "${raw}"`);
  return n;
}

function handle(err: unknown, opts: { timeoutCode?: boolean } = {}): never {
  const wrapped = wrapError(err);
  const isTimeout = opts.timeoutCode && /timeout/i.test(wrapped.error);
  fail(wrapped.error, isTimeout ? 'timeout' : wrapped.code, isTimeout ? 124 : 1);
}

export function registerEmailCommands(program: Command): void {
  const emails = program.command('emails').description('Work with emails in your Mailhooks inbox');

  emails
    .command('list')
    .description('List emails (paginated, most recent first by default)')
    .option('--from <addr>', 'Filter by sender address')
    .option('--to <addr>', 'Filter by recipient address')
    .option('--subject <s>', 'Filter by subject substring')
    .option('--since <date>', 'Only include emails created after this date (ISO or parseable form)')
    .option('--until <date>', 'Only include emails created before this date')
    .option('--read', 'Only show read emails')
    .option('--unread', 'Only show unread emails')
    .option('--page <n>', 'Page number (default 1)', parseIntOption)
    .option('--per-page <n>', 'Page size (default 20)', parseIntOption)
    .option('--sort-field <field>', 'Sort field: createdAt | from | subject')
    .option('--sort-order <order>', 'Sort order: asc | desc')
    .action(async function (this: Command) {
      const flags = this.optsWithGlobals() as GlobalFlags &
        FilterFlags & {
          page?: number;
          perPage?: number;
          sortField?: 'createdAt' | 'from' | 'subject';
          sortOrder?: 'asc' | 'desc';
        };
      try {
        const client = await createClient(flags);
        const filter = buildFilter(flags);
        const result = await client.emails.list({
          page: flags.page,
          perPage: flags.perPage,
          filter,
          sort:
            flags.sortField || flags.sortOrder
              ? { field: flags.sortField, order: flags.sortOrder }
              : undefined,
        });
        emit(result, flags);
      } catch (err) {
        handle(err);
      }
    });

  emails
    .command('get')
    .argument('<id>', 'Email ID')
    .description('Get a single email by ID')
    .option('--mark-read', 'Mark the email as read when fetching')
    .action(async function (this: Command, id: string) {
      const flags = this.optsWithGlobals() as GlobalFlags & { markRead?: boolean };
      try {
        const client = await createClient(flags);
        const email = await client.emails.getEmail(id, Boolean(flags.markRead));
        emit(email, flags);
      } catch (err) {
        handle(err);
      }
    });

  emails
    .command('content')
    .argument('<id>', 'Email ID')
    .description('Get the HTML and text body of an email')
    .option('--html', 'Print only the HTML body to stdout (raw, not JSON)')
    .option('--text', 'Print only the text body to stdout (raw, not JSON)')
    .action(async function (this: Command, id: string) {
      const flags = this.optsWithGlobals() as GlobalFlags & { html?: boolean; text?: boolean };
      if (flags.html && flags.text) {
        fail('Pass only one of --html or --text', 'usage', 2);
      }
      try {
        const client = await createClient(flags);
        const content = await client.emails.getContent(id);
        if (flags.html) {
          process.stdout.write(content.html ?? '');
          return;
        }
        if (flags.text) {
          process.stdout.write(content.text ?? '');
          return;
        }
        emit(content, flags);
      } catch (err) {
        handle(err);
      }
    });

  emails
    .command('wait-for')
    .description('Block until an email matching the filters arrives')
    .option('--from <addr>', 'Filter by sender address')
    .option('--to <addr>', 'Filter by recipient address')
    .option('--subject <s>', 'Filter by subject substring')
    .option('--since <date>', 'Only consider emails after this date')
    .option('--until <date>', 'Only consider emails before this date')
    .option('--read', 'Only match read emails')
    .option('--unread', 'Only match unread emails')
    .option('--timeout <ms>', 'Max time to wait in ms (default 30000)', parseIntOption)
    .option('--poll-interval <ms>', 'Poll frequency in ms (default 1000)', parseIntOption)
    .option('--initial-delay <ms>', 'Wait this long before first check (default 0)', parseIntOption)
    .option('--lookback <ms>', 'Consider emails from this far back on first check (default 10000)', parseIntOption)
    .action(async function (this: Command) {
      const flags = this.optsWithGlobals() as GlobalFlags &
        FilterFlags & {
          timeout?: number;
          pollInterval?: number;
          initialDelay?: number;
          lookback?: number;
        };
      try {
        const client = await createClient(flags);
        const filter = buildFilter(flags);
        const email = await client.emails.waitFor({
          filter,
          timeout: flags.timeout,
          pollInterval: flags.pollInterval,
          initialDelay: flags.initialDelay,
          lookbackWindow: flags.lookback,
        });
        emit(email, flags);
      } catch (err) {
        handle(err, { timeoutCode: true });
      }
    });

  emails
    .command('mark-read')
    .argument('<id>', 'Email ID')
    .description('Mark an email as read')
    .action(async function (this: Command, id: string) {
      const flags = this.optsWithGlobals() as GlobalFlags;
      try {
        const client = await createClient(flags);
        const email = await client.emails.markAsRead(id);
        emit(email, flags);
      } catch (err) {
        handle(err);
      }
    });

  emails
    .command('mark-unread')
    .argument('<id>', 'Email ID')
    .description('Mark an email as unread')
    .action(async function (this: Command, id: string) {
      const flags = this.optsWithGlobals() as GlobalFlags;
      try {
        const client = await createClient(flags);
        const email = await client.emails.markAsUnread(id);
        emit(email, flags);
      } catch (err) {
        handle(err);
      }
    });

  emails
    .command('delete')
    .argument('<id>', 'Email ID')
    .description('Permanently delete an email and its attachments')
    .action(async function (this: Command, id: string) {
      const flags = this.optsWithGlobals() as GlobalFlags;
      try {
        const client = await createClient(flags);
        await client.emails.deleteEmail(id);
        emit({ id, deleted: true }, flags);
      } catch (err) {
        handle(err);
      }
    });

  emails
    .command('download-eml')
    .argument('<id>', 'Email ID')
    .description('Download an email as EML (raw rfc822)')
    .option('-o, --output <path>', 'Write to this file instead of stdout')
    .action(async function (this: Command, id: string) {
      const flags = this.optsWithGlobals() as GlobalFlags & { output?: string };
      try {
        const client = await createClient(flags);
        const { data, filename } = await client.emails.downloadEml(id);
        const buf = Buffer.from(data);
        if (flags.output) {
          await writeFile(flags.output, buf);
          emit({ id, path: flags.output, filename, bytes: buf.length }, flags);
        } else {
          process.stdout.write(buf);
        }
      } catch (err) {
        handle(err);
      }
    });

  emails
    .command('download-attachment')
    .argument('<emailId>', 'Email ID')
    .argument('<attachmentId>', 'Attachment ID (from emails get → .attachments[].id)')
    .description('Download an attachment from an email')
    .option('-o, --output <path>', 'Write to this file instead of stdout')
    .action(async function (this: Command, emailId: string, attachmentId: string) {
      const flags = this.optsWithGlobals() as GlobalFlags & { output?: string };
      try {
        const client = await createClient(flags);
        const { data, filename, contentType } = await client.emails.downloadAttachment(
          emailId,
          attachmentId
        );
        const buf = Buffer.from(data);
        if (flags.output) {
          await writeFile(flags.output, buf);
          emit(
            { emailId, attachmentId, path: flags.output, filename, contentType, bytes: buf.length },
            flags
          );
        } else {
          process.stdout.write(buf);
        }
      } catch (err) {
        handle(err);
      }
    });
}
