# Changelog

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