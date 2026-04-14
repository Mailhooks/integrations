import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { MailhooksClient } from './api-client.js';

// ── Zod schemas for runtime input validation ────────────────────────────

const listInboxesSchema = z.object({
  page: z.number().optional(),
  perPage: z.number().optional(),
});

const getInboxSchema = z.object({ id: z.string() });

const createInboxSchema = z.object({ name: z.string() });

const listEmailsSchema = z.object({
  inboxId: z.string().optional(),
  limit: z.number().optional(),
  cursor: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  subject: z.string().optional(),
});

const getEmailSchema = z.object({ id: z.string() });

const searchEmailsSchema = z.object({
  query: z.string(),
  inboxId: z.string().optional(),
  limit: z.number().optional(),
});

const downloadEmailSchema = z.object({ id: z.string() });

const deleteEmailSchema = z.object({ id: z.string() });

const markAsReadSchema = z.object({ id: z.string() });

const markAsUnreadSchema = z.object({ id: z.string() });

const waitForEmailSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  subject: z.string().optional(),
  timeout: z.number().optional(),
  pollInterval: z.number().optional(),
  lookbackWindow: z.number().optional(),
});

const listAttachmentsSchema = z.object({ emailId: z.string() });

const getAttachmentSchema = z.object({
  emailId: z.string(),
  attachmentId: z.string(),
});

const listWebhooksSchema = z.object({ inboxId: z.string().optional() });

const getWebhookSchema = z.object({ id: z.string() });

const createWebhookSchema = z.object({
  inboxId: z.string(),
  url: z.string(),
  secret: z.string().optional(),
});

const updateWebhookSchema = z.object({
  id: z.string(),
  url: z.string().optional(),
  secret: z.string().optional(),
  enabled: z.boolean().optional(),
});

const deleteWebhookSchema = z.object({ id: z.string() });

const getDomainSchema = z.object({ id: z.string() });

const checkDomainVerificationSchema = z.object({ id: z.string() });

// ── JSON Schema definitions for MCP tool registration ───────────────────

const noParams: Tool['inputSchema'] = {
  type: 'object',
  properties: {},
};

const inboxTools: Tool[] = [
  {
    name: 'list_inboxes',
    description: 'List inboxes in the tenant',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'number', description: 'Page number (default: 1)' },
        perPage: { type: 'number', description: 'Items per page (default: 20)' },
      },
    },
  },
  {
    name: 'get_inbox',
    description: 'Get details of a specific inbox',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Inbox ID' } },
      required: ['id'],
    },
  },
  {
    name: 'create_inbox',
    description: 'Create a new inbox',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Name for the new inbox' } },
      required: ['name'],
    },
  },
];

const emailTools: Tool[] = [
  {
    name: 'list_emails',
    description: 'List emails with optional filtering and pagination',
    inputSchema: {
      type: 'object',
      properties: {
        inboxId: { type: 'string', description: 'Filter by inbox ID' },
        limit: { type: 'number', description: 'Number of emails per page (default: 20)' },
        cursor: { type: 'string', description: 'Pagination cursor from previous response' },
        from: { type: 'string', description: 'Filter by sender email' },
        to: { type: 'string', description: 'Filter by recipient email' },
        subject: { type: 'string', description: 'Filter by subject (partial match)' },
      },
    },
  },
  {
    name: 'get_email',
    description: 'Get full parsed email including body HTML, plain text, and attachment metadata',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Email ID' } },
      required: ['id'],
    },
  },
  {
    name: 'search_emails',
    description: 'Search emails by querying subject, sender, and recipient in parallel and merging results',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query (matched against subject, from, and to)' },
        inboxId: { type: 'string', description: 'Restrict search to this inbox' },
        limit: { type: 'number', description: 'Max results (default: 20)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'download_email',
    description: 'Download the raw .eml content of an email',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Email ID' } },
      required: ['id'],
    },
  },
  {
    name: 'delete_email',
    description: 'Permanently delete an email and its attachments',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Email ID' } },
      required: ['id'],
    },
  },
  {
    name: 'mark_as_read',
    description: 'Mark an email as read',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Email ID' } },
      required: ['id'],
    },
  },
  {
    name: 'mark_as_unread',
    description: 'Mark an email as unread',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Email ID' } },
      required: ['id'],
    },
  },
  {
    name: 'wait_for_email',
    description: 'Wait for an email matching filters. Polls until a match is found or timeout expires. Useful for testing and automation.',
    inputSchema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Filter by sender email' },
        to: { type: 'string', description: 'Filter by recipient email' },
        subject: { type: 'string', description: 'Filter by subject (partial match)' },
        timeout: { type: 'number', description: 'Max wait time in ms (default: 30000)' },
        pollInterval: { type: 'number', description: 'Time between checks in ms (default: 1000)' },
        lookbackWindow: { type: 'number', description: 'How far back to look on first check in ms (default: 10000)' },
      },
    },
  },
  {
    name: 'list_attachments',
    description: 'List attachments for an email',
    inputSchema: {
      type: 'object',
      properties: { emailId: { type: 'string', description: 'Email ID' } },
      required: ['emailId'],
    },
  },
  {
    name: 'get_attachment',
    description: 'Get an attachment content as base64 with MIME type',
    inputSchema: {
      type: 'object',
      properties: {
        emailId: { type: 'string', description: 'Email ID' },
        attachmentId: { type: 'string', description: 'Attachment ID' },
      },
      required: ['emailId', 'attachmentId'],
    },
  },
];

