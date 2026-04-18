import type { IHookFunctions, IWebhookFunctions } from 'n8n-workflow';
import { MailhooksTrigger } from '../MailhooksTrigger.node';
import { verifyWebhookSignature } from '@mailhooks/sdk';

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
		expect(webhook.responseMode).toBe('onReceived');
		expect(webhook.path).toBe('mailhooks');
	});

	it('should have a webhookSecret parameter', () => {
		const node = new MailhooksTrigger();
		const propNames = node.description.properties.map((p) => p.name);
		expect(propNames).toContain('webhookSecret');
	});

	it('should label webhookSecret as an override field', () => {
		const node = new MailhooksTrigger();
		const secretProp = node.description.properties.find((p) => p.name === 'webhookSecret');
		expect(secretProp?.displayName).toBe('Override Webhook Secret');
	});

	it('should have an event parameter with email.received option', () => {
		const node = new MailhooksTrigger();
		const eventProp = node.description.properties.find((p) => p.name === 'event');
		expect(eventProp).toBeDefined();
		expect(eventProp?.type).toBe('options');
		const optionValues = (eventProp?.options as Array<{ name: string; value: string }>).map(
			(o) => o.value,
		);
		expect(optionValues).toContain('email.received');
	});

	it('should default event to email.received', () => {
		const node = new MailhooksTrigger();
		const eventProp = node.description.properties.find((p) => p.name === 'event');
		expect(eventProp?.default).toBe('email.received');
	});

	it('should implement webhookMethods', () => {
		const node = new MailhooksTrigger();
		expect(node.webhookMethods).toBeDefined();
		expect(node.webhookMethods.default).toBeDefined();
		expect(typeof node.webhookMethods.default.checkExists).toBe('function');
		expect(typeof node.webhookMethods.default.create).toBe('function');
		expect(typeof node.webhookMethods.default.delete).toBe('function');
	});
});

describe('MailhooksTrigger — create()', () => {
	it('should store webhook id and secret from the API response', async () => {
		const node = new MailhooksTrigger();
		const webhookData: Record<string, unknown> = {};

		const mockThis = {
			getNodeWebhookUrl: jest.fn(() => 'https://example.com/webhook/mailhooks/test-uuid'),
			getWorkflowStaticData: jest.fn(() => webhookData),
			getNodeParameter: jest.fn((name: string) => {
				if (name === 'event') return 'email.received';
				if (name === 'inboxId') return '';
				return '';
			}),
			getCredentials: jest.fn(() =>
				Promise.resolve({ apiKey: 'test-key', baseUrl: 'https://mailhooks.dev/api' }),
			),
			helpers: {
				httpRequest: jest.fn(() =>
					Promise.resolve({ id: 'wh_abc123', secret: 'whsec_testsecret' }),
				),
			},
		} as unknown as IHookFunctions;

		await node.webhookMethods.default.create.call(mockThis);

		expect(webhookData.mailhooksWebhookId).toBe('wh_abc123');
		expect(webhookData.mailhooksWebhookSecret).toBe('whsec_testsecret');
	});
});

