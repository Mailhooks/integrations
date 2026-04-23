# Mailhooks CLI — Agent Guide

The `mailhooks` CLI is a thin wrapper over the [Mailhooks SDK](https://www.npmjs.com/package/@mailhooks/sdk) designed for agentic systems. Every command emits JSON to stdout and errors (as JSON) to stderr, so you can pipe output straight into `jq`, parse it in any language, or feed it back to an LLM.

## Install

```bash
npm install -g @mailhooks/cli
# or invoke without install:
npx @mailhooks/cli <command>
```

## Configuration

Credentials are stored in named **profiles** — one config file can hold keys for production, staging, multiple tenants, etc. Each invocation resolves credentials in this order:

**Profile selection:** `--profile <name>` flag → `MAILHOOKS_PROFILE` env → `currentProfile` in config → none

**API key:** `--api-key` flag → `MAILHOOKS_API_KEY` env → selected profile's `apiKey` → error

**Base URL:** `--base-url` flag → `MAILHOOKS_API_URL` env → selected profile's `baseUrl` → `https://mailhooks.dev/api`

| Env var | Flag | Purpose |
|---|---|---|
| `MAILHOOKS_API_KEY` | `--api-key <key>` | API key. |
| `MAILHOOKS_API_URL` | `--base-url <url>` | API base URL. |
| `MAILHOOKS_PROFILE` | `--profile <name>` | Profile to use. |
| `MAILHOOKS_CONFIG_PATH` | — | Override the config file path. |

Global flags on every command:

- `--pretty` / `--no-pretty` — override JSON formatting. Default: pretty when stdout is a TTY, compact (one line per object) when piped. Agents get compact output automatically.
- `--help` — show command help.
- `--version` — print CLI version.

### `mailhooks login` / `logout` / `whoami` / `profiles`

```bash
# Store a key under the default profile (verified against the API by default)
mailhooks login --api-key mh_live_... [--base-url https://...] [--skip-verify]

# Multiple profiles — for prod, staging, different tenants, etc.
mailhooks login --profile prod    --api-key mh_prod_...
mailhooks login --profile staging --api-key mh_staging_... --base-url https://staging-api.mailhooks.dev/api

# Pipe the key from a secret manager:
op read "op://vault/mailhooks/api-key" | mailhooks login --profile prod

# Or run in a TTY and enter it at the hidden prompt:
mailhooks login --profile prod

# Use a specific profile for one command
mailhooks --profile staging emails list
MAILHOOKS_PROFILE=staging mailhooks emails list

# List / switch / inspect
mailhooks profiles list
mailhooks profiles use staging      # sets currentProfile
mailhooks whoami                    # shows active creds + profile name + domains

# Remove credentials
mailhooks logout                    # removes the currently selected profile
mailhooks logout --profile staging  # removes a specific profile
mailhooks logout --all              # nuke the whole config file
```

`login` without `--profile` writes to a profile called `default`. The first profile you create becomes `currentProfile` automatically; subsequent `login --profile X` calls don't override that — use `profiles use X` to switch.

The stored file is plaintext JSON with mode `0600`. Security caveat: that protects against *other* users on the machine, but anything running as your user can read it — same threat model as your SSH key or shell env. Don't use it in shared/untrusted environments; prefer `MAILHOOKS_API_KEY` injected from a secret manager.

## Output contract

- **Success** → JSON written to stdout, exit code `0`.
- **Error** → `{"error": "<message>", "code": "<code>"}` written to stderr, non-zero exit code.
- **Timeout** (only `wait-for`) → exit code `124`, error `code: "timeout"`.
- **Usage error** (missing key, conflicting flags, missing stdin, unknown profile) → exit code `2`, `code: "usage"`, `"missing_api_key"`, `"no_input"`, or `"unknown_profile"`.
- **Login verify failed** (bad key) → exit code `1`, `code: "verify_failed"`.

Dates are ISO-8601 strings. Email IDs are stable strings.

## The canonical agent loop

Wait for an email, read its body, then mark it as handled:

```bash
EMAIL=$(mailhooks emails wait-for --subject "Order Confirmation" --timeout 60000)
ID=$(echo "$EMAIL" | jq -r '.id')
mailhooks emails content "$ID" --text     # plain-text body to stdout
mailhooks emails mark-read "$ID" > /dev/null
```

Exit code `124` from `wait-for` means no matching email arrived in time — handle that as a retriable condition, not a hard failure.

## Commands

### `login` / `logout` / `whoami`

Store credentials so you don't pass `--api-key` on every call. See [Configuration](#configuration) for the full flow.

```bash
mailhooks login --api-key mh_... [--profile <name>] [--base-url <url>] [--skip-verify]
mailhooks logout [--profile <name>] [--all]
mailhooks whoami
```

`whoami` output:

```jsonc
{
  "authenticated": true,
  "apiKey": "mh_xxx…yyyy",        // masked
  "baseUrl": "https://mailhooks.dev/api",
  "profile": "default",            // which profile is active, or null
  "currentProfile": "default",     // what's stored as the default
  "profiles": ["default", "..."],  // all configured profiles
  "source": {                      // where each value came from
    "apiKey":  "flag" | "env" | "profile",
    "baseUrl": "flag" | "env" | "profile" | "default",
    "profile": "flag" | "env" | "config"
  },
  "domains": [                     // domains available to this key
    { "id": "...", "domain": "example.com", "status": "ACTIVE",
      "verified": true, "isDefault": true, "environment": "production" }
  ],
  "configPath": "/home/.../config.json"
}
```

The `domains[]` list is useful for agent discovery: an agent can call `mailhooks whoami` to find out which domains it can receive mail at before constructing inbox addresses. If the domains fetch fails (non-200 or network), the response contains `domainsError` instead of `domains`.

When unauthenticated, `whoami` returns `{authenticated: false, profiles, currentProfile, configPath}` with exit 0 — use it to probe whether credentials are configured without triggering an error.

### `profiles list` / `profiles use <name>`

```bash
mailhooks profiles list
# → { currentProfile, profiles: [{name, apiKey (masked), baseUrl, current}] }

mailhooks profiles use prod
# → { ok: true, currentProfile: "prod" }
```

### `emails list`

List emails (paginated). Most-recent-first by default.

```bash
mailhooks emails list --from invoices@stripe.com --unread --per-page 10
```

Flags: `--from`, `--to`, `--subject`, `--since <date>`, `--until <date>`, `--read`, `--unread`, `--page <n>`, `--per-page <n>`, `--sort-field <createdAt|from|subject>`, `--sort-order <asc|desc>`.

Output: `{ data: Email[], currentPage, perPage, totalItems, totalPages, hasNextPage, nextCursor? }`.

### `emails get <id>`

Fetch a single email's metadata (headers, sender, recipients, attachments — not the body).

```bash
mailhooks emails get em_123 --mark-read
```

### `emails content <id>`

Fetch the HTML + text body.

```bash
mailhooks emails content em_123              # JSON: {html?, text?}
mailhooks emails content em_123 --text       # raw text body to stdout
mailhooks emails content em_123 --html       # raw HTML body to stdout
```

Raw modes (`--text` / `--html`) are the right choice when feeding a body into another tool or LLM prompt.

### `emails wait-for`

Poll until a matching email arrives. This is the main primitive for agents that trigger on inbound mail (magic links, verification codes, confirmations).

```bash
mailhooks emails wait-for \
  --from noreply@example.com \
  --subject "verification" \
  --timeout 120000 \
  --poll-interval 2000 \
  --lookback 5000
```

Flags: same filter flags as `list`, plus:
- `--timeout <ms>` — give up after this long (default 30000). Exit `124` on timeout.
- `--poll-interval <ms>` — how often to check (default 1000).
- `--initial-delay <ms>` — wait before first check (default 0).
- `--lookback <ms>` — on first check, consider emails received this far back (default 10000). Useful to avoid matching emails from before the agent started.

Returns the first matching `Email` object.

### `emails mark-read <id>` / `emails mark-unread <id>`

Update the read state. Returns the updated email.

### `emails delete <id>`

Permanently delete an email and its attachments. Returns `{ id, deleted: true }`. Note: does not refund quota — the email was already counted at ingestion.

### `emails download-eml <id>`

Download the raw `.eml` (rfc822 source).

```bash
mailhooks emails download-eml em_123 -o /tmp/msg.eml   # writes file, emits {path, bytes}
mailhooks emails download-eml em_123 > msg.eml          # raw bytes to stdout
```

### `emails download-attachment <emailId> <attachmentId>`

Download a specific attachment. Attachment IDs come from `emails get` → `.attachments[].id`.

```bash
mailhooks emails download-attachment em_123 att_456 -o invoice.pdf
```

### `parse-eml [file]`

Parse an EML file into structured JSON. Accepts a file path or stdin. Useful for BYOB (bring-your-own-bucket) setups where the raw EML is in your own storage.

```bash
mailhooks parse-eml /path/to/msg.eml
cat msg.eml | mailhooks parse-eml
```

Output: `{ from, to[], subject, body, html?, attachments[], headers, date? }`.

### `listen`

Listen for real-time email events via Server-Sent Events (SSE) and forward them to a local webhook endpoint — like the Stripe CLI's `stripe listen` or ngrok, but for Mailhooks.

```bash
# Basic: forward all email events to localhost:3000/webhooks
mailhooks listen

# Custom endpoint
mailhooks listen --forward-to http://localhost:8080/api/mailhooks

# With webhook signature verification (your server can verify X-Webhook-Signature)
mailhooks listen --secret whsec_your_webhook_secret

# Distributed mode (for load-balancing across multiple listeners)
mailhooks listen --mode distributed --forward-to http://localhost:4000/hooks

# Suppress stdout output (pipe-friendly)
mailhooks listen --no-print --forward-to http://localhost:3000/webhooks
```

**How it works:**

1. Connects to the Mailhooks SSE stream using your API key.
2. On each `email.received` or `email.updated` event, POSTs a JSON payload to your local endpoint.
3. The forwarded request body is `{ type, data, timestamp }` where `type` is the event type and `data` is the event payload.
4. If `--secret` is provided, each forward includes an `X-Webhook-Signature` header containing the HMAC-SHA256 of the body — your server can verify it with `verifyWebhookSignature()` from `@mailhooks/sdk`.
5. Runs until you press Ctrl+C. Prints connection status and per-event logs to stderr; optionally emits the event JSON to stdout (on by default in a TTY).

**Flags:**

| Flag | Default | Purpose |
|---|---|---|
| `-f, --forward-to <url>` | `http://localhost:3000/webhooks` | Local URL to forward events to |
| `--mode <mode>` | `broadcast` | SSE mode: `broadcast` (all events) or `distributed` (load-balanced) |
| `--no-reconnect` | (reconnect on) | Disable automatic reconnection |
| `--reconnect-delay <ms>` | `5000` | Delay between reconnection attempts |
| `--secret <secret>` | — | Webhook signing secret. Adds `X-Webhook-Signature` header to forwards |
| `--print` | auto (TTY=on) | Print event JSON to stdout |
| `--no-print` | — | Suppress event JSON output |

**Forwarded request format:**

```json
{
  "type": "email.received",
  "data": { "id": "...", "from": "...", "to": ["..."], "subject": "...", ... },
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

Headers: `Content-Type: application/json`, `X-Mailhooks-Event: email.received`, plus `X-Webhook-Signature` if `--secret` is set.

**Usage pattern — local dev with Next.js:**

```bash
# Terminal 1: your app
npm run dev

# Terminal 2: forward Mailhooks events
mailhooks listen --forward-to http://localhost:3000/api/mailhooks/webhook --secret whsec_dev_secret

# Your /api/mailhooks/webhook route receives real Mailhooks events locally
```

## Patterns

**Wait for a one-time code, extract it, move on:**

```bash
EMAIL=$(mailhooks emails wait-for --subject "Your login code" --timeout 60000) || exit 1
ID=$(echo "$EMAIL" | jq -r '.id')
CODE=$(mailhooks emails content "$ID" --text | grep -oE '[0-9]{6}' | head -1)
mailhooks emails mark-read "$ID" > /dev/null
echo "$CODE"
```

**Drain an inbox by sender:**

```bash
mailhooks emails list --from alerts@example.com --unread --per-page 100 \
  | jq -r '.data[].id' \
  | while read id; do mailhooks emails mark-read "$id" > /dev/null; done
```

**Stream new arrivals (poll-based):**

```bash
while true; do
  mailhooks emails wait-for --unread --timeout 300000 || continue
done | jq -c .
```

**Switch profiles per call (multi-tenant agents):**

```bash
# An agent operating on behalf of different tenants can pass --profile
# per call without mutating the current default.
for tenant in acme globex initech; do
  mailhooks --profile "$tenant" emails list --unread --per-page 50
done
```

**Discover available inbox domains before sending:**

```bash
# Ask whoami which domains this key can receive mail at, then construct an
# address the agent will monitor.
DOMAIN=$(mailhooks whoami | jq -r '.domains[] | select(.verified and .isDefault) | .domain' | head -1)
echo "agent+$(uuidgen)@$DOMAIN"
```

## Tips for agent orchestration

- Always read the exit code before parsing stdout. Agents that assume success and try to `jq` an error message will get confused.
- For long-running waits, set `--timeout` to a bounded value and let your orchestrator retry — don't rely on indefinite blocking.
- The `--lookback` window on `wait-for` prevents matching stale emails. If you've just kicked off an action that *should* produce an email, a short lookback (a few seconds) is usually right.
- You don't need `--no-pretty` when invoking from a script — the CLI detects that stdout isn't a TTY and emits compact JSON automatically. Pass `--no-pretty` only if something in between (e.g. a pseudo-TTY in a container runner) is tricking the detection.
- Use `mailhooks whoami` as a cheap probe: it confirms credentials work, tells you which domains are available, and exits 0 with `authenticated: false` (no error) when unconfigured — ideal for health checks at agent startup.
- Multiple agents on the same machine can share one config file via separate profiles; each agent passes its own `--profile <name>` (or sets `MAILHOOKS_PROFILE`) so they don't clobber each other's default.
