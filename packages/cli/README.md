# @mailhooks/cli

Command-line interface for [Mailhooks](https://mailhooks.dev) - list, read, and manage emails from the terminal.

## Installation

```bash
# Install globally
npm install -g @mailhooks/cli

# Or use npx
npx @mailhooks/cli
```

## Configuration

Set your Mailhooks API key as an environment variable:

```bash
export MAILHOOKS_API_KEY=your_api_key_here
```

Optionally, set a custom API URL:

```bash
export MAILHOOKS_API_URL=https://mailhooks.dev/api
```

## Commands

### List Emails

List emails from your Mailhooks inbox with optional filtering:

```bash
# List all emails
mailhooks list

# List with pagination
mailhooks list --page 2 --per-page 50

# Filter by sender
mailhooks list --from sender@example.com

# Filter by recipient
mailhooks list --to recipient@example.com

# Filter by subject (partial match)
mailhooks list --subject "Welcome"

# Show only unread emails
mailhooks list --unread

# Filter by date range
mailhooks list --start-date 2024-01-01T00:00:00Z --end-date 2024-01-31T23:59:59Z

# Sort by field
mailhooks list --sort from --order asc

# Output as JSON
mailhooks list --json
```

### Read Email

Read the full content of a specific email:

```bash
# Read email by ID
mailhooks read <email-id>

# Mark as read when fetching
mailhooks read <email-id> --mark-read

# Output as JSON
mailhooks read <email-id> --json

# Show only text content
mailhooks read <email-id> --text-only

# Show only HTML content
mailhooks read <email-id> --html-only
```

### Wait for Email

Wait for an email matching specific criteria. Useful for testing and automation:

```bash
# Wait for email from specific sender
mailhooks wait --from sender@example.com

# Wait for email with specific subject
mailhooks wait --subject "Verification Code"

# Wait with custom timeout (60 seconds)
mailhooks wait --from noreply@app.com --timeout 60000

# Wait with custom polling interval
mailhooks wait --subject "Order" --poll-interval 2000

# Wait with initial delay
mailhooks wait --subject "Welcome" --initial-delay 5000

# Output only the email ID (useful for scripting)
mailhooks wait --from test@example.com --quiet

# Output as JSON
mailhooks wait --from test@example.com --json
```

### Download

Download emails or attachments:

```bash
# Download email as EML file
mailhooks download <email-id>

# Download to specific path
mailhooks download <email-id> --output ./emails/my-email.eml

# Download a specific attachment
mailhooks download <email-id> --attachment <attachment-id>

# Download all attachments
mailhooks download <email-id> --all-attachments

# Download attachments to specific directory
mailhooks download <email-id> --all-attachments --output ./attachments
```

### Domains

List all configured domains:

```bash
# List domains
mailhooks domains

# Output as JSON
mailhooks domains --json
```

### Mark Read/Unread

Toggle email read status:

```bash
# Mark as read
mailhooks mark-read <email-id>

# Mark as unread
mailhooks mark-unread <email-id>
```

## Examples

### E2E Testing Script

```bash
#!/bin/bash

# Send a test email (using your application)
curl -X POST https://your-app.com/api/send-verification

# Wait for the email and capture the ID
EMAIL_ID=$(mailhooks wait --to test@your-domain.com --subject "Verification" --quiet)

# Read the email content
mailhooks read $EMAIL_ID --text-only
```

### CI/CD Pipeline

```yaml
- name: Test email notifications
  env:
    MAILHOOKS_API_KEY: ${{ secrets.MAILHOOKS_API_KEY }}
  run: |
    # Trigger your application to send an email
    npm run trigger-notification

    # Wait for and verify the email arrived
    mailhooks wait --from notifications@your-app.com --timeout 60000
```

### Pipe to Other Tools

```bash
# Get email content and search with grep
mailhooks read <email-id> --text-only | grep "verification code"

# Parse JSON output with jq
mailhooks list --json | jq '.data[0].subject'

# Download and process EML
mailhooks download <email-id> --output - | your-eml-processor
```

## Options Reference

### Global Options

| Option | Description |
|--------|-------------|
| `-V, --version` | Output version number |
| `-h, --help` | Display help |

### list Options

| Option | Description |
|--------|-------------|
| `-p, --page <number>` | Page number (default: 1) |
| `-n, --per-page <number>` | Emails per page (default: 20) |
| `-f, --from <email>` | Filter by sender |
| `-t, --to <email>` | Filter by recipient |
| `-s, --subject <text>` | Filter by subject (partial match) |
| `--read` | Show only read emails |
| `--unread` | Show only unread emails |
| `--start-date <date>` | Filter after date (ISO format) |
| `--end-date <date>` | Filter before date (ISO format) |
| `--sort <field>` | Sort field: createdAt, from, subject |
| `--order <order>` | Sort order: asc, desc |
| `-j, --json` | Output as JSON |

### wait Options

| Option | Description |
|--------|-------------|
| `-f, --from <email>` | Filter by sender |
| `-t, --to <email>` | Filter by recipient |
| `-s, --subject <text>` | Filter by subject |
| `--timeout <ms>` | Max wait time (default: 30000) |
| `--poll-interval <ms>` | Check interval (default: 1000) |
| `--initial-delay <ms>` | Delay before first check (default: 0) |
| `--lookback <ms>` | Lookback window (default: 10000) |
| `--max-retries <number>` | Max polling attempts |
| `-j, --json` | Output as JSON |
| `-q, --quiet` | Output only email ID |

## License

MIT
