import type {
	IHookFunctions,
	IWebhookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';
import { verifyWebhookSignature, parseWebhookPayload } from '@mailhooks/sdk';

export class MailhooksTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Mailhooks Trigger',
		name: 'mailhooksTrigger',
		icon: 'file:mailhooks-logo.png',
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["event"]}}',
		description: 'Starts the workflow when a Mailhooks webhook event is received',
		defaults: {
			name: 'Mailhooks Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
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
				displayName: 'Webhook Secret',
				name: 'webhookSecret',
				type: 'string',
				typeOptions: { password: true },
				default: '',
				description: 'The webhook secret from your Mailhooks dashboard (starts with whsec_). Leave empty to skip signature verification.',
			},
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
		],
		usableAsTool: true,
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				// Mailhooks webhooks are configured in the dashboard, not via API
				// Always return false to show the webhook URL to the user
				return false;
			},
			async create(this: IHookFunctions): Promise<boolean> {
				// Webhooks are configured manually in the Mailhooks dashboard
				// This method just returns true to proceed
				return true;
			},
			async delete(this: IHookFunctions): Promise<boolean> {
				// Webhooks are managed in the Mailhooks dashboard
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
							attachments: payload.attachments,
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
