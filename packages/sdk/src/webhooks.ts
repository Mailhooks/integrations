import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Webhook payload sent by Mailhooks when an email is received.
 */
export interface WebhookPayload {
  /** Unique email ID */
  id: string;
  /** Sender email address */
  from: string;
  /** Array of recipient email addresses */
  to: string[];
  /** Email subject line */
  subject: string;
  /** Plain text body of the email */
  body: string;
  /** HTML body of the email (if available) */
  html?: string;
  /** Array of attachment metadata */
  attachments: Array<{
    /** Unique attachment ID */
    id: string;
    filename: string;
    contentType: string;
    size: number;
    /** Storage path for the attachment (only present when usesCustomStorage is true) */
    storagePath?: string;
  }>;
  /** ISO 8601 timestamp when the email was received */
  receivedAt: string;
  /** SPF authentication result */
  spfResult?: 'pass' | 'fail' | 'softfail' | 'neutral' | 'none';
  /** DKIM authentication result */
  dkimResult?: 'pass' | 'fail' | 'none' | 'temperror' | 'permerror';
  /** DMARC authentication result */
  dmarcResult?: 'pass' | 'fail' | 'none' | 'temperror' | 'permerror';
  /** Overall authentication summary */
  authSummary?: 'pass' | 'fail' | 'partial';
  /** Email headers as key-value pairs */
  headers?: Record<string, string>;
  /** Authentication diagnostic details */
  authDiagnostics?: {
    spf: {
      clientIp: string;
      domain: string;
      record?: string;
      helo?: string;
    } | null;
    dkim: Array<{
      domain: string;
      selector?: string;
      algorithm?: string;
      aligned?: boolean;
      result: string;
    }>;
    dmarc: {
      domain: string;
      policy: string;
      record?: string;
      alignment: {
        spf: { result: string | false; strict: boolean };
        dkim: { result: string | false; strict: boolean };
      };
    } | null;
  };
  /** Whether this email is stored in custom (BYOB) storage */
  usesCustomStorage: boolean;
  /** Storage path for the email (only present when usesCustomStorage is true) */
  storagePath?: string;
  /** Storage configuration details (only present when usesCustomStorage is true) */
  storageConfig?: {
    /** Storage provider type (S3, AZURE_BLOB, GCS) */
    provider: string;
    /** Storage bucket or container name */
    bucket: string;
  };
}

/**
 * Verifies a webhook signature using HMAC-SHA256.
 *
 * Each webhook request from Mailhooks includes an `X-Webhook-Signature` header
 * containing a hex-encoded HMAC-SHA256 signature of the request body.
 *
 * @param payload - The raw request body as a string or Buffer
 * @param signature - The signature from the `X-Webhook-Signature` header
 * @param secret - Your webhook secret (starts with `whsec_`)
 * @returns `true` if the signature is valid, `false` otherwise
 *
 * @example
 * ```typescript
 * import { verifyWebhookSignature } from '@mailhooks/sdk';
 *
 * // Express.js with raw body parser
 * app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
 *   const signature = req.headers['x-webhook-signature'] as string;
 *   const payload = req.body.toString();
 *
 *   if (!verifyWebhookSignature(payload, signature, process.env.WEBHOOK_SECRET!)) {
 *     return res.status(401).send('Invalid signature');
 *   }
 *
 *   const event = JSON.parse(payload);
 *   // Process the webhook...
 *   res.status(200).send('OK');
 * });
 * ```
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  secret: string
): boolean {
  if (!payload || !signature || !secret) {
    return false;
  }

  // Normalize and validate signature format (should be 64 hex chars for SHA256)
  const normalizedSignature = signature.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalizedSignature)) {
    return false;
  }

  const expectedSignature = createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  // Both buffers are guaranteed to be 32 bytes (64 hex chars)
  return timingSafeEqual(
    Buffer.from(normalizedSignature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

/**
 * Parses a webhook payload from a JSON string.
 *
 * @param body - The raw request body as a string
 * @returns The parsed webhook payload
 * @throws {SyntaxError} If the body is not valid JSON
 *
 * @example
 * ```typescript
 * import { parseWebhookPayload } from '@mailhooks/sdk';
 *
 * const payload = parseWebhookPayload(req.body.toString());
 * console.log(`Received email from ${payload.from}: ${payload.subject}`);
 * ```
 */
export function parseWebhookPayload(body: string): WebhookPayload {
  return JSON.parse(body) as WebhookPayload;
}

/**
 * Constructs the expected signature for a webhook payload.
 * Useful for debugging or manual verification.
 *
 * @param payload - The raw request body as a string or Buffer
 * @param secret - Your webhook secret
 * @returns The expected HMAC-SHA256 signature as a hex string
 */
export function constructSignature(
  payload: string | Buffer,
  secret: string
): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}
