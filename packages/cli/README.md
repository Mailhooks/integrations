# @mailhooks/cli

Command-line interface for the [Mailhooks](https://mailhooks.dev) email platform, designed for agentic systems and shell scripts.

Every command emits JSON to stdout and JSON errors to stderr, so the CLI composes cleanly with `jq`, pipelines, and LLM tool loops.

## Install

```bash
npm install -g @mailhooks/cli
# or one-off:
npx @mailhooks/cli emails list
```

## Quick start

```bash
# Option 1: store credentials once (plaintext, mode 0600 in ~/.config/mailhooks/)
mailhooks login --api-key mh_live_...

# Multiple environments? Use profiles:
mailhooks login --profile prod    --api-key mh_prod_...
mailhooks login --profile staging --api-key mh_staging_... --base-url https://staging-api.mailhooks.dev/api
mailhooks profiles list
mailhooks --profile staging emails list    # per-invocation override
mailhooks profiles use staging              # or switch the default

# Option 2: env var (no disk persistence)
export MAILHOOKS_API_KEY=mh_live_...

# Then use any command:
mailhooks emails list --per-page 5
mailhooks emails wait-for --subject "verification" --timeout 60000
mailhooks whoami   # active profile, creds (masked), source, domains
mailhooks logout   # remove the current profile (use --all to nuke everything)
```

Resolution order: `--api-key` flag → `MAILHOOKS_API_KEY` → current profile. Profile selection: `--profile` → `MAILHOOKS_PROFILE` → `currentProfile` in config.

## Agent usage

The CLI is intended to be called from agentic systems (LLM tool loops, scripts, automations). See [AGENTS.md](./AGENTS.md) for the full agent-facing guide, including the canonical `wait-for → content → mark-read` loop, exit code contract, and patterns like extracting one-time codes.

## Commands

- `mailhooks login [--profile name]` — store API key (flag, stdin, or hidden TTY prompt)
- `mailhooks logout [--profile name] [--all]` — remove credentials
- `mailhooks whoami` — show active credentials (masked), source, profile, domains
- `mailhooks profiles list` — list configured profiles
- `mailhooks profiles use <name>` — switch the current profile
- `mailhooks emails list` — paginated list with filters
- `mailhooks emails get <id>` — fetch a single email (metadata)
- `mailhooks emails content <id>` — fetch HTML + text body
- `mailhooks emails wait-for` — block until a matching email arrives
- `mailhooks emails mark-read <id>` / `mark-unread <id>`
- `mailhooks emails delete <id>`
- `mailhooks emails download-eml <id>`
- `mailhooks emails download-attachment <emailId> <attachmentId>`
- `mailhooks parse-eml [file]` — parse an EML file (path or stdin) into JSON

Run `mailhooks --help` or `mailhooks <command> --help` for full flag lists.

## Configuration

| Env var | Flag | Purpose |
|---|---|---|
| `MAILHOOKS_API_KEY` | `--api-key` | API key. Required unless stored via `mailhooks login`. |
| `MAILHOOKS_API_URL` | `--base-url` | Override API base. Default: `https://mailhooks.dev/api`. |
| `MAILHOOKS_PROFILE` | `--profile` | Which stored profile to use. |
| `MAILHOOKS_CONFIG_PATH` | — | Override the config file path. |

Global flags: `--pretty` / `--no-pretty` (format JSON — defaults to pretty on a TTY, compact when piped), `--help`, `--version`.

Stored config lives at `~/.config/mailhooks/config.json` (mode `0600`). See [AGENTS.md](./AGENTS.md#configuration) for the full security note.

## License

MIT
