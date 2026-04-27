import { MailhooksApi } from '../MailhooksApi.credentials';

describe('MailhooksApi credentials', () => {
	it('should have the correct credential name', () => {
		const cred = new MailhooksApi();
		expect(cred.name).toBe('mailhooksApi');
	});

	it('should have the correct display name', () => {
		const cred = new MailhooksApi();
		expect(cred.displayName).toBe('Mailhooks');
	});

	it('should define apiKey and baseUrl properties', () => {
		const cred = new MailhooksApi();
		const propNames = cred.properties.map((p) => p.name);
		expect(propNames).toContain('apiKey');
		expect(propNames).toContain('baseUrl');
	});

	it('should mark apiKey as required', () => {
		const cred = new MailhooksApi();
		const apiKeyProp = cred.properties.find((p) => p.name === 'apiKey');
		expect(apiKeyProp?.required).toBe(true);
	});

	it('should set default baseUrl to Mailhooks production', () => {
		const cred = new MailhooksApi();
		const baseUrlProp = cred.properties.find((p) => p.name === 'baseUrl');
		expect(baseUrlProp?.default).toBe('https://mailhooks.dev/api');
	});

	it('should use generic authentication with X-API-Key header', () => {
		const cred = new MailhooksApi();
		expect(cred.authenticate.type).toBe('generic');
		expect(cred.authenticate.properties).toHaveProperty('headers');
		expect(cred.authenticate.properties.headers).toHaveProperty('X-API-Key');
	});

	it('should have a test request that hits the inboxes endpoint', () => {
		const cred = new MailhooksApi();
		expect(cred.test).toBeDefined();
		expect(cred.test?.request?.url).toBe('/v1/inboxes');
	});

	it('should reference baseUrl in the test request', () => {
		const cred = new MailhooksApi();
		const testRequest = cred.test?.request as { baseURL?: string };
		expect(testRequest.baseURL).toBe('={{$credentials.baseUrl}}');
	});
});