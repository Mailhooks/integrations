# @mailhooks/sdk

TypeScript SDK for the Mailhooks API. Easily integrate email receiving capabilities into your applications.

## Installation

```bash
npm install @mailhooks/sdk
# or
yarn add @mailhooks/sdk
# or
pnpm add @mailhooks/sdk
```

## Quick Start

```typescript
import { Mailhooks } from '@mailhooks/sdk';

// Initialize the SDK with your API key
const mailhooks = new Mailhooks({
  apiKey: 'your-api-key-here',
  // baseUrl: 'https://custom-url.com/api', // optional, defaults to https://mailhooks.dev/api
});

// Get all emails
const emails = await mailhooks.emails.list();
console.log(emails.data);

// Get a specific email
const email = await mailhooks.emails.getEmail('email-id');
console.log(email);

// Get email content
const content = await mailhooks.emails.getContent('email-id');
console.log(content.html, content.text);
```

## API Reference

### Authentication

The SDK uses API key authentication. You can create API keys in your Mailhooks dashboard.

```typescript
const mailhooks = new Mailhooks({
  apiKey: 'your-api-key',
  // baseUrl: 'https://custom-url.com/api', // optional, defaults to https://mailhooks.dev/api
});
```

### Emails

#### List Emails

```typescript
const emails = await mailhooks.emails.list({
  page: 1,
  perPage: 20,
  filter: {
    from: 'sender@example.com',
    subject: 'Important',
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    read: false, // Filter by read status
  },
  sort: {
    field: 'createdAt',
    order: 'desc',
  },
});
```

#### Get Email

```typescript
// Get email without marking as read
const email = await mailhooks.emails.getEmail('email-id');

// Get email and mark it as read in one call
const readEmail = await mailhooks.emails.getEmail('email-id', true);
```

#### Get Email Content

```typescript
const content = await mailhooks.emails.getContent('email-id');
```

#### Download Email as EML

```typescript
const emlFile = await mailhooks.emails.downloadEml('email-id');
// emlFile.data contains the ArrayBuffer
// emlFile.filename contains the suggested filename
```

#### Download Attachment

```typescript
const attachment = await mailhooks.emails.downloadAttachment('email-id', 'attachment-id');
// attachment.data contains the ArrayBuffer
// attachment.filename contains the original filename
// attachment.contentType contains the MIME type
```

#### Mark Email as Read/Unread

```typescript
// Mark email as read
const readEmail = await mailhooks.emails.markAsRead('email-id');
console.log(readEmail.read); // true

// Mark email as unread
const unreadEmail = await mailhooks.emails.markAsUnread('email-id');
console.log(unreadEmail.read); // false
```

#### Delete Email

```typescript
// Permanently delete an email and its attachments
await mailhooks.emails.deleteEmail('email-id');
```

> ⚠️ Deleted emails still count towards your monthly usage quota — the email was
> already received and billed at ingestion time. Use delete to free up storage,
> not to reduce usage. This action is irreversible.

#### Wait for Email

Wait for an email that matches specific filters. Useful for testing and automation.

```typescript
// Basic usage - wait for unread email from specific sender
const email = await mailhooks.emails.waitFor({
  filter: { 
    from: 'noreply@example.com',
    read: false // Only wait for unread emails
  },
  timeout: 30000, // 30 seconds
  pollInterval: 2000, // Check every 2 seconds
});

// Advanced usage with all options
const email = await mailhooks.emails.waitFor({
  filter: {
    from: 'noreply@example.com',
    to: 'test@yourdomain.com',
    subject: 'Order Confirmation',
    read: false, // Only unread emails
  },
  lookbackWindow: 10000, // Only consider emails from last 10 seconds
  initialDelay: 5000,    // Wait 5 seconds before first check
  timeout: 60000,        // Total timeout of 60 seconds
  pollInterval: 3000,    // Check every 3 seconds
  maxRetries: 20,        // Stop after 20 attempts
});
```

**Options:**
- `filter`: Same filters as `list()` method (from, to, subject, startDate, endDate, read)
- `lookbackWindow`: How far back to look for emails on first check (default: 10000ms)
- `initialDelay`: Delay before starting to poll (default: 0ms)
- `timeout`: Maximum time to wait before throwing error (default: 30000ms)
- `pollInterval`: Time between checks (default: 1000ms)
- `maxRetries`: Maximum number of polling attempts (default: unlimited)

**Key Features:**
- Returns immediately if a matching email already exists (within lookback window)
- Prevents returning old emails by using the lookback window
- Efficiently tracks checked emails to avoid duplicates
- Throws error on timeout or max retries exceeded

## Push Notifications (SSE)

Get instant push notifications when emails arrive using Server-Sent Events. This is ideal for serverless environments, client-side apps, firewalled networks, or local development where webhooks aren't practical.

### Basic Usage

