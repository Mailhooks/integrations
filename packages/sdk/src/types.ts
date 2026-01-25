export interface Attachment {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  /** Storage path for the attachment (only present for custom storage) */
  storagePath?: string;
}

export interface StorageConfigSummary {
  /** Storage provider type */
  provider: 'S3' | 'AZURE_BLOB' | 'GCS';
  /** Storage bucket or container name */
  bucket: string;
}

export interface Email {
  id: string;
  from: string;
  to: string[];
  subject: string;
  read: boolean;
  createdAt: Date;
  attachments: Attachment[];
  /** Whether this email is stored in custom (BYOB) storage */
  usesCustomStorage?: boolean;
  /** Storage configuration details (only present for custom storage) */
  storageConfig?: StorageConfigSummary;
  /** Storage path for the email EML file (only present for custom storage) */
  storagePath?: string;
}

export interface EmailContent {
  html?: string;
  text?: string;
}

export interface PaginationResponse {
  currentPage: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  nextCursor?: string;
}

export interface EmailsResponse extends PaginationResponse {
  data: Email[];
}

export interface EmailFilter {
  from?: string;
  to?: string;
  subject?: string;
  startDate?: string;
  endDate?: string;
  read?: boolean;
}

export interface EmailSort {
  field?: 'createdAt' | 'from' | 'subject';
  order?: 'asc' | 'desc';
}

export interface EmailListParams {
  page?: number;
  perPage?: number;
  filter?: EmailFilter;
  sort?: EmailSort;
}

export interface MailhooksConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface DownloadResponse {
  data: ArrayBuffer;
  filename?: string;
  contentType?: string;
}

export interface WaitForOptions {
  filter?: EmailFilter;
  timeout?: number;
  pollInterval?: number;
  maxRetries?: number;
  initialDelay?: number;
  lookbackWindow?: number;
}