describe('MailhooksTrigger — webhook()', () => {
	it('should prefer auto-captured secret over override parameter', async () => {
		const node = new MailhooksTrigger();
		(verifyWebhookSignature as jest.Mock).mockReturnValue(true);

		const mockThis = {
			getNodeParameter: jest.fn((name: string, fallback?: unknown) => {
				if (name === 'webhookSecret') return 'whsec_override';
				return fallback ?? '';
			}),
			getRequestObject: jest.fn(() => ({
				body: '{"id":"email-1"}',
				headers: { 'x-webhook-signature': 'sig123' },
			})),
			getWorkflowStaticData: jest.fn(() => ({
				mailhooksWebhookId: 'wh_abc123',
				mailhooksWebhookSecret: 'whsec_autocaptured',
			})),
		} as unknown as IWebhookFunctions;

		const result = await node.webhook.call(mockThis);
		// verifyWebhookSignature should have been called with the auto-captured secret
		expect(verifyWebhookSignature).toHaveBeenCalledWith(
			'{"id":"email-1"}',
			'sig123',
			'whsec_autocaptured',
		);
		expect(result.webhookResponse).toBeUndefined();
	});

	it('should fall back to override secret when auto-captured secret is missing', async () => {
		const node = new MailhooksTrigger();
		(verifyWebhookSignature as jest.Mock).mockReturnValue(true);

		const mockThis = {
			getNodeParameter: jest.fn((name: string, fallback?: unknown) => {
				if (name === 'webhookSecret') return 'whsec_override';
				return fallback ?? '';
			}),
			getRequestObject: jest.fn(() => ({
				body: '{"id":"email-1"}',
				headers: { 'x-webhook-signature': 'sig123' },
			})),
			getWorkflowStaticData: jest.fn(() => ({
				mailhooksWebhookId: 'wh_abc123',
				// No mailhooksWebhookSecret — simulates pre-existing manually created webhook
			})),
		} as unknown as IWebhookFunctions;

		await node.webhook.call(mockThis);

		expect(verifyWebhookSignature).toHaveBeenCalledWith(
			'{"id":"email-1"}',
			'sig123',
			'whsec_override',
		);
	});

	it('should skip signature verification when no secret is available', async () => {
		const node = new MailhooksTrigger();
		(verifyWebhookSignature as jest.Mock).mockClear();

		const mockThis = {
			getNodeParameter: jest.fn((name: string, fallback?: unknown) => {
				if (name === 'webhookSecret') return '';
				return fallback ?? '';
			}),
			getRequestObject: jest.fn(() => ({
				body: '{"id":"email-1"}',
				headers: {},
			})),
			getWorkflowStaticData: jest.fn(() => ({
				mailhooksWebhookId: 'wh_abc123',
				// No mailhooksWebhookSecret either
			})),
		} as unknown as IWebhookFunctions;

		const result = await node.webhook.call(mockThis);
		expect(verifyWebhookSignature).not.toHaveBeenCalled();
		expect(result.webhookResponse).toBeUndefined();
	});

	it('should return 401 when signature is invalid', async () => {
		const node = new MailhooksTrigger();
		(verifyWebhookSignature as jest.Mock).mockReturnValue(false);

		const mockThis = {
			getNodeParameter: jest.fn((name: string, fallback?: unknown) => {
				if (name === 'webhookSecret') return '';
				return fallback ?? '';
			}),
			getRequestObject: jest.fn(() => ({
				body: '{"id":"email-1"}',
				headers: { 'x-webhook-signature': 'badsig' },
			})),
			getWorkflowStaticData: jest.fn(() => ({
				mailhooksWebhookId: 'wh_abc123',
				mailhooksWebhookSecret: 'whsec_autocaptured',
			})),
		} as unknown as IWebhookFunctions;

		const result = await node.webhook.call(mockThis);
		expect(result.webhookResponse).toEqual({ status: 401, body: 'Invalid signature' });
	});
});

describe('MailhooksTrigger — delete()', () => {
	it('should clear both webhook id and secret on delete', async () => {
		const node = new MailhooksTrigger();
		const webhookData: Record<string, unknown> = {
			mailhooksWebhookId: 'wh_abc123',
			mailhooksWebhookSecret: 'whsec_testsecret',
		};

		const mockThis = {
			getWorkflowStaticData: jest.fn(() => webhookData),
			getCredentials: jest.fn(() =>
				Promise.resolve({ apiKey: 'test-key', baseUrl: 'https://mailhooks.dev/api' }),
			),
			helpers: {
				httpRequest: jest.fn(() => Promise.resolve()),
			},
		} as unknown as IHookFunctions;

		await node.webhookMethods.default.delete.call(mockThis);
		expect(webhookData.mailhooksWebhookId).toBeUndefined();
		expect(webhookData.mailhooksWebhookSecret).toBeUndefined();
	});
});

