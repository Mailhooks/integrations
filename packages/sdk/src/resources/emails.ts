import { MailhooksClient } from '../client';
import {
  Email,
  EmailContent,
  EmailsResponse,
  EmailListParams,
  DownloadResponse,
  WaitForOptions,
} from '../types';

export class EmailsResource extends MailhooksClient {
  /**
   * Get a paginated list of emails
   */
  async list(params?: EmailListParams): Promise<EmailsResponse> {
    // Set defaults
    const queryParams: any = {
      page: params?.page || 1,
      perPage: params?.perPage || 20,
    };

    // Handle filter params
    if (params?.filter) {
      if (params.filter.from) queryParams['filter.from'] = params.filter.from;
      if (params.filter.to) queryParams['filter.to'] = params.filter.to;
      if (params.filter.subject) queryParams['filter.subject'] = params.filter.subject;
      if (params.filter.startDate) queryParams['filter.createdAfter'] = params.filter.startDate;
      if (params.filter.endDate) queryParams['filter.createdBefore'] = params.filter.endDate;
      if (params.filter.read !== undefined) queryParams['filter.read'] = String(params.filter.read);
    }

    // Handle sort params
    if (params?.sort) {
      if (params.sort.field) queryParams['sort[field]'] = params.sort.field;
      if (params.sort.order) queryParams['sort[order]'] = params.sort.order;
    }

    return super.get<EmailsResponse>('/v1/emails', queryParams);
  }

  /**
   * Get a specific email by ID
   * @param emailId - The ID of the email to retrieve
   * @param markAsRead - Optional: Mark the email as read when fetching (default: false)
   */
  async getEmail(emailId: string, markAsRead: boolean = false): Promise<Email> {
    const params = markAsRead ? { markAsRead: 'true' } : undefined;
    return super.get<Email>(`/v1/emails/${emailId}`, params);
  }

  /**
   * Get the HTML and text content of an email
   */
  async getContent(emailId: string): Promise<EmailContent> {
    return super.get<EmailContent>(`/v1/emails/${emailId}/content`);
  }

  /**
   * Download email in EML format
   */
  async downloadEml(emailId: string): Promise<DownloadResponse> {
    const data = await this.downloadFile(`/v1/emails/${emailId}/eml`);
    return {
      data,
      filename: `email-${emailId}.eml`,
      contentType: 'message/rfc822',
    };
  }

  /**
   * Download a specific attachment from an email
   */
  async downloadAttachment(
    emailId: string,
    attachmentId: string
  ): Promise<DownloadResponse> {
    const axios = this.getAxiosInstance();
    const response = await axios.get(
      `/v1/emails/${emailId}/attachments/${attachmentId}`,
      {
        responseType: 'arraybuffer',
      }
    );

    const contentDisposition = response.headers['content-disposition'];
    const filename = contentDisposition
      ? contentDisposition.split('filename=')[1]?.replace(/['"]/g, '')
      : `attachment-${attachmentId}`;

    return {
      data: response.data,
      filename,
      contentType: response.headers['content-type'],
    };
  }

  /**
   * Mark an email as read
   */
  async markAsRead(emailId: string): Promise<Email> {
    return super.patch<Email>(`/v1/emails/${emailId}/read`);
  }

  /**
   * Mark an email as unread
   */
  async markAsUnread(emailId: string): Promise<Email> {
    return super.patch<Email>(`/v1/emails/${emailId}/unread`);
  }

  /**
   * Permanently delete an email and its attachments.
   *
   * Deleted emails still count towards the monthly usage quota — this frees up
   * storage and removes the email from the inbox, but does not refund usage
   * since the email was already received and billed at ingestion time.
   *
   * @param emailId - The ID of the email to delete
   */
  async deleteEmail(emailId: string): Promise<void> {
    return super.delete<void>(`/v1/emails/${emailId}`);
  }

  /**
   * Wait for an email that matches the given filters
   *
   * @param options - Options for waiting including filters, timeouts, and delays
   * @returns The first email that matches the filters
   * @throws Error if timeout is reached or max retries exceeded
   *
   * @example
   * // Wait for an email from a specific sender (only considers emails from last 10 seconds)
   * const email = await mailhooks.emails.waitFor({
   *   filter: { from: 'test@example.com' },
   *   timeout: 30000, // 30 seconds
   *   pollInterval: 2000, // Check every 2 seconds
   *   lookbackWindow: 10000, // Only consider emails from last 10 seconds
   * });
   *
   * @example
   * // Wait with initial delay (useful when you know email will take time)
   * const email = await mailhooks.emails.waitFor({
   *   filter: { subject: 'Order Confirmation' },
   *   initialDelay: 5000, // Wait 5 seconds before first check
   *   timeout: 60000,
   *   lookbackWindow: 5000, // Only consider very recent emails
   * });
   */
  async waitFor(options: WaitForOptions = {}): Promise<Email> {
    const {
      filter = {},
      timeout = 30000, // Default 30 seconds
      pollInterval = 1000, // Default poll every 1 second
      maxRetries = null,
      initialDelay = 0,
      lookbackWindow = 10000, // Default 10 seconds lookback
    } = options;

    const startTime = Date.now();
    let retries = 0;
    let lastCheckedTime: Date | null = null;

    // Helper function to check for matching emails
    const checkForEmail = async (isFirstCheck: boolean = false): Promise<Email | null> => {
      try {
        // Calculate the time window for filtering
        const now = new Date();
        let startDateFilter: string;

        if (isFirstCheck && lookbackWindow) {
          // On first check, only look back the specified window
          startDateFilter = new Date(now.getTime() - lookbackWindow).toISOString();
        } else if (lastCheckedTime) {
          // On subsequent checks, look for emails since last check
          startDateFilter = lastCheckedTime.toISOString();
        } else {
          // Fallback to lookback window
          startDateFilter = new Date(now.getTime() - lookbackWindow).toISOString();
        }

        // Merge the time filter with user-provided filters
        const searchFilter = {
          ...filter,
          startDate: startDateFilter,
        };

        const response = await this.list({
          filter: searchFilter,
          perPage: 10,
          sort: { field: 'createdAt', order: 'desc' },
        });

        // Update last checked time for next iteration
        lastCheckedTime = now;

        if (response.data.length > 0) {
          // Return the most recent matching email
          return response.data[0];
        }

        return null;
      } catch (error) {
        // Log error but continue polling
        console.warn('Error checking for email:', error);
        return null;
      }
    };

    // Check immediately for existing emails (before any delay)
    const existingEmail = await checkForEmail(true);
    if (existingEmail) {
      return existingEmail;
    }

    // Apply initial delay if specified
    if (initialDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, initialDelay));
    }

    // Start polling
    while (true) {
      // Check timeout
      if (timeout && Date.now() - startTime > timeout) {
        throw new Error(`Timeout waiting for email after ${timeout}ms`);
      }

      // Check max retries
      if (maxRetries !== null && retries >= maxRetries) {
        throw new Error(`Max retries (${maxRetries}) exceeded waiting for email`);
      }

      // Check for email
      const email = await checkForEmail();
      if (email) {
        return email;
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      retries++;
    }
  }
}