```typescript
import { Mailhooks } from '@mailhooks/sdk';

const mailhooks = new Mailhooks({ apiKey: 'mh_xxx' });

const subscription = mailhooks.realtime.subscribe({
  onEmailReceived: (email) => {
    console.log('New email:', email.subject);
    console.log('From:', email.from);
  },
  onConnected: (payload) => {
    console.log('Connected!', payload.connectionId);
  },
  onError: (error) => {
    console.error('Error:', error);
  },
});

// Later, disconnect when done
subscription.disconnect();
```

### Distributed Mode (Worker Load Balancing)

When running multiple workers, use distributed mode so only ONE worker receives each notification:

```typescript
// Each worker connects with the same API key
// Only ONE worker receives each notification (random selection)
const subscription = mailhooks.realtime.subscribe({
  mode: 'distributed',
  onEmailReceived: async (email) => {
    // Process email - only one worker will receive this
    await processEmail(email.id);
  },
});
```

### Full Event Handling

```typescript
const subscription = mailhooks.realtime.subscribe({
  mode: 'broadcast', // or 'distributed'
  onConnected: (payload) => {
    console.log(`Connected: ${payload.connectionId}`);
    console.log(`Mode: ${payload.mode}`);
  },
  onEmailReceived: (email) => {
    console.log(`From: ${email.from}`);
    console.log(`Subject: ${email.subject}`);
    console.log(`Has attachments: ${email.hasAttachments}`);
  },
  onEmailUpdated: (update) => {
    console.log(`Email ${update.id} updated:`, update.changes);
  },
  onHeartbeat: () => {
    // Sent every 30 seconds to keep connection alive
  },
  onError: (error) => {
    console.error('Connection error:', error);
  },
  onDisconnect: () => {
    console.log('Disconnected');
  },
  autoReconnect: true,  // Automatically reconnect on disconnect (default: true)
  reconnectDelay: 5000, // Delay between reconnect attempts in ms (default: 5000)
});
```

### Node.js Usage

In Node.js, you need to install the `eventsource` package:

```bash
npm install eventsource
```

Then make EventSource available globally before importing the SDK:

```typescript
import EventSource from 'eventsource';
(global as any).EventSource = EventSource;

import { Mailhooks } from '@mailhooks/sdk';
// Use as normal
```

### Event Types

| Event | Payload | Description |
|-------|---------|-------------|
| `connected` | `{ tenantId, connectedAt, mode, connectionId }` | Connection established |
| `email.received` | `{ id, from, to, subject, hasAttachments, ... }` | New email arrived |
| `email.updated` | `{ id, changes: { read?: boolean } }` | Email was updated |
| `heartbeat` | `{ timestamp }` | Keep-alive ping (every 30s) |

### Connection Modes

| Mode | Behavior | Use Case |
|------|----------|----------|
| `broadcast` | All connected clients receive every event | Dashboards, monitoring |
| `distributed` | One random client per API key receives each event | Worker pools, load balancing |

## Types

The SDK includes comprehensive TypeScript types:

```typescript
interface Email {
  id: string;
  from: string;
  to: string[];
  subject: string;
  read: boolean;
  createdAt: Date;
  attachments: Attachment[];
}

interface EmailContent {
  html?: string;
  text?: string;
}

interface Attachment {
  id: string;
  filename: string;
  contentType: string;
  size: number;
}
```

## Error Handling

The SDK throws standard HTTP errors. Wrap your calls in try-catch blocks:

```typescript
try {
  const email = await mailhooks.emails.getEmail('non-existent-id');
} catch (error) {
  if (error.response?.status === 404) {
    console.log('Email not found');
  } else if (error.response?.status === 403) {
    console.log('Authentication failed - check your API key');
  }
}
```

### Common Errors

- **403 Forbidden**: Invalid API key or missing authentication
- **404 Not Found**: Resource not found
- **429 Too Many Requests**: Rate limit exceeded

## Webhook Signature Verification

When you create a webhook in Mailhooks, you receive a secret that can be used to verify that incoming webhook requests are genuinely from Mailhooks. Each webhook request includes an `X-Webhook-Signature` header containing an HMAC-SHA256 signature of the request body.

### Verifying Signatures

```typescript
import { verifyWebhookSignature, parseWebhookPayload } from '@mailhooks/sdk';

// Express.js example - IMPORTANT: Use raw body parser for signature verification
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-webhook-signature'] as string;
  const payload = req.body.toString();

  // Verify the signature using your webhook secret
  if (!verifyWebhookSignature(payload, signature, process.env.WEBHOOK_SECRET!)) {
    console.error('Invalid webhook signature');
    return res.status(401).send('Invalid signature');
  }

  // Parse the verified payload
  const event = parseWebhookPayload(payload);

  console.log(`Received email from ${event.from}: ${event.subject}`);

  // Process the webhook...
  res.status(200).send('OK');
});
```

### Webhook Payload

The webhook payload contains the following fields:

