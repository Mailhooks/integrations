# Mailhooks MCP Server

An MCP (Model Context Protocol) server that provides tools to interact with the Mailhooks API for listing and reading emails.

## Features

- **list_emails**: List emails with optional filtering by sender, recipient, or subject
- **read_email**: Read the full content of a specific email by ID
- **wait_for_email**: Wait for an email that matches specific filters (useful for testing and automation)
- **list_domains**: List all domains configured in your Mailhooks account

## Installation

### Option 1: Install from npm

```bash
npm install -g @mailhooks/mcp
```

### Option 2: Use npx (no installation required)

You can run the MCP server directly using npx without installing it globally.

## Configuration

### Required Environment Variables

- `MAILHOOKS_API_KEY` (required): Your Mailhooks API key
- `MAILHOOKS_API_URL` (optional): API base URL (defaults to https://mailhooks.dev)

### Getting your API Key

1. Sign up or log in to your Mailhooks account
2. Navigate to Settings → API Keys
3. Create a new API key or copy an existing one

## Usage with Claude Desktop

### Quick Setup with Claude CLI

```bash
claude mcp add-json mailhooks --scope user '
  { 
    "command": "npx", 
    "args": ["@mailhooks/mcp"],
    "env": {
      "MAILHOOKS_API_KEY": "mh_your_api_key_here"
    }
  }
'
```

### Manual Configuration

Add to your Claude Desktop configuration:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`  
**Linux**: `~/.config/Claude/claude_desktop_config.json`

#### Using npx (Recommended)

```json
{
  "mcpServers": {
    "mailhooks": {
      "command": "npx",
      "args": ["@mailhooks/mcp"],
      "env": {
        "MAILHOOKS_API_KEY": "mh_your_api_key_here"
      }
    }
  }
}
```

#### Using global installation

```json
{
  "mcpServers": {
    "mailhooks": {
      "command": "mcp-mailhooks",
      "args": [],
      "env": {
        "MAILHOOKS_API_KEY": "mh_your_api_key_here"
      }
    }
  }
}
```

## Development

```bash
# Install dependencies
pnpm install

# Build the package
pnpm build

# Run in development mode
pnpm dev
```

## Tools

### list_emails

Lists emails from your Mailhooks account.

Parameters:
- `page` (optional): Page number (default: 1)
- `perPage` (optional): Items per page (default: 20, max: 100)
- `from` (optional): Filter by sender email
- `to` (optional): Filter by recipient email
- `subject` (optional): Filter by subject (partial match)

### read_email

Reads the full content of a specific email.

Parameters:
- `emailId` (required): The ID of the email to read

### wait_for_email

Waits for an email that matches specific filters. Useful for testing email flows and automation.

Parameters:
- `from` (optional): Filter by sender email address
- `to` (optional): Filter by recipient email address
- `subject` (optional): Filter by subject (partial match)
- `lookbackWindow` (optional): How far back to look for emails on first check in ms (default: 10000)
- `initialDelay` (optional): Delay before starting to poll in ms (default: 0)
- `timeout` (optional): Maximum time to wait in ms (default: 30000)
- `pollInterval` (optional): Time between checks in ms (default: 1000)
- `maxRetries` (optional): Maximum number of polling attempts (default: unlimited)

### list_domains

Lists all domains configured in your Mailhooks account.

No parameters required.