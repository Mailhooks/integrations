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
| `packages/n8n` | `n8n-nodes-mailhooks` | 0.2.0 | `n8n-node build` (CJS) | `jest` (42 tests) | `n8n-node lint` |

### Package relationships

```
@mailhooks/sdk ← (depends on) ─── n8n-nodes-mailhooks
     ↑
     └── SDK must be built before n8n (CI does this explicitly)
```

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

# n8n node
pnpm --filter n8n-nodes-mailhooks build
pnpm --filter n8n-nodes-mailhooks lint
pnpm --filter n8n-nodes-mailhooks dev

# MCP (new)
pnpm --filter mcp-mailhooks build
pnpm --filter mcp-mailhooks dev       # tsx src/index.ts

# MCP (legacy)
pnpm --filter @mailhooks/mcp build
```

**Build order matters:** SDK must build before n8n. The n8n publish workflow does `pnpm --filter @mailhooks/sdk run build` first.

## Testing

```bash
# n8n — Jest with ts-jest, mocks for n8n-workflow and @mailhooks/sdk
cd packages/n8n && npx jest

# MCP (new) — Vitest with axios mocks
cd packages/mcp-mailhooks && npx vitest run

# SDK — no tests
# MCP (legacy) — no tests
```

### n8n test setup

Jest can't import `n8n-workflow` or `@mailhooks/sdk` directly (ESM-only packages). The jest config uses `moduleNameMapper` to redirect both to mocks in `packages/n8n/__mocks__/`:
- `__mocks__/n8n-workflow.ts` — exports `NodeConnectionTypes`, `NodeOperationError`, `NodeApiError`
- `__mocks__/@mailhooks/sdk.ts` — exports `Mailhooks` class, `verifyWebhookSignature`, `parseEml`, etc.

## Publishing

Three GitHub Actions workflows auto-publish to npm when `package.json` version changes on `main`:

| Workflow | Trigger | npm package | Git tag prefix |
|----------|---------|-------------|----------------|
| `publish-sdk.yml` | push to main (paths: sdk/package.json) | `@mailhooks/sdk` | `sdk-v` |
| `publish-mcp.yml` | push to main (paths: mcp/package.json) | `@mailhooks/mcp` | `mcp-v` |
| `publish-n8n.yml` | push to main (paths: n8n/package.json) | `n8n-nodes-mailhooks` | `n8n-v` |

All three also support `workflow_dispatch` with a version input for manual publishes.

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