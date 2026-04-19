import { MailhooksTrigger } from '../MailhooksTrigger.node';

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
		expect(webhook.path).toBe('webhook');
	});

	it('should have a webhookSecret parameter', () => {
		const node = new MailhooksTrigger();
		const propNames = node.description.properties.map((p) => p.name);
		expect(propNames).toContain('webhookSecret');
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
		} as unknown as import('n8n-workflow').IWebhookFunctions;

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
		} as unknown as import('n8n-workflow').IWebhookFunctions;

		const result = await node.webhook.call(mockThis);
		const outputItem = result.workflowData![0][0].json as Record<string, unknown>;
		const attachments = outputItem.attachments as Array<Record<string, unknown>>;

		expect(attachments).toHaveLength(1);
		expect(attachments[0].id).toBe('att-2');
		expect(attachments[0].downloadUrl).toBeUndefined();
		expect(attachments[0].downloadUrlExpiresAt).toBeUndefined();
	});
});
