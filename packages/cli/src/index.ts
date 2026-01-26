#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { Mailhooks, Email, Attachment } from '@mailhooks/sdk';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// Version from package.json
const VERSION = '1.0.0';

// Create the main program
const program = new Command();

// Helper to get API configuration
function getConfig(): { apiKey: string; baseUrl: string } {
  const apiKey = process.env.MAILHOOKS_API_KEY;
  const baseUrl = process.env.MAILHOOKS_API_URL || 'https://mailhooks.dev/api';

  if (!apiKey) {
    console.error(chalk.red('Error: MAILHOOKS_API_KEY environment variable is required'));
    console.error(chalk.gray('Set it with: export MAILHOOKS_API_KEY=your_api_key'));
    process.exit(1);
  }

  return { apiKey, baseUrl };
}

// Helper to create SDK instance
function createClient(): Mailhooks {
  const { apiKey, baseUrl } = getConfig();
  return new Mailhooks({ apiKey, baseUrl });
}

// Helper to create axios instance for domains API (not in SDK)
function createAxiosClient() {
  const { apiKey, baseUrl } = getConfig();
  return axios.create({
    baseURL: baseUrl,
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
  });
}

// Format date for display
function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString();
}

// Format file size
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Display a single email summary
function displayEmailSummary(email: Email, index?: number): void {
  const prefix = index !== undefined ? chalk.gray(`[${index + 1}] `) : '';
  console.log(`${prefix}${chalk.cyan('ID:')} ${email.id}`);
  console.log(`    ${chalk.cyan('From:')} ${email.from}`);
  console.log(`    ${chalk.cyan('To:')} ${email.to.join(', ')}`);
  console.log(`    ${chalk.cyan('Subject:')} ${email.subject}`);
  console.log(`    ${chalk.cyan('Date:')} ${formatDate(email.createdAt)}`);
  console.log(`    ${chalk.cyan('Read:')} ${email.read ? chalk.green('Yes') : chalk.yellow('No')}`);
  if (email.attachments.length > 0) {
    console.log(`    ${chalk.cyan('Attachments:')} ${email.attachments.length}`);
  }
  console.log();
}

