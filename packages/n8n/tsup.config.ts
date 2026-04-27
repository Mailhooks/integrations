import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';
import { defineConfig } from 'tsup';

export default defineConfig({
	entry: [
		'credentials/MailhooksApi.credentials.ts',
		'nodes/Mailhooks/Mailhooks.node.ts',
		'nodes/MailhooksTrigger/MailhooksTrigger.node.ts',
		'nodes/MailhooksPollingTrigger/MailhooksPollingTrigger.node.ts',
	],
	outDir: 'dist',
	format: ['cjs'],
	target: 'es2022',
	clean: true,
	sourcemap: false,
	splitting: false,
	dts: false,
	platform: 'browser',
	external: ['n8n-workflow'],
	noExternal: [],
	outExtension: () => ({ js: '.js' }),
	esbuildOptions(options) {
		options.outbase = '.';
	},
	async onSuccess() {
		const staticFiles = await fg(['**/*.{png,svg}', '**/*.node.json'], {
			ignore: ['dist/**', 'node_modules/**'],
		});
		await Promise.all(
			staticFiles.map(async (filePath) => {
				const destPath = path.join('dist', filePath);
				await mkdir(path.dirname(destPath), { recursive: true });
				await cp(filePath, destPath, { recursive: true });
			}),
		);
	},
});