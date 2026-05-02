import type {
	IHookFunctions,
	IWebhookFunctions,
	INodeType,
	INodeTypeDescription,
	IDataObject,
	IWebhookResponseData,
	ILoadOptionsFunctions,
	INodePropertyOptions,
	IHttpRequestOptions,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

async function verifyWebhookSignature(
	payload: string,
	signature: string,
	secret: string,
): Promise<boolean> {
	if (!payload || !signature || !secret) return false;
	const normalizedSignature = signature.trim().toLowerCase();
	if (!/^[a-f0-9]{64}$/.test(normalizedSignature)) return false;

	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign'],
	);
	const sigBuf = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
	const expectedHex = Array.from(new Uint8Array(sigBuf))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');

	if (expectedHex.length !== normalizedSignature.length) return false;
	let mismatch = 0;
	for (let i = 0; i < expectedHex.length; i++) {
		mismatch |= expectedHex.charCodeAt(i) ^ normalizedSignature.charCodeAt(i);
	}
	return mismatch === 0;
}

export class MailhooksTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Mailhooks Trigger',
		name: 'mailhooksTrigger',
		icon: 'file:mailhooks-logo.svg',
		group: ['trigger'],
		version: 2,
		description: 'Receive Mailhooks webhook events',
		defaults: { name: 'Mailhooks Trigger' },
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		subtitle: '={{$parameter?.event || "Email Received"}}',
		credentials: [{ name: 'mailhooksApi', required: true }],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST' as const,
				path: 'mailhooks-webhook',
				responseMode: 'onReceived' as const,
				isAvailable: true,
			},
		],
		properties: [
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				options: [
					{ name: 'Email Received', value: 'email.received' },
					{ name: 'Email Updated', value: 'email.updated' },
				],
				default: ['email.received'],
				description: 'Events to listen for',
			},
			{
				displayName: 'Inbox Name or ID',
				name: 'inboxId',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getInboxes',
				},
				default: '',
				description:
					'Optional: only trigger for emails in a specific inbox. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
		],
		usableAsTool: true,
	};

	methods = {
		loadOptions: {
			async getInboxes(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const credentials = await this.getCredentials('mailhooksApi');
				const baseUrl = (credentials.baseUrl as string) || 'https://mailhooks.dev/api';

				const options: IHttpRequestOptions = {
					method: 'GET',
					url: `${baseUrl}/v1/inboxes`,
				};

				const response = await this.helpers.httpRequestWithAuthentication.call(
					this,
					'mailhooksApi',
					options,
				);

				const inboxes = response?.data ?? response;
				const inboxList = Array.isArray(inboxes) ? inboxes : [];

				return inboxList.map(
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					(inbox: any) => ({
						name: `${inbox.name || inbox.addressPrefix || inbox.address} (${inbox.address})`,
						value: inbox.id,
					}),
				);
			},
		},
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const staticData = this.getWorkflowStaticData('node') as IDataObject;
				const webhookId = staticData.webhookId as string | undefined;
				if (!webhookId) return false;

				const credentials = await this.getCredentials('mailhooksApi');
				const baseUrl = (credentials.baseUrl as string) || 'https://mailhooks.dev/api';

				try {
					const options: IHttpRequestOptions = {
						method: 'GET',
						url: `${baseUrl}/v1/webhooks/${webhookId}`,
					};
					await this.helpers.httpRequestWithAuthentication.call(this, 'mailhooksApi', options);
					return true;
				} catch {
					return false;
				}
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				const staticData = this.getWorkflowStaticData('node') as IDataObject;
				const credentials = await this.getCredentials('mailhooksApi');
				const baseUrl = (credentials.baseUrl as string) || 'https://mailhooks.dev/api';

				const events = this.getNodeParameter('events') as string[];
				const inboxId = this.getNodeParameter('inboxId') as string;

				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const body: any = {
					url: webhookUrl,
					active: true,
					events,
				};

				if (inboxId) {
					body.inboxId = inboxId;
				}

				const options: IHttpRequestOptions = {
					method: 'POST',
					url: `${baseUrl}/v1/webhooks`,
					body,
				};

				const response = await this.helpers.httpRequestWithAuthentication.call(
					this,
					'mailhooksApi',
					options,
				);

				// Store the webhook ID and secret in static data for verification and cleanup
				staticData.webhookId = response.id;
				staticData.webhookSecret = response.secret;

				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const staticData = this.getWorkflowStaticData('node') as IDataObject;
				const webhookId = staticData.webhookId as string | undefined;
				if (!webhookId) return true;

				const credentials = await this.getCredentials('mailhooksApi');
				const baseUrl = (credentials.baseUrl as string) || 'https://mailhooks.dev/api';

				try {
					const options: IHttpRequestOptions = {
						method: 'DELETE',
						url: `${baseUrl}/v1/webhooks/${webhookId}`,
					};
					await this.helpers.httpRequestWithAuthentication.call(this, 'mailhooksApi', options);
				} catch {
					// Webhook may have been deleted outside n8n, that's fine
				}

				// Clear static data
				delete staticData.webhookId;
				delete staticData.webhookSecret;

				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const body = this.getBodyData() as IDataObject;
		const headers = this.getHeaderData() as Record<string, string>;
		const staticData = this.getWorkflowStaticData('node') as IDataObject;

		// Always verify signature using the secret stored when the webhook was created
		const secret = staticData.webhookSecret as string;
		const signature = headers['x-webhook-signature'] || headers['X-Webhook-Signature'] || '';
		const rawBody = JSON.stringify(body);

		if (secret) {
			const isValid = await verifyWebhookSignature(rawBody, signature, secret);
			if (!isValid) {
				return {
					webhookResponse: { statusCode: 401, body: { error: 'Invalid signature' } },
				};
			}
		}

		return {
			workflowData: [[{ json: body }]],
		};
	}
}