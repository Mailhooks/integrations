import type {
	IHookFunctions,
	IWebhookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookResponseData,
	IDataObject,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';
import { verifyWebhookSignature, parseWebhookPayload } from '@mailhooks/sdk';

export class MailhooksTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Mailhooks Trigger',
		name: 'mailhooksTrigger',
		icon: 'file:mailhooks-logo.svg',
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["event"]}}',
		description: 'Starts the workflow when a Mailhooks webhook event is received',
		defaults: {
			name: 'Mailhooks Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'mailhooksApi',
				required: true,
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				options: [
					{
						name: 'Email Received',
						value: 'email.received',
						description: 'Triggered when a new email is received',
					},
				],
				default: 'email.received',
				description: 'The event to listen for',
			},
			{
				displayName: 'Inbox',
				name: 'inboxId',
				type: 'string',
				default: '',
				description: 'Restrict this trigger to a specific inbox (leave empty for all inboxes)',
			},
			{
				displayName: 'Webhook Secret',
				name: 'webhookSecret',
				type: 'string',
				typeOptions: { password: true },
				default: '',
				description: 'The webhook secret from your Mailhooks dashboard (starts with whsec_). Leave empty to skip signature verification.',
			},
		],
		usableAsTool: true,
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				const webhookId = webhookData.mailhooksWebhookId as string | undefined;
				if (!webhookId) return false;

				const credentials = await this.getCredentials('mailhooksApi');
				const baseUrl = (credentials.baseUrl as string) || 'https://mailhooks.dev/api';

				try {
					await this.helpers.httpRequest({
						method: 'GET',
						baseURL: baseUrl,
						url: `/v1/webhooks/${webhookId}`,
						headers: {
							'X-API-Key': credentials.apiKey as string,
						},
					});
					return true;
				} catch {
					// Webhook no longer exists on Mailhooks side
					webhookData.mailhooksWebhookId = undefined;
					return false;
				}
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				const webhookData = this.getWorkflowStaticData('node');
				const event = this.getNodeParameter('event') as string;
				const inboxId = this.getNodeParameter('inboxId', '') as string;

				const credentials = await this.getCredentials('mailhooksApi');
				const baseUrl = (credentials.baseUrl as string) || 'https://mailhooks.dev/api';

				const body: Record<string, string | string[] | undefined> = {
					url: webhookUrl,
					events: [event],
				};
				if (inboxId) body.inboxId = inboxId;

				const result = await this.helpers.httpRequest({
					method: 'POST',
					baseURL: baseUrl,
					url: '/v1/webhooks',
					headers: {
						'X-API-Key': credentials.apiKey as string,
						'Content-Type': 'application/json',
					},
					body,
				});

				// Store the webhook ID so we can delete it on deactivation
				webhookData.mailhooksWebhookId = (result as IDataObject).id;
				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				const webhookId = webhookData.mailhooksWebhookId as string | undefined;
				if (!webhookId) return true;

				const credentials = await this.getCredentials('mailhooksApi');
				const baseUrl = (credentials.baseUrl as string) || 'https://mailhooks.dev/api';

				try {
					await this.helpers.httpRequest({
						method: 'DELETE',
						baseURL: baseUrl,
						url: `/v1/webhooks/${webhookId}`,
						headers: {
							'X-API-Key': credentials.apiKey as string,
						},
					});
				} catch {
					// Webhook may already be deleted — that's fine
				}

				webhookData.mailhooksWebhookId = undefined;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const webhookSecret = this.getNodeParameter('webhookSecret', '') as string;
		const req = this.getRequestObject();
		const body = req.body;

		// Verify signature if secret is provided
		if (webhookSecret) {
			const signature = req.headers['x-webhook-signature'] as string;
			const rawBody = typeof body === 'string' ? body : JSON.stringify(body);

			if (!signature || !verifyWebhookSignature(rawBody, signature, webhookSecret)) {
				return {
					webhookResponse: {
						status: 401,
						body: 'Invalid signature',
					},
				};
			}
		}

		// Parse the webhook payload
		const payload = typeof body === 'string' ? parseWebhookPayload(body) : body;

		// Map attachments to include download URLs when provided by the webhook
		const attachments = (payload.attachments ?? []).map((att: IDataObject) => ({
			id: att.id,
			filename: att.filename,
			contentType: att.contentType,
			size: att.size,
			...(att.downloadUrl ? { downloadUrl: att.downloadUrl } : {}),
			...(att.downloadUrlExpiresAt ? { downloadUrlExpiresAt: att.downloadUrlExpiresAt } : {}),
		}));

		return {
			workflowData: [
				[
					{
						json: {
							id: payload.id,
							from: payload.from,
							to: payload.to,
							subject: payload.subject,
							body: payload.body,
							html: payload.html,
							attachments,
							receivedAt: payload.receivedAt,
							spfResult: payload.spfResult,
							dkimResult: payload.dkimResult,
							dmarcResult: payload.dmarcResult,
							authSummary: payload.authSummary,
							headers: payload.headers,
							usesCustomStorage: payload.usesCustomStorage,
							storagePath: payload.storagePath,
							storageConfig: payload.storageConfig,
						},
					},
				],
			],
		};
	}
}