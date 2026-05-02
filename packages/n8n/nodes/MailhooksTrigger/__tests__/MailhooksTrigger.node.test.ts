import type {
	IWebhookFunctions,
	IDataObject,
} from 'n8n-workflow';
import { MailhooksTrigger } from '../MailhooksTrigger.node';

// Helper to create a mock IWebhookFunctions
function createMockWebhookFunctions(overrides: {
	body?: IDataObject;
	headers?: Record<string, string>;
	staticData?: IDataObject;
}): IWebhookFunctions {
	const body = overrides.body ?? {};
	const headers = overrides.headers ?? { 'x-webhook-signature': '' };
	const staticData = overrides.staticData ?? {};

	return {
		getBodyData: () => body,
		getHeaderData: () => headers,
		getWorkflowStaticData: () => staticData,
		getNodeParameter: (name: string) => {
			if (name === 'events') return ['email.received'];
			if (name === 'verifySignature') return true;
			if (name === 'webhookSecret') return '';
			if (name === 'inboxId') return '';
			return '';
		},
		getCredentials: async () => ({ apiKey: 'test-api-key', baseUrl: 'https://test.api' }),
	} as unknown as IWebhookFunctions;
}

// Helper to compute a valid HMAC-SHA256 signature for testing
async function computeSignature(payload: string, secret: string): Promise<string> {
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign'],
	);
	const sigBuf = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
	return Array.from(new Uint8Array(sigBuf))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
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

	it('should have hookFunctions for auto-creating webhooks', () => {
		const node = new MailhooksTrigger();
		const hooks = node.hookFunctions;
		expect(hooks).toBeDefined();
		expect(hooks.default).toBeDefined();
		expect(typeof hooks.default.checkExists).toBe('function');
		expect(typeof hooks.default.create).toBe('function');
		expect(typeof hooks.default.delete).toBe('function');
	});

	it('should not have a manual webhookSecret parameter', () => {
		const node = new MailhooksTrigger();
		const propNames = node.description.properties.map((p) => p.name);
		expect(propNames).not.toContain('webhookSecret');
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
		it('should pass webhook body through when no secret is stored in static data', async () => {
			const mockBody = { id: 'em_123', from: 'test@example.com', subject: 'Test' };
			const mockContext = createMockWebhookFunctions({
				body: mockBody,
				staticData: {}, // no webhookSecret
			});

			const node = new MailhooksTrigger();
			const result = await node.webhook.call(mockContext);

			expect(result).toEqual({
				workflowData: [[{ json: mockBody }]],
			});
		});

		it('should reject with 401 when signature does not match stored secret', async () => {
			const mockBody = { id: 'em_123', from: 'test@example.com', subject: 'Test' };
			const mockContext = createMockWebhookFunctions({
				body: mockBody,
				headers: { 'x-webhook-signature': 'invalid_signature' },
				staticData: { webhookSecret: 'whsec_testsecret' },
			});

			const node = new MailhooksTrigger();
			const result = await node.webhook.call(mockContext);

			expect(result).toEqual({
				webhookResponse: { statusCode: 401, body: { error: 'Invalid signature' } },
			});
		});

		it('should pass through when signature verifies with stored webhook secret', async () => {
			const secret = 'whsec_testsecret1234567890123456789012';
			const mockBody = { id: 'em_123', from: 'test@example.com', subject: 'Test' };
			const rawBody = JSON.stringify(mockBody);
			const validSignature = await computeSignature(rawBody, secret);

			const mockContext = createMockWebhookFunctions({
				body: mockBody,
				headers: { 'x-webhook-signature': validSignature },
				staticData: { webhookSecret: secret },
			});

			const node = new MailhooksTrigger();
			const result = await node.webhook.call(mockContext);

			expect(result).toEqual({
				workflowData: [[{ json: mockBody }]],
			});
		});
	});
});