// Display email details with content
function displayEmailDetails(email: Email, content: { html?: string; text?: string }): void {
  console.log(chalk.bold('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  console.log(`${chalk.cyan('ID:')} ${email.id}`);
  console.log(`${chalk.cyan('From:')} ${email.from}`);
  console.log(`${chalk.cyan('To:')} ${email.to.join(', ')}`);
  console.log(`${chalk.cyan('Subject:')} ${email.subject}`);
  console.log(`${chalk.cyan('Date:')} ${formatDate(email.createdAt)}`);
  console.log(`${chalk.cyan('Read:')} ${email.read ? chalk.green('Yes') : chalk.yellow('No')}`);

  if (email.attachments.length > 0) {
    console.log(chalk.cyan('\nAttachments:'));
    email.attachments.forEach((att: Attachment, i: number) => {
      console.log(`  ${i + 1}. ${att.filename} (${att.contentType}, ${formatSize(att.size)})`);
      console.log(chalk.gray(`     ID: ${att.id}`));
    });
  }

  console.log(chalk.bold('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));

  if (content.text) {
    console.log(chalk.cyan('\nText Content:'));
    console.log(content.text);
  }

  if (content.html) {
    console.log(chalk.cyan('\nHTML Content (preview):'));
    const preview = content.html.substring(0, 500);
    console.log(chalk.gray(preview + (content.html.length > 500 ? '...' : '')));
  }

  if (!content.text && !content.html) {
    console.log(chalk.yellow('\n(No content available)'));
  }
}

// ============================================================================
// Commands
// ============================================================================

program
  .name('mailhooks')
  .description('CLI for Mailhooks - list, read, and manage emails')
  .version(VERSION);

// LIST command
program
  .command('list')
  .alias('ls')
  .description('List emails from your Mailhooks inbox')
  .option('-p, --page <number>', 'Page number', '1')
  .option('-n, --per-page <number>', 'Number of emails per page', '20')
  .option('-f, --from <email>', 'Filter by sender email address')
  .option('-t, --to <email>', 'Filter by recipient email address')
  .option('-s, --subject <text>', 'Filter by subject (partial match)')
  .option('--read', 'Show only read emails')
  .option('--unread', 'Show only unread emails')
  .option('--start-date <date>', 'Filter emails after this date (ISO format)')
  .option('--end-date <date>', 'Filter emails before this date (ISO format)')
  .option('--sort <field>', 'Sort field: createdAt, from, subject', 'createdAt')
  .option('--order <order>', 'Sort order: asc, desc', 'desc')
  .option('-j, --json', 'Output as JSON')
  .action(async (options) => {
    const spinner = ora('Fetching emails...').start();

    try {
      const client = createClient();

      let readFilter: boolean | undefined = undefined;
      if (options.read) readFilter = true;
      if (options.unread) readFilter = false;

      const response = await client.emails.list({
        page: parseInt(options.page),
        perPage: parseInt(options.perPage),
        filter: {
          from: options.from,
          to: options.to,
          subject: options.subject,
          read: readFilter,
          startDate: options.startDate,
          endDate: options.endDate,
        },
        sort: {
          field: options.sort as 'createdAt' | 'from' | 'subject',
          order: options.order as 'asc' | 'desc',
        },
      });

      spinner.stop();

      if (options.json) {
        console.log(JSON.stringify(response, null, 2));
        return;
      }

      console.log(chalk.bold(`\nFound ${response.totalItems} emails (Page ${response.currentPage}/${response.totalPages})\n`));

      if (response.data.length === 0) {
        console.log(chalk.yellow('No emails found matching your criteria.'));
        return;
      }

      response.data.forEach((email: Email, index: number) => {
        displayEmailSummary(email, index);
      });

      if (response.hasNextPage) {
        console.log(chalk.gray(`Use --page ${response.currentPage + 1} to see more emails`));
      }
    } catch (error) {
      spinner.fail('Failed to fetch emails');
      const message = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`Error: ${message}`));
      process.exit(1);
    }
  });

// READ command
program
  .command('read <emailId>')
  .alias('get')
  .description('Read the full content of an email')
  .option('-m, --mark-read', 'Mark the email as read')
  .option('-j, --json', 'Output as JSON')
  .option('--text-only', 'Show only text content')
  .option('--html-only', 'Show only HTML content')
  .action(async (emailId: string, options) => {
    const spinner = ora('Fetching email...').start();

    try {
      const client = createClient();

      const [email, content] = await Promise.all([
        client.emails.getEmail(emailId, options.markRead),
        client.emails.getContent(emailId),
      ]);

      spinner.stop();

      if (options.json) {
        console.log(JSON.stringify({ ...email, content }, null, 2));
        return;
      }

      if (options.textOnly) {
        console.log(content.text || '(No text content)');
        return;
      }

      if (options.htmlOnly) {
        console.log(content.html || '(No HTML content)');
        return;
      }

      displayEmailDetails(email, content);
    } catch (error) {
      spinner.fail('Failed to fetch email');
      const message = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`Error: ${message}`));
      process.exit(1);
    }
  });

// WAIT command
program
  .command('wait')
  .description('Wait for an email matching specific criteria')
  .option('-f, --from <email>', 'Filter by sender email address')
  .option('-t, --to <email>', 'Filter by recipient email address')
  .option('-s, --subject <text>', 'Filter by subject (partial match)')
  .option('--timeout <ms>', 'Maximum time to wait in milliseconds', '30000')
  .option('--poll-interval <ms>', 'Time between checks in milliseconds', '1000')
  .option('--initial-delay <ms>', 'Delay before first check in milliseconds', '0')
  .option('--lookback <ms>', 'How far back to check on first poll in milliseconds', '10000')
  .option('--max-retries <number>', 'Maximum number of polling attempts')
  .option('-j, --json', 'Output as JSON')
  .option('-q, --quiet', 'Only output the email ID')
  .action(async (options) => {
    const spinner = ora('Waiting for email...').start();

    try {
      const client = createClient();

      const startTime = Date.now();

      const email = await client.emails.waitFor({
        filter: {
          from: options.from,
          to: options.to,
          subject: options.subject,
        },
        timeout: parseInt(options.timeout),
        pollInterval: parseInt(options.pollInterval),
        initialDelay: parseInt(options.initialDelay),
        lookbackWindow: parseInt(options.lookback),
        maxRetries: options.maxRetries ? parseInt(options.maxRetries) : undefined,
      });

      const elapsed = Date.now() - startTime;
      spinner.succeed(`Email found in ${(elapsed / 1000).toFixed(1)}s`);

      if (options.quiet) {
        console.log(email.id);
        return;
      }

      if (options.json) {
        console.log(JSON.stringify(email, null, 2));
        return;
      }

      console.log();
      displayEmailSummary(email);
      console.log(chalk.gray(`Use 'mailhooks read ${email.id}' to view the full content`));
    } catch (error) {
      spinner.fail('Failed to find email');
      const message = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`Error: ${message}`));

      if (message.includes('Timeout')) {
        console.error(chalk.yellow('\nTip: Try increasing --timeout or relaxing your filters'));
      }
      process.exit(1);
    }
  });

