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
		expect(webhook.path).toBe('mailhooks-webhook');
	});

	it('should not expose a webhookSecret parameter to users', () => {
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
});