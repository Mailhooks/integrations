# Changelog

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