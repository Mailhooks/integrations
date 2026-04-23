import http from 'node:http';
import { URL } from 'node:url';
import type { Command } from 'commander';
import {
  Mailhooks,
  RealtimeEventType,
  type EmailReceivedPayload,
  type EmailUpdatedPayload,
} from '@mailhooks/sdk';
import { resolveCredentials, DEFAULT_BASE_URL } from '../client.js';
import { emit, fail } from '../output.js';

type GlobalFlags = { apiKey?: string; baseUrl?: string; profile?: string };

export function registerListenCommand(program: Command): void {
  program
    .command('listen')
    .description('Listen for email events via SSE and forward them to a local webhook endpoint')
    .option('-f, --forward-to <url>', 'Local URL to forward events to (e.g. http://localhost:3000/webhooks)', 'http://localhost:3000/webhooks')
    .option('--mode <mode>', 'SSE connection mode: broadcast (all events) or distributed (load-balanced)', 'broadcast')
    .option('--no-reconnect', 'Disable automatic reconnection on SSE disconnect')
    .option('--reconnect-delay <ms>', 'Reconnect delay in ms (default: 5000)', Number.parseInt)
    .option('--secret <secret>', 'Webhook signing secret (whsec_...). If set, forwards include X-Webhook-Signature header')
    .option('--print', 'Also print events to stdout (default when stdout is a TTY)')
    .option('--no-print', 'Do not print events to stdout')
    .action(async function (this: Command) {
      const flags = this.optsWithGlobals() as GlobalFlags & {
        forwardTo: string;
        mode: 'broadcast' | 'distributed';
        reconnect: boolean;
        reconnectDelay?: number;
        secret?: string;
        print?: boolean;
      };

      // Resolve credentials
      const resolved = await resolveCredentials(flags);
      if (!resolved) {
        fail('No API key configured. Run `mailhooks login`, pass --api-key, or set $MAILHOOKS_API_KEY.', 'missing_api_key', 2);
      }

      // Validate forward-to URL
      let forwardUrl: URL;
      try {
        forwardUrl = new URL(flags.forwardTo);
      } catch {
        fail(`Invalid --forward-to URL: ${flags.forwardTo}`, 'usage', 2);
      }

      if (forwardUrl.protocol !== 'http:' && forwardUrl.protocol !== 'https:') {
        fail(`--forward-to must be an HTTP or HTTPS URL, got: ${forwardUrl.protocol}//`, 'usage', 2);
      }

      // Validate mode
      if (flags.mode !== 'broadcast' && flags.mode !== 'distributed') {
        fail(`--mode must be 'broadcast' or 'distributed', got: ${flags.mode}`, 'usage', 2);
      }

      const shouldPrint = flags.print !== false && (flags.print === true || process.stdout.isTTY);

      const mailhooks = new Mailhooks({ apiKey: resolved!.apiKey, baseUrl: resolved!.baseUrl });

      // Stats tracking
      let eventsReceived = 0;
      let eventsForwarded = 0;
      let eventsFailed = 0;
      const startTime = Date.now();

      // Startup banner
      const label = resolved!.profile ? `profile: ${resolved!.profile}` : `API key: ${resolved!.apiKey.slice(0, 8)}...`;
      process.stderr.write(`\n  🔗 Mailhooks Listen\n`);
      process.stderr.write(`  Source: ${resolved!.baseUrl}/v1/realtime/events (${flags.mode} mode)\n`);
      process.stderr.write(`  Forward: ${flags.forwardTo}\n`);
      process.stderr.write(`  Auth: ${label}\n`);
      if (flags.secret) process.stderr.write(`  Signing: enabled (X-Webhook-Signature)\n`);
      process.stderr.write(`\n  Ready. Waiting for events...\n\n`);

      // Build a WebhookPayload-compatible body from an email ID.
      // Fetches the email metadata + content from the API so the forwarded
      // payload matches what a real Mailhooks webhook would send.
      async function buildWebhookPayload(emailId: string): Promise<Record<string, unknown>> {
        const [email, content] = await Promise.all([
          mailhooks.emails.getEmail(emailId),
          mailhooks.emails.getContent(emailId),
        ]);

        return {
          id: email.id,
          from: email.from,
          to: email.to,
          subject: email.subject,
          body: content.text ?? '',
          html: content.html,
          attachments: (email as any).attachments ?? [],
          receivedAt: email.createdAt instanceof Date
            ? email.createdAt.toISOString()
            : String(email.createdAt),
          spfResult: (email as any).spfResult,
          dkimResult: (email as any).dkimResult,
          dmarcResult: (email as any).dmarcResult,
          authSummary: (email as any).authSummary,
          usesCustomStorage: (email as any).usesCustomStorage ?? false,
        };
      }

      // Forward event to local webhook
      async function forwardEvent(eventType: string, payload: unknown): Promise<boolean> {
        const body = JSON.stringify(payload);

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Mailhooks-Event': eventType,
        };

        // If a signing secret is provided, compute HMAC-SHA256 signature
        if (flags.secret) {
          const { createHmac } = await import('node:crypto');
          const sig = createHmac('sha256', flags.secret).update(body).digest('hex');
          headers['X-Webhook-Signature'] = sig;
        }

        return new Promise<boolean>((resolve) => {
          const req = http.request(
            {
              hostname: forwardUrl.hostname,
              port: forwardUrl.port || (forwardUrl.protocol === 'https:' ? 443 : 80),
              path: forwardUrl.pathname + forwardUrl.search,
              method: 'POST',
              headers,
            },
            (res) => {
              // Drain response so the socket can be reused
              res.resume();
              resolve(res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 300);
            },
          );
          req.on('error', (err) => {
            process.stderr.write(`  ⚠ Forward error: ${err.message}\n`);
            resolve(false);
          });
          req.write(body);
          req.end();
        });
      }

      // Subscribe to SSE
      const subscription = mailhooks.realtime.subscribe({
        mode: flags.mode,
        autoReconnect: flags.reconnect,
        reconnectDelay: flags.reconnectDelay ?? 5000,
        onConnected: (payload) => {
          process.stderr.write(`  ✓ Connected (tenant: ${payload.tenantId}, mode: ${payload.mode ?? flags.mode})\n`);
        },
        onEmailReceived: async (payload: EmailReceivedPayload) => {
          eventsReceived++;
          const summary = `${payload.from} → ${payload.to.join(', ')} | ${payload.subject}`;
          process.stderr.write(`  📧 [${new Date().toISOString()}] email.received: ${summary}\n`);

          try {
            // Fetch full email + content to build a real WebhookPayload
            const webhookPayload = await buildWebhookPayload(payload.id);

            if (shouldPrint) {
              emit({ type: 'email.received', data: webhookPayload }, { pretty: true });
            }

            const ok = await forwardEvent('email.received', webhookPayload);
            if (ok) {
              eventsForwarded++;
              process.stderr.write(`    → Forwarded to ${flags.forwardTo} [200]\n`);
            } else {
              eventsFailed++;
              process.stderr.write(`    → Failed to forward to ${flags.forwardTo}\n`);
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            process.stderr.write(`    ⚠ Error processing event: ${msg}\n`);
            eventsFailed++;
          }
        },
        onEmailUpdated: async (payload: EmailUpdatedPayload) => {
          eventsReceived++;
          process.stderr.write(`  ✏️  [${new Date().toISOString()}] email.updated: ${payload.id} (${JSON.stringify(payload.changes)})\n`);

          // email.updated is lighter — just forward the SSE payload as-is
          if (shouldPrint) {
            emit({ type: 'email.updated', data: payload }, { pretty: true });
          }

          const ok = await forwardEvent('email.updated', payload);
          if (ok) {
            eventsForwarded++;
            process.stderr.write(`    → Forwarded to ${flags.forwardTo} [200]\n`);
          } else {
            eventsFailed++;
            process.stderr.write(`    → Failed to forward to ${flags.forwardTo}\n`);
          }
        },
        onHeartbeat: () => {
          // Heartbeats are internal — no forwarding, just a subtle keepalive
        },
        onError: (error) => {
          process.stderr.write(`  ⚠ SSE error: ${error.message}\n`);
        },
        onDisconnect: () => {
          process.stderr.write(`  ○ Disconnected from SSE stream\n`);
        },
      });

      // Graceful shutdown
      const shutdown = () => {
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        process.stderr.write(`\n  Shutting down after ${elapsed}s — ${eventsReceived} received, ${eventsForwarded} forwarded, ${eventsFailed} failed\n`);
        subscription.disconnect();
        process.exit(0);
      };

      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    });
}