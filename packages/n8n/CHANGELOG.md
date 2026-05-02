# Changelog

## 0.7.1

### Fixed
- Renamed `hookFunctions` to `webhookMethods` so n8n actually calls checkExists/create/delete lifecycle hooks on workflow activation/deactivation. The previous v0.7.0 used the wrong property name, causing webhooks to never be created on the Mailhooks API and resulting in "not registered" errors on delivery.
- Added `responseMode: 'onReceived'` to webhook definition so n8n responds 200 immediately on webhook receipt, preventing Mailhooks delivery timeouts.

## 0.7.0

### Changed

- **Breaking:** The MailhooksTrigger node now auto-creates and auto-deletes webhooks in Mailhooks when the n8n workflow is activated/deactivated. This replaces the previous manual setup flow.
- When a workflow is activated, the trigger calls `POST /v1/webhooks` to create a webhook pointing at the n8n instance. The webhook secret is stored in n8n's static data and used for signature verification automatically.
- When a workflow is deactivated, the trigger calls `DELETE /v1/webhooks/:id` to clean up.
- Removed the manual `Webhook Secret` and `Verify Signature` parameters. Signature verification is now automatic using the secret returned by the Mailhooks API on webhook creation.

## 0.6.3

### Fixed

- Inbox dropdown in n8n showed "undefined" instead of the inbox name because the API returns `addressPrefix` (not `name`). Now uses `addressPrefix` with a fallback chain: `name || addressPrefix || address`.

## 0.6.2

### Changed

- Inbox ID fields on trigger and action nodes now dynamically load inboxes from the API as a dropdown (shows name + address)
- Display names follow n8n convention for dynamic options ("Inbox Name or ID")

## 0.6.1

### Added

- Inbox ID filter on MailhooksTrigger node (optional — only trigger for emails in a specific inbox)

## 0.6.0

### Changed

- **Removed `@mailhooks/sdk` entirely** — bundling via tsup still triggered n8n Cloud scanner failures because bundled code references Node.js built-ins (`http`, `crypto`, `stream`). The scanner inspects the published dist, not the source, so inlining deps doesn't help.
- All API calls now use `this.helpers.httpRequestWithAuthentication` instead of the SDK client.
- HMAC webhook signature verification migrated from Node `crypto` to Web Crypto API (`crypto.subtle`).
- Credential class uses `authenticate` property with `X-API-Key` header and test request hitting `/v1/inboxes`.
- MailhooksTrigger uses a plain `webhook()` handler instead of `webhookMethods` (no auto-subscribe lifecycle).
- Event parameter renamed from `event` (single option) to `events` (multiOptions) in MailhooksTrigger.
- Tests updated to match post-rewrite implementation (43 passing).

### Removed

- `waitFor` email operation — relied on SDK polling helper; use the Mailhooks Polling Trigger node instead.
- `parseEml` operation — required `mailparser` which brings Node built-in deps incompatible with n8n Cloud.
- `webhookMethods` from MailhooksTrigger node.

## 0.3.0

### Changed

- **Build system**: switched from `n8n-node build` (tsc) to `tsup`. All runtime dependencies (`@mailhooks/sdk`, `axios`, `eventsource`, `mailparser`) are now bundled into the published artifact, leaving only `n8n-workflow` as a peer dependency. This is a prerequisite for n8n verified community node submission, which requires zero runtime dependencies.
- `@mailhooks/sdk` moved from `dependencies` to `devDependencies` (`workspace:*`) since it is now bundled.

### Fixed

- Credential display name test now matches the renamed `"Mailhooks"` credential.

## 0.2.0

### Added

- **Inbox resource**: List, Get, Create operations
- **Webhook resource**: List, Get, Create, Update, Delete operations
- **Domain resource**: List, Verify operations
- **Email Delete** operation
- **Auto-register webhook trigger**: MailhooksTrigger now automatically creates a Mailhooks webhook on workflow activation and removes it on deactivation
- **Inbox filter** on MailhooksTrigger
- **SVG icons** for all three nodes (replaces PNGs for n8n community node compliance)
- Unit tests for all nodes and credentials (42 tests)
- Jest config with mocks for `n8n-workflow` and `@mailhooks/sdk`

### Changed

- SDK dependency uses `^2.6.14` (published npm package) instead of `workspace:*`
- MailhooksTrigger now uses `webhookMethods` for automatic webhook lifecycle (previously required manual webhook URL configuration)
- Credential test endpoint updated to `GET /v1/emails?perPage=1`

## 0.1.1

- Initial release with Email and Utility resources
- MailhooksTrigger (manual webhook URL configuration)
- MailhooksPollingTrigger
- MailhooksApi credentials