import type { Command } from 'commander';
import { emit, fail, wrapError, type OutputFlags } from '../output.js';
import { maskApiKey, readConfig, setCurrentProfile } from '../config.js';

export function registerProfileCommands(program: Command): void {
  const profiles = program
    .command('profiles')
    .description('Manage stored credential profiles');

  profiles
    .command('list')
    .description('List configured profiles (API keys are masked)')
    .action(async function (this: Command) {
      const flags = this.optsWithGlobals() as OutputFlags;
      try {
        const config = await readConfig();
        const entries = Object.entries(config.profiles).map(([name, profile]) => ({
          name,
          apiKey: maskApiKey(profile.apiKey),
          baseUrl: profile.baseUrl ?? null,
          current: name === config.currentProfile,
        }));
        emit({ currentProfile: config.currentProfile ?? null, profiles: entries }, flags);
      } catch (err) {
        const wrapped = wrapError(err);
        fail(wrapped.error, wrapped.code);
      }
    });

  profiles
    .command('use')
    .argument('<name>', 'Profile name to switch to')
    .description('Set the default profile used when --profile and $MAILHOOKS_PROFILE are unset')
    .action(async function (this: Command, name: string) {
      const flags = this.optsWithGlobals() as OutputFlags;
      try {
        const config = await setCurrentProfile(name);
        emit({ ok: true, currentProfile: config.currentProfile }, flags);
      } catch (err) {
        const wrapped = wrapError(err);
        fail(wrapped.error, wrapped.code);
      }
    });
}