const webhookTools: Tool[] = [
  {
    name: 'list_webhooks',
    description: 'List webhooks, optionally filtered by inbox',
    inputSchema: {
      type: 'object',
      properties: { inboxId: { type: 'string', description: 'Filter by inbox ID' } },
    },
  },
  {
    name: 'get_webhook',
    description: 'Get details of a specific webhook',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Webhook ID' } },
      required: ['id'],
    },
  },
  {
    name: 'create_webhook',
    description: 'Create a new webhook for an inbox',
    inputSchema: {
      type: 'object',
      properties: {
        inboxId: { type: 'string', description: 'Inbox to attach the webhook to' },
        url: { type: 'string', description: 'Webhook callback URL' },
        secret: { type: 'string', description: 'Webhook signing secret' },
      },
      required: ['inboxId', 'url'],
    },
  },
  {
    name: 'update_webhook',
    description: 'Update a webhook (URL, secret, or enabled status)',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Webhook ID' },
        url: { type: 'string', description: 'New callback URL' },
        secret: { type: 'string', description: 'New signing secret' },
        enabled: { type: 'boolean', description: 'Enable or disable the webhook' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_webhook',
    description: 'Delete a webhook',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Webhook ID' } },
      required: ['id'],
    },
  },
];

const domainTools: Tool[] = [
  {
    name: 'list_domains',
    description: 'List all domains in the tenant',
    inputSchema: noParams,
  },
  {
    name: 'get_domain',
    description: 'Get details of a specific domain',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Domain ID' } },
      required: ['id'],
    },
  },
  {
    name: 'check_domain_verification',
    description: 'Check domain DNS verification status (SPF, DKIM, MX records)',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Domain ID' } },
      required: ['id'],
    },
  },
];

const tenantTools: Tool[] = [
  {
    name: 'get_tenant',
    description: 'Get current tenant info',
    inputSchema: noParams,
  },
  {
    name: 'get_usage',
    description: 'Get email/webhook usage and quota for the current period',
    inputSchema: noParams,
  },
];

// ── Server class ───────────────────────────────────────────────────────────

export class MailhooksMCPServer {
  private server: Server;
  private api: MailhooksClient;

