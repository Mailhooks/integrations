import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MailhooksClient } from '../src/api-client.js';
import { MailhooksMCPServer } from '../src/server.js';

// Mock axios so no real HTTP calls happen
vi.mock('axios', () => {
  const mockInstance = {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    create: vi.fn(),
  };
  mockInstance.create.mockReturnValue(mockInstance);
  return {
    default: mockInstance,
  };
});

// Helper to create a server and call a tool
async function callTool(name: string, args: Record<string, any> = {}) {
  const server = new MailhooksMCPServer('test-key', 'https://test.api');
  const mcpServer = server.getServer();

  // Simulate a CallToolRequest
  const result = await (mcpServer as any)._requestHandlers?.get?.(
    'tools/call',
  );

  // Direct approach: call the handler via the server's internal dispatch
  // Since we can't easily invoke MCP handlers directly, we test through the client
  return null;
}

describe('MailhooksClient', () => {
  let client: MailhooksClient;
  let mockHttp: any;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new MailhooksClient('test-key', 'https://test.api');
    // Access the internal axios instance to set up mocks
    mockHttp = (client as any).http;
  });

  describe('listInboxes', () => {
    it('calls GET /inboxes with params', async () => {
      mockHttp.get.mockResolvedValue({
        data: { data: [{ id: 'inbox-1', name: 'Test' }] },
      });
      const result = await client.listInboxes({ page: 1, perPage: 10 });
      expect(mockHttp.get).toHaveBeenCalledWith('/inboxes', {
        params: { page: 1, perPage: 10 },
      });
      expect(result.data).toHaveLength(1);
    });
  });

  describe('getInbox', () => {
    it('calls GET /inboxes/:id', async () => {
      mockHttp.get.mockResolvedValue({
        data: { id: 'inbox-1', name: 'Test' },
      });
      const result = await client.getInbox('inbox-1');
      expect(mockHttp.get).toHaveBeenCalledWith('/inboxes/inbox-1');
      expect(result.id).toBe('inbox-1');
    });
  });

  describe('createInbox', () => {
    it('calls POST /inboxes with data', async () => {
      mockHttp.post.mockResolvedValue({
        data: { id: 'inbox-2', name: 'New' },
      });
      const result = await client.createInbox({ name: 'New' });
      expect(mockHttp.post).toHaveBeenCalledWith('/inboxes', { name: 'New' });
      expect(result.name).toBe('New');
    });
  });

  describe('listEmails', () => {
    it('calls GET /emails with filter params', async () => {
      mockHttp.get.mockResolvedValue({
        data: { data: [], totalItems: 0 },
      });
      await client.listEmails({
        inboxId: 'inbox-1',
        'filter.from': 'test@example.com',
      });
      expect(mockHttp.get).toHaveBeenCalledWith('/emails', {
        params: { inboxId: 'inbox-1', 'filter.from': 'test@example.com' },
      });
    });
  });

  describe('getEmail', () => {
    it('calls GET /emails/:id', async () => {
      mockHttp.get.mockResolvedValue({
        data: { id: 'email-1', from: 'a@b.com' },
      });
      const result = await client.getEmail('email-1');
      expect(mockHttp.get).toHaveBeenCalledWith('/emails/email-1');
      expect(result.id).toBe('email-1');
    });
  });

  describe('getEmailContent', () => {
    it('calls GET /emails/:id/content', async () => {
      mockHttp.get.mockResolvedValue({
        data: { html: '<p>Hi</p>', text: 'Hi' },
      });
      const result = await client.getEmailContent('email-1');
      expect(mockHttp.get).toHaveBeenCalledWith('/emails/email-1/content');
      expect(result.text).toBe('Hi');
    });
  });

  describe('downloadEml', () => {
    it('calls GET /emails/:id/eml and returns raw text', async () => {
      mockHttp.get.mockResolvedValue({ data: 'raw-eml-content' });
      const result = await client.downloadEml('email-1');
      expect(mockHttp.get).toHaveBeenCalledWith('/emails/email-1/eml', {
        responseType: 'text',
        transformResponse: expect.any(Array),
      });
      expect(result).toBe('raw-eml-content');
    });
  });

  describe('listAttachments', () => {
    it('gets email and returns attachments array', async () => {
      mockHttp.get.mockResolvedValue({
        data: {
          id: 'email-1',
          attachments: [
            { id: 'att-1', filename: 'test.pdf', contentType: 'application/pdf', size: 1024 },
          ],
        },
      });
      const result = await client.listAttachments('email-1');
      expect(result).toHaveLength(1);
      expect(result[0].filename).toBe('test.pdf');
    });
  });

  describe('getAttachment', () => {
    it('calls GET /emails/:id/attachments/:attId and returns base64', async () => {
      mockHttp.get.mockResolvedValue({
        data: Buffer.from('file-content'),
        headers: { 'content-type': 'application/pdf' },
      });
      const result = await client.getAttachment('email-1', 'att-1');
      expect(mockHttp.get).toHaveBeenCalledWith(
        '/emails/email-1/attachments/att-1',
        { responseType: 'arraybuffer' },
      );
      expect(result.contentType).toBe('application/pdf');
      expect(result.data).toBe(Buffer.from('file-content').toString('base64'));
    });
  });

  describe('listWebhooks', () => {
    it('calls GET /webhooks with inboxId filter', async () => {
      mockHttp.get.mockResolvedValue({ data: [{ id: 'wh-1' }] });
      const result = await client.listWebhooks({ inboxId: 'inbox-1' });
      expect(mockHttp.get).toHaveBeenCalledWith('/webhooks', {
        params: { inboxId: 'inbox-1' },
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('createWebhook', () => {
    it('calls POST /webhooks with inboxId, url, secret', async () => {
      mockHttp.post.mockResolvedValue({
        data: { id: 'wh-1', inboxId: 'inbox-1', url: 'https://hook.url' },
      });
      const result = await client.createWebhook({
        inboxId: 'inbox-1',
        url: 'https://hook.url',
        secret: 'whsec_test',
      });
      expect(mockHttp.post).toHaveBeenCalledWith('/webhooks', {
        inboxId: 'inbox-1',
        url: 'https://hook.url',
        secret: 'whsec_test',
      });
    });
  });

  describe('updateWebhook', () => {
    it('calls PATCH /webhooks/:id with update data', async () => {
      mockHttp.patch.mockResolvedValue({
        data: { id: 'wh-1', enabled: false },
      });
      const result = await client.updateWebhook('wh-1', { enabled: false });
      expect(mockHttp.patch).toHaveBeenCalledWith('/webhooks/wh-1', {
        enabled: false,
      });
    });
  });

  describe('deleteWebhook', () => {
    it('calls DELETE /webhooks/:id', async () => {
      mockHttp.delete.mockResolvedValue({ data: null });
      await client.deleteWebhook('wh-1');
      expect(mockHttp.delete).toHaveBeenCalledWith('/webhooks/wh-1');
    });
  });

  describe('listDomains', () => {
    it('calls GET /domains', async () => {
      mockHttp.get.mockResolvedValue({ data: [{ id: 'd-1', domain: 'test.dev' }] });
      const result = await client.listDomains();
      expect(mockHttp.get).toHaveBeenCalledWith('/domains');
      expect(result).toHaveLength(1);
    });
  });

  describe('getDomain', () => {
    it('calls GET /domains/:id', async () => {
      mockHttp.get.mockResolvedValue({ data: { id: 'd-1', domain: 'test.dev' } });
      const result = await client.getDomain('d-1');
      expect(mockHttp.get).toHaveBeenCalledWith('/domains/d-1');
      expect(result.domain).toBe('test.dev');
    });
  });

  describe('checkDomainVerification', () => {
    it('calls GET /domains/:id/verify', async () => {
      mockHttp.get.mockResolvedValue({
        data: { verified: true, records: [] },
      });
      const result = await client.checkDomainVerification('d-1');
      expect(mockHttp.get).toHaveBeenCalledWith('/domains/d-1/verify');
      expect(result.verified).toBe(true);
    });
  });

  describe('getTenant', () => {
    it('calls GET /tenant', async () => {
      mockHttp.get.mockResolvedValue({
        data: { id: 't-1', name: 'Acme' },
      });
      const result = await client.getTenant();
      expect(mockHttp.get).toHaveBeenCalledWith('/tenant');
      expect(result.name).toBe('Acme');
    });
  });

  describe('getUsage', () => {
    it('calls GET /usage', async () => {
      mockHttp.get.mockResolvedValue({
        data: { emailsUsed: 50, emailsLimit: 100 },
      });
      const result = await client.getUsage();
      expect(mockHttp.get).toHaveBeenCalledWith('/usage');
      expect(result.emailsUsed).toBe(50);
    });
  });
});