describe('MailhooksTrigger — checkExists()', () => {
	it('should clear both webhook id and secret when webhook is stale (404)', async () => {
		const node = new MailhooksTrigger();
		const webhookData: Record<string, unknown> = {
			mailhooksWebhookId: 'wh_stale',
			mailhooksWebhookSecret: 'whsec_stalesecret',
		};

		const mockThis = {
			getWorkflowStaticData: jest.fn(() => webhookData),
			getCredentials: jest.fn(() =>
				Promise.resolve({ apiKey: 'test-key', baseUrl: 'https://mailhooks.dev/api' }),
			),
			helpers: {
				httpRequest: jest.fn(() => Promise.reject(new Error('404'))),
			},
		} as unknown as IHookFunctions;

		const result = await node.webhookMethods.default.checkExists.call(mockThis);
		expect(result).toBe(false);
		expect(webhookData.mailhooksWebhookId).toBeUndefined();
		expect(webhookData.mailhooksWebhookSecret).toBeUndefined();
	});
});

describe('MailhooksTrigger — webhook attachment download URLs', () => {
	it('should include downloadUrl on attachments when provided in payload', async () => {
		const node = new MailhooksTrigger();

		const mockThis = {
			getNodeParameter: jest.fn((name: string, fallback?: unknown) => {
				if (name === 'webhookSecret') return '';
				return fallback ?? '';
			}),
			getRequestObject: jest.fn(() => ({
				body: {
					id: 'email-1',
					from: 'sender@example.com',
					to: ['recipient@example.com'],
					subject: 'Test',
					body: 'Hello',
					attachments: [
						{
							id: 'att-1',
							filename: 'doc.pdf',
							contentType: 'application/pdf',
							size: 1024,
							downloadUrl: 'https://mailhooks.dev/api/v1/emails/email-1/attachments/att-1/download?token=signed',
							downloadUrlExpiresAt: '2026-04-18T18:00:00Z',
						},
					],
					receivedAt: '2026-04-18T17:00:00Z',
					usesCustomStorage: false,
				},
				headers: {},
			})),
			getWorkflowStaticData: jest.fn(() => ({})),
		} as unknown as IWebhookFunctions;

		const result = await node.webhook.call(mockThis);
		const outputItem = result.workflowData![0][0].json as Record<string, unknown>;
		const attachments = outputItem.attachments as Array<Record<string, unknown>>;

		expect(attachments).toHaveLength(1);
		expect(attachments[0].id).toBe('att-1');
		expect(attachments[0].filename).toBe('doc.pdf');
		expect(attachments[0].downloadUrl).toBe('https://mailhooks.dev/api/v1/emails/email-1/attachments/att-1/download?token=signed');
		expect(attachments[0].downloadUrlExpiresAt).toBe('2026-04-18T18:00:00Z');
	});

	it('should omit downloadUrl when not provided in payload', async () => {
		const node = new MailhooksTrigger();

		const mockThis = {
			getNodeParameter: jest.fn((name: string, fallback?: unknown) => {
				if (name === 'webhookSecret') return '';
				return fallback ?? '';
			}),
			getRequestObject: jest.fn(() => ({
				body: {
					id: 'email-2',
					from: 'sender@example.com',
					to: ['recipient@example.com'],
					subject: 'Test',
					body: 'Hello',
					attachments: [
						{ id: 'att-2', filename: 'file.txt', contentType: 'text/plain', size: 50 },
					],
					receivedAt: '2026-04-18T17:00:00Z',
					usesCustomStorage: false,
				},
				headers: {},
			})),
			getWorkflowStaticData: jest.fn(() => ({})),
		} as unknown as IWebhookFunctions;

		const result = await node.webhook.call(mockThis);
		const outputItem = result.workflowData![0][0].json as Record<string, unknown>;
		const attachments = outputItem.attachments as Array<Record<string, unknown>>;

		expect(attachments).toHaveLength(1);
		expect(attachments[0].id).toBe('att-2');
		expect(attachments[0].downloadUrl).toBeUndefined();
		expect(attachments[0].downloadUrlExpiresAt).toBeUndefined();
	});
});