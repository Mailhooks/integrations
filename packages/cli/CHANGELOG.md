# Changelog

## 0.3.0

- New `mailhooks listen` command — connects to the Mailhooks SSE real-time stream and forwards email events to a local webhook endpoint, like `stripe listen --forward-to`.
  - `-f, --forward-to <url>` — local URL to forward events to (default `http://localhost:3000/webhooks`)
  - `--mode <broadcast|distributed>` — SSE connection mode
  - `--secret <whsec_...>` — adds `X-Webhook-Signature` header (HMAC-SHA256) so local servers can verify with the SDK's `verifyWebhookSignature()`
  - `--no-reconnect` / `--reconnect-delay <ms>` — reconnect control
  - `--print` / `--no-print` — stdout output control (auto-on in TTY)
  - Forwards match the real `WebhookPayload` DTO (id, from, to, subject, body, html, attachments, receivedAt, spfResult, dkimResult, dmarcResult, authSummary, usesCustomStorage)
  - Graceful shutdown on Ctrl+C with event stats

## 0.2.1

- Add `"license": "MIT"` to `package.json` so the npm listing reflects the licence shipped in the tarball (the root `LICENSE` was already included).

## 0.2.0

- Multi-profile credential storage. `login --profile <name>` stores to a named profile, `profiles list` and `profiles use <name>` manage them, `--profile` / `MAILHOOKS_PROFILE` pick one per invocation.
- Config file shape changed from flat `{apiKey, baseUrl}` to `{currentProfile, profiles}`. Old 0.1.0 files auto-migrate (read-only) on first access; they get rewritten to the new shape on the next `login` or `profiles use`.
- `logout` now removes the currently selected profile; `logout --profile X` targets a specific one; `logout --all` deletes the whole config file.
- `whoami` now includes `profile`, `currentProfile`, `profiles[]`, and a `source.profile` field (`flag` / `env` / `config`).
- New exit code `2` + `code: "unknown_profile"` when `--profile X` references a profile that doesn't exist.

## 0.1.0

- Initial release.
- `emails list`, `get`, `content`, `wait-for`, `mark-read`, `mark-unread`, `delete`, `download-eml`, `download-attachment`.
- `parse-eml` (file or stdin).
- `login` / `logout` / `whoami` — stored credentials at `~/.config/mailhooks/config.json` (mode `0600`). Resolution order: `--api-key` flag → `MAILHOOKS_API_KEY` → stored config. Login accepts flag, stdin, or an interactive hidden TTY prompt, and verifies the key against the API by default (`--skip-verify` to skip).
- JSON output, pretty-printed when stdout is a TTY and compact when piped (override with `--pretty` / `--no-pretty`). Structured JSON errors on stderr.
- Exit code `124` on `wait-for` timeout, `2` on usage errors.
- Ships `AGENTS.md` agent skill alongside the package.
