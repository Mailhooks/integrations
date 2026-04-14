# Mailhooks Integrations

Official integration packages for [Mailhooks](https://mailhooks.dev) - the email receiving platform for developers.

## Packages

| Package | Version | Description |
|---------|---------|-------------|
| [@mailhooks/sdk](./packages/sdk) | [![npm](https://img.shields.io/npm/v/@mailhooks/sdk)](https://www.npmjs.com/package/@mailhooks/sdk) | TypeScript SDK for the Mailhooks API |
| [@mailhooks/mcp](./packages/mcp) | [![npm](https://img.shields.io/npm/v/@mailhooks/mcp)](https://www.npmjs.com/package/@mailhooks/mcp) | MCP server for Claude Desktop integration (legacy) |
| [mcp-mailhooks](./packages/mcp-mailhooks) | [![npm](https://img.shields.io/npm/v/mcp-mailhooks)](https://www.npmjs.com/package/mcp-mailhooks) | MCP server with full API coverage (inboxes, emails, webhooks, domains, usage) |

## Quick Start

### SDK

```bash
npm install @mailhooks/sdk
```

```typescript
import { Mailhooks } from '@mailhooks/sdk';

const mailhooks = new Mailhooks({
  apiKey: 'your-api-key',
});

// List emails
const emails = await mailhooks.emails.list();

// Wait for a specific email
const email = await mailhooks.emails.waitFor({
  filter: { from: 'noreply@example.com' },
  timeout: 30000,
});

// Real-time notifications
const subscription = mailhooks.realtime.subscribe({
  onEmailReceived: (email) => {
    console.log('New email:', email.subject);
  },
});
```

### MCP Server

```bash
npm install -g mcp-mailhooks
```

Add to your Claude Desktop config:

```json
{
  "mcpServers": {
    "mailhooks": {
      "command": "npx",
      "args": ["mcp-mailhooks"],
      "env": {
        "MAILHOOKS_API_KEY": "your-api-key"
      }
    }
  }
}
```

See the [mcp-mailhooks README](./packages/mcp-mailhooks) for full tool reference and config examples for Claude Code, Cursor, and SSE transport.

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Development mode
pnpm dev
```

## License

MIT
