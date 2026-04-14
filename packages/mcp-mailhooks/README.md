# mcp-mailhooks

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server that gives AI assistants full access to the Mailhooks API — inboxes, emails, webhooks, domains, tenant info, and usage stats.

Works with Claude Desktop, Claude Code, Cursor, and any MCP-capable client.

## Install

```bash
# Run directly (no install)
npx mcp-mailhooks

# Or install globally
npm install -g mcp-mailhooks
```

## Configuration

### Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `MAILHOOKS_API_KEY` | Yes | — | Your Mailhooks tenant API key |
| `MAILHOOKS_API_URL` | No | `https://app.mailhooks.dev/api/v1` | API base URL |

### Getting an API key

1. Sign up at [mailhooks.dev](https://mailhooks.dev)
2. Go to **Settings → API Keys**
3. Create a new key (tenant-scoped)

### Claude Desktop

Add to `claude_desktop_config.json`:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "mailhooks": {
      "command": "npx",
      "args": ["mcp-mailhooks"],
      "env": {
        "MAILHOOKS_API_KEY": "mh_your_api_key_here"
      }
    }
  }
}
```

### Claude Code

Add to `~/.claude/.mcp.json` or your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "mailhooks": {
      "command": "npx",
      "args": ["mcp-mailhooks"],
      "env": {
        "MAILHOOKS_API_KEY": "mh_your_api_key_here"
      }
    }
  }
}
```

Or via CLI:

```bash
claude mcp add mailhooks -e MAILHOOKS_API_KEY=mh_your_api_key_here -- npx mcp-mailhooks
```

### Cursor

Add to `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "mailhooks": {
      "command": "npx",
      "args": ["mcp-mailhooks"],
      "env": {
        "MAILHOOKS_API_KEY": "mh_your_api_key_here"
      }
    }
  }
}
```

## Transport modes

The server supports two transport modes:

### stdio (default) — for local MCP clients

```bash
mcp-mailhooks
# or explicitly:
mcp-mailhooks --transport stdio
```

### SSE over HTTP — for remote agent runners

```bash
mcp-mailhooks --transport sse --port 4000
```

Connect remote clients to:
- SSE endpoint: `http://localhost:4000/sse`
- POST endpoint: `http://localhost:4000/messages`

The SSE server supports multiple concurrent clients. Each connection is tracked by session ID.

## Tools

All tools are prefixed `mcp__mailhooks__` in MCP client UIs.

### Inbox operations

| Tool | Description | Parameters |
|---|---|---|
| `list_inboxes` | List inboxes in the tenant | `page?`, `perPage?` |
| `get_inbox` | Get inbox details | `id` (required) |
| `create_inbox` | Create a new inbox | `name` (required) |

### Email operations

| Tool | Description | Parameters |
|---|---|---|
| `list_emails` | List emails with filters and pagination | `inboxId?`, `limit?`, `cursor?`, `from?`, `to?`, `subject?` |
| `get_email` | Full parsed email (HTML + text + attachment metadata) | `id` (required) |
| `search_emails` | Search across subject, sender, and recipient in parallel; merges and deduplicates results | `query` (required), `inboxId?`, `limit?` |
| `download_email` | Raw .eml content as text | `id` (required) |
| `delete_email` | Permanently delete an email and its attachments | `id` (required) |
| `mark_as_read` | Mark an email as read | `id` (required) |
| `mark_as_unread` | Mark an email as unread | `id` (required) |
| `wait_for_email` | Poll until a matching email arrives (useful for testing and automation) | `from?`, `to?`, `subject?`, `timeout?`, `pollInterval?`, `lookbackWindow?` |
| `list_attachments` | List attachment metadata for an email | `emailId` (required) |
| `get_attachment` | Attachment content as base64 + MIME type | `emailId` (required), `attachmentId` (required) |

### Webhook operations

| Tool | Description | Parameters |
|---|---|---|
| `list_webhooks` | List webhooks, optionally filtered by inbox | `inboxId?` |
| `get_webhook` | Get webhook details | `id` (required) |
| `create_webhook` | Create a new webhook | `inboxId` (required), `url` (required), `secret?` |
| `update_webhook` | Update webhook URL, secret, or enabled status | `id` (required), `url?`, `secret?`, `enabled?` |
| `delete_webhook` | Delete a webhook | `id` (required) |

### Domain operations

| Tool | Description | Parameters |
|---|---|---|
| `list_domains` | List all domains | — |
| `get_domain` | Get domain details | `id` (required) |
| `check_domain_verification` | DNS record verification status (SPF, DKIM, MX) | `id` (required) |

### Tenant & usage

| Tool | Description | Parameters |
|---|---|---|
| `get_tenant` | Current tenant info | — |
| `get_usage` | Emails/webhooks/quota this billing period | — |

## Example calls

Once connected, your AI assistant can:

```
"List my inboxes"
→ list_inboxes → [{ id: "inbox_abc", name: "Support" }]

"Show me the latest email in the Support inbox"
→ list_emails(inboxId: "inbox_abc", limit: 1)

"Get the full content of email eml_123"
→ get_email(id: "eml_123")

"Create a webhook for the Support inbox pointing to https://myapp.com/hook"
→ create_webhook(inboxId: "inbox_abc", url: "https://myapp.com/hook")

"Check if my domain is verified"
→ check_domain_verification(id: "domain_1")

"How many emails have I used this month?"
→ get_usage()
```

## Development

```bash
pnpm install
pnpm build
pnpm dev       # run with tsx
pnpm test      # unit tests
```

## Publishing

```bash
pnpm build
npm publish --access public
```

## License

MIT