// DOWNLOAD command
program
  .command('download <emailId>')
  .description('Download email as EML or download attachments')
  .option('-a, --attachment <id>', 'Download a specific attachment by ID')
  .option('-o, --output <path>', 'Output file path (default: current directory)')
  .option('--all-attachments', 'Download all attachments')
  .action(async (emailId: string, options) => {
    const spinner = ora('Downloading...').start();

    try {
      const client = createClient();

      if (options.attachment) {
        // Download specific attachment
        const response = await client.emails.downloadAttachment(emailId, options.attachment);
        const filename = options.output || response.filename || `attachment-${options.attachment}`;
        const outputPath = path.resolve(filename);

        fs.writeFileSync(outputPath, Buffer.from(response.data));
        spinner.succeed(`Downloaded attachment to ${outputPath}`);
      } else if (options.allAttachments) {
        // Download all attachments
        const email = await client.emails.getEmail(emailId);

        if (email.attachments.length === 0) {
          spinner.info('No attachments found in this email');
          return;
        }

        const outputDir = options.output || '.';
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        spinner.text = `Downloading ${email.attachments.length} attachments...`;

        for (const attachment of email.attachments) {
          const response = await client.emails.downloadAttachment(emailId, attachment.id);
          const filename = response.filename || attachment.filename;
          const outputPath = path.join(outputDir, filename);
          fs.writeFileSync(outputPath, Buffer.from(response.data));
          console.log(chalk.green(`  ✓ ${filename}`));
        }

        spinner.succeed(`Downloaded ${email.attachments.length} attachments to ${outputDir}`);
      } else {
        // Download EML
        const response = await client.emails.downloadEml(emailId);
        const filename = options.output || response.filename || `email-${emailId}.eml`;
        const outputPath = path.resolve(filename);

        fs.writeFileSync(outputPath, Buffer.from(response.data));
        spinner.succeed(`Downloaded EML to ${outputPath}`);
      }
    } catch (error) {
      spinner.fail('Download failed');
      const message = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`Error: ${message}`));
      process.exit(1);
    }
  });

// DOMAINS command
program
  .command('domains')
  .description('List all configured domains')
  .option('-j, --json', 'Output as JSON')
  .action(async (options) => {
    const spinner = ora('Fetching domains...').start();

    try {
      const axiosClient = createAxiosClient();
      const response = await axiosClient.get('/v1/domains');
      const domains = response.data;

      spinner.stop();

      if (options.json) {
        console.log(JSON.stringify(domains, null, 2));
        return;
      }

      if (!domains || domains.length === 0) {
        console.log(chalk.yellow('No domains configured in your Mailhooks account.'));
        return;
      }

      console.log(chalk.bold(`\nFound ${domains.length} domain${domains.length === 1 ? '' : 's'}:\n`));

      domains.forEach((domain: any) => {
        const status = domain.enabled ? chalk.green('Enabled') : chalk.red('Disabled');
        const verified = domain.verified ? chalk.green('Verified') : chalk.yellow('Not Verified');

        console.log(`${chalk.cyan('Domain:')} ${domain.domain}`);
        console.log(`  ${chalk.gray('ID:')} ${domain.id}`);
        console.log(`  ${chalk.gray('Status:')} ${status}`);
        console.log(`  ${chalk.gray('Verified:')} ${verified}`);
        console.log(`  ${chalk.gray('Created:')} ${formatDate(domain.createdAt)}`);
        console.log();
      });
    } catch (error) {
      spinner.fail('Failed to fetch domains');
      const message = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`Error: ${message}`));
      process.exit(1);
    }
  });

// MARK-READ command
program
  .command('mark-read <emailId>')
  .description('Mark an email as read')
  .action(async (emailId: string) => {
    const spinner = ora('Marking as read...').start();

    try {
      const client = createClient();
      await client.emails.markAsRead(emailId);
      spinner.succeed('Email marked as read');
    } catch (error) {
      spinner.fail('Failed to mark email as read');
      const message = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`Error: ${message}`));
      process.exit(1);
    }
  });

// MARK-UNREAD command
program
  .command('mark-unread <emailId>')
  .description('Mark an email as unread')
  .action(async (emailId: string) => {
    const spinner = ora('Marking as unread...').start();

    try {
      const client = createClient();
      await client.emails.markAsUnread(emailId);
      spinner.succeed('Email marked as unread');
    } catch (error) {
      spinner.fail('Failed to mark email as unread');
      const message = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`Error: ${message}`));
      process.exit(1);
    }
  });

// Parse and run
program.parse();
