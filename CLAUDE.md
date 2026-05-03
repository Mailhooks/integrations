# Mailhooks Integrations

This repo is a pnpm monorepo containing published npm packages for the [Mailhooks](https://mailhooks.dev) email platform.

- **GitHub:** `Mailhooks/integrations`
- **Package manager:** pnpm 10.4 with workspaces (`packages/*`)
- **Node:** 24

## Packages

| Path | npm name | Version | Build | Test | Lint |
|------|----------|---------|-------|------|------|
| `packages/sdk` | `@mailhooks/sdk` | 2.6.14 | `tsup` (ESM-only) | none | none |
| `packages/mcp` | `@mailhooks/mcp` | 1.0.11 | `tsc` (CJS) | none | none |
| `packages/mcp-mailhooks` | `mcp-mailhooks` | 0.1.0 | `tsc` (ESM) | `vitest run` (18 tests) | none |

The n8n community node (`n8n-nodes-mailhooks`) has moved to its own repo: [`Mailhooks/n8n-nodes-mailhooks`](https://github.com/Mailhooks/n8n-nodes-mailhooks).

The two MCP servers are standalone — they call the Mailhooks API directly via axios, not through the SDK.

### Two MCP servers

- **`packages/mcp/`** (`@mailhooks/mcp` v1.0.11) — Legacy. 4 tools (`list_emails`, `read_email`, `wait_for_email`, `list_domains`), single-file, no tests, no Zod validation.
- **`packages/mcp-mailhooks/`** (`mcp-mailhooks` v0.1.0) — Current. 20 tools across 5 categories, Zod schemas, dual transport (stdio + SSE), vitest tests. This is the intended replacement.

## Build & dev commands

```bash
# All packages
pnpm install
pnpm build          # builds all packages via pnpm -r

# SDK
pnpm --filter @mailhooks/sdk build
pnpm --filter @mailhooks/sdk dev     # tsc --watch

# MCP (new)
pnpm --filter mcp-mailhooks build
pnpm --filter mcp-mailhooks dev       # tsx src/index.ts

# MCP (legacy)
pnpm --filter @mailhooks/mcp build
```

## Testing

```bash
# MCP (new) — Vitest with axios mocks
cd packages/mcp-mailhooks && npx vitest run

# SDK — no tests
# MCP (legacy) — no tests
```

## Publishing

Two GitHub Actions workflows auto-publish to npm when `package.json` version changes on `main`:

| Workflow | Trigger | npm package | Git tag prefix |
|----------|---------|-------------|----------------|
| `publish-sdk.yml` | push to main (paths: sdk/package.json) | `@mailhooks/sdk` | `sdk-v` |
| `publish-mcp.yml` | push to main (paths: mcp/package.json) | `@mailhooks/mcp` | `mcp-v` |

Both also support `workflow_dispatch` with a version input for manual publishes.

**To publish a new version:**
1. Bump `version` in the package's `package.json`
2. Update `CHANGELOG.md`
3. Merge to `main` via the PR + QA + board approval workflow
4. CI detects the version change and publishes automatically

## API base URLs

Packages use different default base URLs:

| Package | Default base | Routes |
|---------|-------------|--------|
| `@mailhooks/sdk` | `https://mailhooks.dev/api` | `/v1/emails`, `/v1/webhooks`, etc. |
| `@mailhooks/mcp` (legacy) | `https://mailhooks.dev` | `/api/v1/emails`, etc. |
| `mcp-mailhooks` (new) | `https://app.mailhooks.dev/api/v1` | `/emails`, `/webhooks`, etc. |

All accept `MAILHOOKS_API_URL` env var to override.

## SDK API surface

```typescript
import { Mailhooks, verifyWebhookSignature, parseEml } from '@mailhooks/sdk';

const mailhooks = new Mailhooks({ apiKey: '...', baseUrl: '...' });

// Emails
await mailhooks.emails.list({ filter, page, perPage, sort });
await mailhooks.emails.getEmail(id, markAsRead?);
await mailhooks.emails.getContent(id);
await mailhooks.emails.deleteEmail(id);
await mailhooks.emails.markAsRead(id);
await mailhooks.emails.markAsUnread(id);
await mailhooks.emails.downloadEml(id);
await mailhooks.emails.downloadAttachment(emailId, attachmentId);
await mailhooks.emails.waitFor({ filter, timeout, pollInterval, lookbackWindow });

// Realtime (SSE, Pro plan)
mailhooks.realtime.subscribe({ onEmailReceived: (email) => ... });

// Webhook utilities
verifyWebhookSignature(payload, signature, secret); // → boolean
parseEml(emlContent); // → ParsedEmail
```

Key source files: `packages/sdk/src/mailhooks.ts`, `packages/sdk/src/client.ts`, `packages/sdk/src/resources/emails.ts`, `packages/sdk/src/types.ts`.