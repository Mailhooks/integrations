# n8n-nodes-mailhooks

This is an n8n community node for [Mailhooks](https://mailhooks.dev) - a service for receiving, filtering, and processing emails via webhooks and API.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

[Installation](#installation)
[Nodes](#nodes)
[Credentials](#credentials)
[Usage](#usage)
[Resources](#resources)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

Or install directly in n8n:

1. Go to **Settings** > **Community Nodes**
2. Select **Install**
3. Enter `n8n-nodes-mailhooks`
4. Agree to the risks and select **Install**

## Nodes

This package includes three nodes:

### Mailhooks

The main node for interacting with the Mailhooks API.

**Email Operations:**
- **List** - List emails with optional filters (from, to, subject, date range, read status)
- **Get** - Get a specific email by ID
- **Get Content** - Get the HTML and text content of an email
- **Mark as Read** - Mark an email as read
- **Mark as Unread** - Mark an email as unread
- **Download EML** - Download email in EML format
- **Download Attachment** - Download a specific attachment
- **Wait For** - Wait for an email matching filters (useful for testing flows)

**Utility Operations:**
- **Parse EML** - Parse raw EML content into structured data
- **Verify Webhook** - Verify a webhook signature

### Mailhooks Trigger

A webhook trigger that starts the workflow when a new email is received. Configure the webhook URL in your Mailhooks dashboard to point to the n8n webhook URL.

Features:
- Receives `email.received` events in real-time
- Optional signature verification for security
- Returns full email data including headers, body, attachments, and authentication results (SPF, DKIM, DMARC)

### Mailhooks Polling Trigger

A polling trigger that checks for new emails at regular intervals. Useful when webhooks are not available or as a fallback.

Features:
- Configurable polling interval (set in n8n workflow settings)
- Filter by sender, recipient, or subject
- Only processes emails received after workflow activation

## Credentials

To use the Mailhooks nodes, you need to configure credentials:

1. Sign up at [mailhooks.dev](https://mailhooks.dev)
2. Go to your dashboard and copy your API key
3. In n8n, create new **Mailhooks API** credentials
4. Enter your API key

| Field | Description |
|-------|-------------|
| API Key | Your Mailhooks API key from the dashboard |
| Base URL | The API base URL (default: `https://mailhooks.dev/api`) |

## Usage

### Receiving emails via webhook

1. Add a **Mailhooks Trigger** node to your workflow
2. Activate the workflow to get the webhook URL
3. Copy the webhook URL and add it to your Mailhooks dashboard
4. (Optional) Add a webhook secret for signature verification

### Polling for new emails

1. Add a **Mailhooks Polling Trigger** node to your workflow
2. Configure the polling interval in the workflow settings
3. Optionally add filters for sender, recipient, or subject
4. Activate the workflow

### Working with emails

Use the **Mailhooks** node to:
- List and search emails
- Get email content and attachments
- Mark emails as read/unread
- Wait for specific emails (great for automated testing)

### Example: Process incoming emails

```
[Mailhooks Trigger] → [IF] → [Slack]
                         ↓
                    [Google Sheets]
```

1. Trigger on new email
2. Check if subject contains "urgent"
3. Send to Slack if urgent, otherwise log to Google Sheets

## Resources

- [Mailhooks Documentation](https://mailhooks.dev/docs)
- [Mailhooks SDK](https://www.npmjs.com/package/@mailhooks/sdk)
- [n8n Community Nodes Documentation](https://docs.n8n.io/integrations/community-nodes/)
- [GitHub Repository](https://github.com/Mailhooks/integrations)

## License

[MIT](LICENSE)
