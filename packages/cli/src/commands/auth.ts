import { Mailhooks } from '@mailhooks/sdk';
import type { Command } from 'commander';
import { emit, fail, wrapError, type OutputFlags } from '../output.js';
import {
  DEFAULT_PROFILE_NAME,
  configPath,
  deleteConfigFile,
  maskApiKey,
  readConfig,
  removeProfile,
  setProfile,
  type Profile,
} from '../config.js';
import { DEFAULT_BASE_URL, resolveCredentials, resolveProfileName } from '../client.js';

type LoginFlags = OutputFlags & {
  apiKey?: string;
  baseUrl?: string;
  profile?: string;
  skipVerify?: boolean;
};

type LogoutFlags = OutputFlags & { profile?: string; all?: boolean };

type GlobalFlags = OutputFlags & { apiKey?: string; baseUrl?: string; profile?: string };

export function registerAuthCommands(program: Command): void {
  program
    .command('login')
    .description(
      'Store a Mailhooks API key for this user. Reads the key from --api-key, stdin, or an interactive hidden prompt. Saves to the profile named by --profile (default: "default").'
    )
    .option('--skip-verify', 'Skip calling the API to verify the key before saving')
    .action(async function (this: Command) {
      const flags = this.optsWithGlobals() as LoginFlags;
      try {
        const apiKey = flags.apiKey ?? (await readApiKey());
        if (!apiKey) {
          fail('No API key provided (pass --api-key, pipe to stdin, or run in a TTY)', 'no_input', 2);
        }

        if (!flags.skipVerify) {
          const baseUrl = flags.baseUrl ?? DEFAULT_BASE_URL;
          try {
            const client = new Mailhooks({ apiKey: apiKey!, baseUrl });
            await client.emails.list({ perPage: 1 });
          } catch (err) {
            const wrapped = wrapError(err);
            fail(`API key verification failed: ${wrapped.error}`, 'verify_failed', 1);
          }
        }

        const profileName = flags.profile ?? DEFAULT_PROFILE_NAME;
        const profile: Profile = { apiKey: apiKey! };
        if (flags.baseUrl) profile.baseUrl = flags.baseUrl;
        const config = await setProfile(profileName, profile);
        const path = configPath();

        emit(
          {
            ok: true,
            path,
            profile: profileName,
            currentProfile: config.currentProfile,
            apiKey: maskApiKey(apiKey!),
            baseUrl: profile.baseUrl ?? null,
            verified: !flags.skipVerify,
          },
          flags
        );
      } catch (err) {
        const wrapped = wrapError(err);
        fail(wrapped.error, wrapped.code);
      }
    });

  program
    .command('logout')
    .description('Remove stored credentials. Without flags, removes the currently selected profile.')
    .option('--all', 'Remove all profiles and delete the config file')
    .action(async function (this: Command) {
      const flags = this.optsWithGlobals() as LogoutFlags;
      try {
        const path = configPath();

        if (flags.all) {
          const removed = await deleteConfigFile();
          emit({ ok: true, path, removed, scope: 'all' }, flags);
          return;
        }

        const config = await readConfig();
        const { name: profileName } = resolveProfileName(flags, config);
        if (!profileName) {
          emit({ ok: true, path, removed: false, scope: 'none', reason: 'no active profile' }, flags);
          return;
        }
        const { removed, config: updated } = await removeProfile(profileName);
        emit(
          {
            ok: true,
            path,
            profile: profileName,
            removed,
            currentProfile: updated.currentProfile ?? null,
          },
          flags
        );
      } catch (err) {
        const wrapped = wrapError(err);
        fail(wrapped.error, wrapped.code);
      }
    });

  program
    .command('whoami')
    .description('Show the active credentials and where they came from')
    .action(async function (this: Command) {
      const flags = this.optsWithGlobals() as GlobalFlags;
      try {
        const config = await readConfig();
        const resolved = await resolveCredentials(flags);
        if (!resolved) {
          emit(
            {
              authenticated: false,
              configPath: configPath(),
              profiles: Object.keys(config.profiles),
              currentProfile: config.currentProfile ?? null,
            },
            flags
          );
          process.exit(0);
        }
        const domainsResult = await fetchDomains(resolved!.baseUrl, resolved!.apiKey);
        emit(
          {
            authenticated: true,
            apiKey: maskApiKey(resolved!.apiKey),
            baseUrl: resolved!.baseUrl,
            profile: resolved!.profile ?? null,
            source: resolved!.source,
            configPath: configPath(),
            profiles: Object.keys(config.profiles),
            currentProfile: config.currentProfile ?? null,
            ...('domains' in domainsResult
              ? { domains: domainsResult.domains }
              : { domainsError: domainsResult.error }),
          },
          flags
        );
      } catch (err) {
        const wrapped = wrapError(err);
        fail(wrapped.error, wrapped.code);
      }
    });
}

interface DomainSummary {
  id: string;
  domain: string;
  status?: string;
  verified?: boolean;
  isDefault?: boolean;
  environment?: string;
}

async function fetchDomains(
  baseUrl: string,
  apiKey: string
): Promise<{ domains: DomainSummary[] } | { error: string }> {
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/domains`, {
      headers: { 'x-api-key': apiKey },
    });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const body = (await res.json()) as unknown;
    const list = Array.isArray(body)
      ? body
      : Array.isArray((body as { data?: unknown[] })?.data)
        ? (body as { data: unknown[] }).data
        : [];
    const domains = list.map((raw): DomainSummary => {
      const d = raw as Record<string, unknown>;
      const env = d.environment as Record<string, unknown> | undefined;
      return {
        id: String(d.id ?? ''),
        domain: String(d.domain ?? ''),
        status: typeof d.status === 'string' ? d.status : undefined,
        verified: typeof d.verified === 'boolean' ? d.verified : undefined,
        isDefault: typeof d.isDefault === 'boolean' ? d.isDefault : undefined,
        environment: typeof env?.slug === 'string' ? env.slug : undefined,
      };
    });
    return { domains };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

async function readApiKey(): Promise<string | undefined> {
  if (!process.stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    const value = Buffer.concat(chunks).toString('utf8').trim();
    return value || undefined;
  }
  return promptHidden('Mailhooks API key: ');
}

function promptHidden(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    const stdout = process.stderr;
    stdout.write(prompt);

    let buf = '';
    const wasRaw = stdin.isRaw;
    try {
      stdin.setRawMode(true);
    } catch (err) {
      reject(err);
      return;
    }
    stdin.resume();
    stdin.setEncoding('utf8');

    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === '\n' || ch === '\r' || ch === '') {
          stdout.write('\n');
          stdin.removeListener('data', onData);
          try {
            stdin.setRawMode(wasRaw);
          } catch {
            /* ignore */
          }
          stdin.pause();
          resolve(buf.trim());
          return;
        }
        if (ch === '') {
          stdout.write('\n');
          try {
            stdin.setRawMode(wasRaw);
          } catch {
            /* ignore */
          }
          process.exit(130);
        }
        if (ch === '' || ch === '\b') {
          buf = buf.slice(0, -1);
          continue;
        }
        buf += ch;
      }
    };
    stdin.on('data', onData);
  });
}
