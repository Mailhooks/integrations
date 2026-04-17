import axios, { AxiosInstance } from 'axios';

const DEFAULT_BASE_URL = 'https://app.mailhooks.dev/api/v1';

export class MailhooksClient {
  private http: AxiosInstance;

  constructor(apiKey: string, baseUrl?: string) {
    this.http = axios.create({
      baseURL: baseUrl ?? DEFAULT_BASE_URL,
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
    });
  }

  // ── Inboxes ────────────────────────────────────────────────────────────

  async listInboxes(params?: { page?: number; perPage?: number }) {
    const res = await this.http.get('/inboxes', { params });
    return res.data;
  }

  async getInbox(id: string) {
    const res = await this.http.get(`/inboxes/${id}`);
    return res.data;
  }

  async createInbox(data: { name: string }) {
    const res = await this.http.post('/inboxes', data);
    return res.data;
  }

  // ── Emails ─────────────────────────────────────────────────────────────

  async listEmails(params?: {
    inboxId?: string;
    page?: number;
    perPage?: number;
    cursor?: string;
    'filter.from'?: string;
    'filter.to'?: string;
    'filter.subject'?: string;
    'filter.createdAfter'?: string;
    'filter.createdBefore'?: string;
  }) {
    const res = await this.http.get('/emails', { params });
    return res.data;
  }

  async getEmail(id: string) {
    const res = await this.http.get(`/emails/${id}`);
    return res.data;
  }

  async getEmailContent(id: string) {
    const res = await this.http.get(`/emails/${id}/content`);
    return res.data;
  }

  async downloadEml(id: string) {
    const res = await this.http.get(`/emails/${id}/eml`, {
      responseType: 'text',
      transformResponse: [(data: string) => data],
    });
    return res.data;
  }

  async listAttachments(emailId: string) {
    const email = await this.getEmail(emailId);
    return email.attachments ?? [];
  }

  async getAttachment(emailId: string, attachmentId: string) {
    const res = await this.http.get(
      `/emails/${emailId}/attachments/${attachmentId}`,
      { responseType: 'arraybuffer' },
    );
    const contentType =
      (res.headers['content-type'] as string) ?? 'application/octet-stream';
    const contentDisposition = res.headers['content-disposition'] as
      | string
      | undefined;
    const filename = contentDisposition
      ? contentDisposition.split('filename=')[1]?.replace(/['"]/g, '')
      : `attachment-${attachmentId}`;
    return {
      filename,
      contentType,
      data: Buffer.from(res.data).toString('base64'),
    };
  }

  async deleteEmail(id: string) {
    const res = await this.http.delete(`/emails/${id}`);
    return res.data;
  }

  async markAsRead(id: string) {
    const res = await this.http.patch(`/emails/${id}/read`);
    return res.data;
  }

  async markAsUnread(id: string) {
    const res = await this.http.patch(`/emails/${id}/unread`);
    return res.data;
  }

  // ── Webhooks ────────────────────────────────────────────────────────────

  async listWebhooks(params?: { inboxId?: string }) {
    const res = await this.http.get('/webhooks', { params });
    return res.data;
  }

  async getWebhook(id: string) {
    const res = await this.http.get(`/webhooks/${id}`);
    return res.data;
  }

  async createWebhook(data: {
    inboxId: string;
    url: string;
    secret?: string;
  }) {
    const res = await this.http.post('/webhooks', data);
    return res.data;
  }

  async updateWebhook(
    id: string,
    data: { url?: string; secret?: string; enabled?: boolean },
  ) {
    const res = await this.http.patch(`/webhooks/${id}`, data);
    return res.data;
  }

  async deleteWebhook(id: string) {
    const res = await this.http.delete(`/webhooks/${id}`);
    return res.data;
  }

  // ── Domains ────────────────────────────────────────────────────────────

  async listDomains() {
    const res = await this.http.get('/domains');
    return res.data;
  }

  async getDomain(id: string) {
    const res = await this.http.get(`/domains/${id}`);
    return res.data;
  }

  async checkDomainVerification(id: string) {
    const res = await this.http.get(`/domains/${id}/verify`);
    return res.data;
  }

  // ── Tenant & Usage ─────────────────────────────────────────────────────

  async getTenant() {
    const res = await this.http.get('/tenant');
    return res.data;
  }

  async getUsage() {
    const res = await this.http.get('/usage');
    return res.data;
  }
}