```typescript
interface WebhookPayload {
  id: string;           // Unique email ID
  from: string;         // Sender email address
  to: string[];         // Array of recipient addresses
  subject: string;      // Email subject
  body: string;         // Plain text body
  html?: string;        // HTML body (if available)
  attachments: Array<{  // Attachment metadata
    filename: string;
    contentType: string;
    size: number;
    storagePath?: string; // Storage path (only for custom storage)
  }>;
  receivedAt: string;   // ISO 8601 timestamp

  // Email authentication results
  spfResult?: 'pass' | 'fail' | 'softfail' | 'neutral' | 'none';
  dkimResult?: 'pass' | 'fail' | 'none' | 'temperror' | 'permerror';
  dmarcResult?: 'pass' | 'fail' | 'none' | 'temperror' | 'permerror';
  authSummary?: 'pass' | 'fail' | 'partial';

  // Custom storage (BYOB)
  usesCustomStorage: boolean; // true if using your own S3 bucket
  storagePath?: string;       // EML file path (only for custom storage)
}
```

### Security Best Practices

1. **Always verify signatures** before processing webhook data
2. **Use the raw request body** for signature verification (not parsed JSON)
3. **Store secrets securely** in environment variables, not in code
4. **Use HTTPS** for your webhook endpoint
5. **Respond quickly** - return 200 OK before doing heavy processing

### Framework Examples

#### Next.js API Route

```typescript
import { verifyWebhookSignature, parseWebhookPayload } from '@mailhooks/sdk';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const payload = await request.text();
  const signature = request.headers.get('x-webhook-signature') || '';

  if (!verifyWebhookSignature(payload, signature, process.env.WEBHOOK_SECRET!)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const event = parseWebhookPayload(payload);
  // Process event...

  return NextResponse.json({ received: true });
}
```

#### Fastify

```typescript
import { verifyWebhookSignature, parseWebhookPayload } from '@mailhooks/sdk';

fastify.post('/webhook', {
  config: {
    rawBody: true, // Enable raw body
  },
}, async (request, reply) => {
  const signature = request.headers['x-webhook-signature'] as string;
  const payload = request.rawBody?.toString() || '';

  if (!verifyWebhookSignature(payload, signature, process.env.WEBHOOK_SECRET!)) {
    return reply.status(401).send({ error: 'Invalid signature' });
  }

  const event = parseWebhookPayload(payload);
  // Process event...

  return { received: true };
});
```

## Parsing EML Files (BYOB)

If you use custom storage (Bring Your Own Bucket), you can fetch and parse EML files directly using the `parseEml` function. This is useful when you want to process emails from your own S3-compatible storage.

### Basic Usage

```typescript
import { parseEml } from '@mailhooks/sdk';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

// Fetch EML from your S3 bucket
const s3 = new S3Client({ region: 'us-east-1' });
const response = await s3.send(new GetObjectCommand({
  Bucket: 'my-email-bucket',
  Key: storagePath, // from webhook payload
}));

const emlBuffer = Buffer.from(await response.Body!.transformToByteArray());

// Parse the EML
const email = await parseEml(emlBuffer);

console.log(email.from);        // "sender@example.com"
console.log(email.to);          // ["recipient@yourdomain.com"]
console.log(email.subject);     // "Hello World"
console.log(email.body);        // Plain text content
console.log(email.html);        // HTML content (if available)
console.log(email.headers);     // All headers as key-value pairs
console.log(email.attachments); // [{ filename, contentType, size }]
console.log(email.date);        // Date object from Date header
```

### Webhook Integration

When using custom storage, your webhook payload includes `storagePath` for both the email and attachments:

```typescript
import { verifyWebhookSignature, parseWebhookPayload, parseEml } from '@mailhooks/sdk';

app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['x-webhook-signature'] as string;
  const payload = req.body.toString();

  if (!verifyWebhookSignature(payload, signature, process.env.WEBHOOK_SECRET!)) {
    return res.status(401).send('Invalid signature');
  }

  const event = parseWebhookPayload(payload);

  // For custom storage users
  if (event.usesCustomStorage && event.storagePath) {
    // Fetch and parse the full email from your storage
    const emlBuffer = await fetchFromS3(event.storagePath);
    const fullEmail = await parseEml(emlBuffer);

    // Access full email content
    console.log(fullEmail.html);
    console.log(fullEmail.headers);
  }

  // Attachment paths are also available for custom storage
  for (const attachment of event.attachments) {
    if (attachment.storagePath) {
      // Fetch attachment from your storage
      const attachmentBuffer = await fetchFromS3(attachment.storagePath);
      // Process attachment...
    }
  }

  res.status(200).send('OK');
});
```

### ParsedEmail Type

```typescript
interface ParsedEmail {
  from: string;           // Sender email address
  to: string[];           // Recipient addresses
  subject: string;        // Email subject
  body: string;           // Plain text body
  html?: string;          // HTML body (if available)
  attachments: Array<{    // Attachment metadata
    filename: string;
    contentType: string;
    size: number;
  }>;
  headers: Record<string, string>; // All email headers
  date?: Date;            // Date from headers
}
```

## License

MIT