  constructor(apiKey: string, apiUrl?: string) {
    this.api = new MailhooksClient(apiKey, apiUrl);

    this.server = new Server(
      { name: 'mcp-mailhooks', version: '0.1.0' },
      { capabilities: { tools: {} } },
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        ...inboxTools,
        ...emailTools,
        ...webhookTools,
        ...domainTools,
        ...tenantTools,
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      try {
        switch (name) {
          // Inboxes
          case 'list_inboxes':
            return await this.handleListInboxes(args);
          case 'get_inbox':
            return await this.handleGetInbox(args);
          case 'create_inbox':
            return await this.handleCreateInbox(args);

          // Emails
          case 'list_emails':
            return await this.handleListEmails(args);
          case 'get_email':
            return await this.handleGetEmail(args);
          case 'search_emails':
            return await this.handleSearchEmails(args);
          case 'download_email':
            return await this.handleDownloadEmail(args);
          case 'delete_email':
            return await this.handleDeleteEmail(args);
          case 'mark_as_read':
            return await this.handleMarkAsRead(args);
          case 'mark_as_unread':
            return await this.handleMarkAsUnread(args);
          case 'wait_for_email':
            return await this.handleWaitForEmail(args);
          case 'list_attachments':
            return await this.handleListAttachments(args);
          case 'get_attachment':
            return await this.handleGetAttachment(args);

          // Webhooks
          case 'list_webhooks':
            return await this.handleListWebhooks(args);
          case 'get_webhook':
            return await this.handleGetWebhook(args);
          case 'create_webhook':
            return await this.handleCreateWebhook(args);
          case 'update_webhook':
            return await this.handleUpdateWebhook(args);
          case 'delete_webhook':
            return await this.handleDeleteWebhook(args);

          // Domains
          case 'list_domains':
            return await this.handleListDomains(args);
          case 'get_domain':
            return await this.handleGetDomain(args);
          case 'check_domain_verification':
            return await this.handleCheckDomainVerification(args);

          // Tenant & Usage
          case 'get_tenant':
            return await this.handleGetTenant(args);
          case 'get_usage':
            return await this.handleGetUsage(args);

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    });
  }

  // ── Inbox handlers ───────────────────────────────────────────────────

  private async handleListInboxes(args: any) {
    const parsed = listInboxesSchema.parse(args);
    const data = await this.api.listInboxes(parsed);
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  }

  private async handleGetInbox(args: any) {
    const parsed = getInboxSchema.parse(args);
    const data = await this.api.getInbox(parsed.id);
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  }

  private async handleCreateInbox(args: any) {
    const parsed = createInboxSchema.parse(args);
    const data = await this.api.createInbox(parsed);
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  }

  // ── Email handlers ────────────────────────────────────────────────────

  private async handleListEmails(args: any) {
    const parsed = listEmailsSchema.parse(args);
    const params: Record<string, any> = {};
    if (parsed.inboxId) params.inboxId = parsed.inboxId;
    if (parsed.limit) params.perPage = parsed.limit;
    if (parsed.cursor) params.cursor = parsed.cursor;
    if (parsed.from) params['filter.from'] = parsed.from;
    if (parsed.to) params['filter.to'] = parsed.to;
    if (parsed.subject) params['filter.subject'] = parsed.subject;
    const data = await this.api.listEmails(params);
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  }

  private async handleGetEmail(args: any) {
    const parsed = getEmailSchema.parse(args);
    const [metadata, content] = await Promise.all([
      this.api.getEmail(parsed.id),
      this.api.getEmailContent(parsed.id).catch(() => null),
    ]);
    const full = { ...metadata, ...(content ?? {}) };
    return { content: [{ type: 'text' as const, text: JSON.stringify(full, null, 2) }] };
  }

  private async handleSearchEmails(args: any) {
    const parsed = searchEmailsSchema.parse(args);
    const baseParams: Record<string, any> = {};
    if (parsed.inboxId) baseParams.inboxId = parsed.inboxId;
    if (parsed.limit) baseParams.perPage = parsed.limit;

    // Search across subject, from, and to in parallel, then merge and deduplicate
    const [bySubject, byFrom, byTo] = await Promise.all([
      this.api.listEmails({ ...baseParams, 'filter.subject': parsed.query }),
      this.api.listEmails({ ...baseParams, 'filter.from': parsed.query }),
      this.api.listEmails({ ...baseParams, 'filter.to': parsed.query }),
    ]);

    const seen = new Set<string>();
    const merged: any[] = [];
    for (const email of [...(bySubject.data ?? []), ...(byFrom.data ?? []), ...(byTo.data ?? [])]) {
      if (!seen.has(email.id)) {
        seen.add(email.id);
        merged.push(email);
      }
    }

    // Sort by createdAt descending and apply limit
    merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const limit = parsed.limit ?? 20;
    const results = merged.slice(0, limit);

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({ data: results, totalItems: merged.length }, null, 2),
      }],
    };
  }

  private async handleDownloadEmail(args: any) {
    const parsed = downloadEmailSchema.parse(args);
    const eml = await this.api.downloadEml(parsed.id);
    return { content: [{ type: 'text' as const, text: eml }] };
  }

  private async handleDeleteEmail(args: any) {
    const parsed = deleteEmailSchema.parse(args);
    await this.api.deleteEmail(parsed.id);
    return { content: [{ type: 'text' as const, text: `Email ${parsed.id} deleted` }] };
  }

  private async handleMarkAsRead(args: any) {
    const parsed = markAsReadSchema.parse(args);
    const data = await this.api.markAsRead(parsed.id);
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  }

  private async handleMarkAsUnread(args: any) {
    const parsed = markAsUnreadSchema.parse(args);
    const data = await this.api.markAsUnread(parsed.id);
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  }

  private async handleWaitForEmail(args: any) {
    const parsed = waitForEmailSchema.parse(args);
    const {
      from,
      to,
      subject,
      timeout = 30000,
      pollInterval = 1000,
      lookbackWindow = 10000,
    } = parsed;

    const startTime = Date.now();
    let lastCheckedTime: Date | null = null;

    const checkForEmail = async (isFirstCheck: boolean): Promise<any | null> => {
      try {
        const now = new Date();
        const startDateFilter = isFirstCheck
          ? new Date(now.getTime() - lookbackWindow).toISOString()
          : lastCheckedTime
            ? lastCheckedTime.toISOString()
            : new Date(now.getTime() - lookbackWindow).toISOString();

        const params: Record<string, any> = {
          'filter.createdAfter': startDateFilter,
          perPage: 10,
        };
        if (from) params['filter.from'] = from;
        if (to) params['filter.to'] = to;
        if (subject) params['filter.subject'] = subject;

        const response = await this.api.listEmails(params);
        lastCheckedTime = now;

        if (response.data?.length > 0) {
          return response.data[0];
        }
        return null;
      } catch {
        return null;
      }
    };

    // Check immediately
    const existing = await checkForEmail(true);
    if (existing) {
      return { content: [{ type: 'text' as const, text: JSON.stringify(existing, null, 2) }] };
    }

    // Poll
    while (true) {
      if (Date.now() - startTime > timeout) {
        return {
          content: [{ type: 'text' as const, text: `Error: Timeout waiting for email after ${timeout}ms` }],
          isError: true,
        };
      }

      const email = await checkForEmail(false);
      if (email) {
        return { content: [{ type: 'text' as const, text: JSON.stringify(email, null, 2) }] };
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }

  private async handleListAttachments(args: any) {
    const parsed = listAttachmentsSchema.parse(args);
    const data = await this.api.listAttachments(parsed.emailId);
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  }

  private async handleGetAttachment(args: any) {
    const parsed = getAttachmentSchema.parse(args);
    const data = await this.api.getAttachment(parsed.emailId, parsed.attachmentId);
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  }

  // ── Webhook handlers ────────────────────────────────────────────────

  private async handleListWebhooks(args: any) {
    const parsed = listWebhooksSchema.parse(args);
    const data = await this.api.listWebhooks(parsed);
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  }

  private async handleGetWebhook(args: any) {
    const parsed = getWebhookSchema.parse(args);
    const data = await this.api.getWebhook(parsed.id);
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  }

  private async handleCreateWebhook(args: any) {
    const parsed = createWebhookSchema.parse(args);
    const data = await this.api.createWebhook(parsed);
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  }

  private async handleUpdateWebhook(args: any) {
    const parsed = updateWebhookSchema.parse(args);
    const { id, ...data } = parsed;
    const result = await this.api.updateWebhook(id, data);
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  }

  private async handleDeleteWebhook(args: any) {
    const parsed = deleteWebhookSchema.parse(args);
    await this.api.deleteWebhook(parsed.id);
    return { content: [{ type: 'text' as const, text: `Webhook ${parsed.id} deleted` }] };
  }

  // ── Domain handlers ──────────────────────────────────────────────────

  private async handleListDomains(_args: any) {
    const data = await this.api.listDomains();
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  }

  private async handleGetDomain(args: any) {
    const parsed = getDomainSchema.parse(args);
    const data = await this.api.getDomain(parsed.id);
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  }

  private async handleCheckDomainVerification(args: any) {
    const parsed = checkDomainVerificationSchema.parse(args);
    const data = await this.api.checkDomainVerification(parsed.id);
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  }

  // ── Tenant & Usage handlers ──────────────────────────────────────────

  private async handleGetTenant(_args: any) {
    const data = await this.api.getTenant();
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  }

  private async handleGetUsage(_args: any) {
    const data = await this.api.getUsage();
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
  }

  // ── Server lifecycle ────────────────────────────────────────────────

  getServer(): Server {
    return this.server;
  }
}