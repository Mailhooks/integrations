import { simpleParser } from 'mailparser';

/**
 * Parsed email structure returned by parseEml.
 * Matches the webhook payload structure for consistency.
 */
export interface ParsedEmail {
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
    filename: string;
    contentType: string;
    size: number;
  }>;
  /** Email headers as key-value pairs */
  headers: Record<string, string>;
  /** Date the email was sent (from Date header) */
  date?: Date;
}

/**
 * Parses a raw EML file and returns a structured email object.
 *
 * This is useful for BYOB (Bring Your Own Bucket) users who store emails
 * in their own S3-compatible storage and need to parse them.
 *
 * @param eml - The raw EML content as a Buffer or string
 * @returns A Promise that resolves to the parsed email
 *
 * @example
 * ```typescript
 * import { parseEml } from '@mailhooks/sdk';
 * import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
 *
 * // Fetch EML from your S3 bucket
 * const s3 = new S3Client({ region: 'us-east-1' });
 * const response = await s3.send(new GetObjectCommand({
 *   Bucket: 'my-email-bucket',
 *   Key: storagePath, // from webhook payload
 * }));
 * const emlBuffer = Buffer.from(await response.Body.transformToByteArray());
 *
 * // Parse the EML
 * const email = await parseEml(emlBuffer);
 * console.log(email.from);        // "sender@example.com"
 * console.log(email.subject);     // "Hello World"
 * console.log(email.attachments); // [{ filename: "doc.pdf", ... }]
 * ```
 */
export async function parseEml(eml: Buffer | string): Promise<ParsedEmail> {
  const parsed = await simpleParser(eml);

  // Extract sender address
  const from = parsed.from?.value?.[0]?.address || '';

  // Extract recipient addresses
  const toAddresses = parsed.to;
  let to: string[] = [];
  if (toAddresses) {
    if (Array.isArray(toAddresses)) {
      to = toAddresses.flatMap(addr =>
        addr.value?.map(v => v.address || '') || []
      );
    } else {
      to = toAddresses.value?.map(v => v.address || '') || [];
    }
  }

  // Convert headers Map to object
  const headers: Record<string, string> = {};
  for (const [key, value] of parsed.headers) {
    headers[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
  }

  // Extract attachment metadata (no content)
  const attachments = (parsed.attachments || []).map(att => ({
    filename: att.filename || 'unknown',
    contentType: att.contentType || 'application/octet-stream',
    size: att.size || 0,
  }));

  return {
    from,
    to,
    subject: parsed.subject || '',
    body: parsed.text || '',
    html: parsed.html || undefined,
    attachments,
    headers,
    date: parsed.date,
  };
}
