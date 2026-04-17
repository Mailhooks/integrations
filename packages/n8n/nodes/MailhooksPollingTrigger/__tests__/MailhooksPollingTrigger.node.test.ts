import { MailhooksPollingTrigger } from '../MailhooksPollingTrigger.node';

describe('MailhooksPollingTrigger', () => {
	it('should have the correct node name', () => {
		const node = new MailhooksPollingTrigger();
		expect(node.description.name).toBe('mailhooksPollingTrigger');
	});

	it('should have the correct display name', () => {
		const node = new MailhooksPollingTrigger();
		expect(node.description.displayName).toBe('Mailhooks Polling Trigger');
	});

	it('should be a trigger node (no inputs)', () => {
		const node = new MailhooksPollingTrigger();
		expect(node.description.inputs).toEqual([]);
	});

	it('should have main output', () => {
		const node = new MailhooksPollingTrigger();
		expect(node.description.outputs).toBeDefined();
	});

	it('should be usable as a tool', () => {
		const node = new MailhooksPollingTrigger();
		expect(node.description.usableAsTool).toBe(true);
	});

	it('should require mailhooksApi credentials', () => {
		const node = new MailhooksPollingTrigger();
		expect(node.description.credentials).toBeDefined();
		const creds = node.description.credentials as Array<{ name: string; required: boolean }>;
		expect(creds[0].name).toBe('mailhooksApi');
		expect(creds[0].required).toBe(true);
	});

	it('should have filterOptions parameter', () => {
		const node = new MailhooksPollingTrigger();
		const propNames = node.description.properties.map((p) => p.name);
		expect(propNames).toContain('filterOptions');
	});

	it('should be marked as polling', () => {
		const node = new MailhooksPollingTrigger();
		expect(node.description.polling).toBe(true);
	});

	it('should have a poll method', () => {
		const node = new MailhooksPollingTrigger();
		expect(typeof node.poll).toBe('function');
	});
});