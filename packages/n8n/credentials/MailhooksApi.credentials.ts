import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class MailhooksApi implements ICredentialType {
	name = 'mailhooksApi';
	displayName = 'Mailhooks'; // eslint-disable-line n8n-nodes-base/cred-class-field-display-name-missing-api
	documentationUrl = 'https://mailhooks.dev/docs';
	icon = 'file:mailhooks-logo.png' as const;

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://mailhooks.dev/api',
			description: 'The Mailhooks API base URL',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'X-API-Key': '={{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/v1/inboxes',
		},
	};
}