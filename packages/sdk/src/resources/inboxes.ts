import { MailhooksClient } from '../client';
import {
  Inbox,
  InboxListResponse,
  InboxMessage,
  InboxMessagesResponse,
  CreateInboxOptions,
  ListInboxesOptions,
  ListMessagesOptions,
  WaitForMessageOptions,
} from '../types';

export class InboxesResource extends MailhooksClient {
  /**
   * Create a virtual inbox.
   *
   * @example
   * const inbox = await mailhooks.inboxes.create({ prefix: 'test-auth', ttlSeconds: 3600 });
   * // inbox.address = "test-auth@yourapp.mailhooks.email"
   */
  async create(options?: CreateInboxOptions): Promise<Inbox> {
    return super.post<Inbox>('/v1/inboxes', options ?? {});
  }

  /**
   * List all inboxes for the current tenant.
   */
  async list(options?: ListInboxesOptions): Promise<InboxListResponse> {
    const params: Record<string, any> = {};
    if (options?.environmentId) params.environmentId = options.environmentId;
    if (options?.domainId) params.domainId = options.domainId;
    if (options?.tags) params.tags = options.tags;
    if (options?.includeExpired) params.includeExpired = 'true';
    if (options?.page) params.page = options.page;
    if (options?.perPage) params.perPage = options.perPage;
    return super.get<InboxListResponse>('/v1/inboxes', params);
  }

  /**
   * Get inbox details by ID.
   */
  async getInbox(inboxId: string): Promise<Inbox> {
    return super.get<Inbox>(`/v1/inboxes/${inboxId}`);
  }

  /**
   * Delete an inbox and all its messages.
   */
  async deleteInbox(inboxId: string): Promise<void> {
    return super.delete<void>(`/v1/inboxes/${inboxId}`);
  }

  /**
   * Update an inbox (aliases, tags, or active status).
   */
  async update(inboxId: string, data: { aliases?: string[]; tags?: string[]; active?: boolean }): Promise<Inbox> {
    return super.patch<Inbox>(`/v1/inboxes/${inboxId}`, data);
  }

  /**
   * List messages received in this inbox.
   */
  async listMessages(inboxId: string, options?: ListMessagesOptions): Promise<InboxMessagesResponse> {
    const params: Record<string, any> = {};
    if (options?.page) params.page = options.page;
    if (options?.perPage) params.perPage = options.perPage;
    if (options?.afterId) params.afterId = options.afterId;
    return super.get<InboxMessagesResponse>(`/v1/inboxes/${inboxId}/messages`, params);
  }

  /**
   * Long-poll for a new message. Returns immediately if a matching message
   * exists, otherwise waits up to the timeout (server-side, no client polling).
   *
   * @returns The message, or null if timeout reached.
   *
   * @example
   * const inbox = await mailhooks.inboxes.create({ prefix: 'signup-test' });
   * // ... trigger your signup flow ...
   * const msg = await mailhooks.inboxes.waitForMessage(inbox.id, { timeout: 30000 });
   * await page.goto(msg.extracted.magicLink);
   */
  async waitForMessage(inboxId: string, options?: WaitForMessageOptions): Promise<InboxMessage | null> {
    const params: Record<string, any> = {};
    if (options?.timeout) params.timeout = options.timeout;
    if (options?.subject) params.subject = options.subject;
    if (options?.from) params.from = options.from;
    if (options?.afterId) params.afterId = options.afterId;
    return super.get<InboxMessage | null>(`/v1/inboxes/${inboxId}/messages/wait`, params);
  }

  /**
   * Get a specific message by ID.
   */
  async getMessage(inboxId: string, messageId: string): Promise<InboxMessage> {
    return super.get<InboxMessage>(`/v1/inboxes/${inboxId}/messages/${messageId}`);
  }
}
