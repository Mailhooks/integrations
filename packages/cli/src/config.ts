import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { readFile, writeFile, mkdir, rm, chmod } from 'node:fs/promises';

export const DEFAULT_PROFILE_NAME = 'default';

export interface Profile {
  apiKey: string;
  baseUrl?: string;
}

export interface ConfigFile {
  currentProfile?: string;
  profiles: Record<string, Profile>;
}

export function configPath(): string {
  if (process.env.MAILHOOKS_CONFIG_PATH) return process.env.MAILHOOKS_CONFIG_PATH;
  const base = process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config');
  return join(base, 'mailhooks', 'config.json');
}

export async function readConfig(): Promise<ConfigFile> {
  try {
    const raw = await readFile(configPath(), 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    return normaliseConfig(parsed);
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return { profiles: {} };
    }
    throw err;
  }
}

/**
 * Accepts either the current {currentProfile, profiles} shape or the legacy
 * flat {apiKey, baseUrl} shape from 0.1.0 and returns the current shape.
 */
function normaliseConfig(raw: unknown): ConfigFile {
  if (!raw || typeof raw !== 'object') return { profiles: {} };
  const obj = raw as Record<string, unknown>;

  if (obj.profiles && typeof obj.profiles === 'object') {
    const profiles: Record<string, Profile> = {};
    for (const [name, value] of Object.entries(obj.profiles as Record<string, unknown>)) {
      if (value && typeof value === 'object') {
        const p = value as Record<string, unknown>;
        if (typeof p.apiKey === 'string') {
          profiles[name] = {
            apiKey: p.apiKey,
            baseUrl: typeof p.baseUrl === 'string' ? p.baseUrl : undefined,
          };
        }
      }
    }
    return {
      currentProfile: typeof obj.currentProfile === 'string' ? obj.currentProfile : undefined,
      profiles,
    };
  }

  // Legacy flat shape from 0.1.0 — promote to `default` profile.
  if (typeof obj.apiKey === 'string') {
    return {
      currentProfile: DEFAULT_PROFILE_NAME,
      profiles: {
        [DEFAULT_PROFILE_NAME]: {
          apiKey: obj.apiKey,
          baseUrl: typeof obj.baseUrl === 'string' ? obj.baseUrl : undefined,
        },
      },
    };
  }

  return { profiles: {} };
}

export async function writeConfig(config: ConfigFile): Promise<string> {
  const path = configPath();
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
  await chmod(path, 0o600);
  return path;
}

export async function deleteConfigFile(): Promise<boolean> {
  try {
    await rm(configPath());
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return false;
    throw err;
  }
}

export async function setProfile(name: string, profile: Profile): Promise<ConfigFile> {
  const config = await readConfig();
  config.profiles[name] = profile;
  if (!config.currentProfile) config.currentProfile = name;
  await writeConfig(config);
  return config;
}

export async function removeProfile(name: string): Promise<{ removed: boolean; config: ConfigFile }> {
  const config = await readConfig();
  const existed = name in config.profiles;
  if (!existed) return { removed: false, config };
  delete config.profiles[name];
  if (config.currentProfile === name) {
    const remaining = Object.keys(config.profiles);
    config.currentProfile = remaining[0];
  }
  await writeConfig(config);
  return { removed: true, config };
}

export async function setCurrentProfile(name: string): Promise<ConfigFile> {
  const config = await readConfig();
  if (!config.profiles[name]) {
    throw new Error(`Profile "${name}" does not exist. Run \`mailhooks login --profile ${name}\` first.`);
  }
  config.currentProfile = name;
  await writeConfig(config);
  return config;
}

export function maskApiKey(key: string): string {
  if (key.length <= 10) return '****';
  return `${key.slice(0, 6)}…${key.slice(-4)}`;
}
