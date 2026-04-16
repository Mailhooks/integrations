# Changelog

## 0.1.1

### Added

- **Mailhooks action node** with 5 resources and 21 operations:
  - **Domain**: List, Verify
  - **Email**: Delete, Download Attachment, Download EML, Get, Get Content, List, Mark as Read, Mark as Unread, Wait For
  - **Inbox**: Create, Get, List
  - **Webhook**: Create, Delete, Get, List, Update
  - **Utility**: Parse EML, Verify Webhook
- **MailhooksTrigger** — webhook trigger that receives `email.received` events in real-time with optional signature verification
- **MailhooksPollingTrigger** — polling trigger that checks for new emails at intervals with deduplication
- **MailhooksApi credentials** — stores API key + base URL with a test button that hits `GET /v1/emails?perPage=1`
- SVG icons for all three nodes
- Unit tests for all nodes and credentials (42 tests)

### Changed

- SDK dependency uses `^2.6.14` (published npm package) instead of workspace link
- Migrated node icons from PNG to SVG for n8n community node compliance