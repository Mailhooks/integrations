import { Mailhooks } from '@mailhooks/sdk';
import { fail } from './output.js';
import { DEFAULT_PROFILE_NAME, readConfig, type ConfigFile, type Profile } from './config.js';

export const DEFAULT_BASE_URL = 'https://mailhooks.dev/api';

export interface ClientFlags {
  apiKey?: string;
  baseUrl?: string;
  profile?: string;
}

export type CredentialSource = 'flag' | 'env' | 'profile';
export type BaseUrlSource = CredentialSource | 'default';

export interface ResolvedCredentials {
  apiKey: string;
  baseUrl: string;
  profile?: string;
  source: {
    apiKey: CredentialSource;
    baseUrl: BaseUrlSource;
    profile?: 'flag' | 'env' | 'config';
  };
}

export function resolveProfileName(
  flags: ClientFlags,
  config: ConfigFile
): { name?: string; source?: 'flag' | 'env' | 'config' } {
  if (flags.profile) return { name: flags.profile, source: 'flag' };
  if (process.env.MAILHOOKS_PROFILE) return { name: process.env.MAILHOOKS_PROFILE, source: 'env' };
  if (config.currentProfile) return { name: config.currentProfile, source: 'config' };
  return {};
}

export async function resolveCredentials(
  flags: ClientFlags = {}
): Promise<ResolvedCredentials | null> {
  const config = await readConfig();
  const { name: profileName, source: profileSource } = resolveProfileName(flags, config);
  const profile: Profile | undefined = profileName ? config.profiles[profileName] : undefined;

  let apiKey: string | undefined;
  let apiKeySource: CredentialSource | undefined;
  if (flags.apiKey) {
    apiKey = flags.apiKey;
    apiKeySource = 'flag';
  } else if (process.env.MAILHOOKS_API_KEY) {
    apiKey = process.env.MAILHOOKS_API_KEY;
    apiKeySource = 'env';
  } else if (profile?.apiKey) {
    apiKey = profile.apiKey;
    apiKeySource = 'profile';
  }

  if (!apiKey || !apiKeySource) {
    // Surface a distinct error when a profile was requested but doesn't exist.
    if (profileName && !profile && flags.profile) {
      fail(`Profile "${profileName}" does not exist. Run \`mailhooks profiles list\` to see configured profiles.`, 'unknown_profile', 2);
    }
    return null;
  }

  let baseUrl: string;
  let baseUrlSource: BaseUrlSource;
  if (flags.baseUrl) {
    baseUrl = flags.baseUrl;
    baseUrlSource = 'flag';
  } else if (process.env.MAILHOOKS_API_URL) {
    baseUrl = process.env.MAILHOOKS_API_URL;
    baseUrlSource = 'env';
  } else if (profile?.baseUrl) {
    baseUrl = profile.baseUrl;
    baseUrlSource = 'profile';
  } else {
    baseUrl = DEFAULT_BASE_URL;
    baseUrlSource = 'default';
  }

  return {
    apiKey,
    baseUrl,
    profile: apiKeySource === 'profile' ? profileName : undefined,
    source: {
      apiKey: apiKeySource,
      baseUrl: baseUrlSource,
      profile: profileSource,
    },
  };
}

export async function createClient(flags: ClientFlags = {}): Promise<Mailhooks> {
  const resolved = await resolveCredentials(flags);
  if (!resolved) {
    fail(
      'No API key configured. Run `mailhooks login`, pass --api-key, or set $MAILHOOKS_API_KEY.',
      'missing_api_key',
      2
    );
  }
  return new Mailhooks({ apiKey: resolved!.apiKey, baseUrl: resolved!.baseUrl });
}

export { DEFAULT_PROFILE_NAME };
