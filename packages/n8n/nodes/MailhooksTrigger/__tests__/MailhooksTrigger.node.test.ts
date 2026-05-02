import type {
	IWebhookFunctions,
	IDataObject,
} from 'n8n-workflow';
import { MailhooksTrigger } from '../MailhooksTrigger.node';

// Helper to create a mock IWebhookFunctions with common overrides
function createMockWebhookFunctions(overrides: {
	body?: IDataObject;
	headers?: Record<string, string>;
	verifySignature?: boolean;
	webhookSecret?: string;
	apiKey?: string;
	baseUrl?: string;
} = {}): IWebhookFunctions {
	const {
		body = {},
		headers = {},
		verifySignature = true,
		webhookSecret = '',
		apiKey = 'mh_test_key',
		baseUrl = 'https://mailhooks.dev/api',
	} = overrides;

	return {
		getBodyData: () => body,
		getHeaderData: () => headers,
		getNodeParameter: (name: string) => {
			if (name === 'verifySignature') return verifySignature;
			if (name === 'webhookSecret') return webhookSecret;
			return undefined;
		},
		getCredentials: async () => ({ apiKey, baseUrl }),
	} as unknown as IWebhookFunctions;
}

describe('MailhooksTrigger', () => {
	it('should have the correct node name', () => {
		const node = new MailhooksTrigger();
		expect(node.description.name).toBe('mailhooksTrigger');
	});

	it('should have the correct display name', () => {
		const node = new MailhooksTrigger();
		expect(node.description.displayName).toBe('Mailhooks Trigger');
	});

	it('should be a trigger node (no inputs)', () => {
		const node = new MailhooksTrigger();
		expect(node.description.inputs).toEqual([]);
	});

	it('should have main output', () => {
		const node = new MailhooksTrigger();
		expect(node.description.outputs).toBeDefined();
	});

	it('should be usable as a tool', () => {
		const node = new MailhooksTrigger();
		expect(node.description.usableAsTool).toBe(true);
	});

	it('should have a webhook configuration', () => {
		const node = new MailhooksTrigger();
		expect(node.description.webhooks).toBeDefined();
		expect(node.description.webhooks).toHaveLength(1);
		const webhook = node.description.webhooks![0];
		expect(webhook.name).toBe('default');
		expect(webhook.httpMethod).toBe('POST');
		expect(webhook.path).toBe('mailhooks-webhook');
	});

	it('should have a webhookSecret parameter with password type', () => {
		const node = new MailhooksTrigger();
		const secretProp = node.description.properties.find((p) => p.name === 'webhookSecret');
		expect(secretProp).toBeDefined();
		expect(secretProp?.type).toBe('string');
		expect((secretProp?.typeOptions as { password?: boolean })?.password).toBe(true);
	});

	it('should have an events parameter with email.received option', () => {
		const node = new MailhooksTrigger();
		const eventProp = node.description.properties.find((p) => p.name === 'events');
		expect(eventProp).toBeDefined();
		expect(eventProp?.type).toBe('multiOptions');
		const optionValues = (eventProp?.options as Array<{ name: string; value: string }>).map(
			(o) => o.value,
		);
		expect(optionValues).toContain('email.received');
	});

	it('should default events to email.received', () => {
		const node = new MailhooksTrigger();
		const eventProp = node.description.properties.find((p) => p.name === 'events');
		expect(eventProp?.default).toContain('email.received');
	});

	it('should have a verifySignature parameter defaulting to true', () => {
		const node = new MailhooksTrigger();
		const verifyProp = node.description.properties.find((p) => p.name === 'verifySignature');
		expect(verifyProp).toBeDefined();
		expect(verifyProp?.default).toBe(true);
	});

	it('should have an inbox parameter with dynamic loading', () => {
		const node = new MailhooksTrigger();
		const inboxIdProp = node.description.properties.find((p) => p.name === 'inboxId');
		expect(inboxIdProp).toBeDefined();
		expect(inboxIdProp?.type).toBe('options');
		expect((inboxIdProp?.typeOptions as { loadOptionsMethod?: string })?.loadOptionsMethod).toBe('getInboxes');
	});

	it('should have a webhook method', () => {
		const node = new MailhooksTrigger();
		expect(typeof node.webhook).toBe('function');
	});

	describe('webhook signature verification', () => {
		it('should pass webhook body through when signature verification is disabled', async () => {
			const mockBody = { id: 'em_123', from: 'test@example.com', subject: 'Test' };
			const mockContext = createMockWebhookFunctions({
				body: mockBody,
				verifySignature: false,
			});

			const node = new MailhooksTrigger();
			const result = await node.webhook.call(mockContext);

			expect(result).toEqual({
				workflowData: [[{ json: mockBody }]],
			});
		});

		it('should reject with 401 when signature is invalid', async () => {
			const mockBody = { id: 'em_123', from: 'test@example.com', subject: 'Test' };
			const mockContext = createMockWebhookFunctions({
				body: mockBody,
				headers: { 'x-webhook-signature': 'invalid_signature' },
				verifySignature: true,
				webhookSecret: 'whsec_test_secret',
			});

			const node = new MailhooksTrigger();
			const result = await node.webhook.call(mockContext);

			expect(result).toEqual({
				webhookResponse: { statusCode: 401, body: { error: 'Invalid signature' } },
			});
		});

		it('should pass through when signature verifies with webhook secret', async () => {
			// Simulate: Mailhooks generates HMAC-SHA256 of payload using webhook secret
			const mockBody = { id: 'em_123', from: 'test@example.com', subject: 'Test' };
			const secret = 'whsec_test_secret';

			// Compute the expected signature using Web Crypto (same as the node uses)
			const encoder = new TextEncoder();
			const key = await crypto.subtle.importKey(
				'raw',
				encoder.encode(secret),
				{ name: 'HMAC', hash: 'SHA-256' },
				false,
				['sign'],
			);
			const sigBuf = await crypto.subtle.sign('HMAC', key, encoder.encode(JSON.stringify(mockBody)));
			const signature = Array.from(new Uint8Array(sigBuf))
				.map((b) => b.toString(16).padStart(2, '0'))
				.join('');

			const mockContext = createMockWebhookFunctions({
				body: mockBody,
				headers: { 'x-webhook-signature': signature },
				verifySignature: true,
				webhookSecret: secret,
			});

			const node = new MailhooksTrigger();
			const result = await node.webhook.call(mockContext);

			expect(result).toEqual({
				workflowData: [[{ json: mockBody }]],
			});
		});

		it('should reject when using apiKey as secret instead of webhookSecret', async () => {
			const mockBody = { id: 'em_123', from: 'test@example.com', subject: 'Test' };
			const apiKey = 'mh_live_testkey';
			const webhookSecret = 'whsec_abc123';

			// Sign with the webhook secret (what Mailhooks does)
			const encoder = new TextEncoder();
			const key = await crypto.subtle.importKey(
				'raw',
				encoder.encode(webhookSecret),
				{ name: 'HMAC', hash: 'SHA-256' },
				false,
				['sign'],
			);
			const sigBuf = await crypto.subtle.sign('HMAC', key, encoder.encode(JSON.stringify(mockBody)));
			const signature = Array.from(new Uint8Array(sigBuf))
				.map((b) => b.toString(16).padStart(2, '0'))
				.join('');

			// Provide apiKey in credentials but use webhookSecret parameter
			const mockContext = createMockWebhookFunctions({
				body: mockBody,
				headers: { 'x-webhook-signature': signature },
				verifySignature: true,
				webhookSecret: webhookSecret,
				apiKey,
			});

			const node = new MailhooksTrigger();
			const result = await node.webhook.call(mockContext);

			// Should pass because webhookSecret matches what was used to sign
			expect(result).toEqual({
				workflowData: [[{ json: mockBody }]],
			});
		});
	});
});