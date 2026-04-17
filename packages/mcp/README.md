# @mailhooks/mcp

An MCP (Model Context Protocol) server for the Mailhooks API — full coverage for inboxes, emails, webhooks, domains, tenant & usage.

## Tools

| Category | Tool | Description |
|---|---|---|
| Inboxes | `list_inboxes` | List inboxes in the tenant |
| | `get_inbox` | Get details of a specific inbox |
| | `create_inbox` | Create a new inbox |
| Emails | `list_emails` | List emails with optional filtering and pagination |
| | `get_email` | Get full parsed email including body HTML, plain text, and attachment metadata |
| | `search_emails` | Search emails by querying subject, sender, and recipient |
| | `download_email` | Download the raw .eml content of an email |
| | `delete_email` | Permanently delete an email and its attachments |
| | `mark_as_read` | Mark an email as read |
| | `mark_as_unread` | Mark an email as unread |
| | `wait_for_email` | Wait for an email matching filters (useful for testing and automation) |
| | `list_attachments` | List attachments for an email |
| | `get_attachment` | Get an attachment content as base64 with MIME type |
| Webhooks | `list_webhooks` | List webhooks, optionally filtered by inbox |
| | `get_webhook` | Get details of a specific webhook |
| | `create_webhook` | Create a new webhook for an inbox |
| | `update_webhook` | Update a webhook (URL, secret, or enabled status) |
| | `delete_webhook` | Delete a webhook |
| Domains | `list_domains` | List all domains in the tenant |
| | `get_domain` | Get details of a specific domain |
| | `check_domain_verification` | Check domain DNS verification status |
| Tenant | `get_tenant` | Get current tenant info |
| | `get_usage` | Get email/webhook usage and quota for the current period |

## Installation

### Option 1: Install from npm

```bash
npm install -g @mailhooks/mcp
```

### Option 2: Use npx (no installation required)

```bash
npx @mailhooks/mcp
```

## Configuration

### Required Environment Variables

- `MAILHOOKS_API_KEY` (required): Your Mailhooks API key
- `MAILHOOKS_API_URL` (optional): API base URL (defaults to `https://app.mailhooks.dev/api/v1`)

### Getting your API Key

1. Sign up or log in to your Mailhooks account
2. Navigate to Settings → API Keys
3. Create a new API key or copy an existing one

## Usage with AI clients

### Claude Code

```bash
claude mcp add-json mailhooks --scope user '
  {
    "command": "npx",
    "args": ["@mailhooks/mcp"],
    "env": {
      "MAILHOOKS_API_KEY": "mh_your_api_key_here"
    }
  }
'
```

Or add to `.mcp.json`:

```json
{
  "mcpServers": {
    "mailhooks": {
      "command": "npx",
      "args": ["@mailhooks/mcp"],
      "env": {
        "MAILHOOKS_API_KEY": "mh_your_api_key_here"
      }
    }
  }
}
```

### Claude Desktop

Add to your Claude Desktop configuration:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "mailhooks": {
      "command": "npx",
      "args": ["@mailhooks/mcp"],
      "env": {
        "MAILHOOKS_API_KEY": "mh_your_api_key_here"
      }
    }
  }
}
```

### Cursor

Add to your Cursor MCP settings (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "mailhooks": {
      "command": "npx",
      "args": ["@mailhooks/mcp"],
      "env": {
        "MAILHOOKS_API_KEY": "mh_your_api_key_here"
      }
    }
  }
}
```

### SSE transport (remote agents)

For remote agent runners that need HTTP-based access:

```bash
npx @mailhooks/mcp --transport sse --port 4000
```

SSE endpoint: `http://localhost:4000/sse`
POST endpoint: `http://localhost:4000/messages`

## Development

```bash
# Install dependencies
pnpm install

# Build the package
pnpm build

# Run in development mode
pnpm dev

# Run tests
pnpm test

# Type-check
npx tsc --noEmit
```

## Version history

- **v2.0.0** — Full API coverage: 23+ tools across 5 categories, SSE transport, Zod validation, unit tests. Backward-compatible: `read_email` (v1 alias) still works alongside `get_email`.
- **v1.0.11** — Initial release: 4 tools (list_emails, read_email, list_domains, wait_for_email)

### Migrating from v1

v2 is backward compatible with v1:

| v1 Tool | v2 Equivalent | Notes |
|---------|---------------|-------|
| `list_emails` | `list_emails` | Same name, now supports `page`/`perPage` (v1 style) and `limit`/`cursor` (v2 style) |
| `read_email` | `get_email` | `read_email` still works (alias). `get_email` is the new name, uses `id` instead of `emailId` |
| `list_domains` | `list_domains` | Same name, now returns JSON instead of formatted text |
| `wait_for_email` | `wait_for_email` | Same name, same params, returns JSON instead of formatted text |

**Other changes:**
- Default API URL changed from `https://mailhooks.dev` to `https://app.mailhooks.dev/api/v1` — set `MAILHOOKS_API_URL` if you need the old URL
- Output format changed from human-readable text to JSON — structured data is easier for LLMs to parse