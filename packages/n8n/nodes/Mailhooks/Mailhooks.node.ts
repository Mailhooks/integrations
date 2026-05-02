import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IDataObject,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	INodePropertyOptions,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

function toDataObject<T>(obj: T): IDataObject {
	return obj as IDataObject;
}

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

export class Mailhooks implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Mailhooks',
		name: 'mailhooks',
		icon: 'file:mailhooks-logo.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Consume the Mailhooks API',
		defaults: { name: 'Mailhooks' },
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'mailhooksApi', required: true }],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Domain', value: 'domain' },
					{ name: 'Email', value: 'email' },
					{ name: 'Inbox', value: 'inbox' },
					{ name: 'Utility', value: 'utility' },
					{ name: 'Webhook', value: 'webhook' },
				],
				default: 'email',
			},

			// ─── Domain ──────────────────────────────────────────────────────
			{
				displayName: 'Operation', name: 'operation', type: 'options', noDataExpression: true,
				displayOptions: { show: { resource: ['domain'] } },
				options: [
					{ name: 'List', value: 'list', description: 'List all domains', action: 'List domains' },
					{ name: 'Verify', value: 'verify', description: 'Verify a domain MX records', action: 'Verify domain' },
				],
				default: 'list',
			},
			{
				displayName: 'Domain ID', name: 'domainId', type: 'string', required: true, default: '',
				displayOptions: { show: { resource: ['domain'], operation: ['verify'] } },
				description: 'The ID of the domain to verify',
			},

			// ─── Email ───────────────────────────────────────────────────────
			{
				displayName: 'Operation', name: 'operation', type: 'options', noDataExpression: true,
				displayOptions: { show: { resource: ['email'] } },
				options: [
					{ name: 'Delete', value: 'delete', description: 'Delete an email', action: 'Delete email' },
					{ name: 'Download Attachment', value: 'downloadAttachment', description: 'Download a specific attachment', action: 'Download attachment' },
					{ name: 'Download EML', value: 'downloadEml', description: 'Download email in EML format', action: 'Download email as EML' },
					{ name: 'Get', value: 'get', description: 'Get a specific email by ID', action: 'Get email' },
					{ name: 'Get Content', value: 'getContent', description: 'Get the HTML and text content of an email', action: 'Get email content' },
					{ name: 'List', value: 'list', description: 'List emails with optional filters', action: 'List emails' },
					{ name: 'Mark as Read', value: 'markAsRead', description: 'Mark an email as read', action: 'Mark email as read' },
					{ name: 'Mark as Unread', value: 'markAsUnread', description: 'Mark an email as unread', action: 'Mark email as unread' },
				],
				default: 'list',
			},
			{
				displayName: 'Email ID', name: 'emailId', type: 'string', required: true, default: '',
				displayOptions: { show: { resource: ['email'], operation: ['delete', 'get', 'getContent', 'markAsRead', 'markAsUnread', 'downloadEml', 'downloadAttachment'] } },
				description: 'The ID of the email',
			},
			{
				displayName: 'Mark as Read on Get', name: 'markAsReadOnGet', type: 'boolean', default: false,
				displayOptions: { show: { resource: ['email'], operation: ['get'] } },
				description: 'Whether to mark the email as read when retrieving it',
			},
			{
				displayName: 'Attachment ID', name: 'attachmentId', type: 'string', required: true, default: '',
				displayOptions: { show: { resource: ['email'], operation: ['downloadAttachment'] } },
				description: 'The ID of the attachment to download',
			},
			{
				displayName: 'Filters', name: 'filters', type: 'collection', placeholder: 'Add Filter', default: {},
				displayOptions: { show: { resource: ['email'], operation: ['list'] } },
				options: [
					{ displayName: 'End Date', name: 'endDate', type: 'dateTime', default: '', description: 'Filter emails received before this date' },
					{ displayName: 'From', name: 'from', type: 'string', default: '', description: 'Filter by sender' },
					{ displayName: 'Read Status', name: 'read', type: 'options', options: [{ name: 'All', value: '' }, { name: 'Read', value: 'true' }, { name: 'Unread', value: 'false' }], default: '', description: 'Filter by read status' },
					{ displayName: 'Start Date', name: 'startDate', type: 'dateTime', default: '', description: 'Filter emails received after this date' },
					{ displayName: 'Subject', name: 'subject', type: 'string', default: '', description: 'Filter by subject' },
					{ displayName: 'To', name: 'to', type: 'string', default: '', description: 'Filter by recipient' },
				],
			},
			{
				displayName: 'Options', name: 'options', type: 'collection', placeholder: 'Add Option', default: {},
				displayOptions: { show: { resource: ['email'], operation: ['list'] } },
				options: [
					{ displayName: 'Page', name: 'page', type: 'number', default: 1, description: 'Page number' },
					{ displayName: 'Per Page', name: 'perPage', type: 'number', default: 20, description: 'Items per page' },
					{ displayName: 'Sort Field', name: 'sortField', type: 'options', options: [{ name: 'Created At', value: 'createdAt' }, { name: 'From', value: 'from' }, { name: 'Subject', value: 'subject' }], default: 'createdAt', description: 'Field to sort by' },
					{ displayName: 'Sort Order', name: 'sortOrder', type: 'options', options: [{ name: 'Ascending', value: 'asc' }, { name: 'Descending', value: 'desc' }], default: 'desc', description: 'Sort direction' },
				],
			},

			// ─── Inbox ───────────────────────────────────────────────────────
			{
				displayName: 'Operation', name: 'operation', type: 'options', noDataExpression: true,
		displayOptions: { show: { resource: ['inbox'] } },
			options: [
					{ name: 'Create', value: 'create', description: 'Create a new inbox', action: 'Create inbox' },
					{ name: 'Get', value: 'get', description: 'Get a specific inbox', action: 'Get inbox' },
					{ name: 'List', value: 'list', description: 'List all inboxes', action: 'List inboxes' },
				],
				default: 'list',
			},
			{
				displayName: 'Inbox Name or ID', name: 'inboxId', type: 'options',
				typeOptions: { loadOptionsMethod: 'getInboxes' },
				required: true, default: '',
				displayOptions: { show: { resource: ['inbox'], operation: ['get'] } },
				description: 'The ID of the inbox. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Inbox Name', name: 'inboxName', type: 'string', required: true, default: '',
				displayOptions: { show: { resource: ['inbox'], operation: ['create'] } },
				description: 'Name for the new inbox',
			},
			{
				displayName: 'Domain ID', name: 'inboxDomainId', type: 'string', default: '',
				displayOptions: { show: { resource: ['inbox'], operation: ['create'] } },
				description: 'Optional domain ID to associate with the inbox',
			},

			// ─── Webhook ─────────────────────────────────────────────────────
			{
				displayName: 'Operation', name: 'operation', type: 'options', noDataExpression: true,
				displayOptions: { show: { resource: ['webhook'] } },
				options: [
					{ name: 'Create', value: 'create', description: 'Create a new webhook', action: 'Create webhook' },
					{ name: 'Delete', value: 'delete', description: 'Delete a webhook', action: 'Delete webhook' },
					{ name: 'Get', value: 'get', description: 'Get a specific webhook', action: 'Get webhook' },
					{ name: 'List', value: 'list', description: 'List all webhooks', action: 'List webhooks' },
					{ name: 'Update', value: 'update', description: 'Update a webhook', action: 'Update webhook' },
				],
				default: 'list',
			},
			{
				displayName: 'Webhook ID', name: 'webhookId', type: 'string', required: true, default: '',
				displayOptions: { show: { resource: ['webhook'], operation: ['get', 'update', 'delete'] } },
				description: 'The ID of the webhook',
			},
			{
				displayName: 'Webhook URL', name: 'webhookUrl', type: 'string', required: true, default: '',
				displayOptions: { show: { resource: ['webhook'], operation: ['create'] } },
				description: 'The URL to send webhook events to',
			},
			{
				displayName: 'Events', name: 'webhookEvents', type: 'multiOptions',
				options: [{ name: 'Email Received', value: 'email.received' }, { name: 'Email Updated', value: 'email.updated' }],
				default: ['email.received'],
				displayOptions: { show: { resource: ['webhook'], operation: ['create', 'update'] } },
				description: 'Events to subscribe to',
			},
			{
				displayName: 'Inbox Name or ID', name: 'webhookInboxId', type: 'options',
				typeOptions: { loadOptionsMethod: 'getInboxes' },
				default: '',
				displayOptions: { show: { resource: ['webhook'], operation: ['create', 'update'] } },
				description: 'Restrict the webhook to a specific inbox. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Update Fields', name: 'webhookUpdateFields', type: 'collection', placeholder: 'Add Field', default: {},
				displayOptions: { show: { resource: ['webhook'], operation: ['update'] } },
				options: [
					{ displayName: 'URL', name: 'url', type: 'string', default: '', description: 'New webhook URL' },
					{ displayName: 'Active', name: 'active', type: 'boolean', default: true, description: 'Whether the webhook is active' },
				],
			},

			// ─── Utility ─────────────────────────────────────────────────────
			{
				displayName: 'Operation', name: 'operation', type: 'options', noDataExpression: true,
				displayOptions: { show: { resource: ['utility'] } },
				options: [
					{ name: 'Verify Webhook', value: 'verifyWebhook', description: 'Verify a webhook signature', action: 'Verify webhook signature' },
				],
				default: 'verifyWebhook',
			},
			{
				displayName: 'Webhook Payload', name: 'webhookPayload', type: 'string', required: true, default: '',
				displayOptions: { show: { resource: ['utility'], operation: ['verifyWebhook'] } },
				description: 'The raw webhook payload string',
			},
			{
				displayName: 'Webhook Signature', name: 'webhookSignature', type: 'string', required: true, default: '',
				displayOptions: { show: { resource: ['utility'], operation: ['verifyWebhook'] } },
				description: 'The signature from the X-Webhook-Signature header',
			},
			{
				displayName: 'Webhook Secret', name: 'webhookSecret', type: 'string',
																																																										typeOptions: { password: true }, required: true, default: '',
				displayOptions: { show: { resource: ['utility'], operation: ['verifyWebhook'] } },
				description: 'Your webhook secret (starts with whsec_)',
			},
		],
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

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		const credentials = await this.getCredentials('mailhooksApi');
		const baseUrl = (credentials.baseUrl as string) || 'https://mailhooks.dev/api';

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const apiRequest = async (options: IHttpRequestOptions): Promise<any> => {
			return this.helpers.httpRequestWithAuthentication.call(
				this,
				'mailhooksApi',
				{ ...options, url: `${baseUrl}${options.url}` },
			);
		};

		const apiRequestArray = async (options: IHttpRequestOptions): Promise<IDataObject[]> => {
			const result = await apiRequest(options);
			if (Array.isArray(result)) return result as IDataObject[];
			if (result?.data && Array.isArray(result.data)) return result.data as IDataObject[];
			return [toDataObject(result)];
		};

		for (let i = 0; i < items.length; i++) {
			try {
				if (resource === 'domain') {
					if (operation === 'list') {
						const items = await apiRequestArray({ method: 'GET', url: '/v1/domains' });
						for (const item of items) returnData.push({ json: toDataObject(item), pairedItem: { item: i } });
					} else if (operation === 'verify') {
						const domainId = this.getNodeParameter('domainId', i) as string;
						const result = await apiRequest({ method: 'POST', url: `/v1/domains/${domainId}/verify` });
						returnData.push({ json: toDataObject(result), pairedItem: { item: i } });
					}

				} else if (resource === 'email') {
				if (operation === 'list') {
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const filters = this.getNodeParameter('filters', i, {}) as Record<string, any>;
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const listOpts = this.getNodeParameter('options', i, {}) as Record<string, any>;
						const qs: Record<string, string> = {};
						if (filters.from) qs['filter[from]'] = filters.from;
						if (filters.to) qs['filter[to]'] = filters.to;
						if (filters.subject) qs['filter[subject]'] = filters.subject;
						if (filters.read) qs['filter[read]'] = filters.read;
						if (filters.startDate) qs['filter[startDate]'] = filters.startDate;
						if (filters.endDate) qs['filter[endDate]'] = filters.endDate;
						if (listOpts.page) qs.page = String(listOpts.page);
						if (listOpts.perPage) qs.perPage = String(listOpts.perPage);
						if (listOpts.sortField) qs['sort[field]'] = listOpts.sortField;
						if (listOpts.sortOrder) qs['sort[order]'] = listOpts.sortOrder;
						const response = await apiRequest({ method: 'GET', url: '/v1/emails', qs });
						returnData.push({ json: toDataObject(response), pairedItem: { item: i } });

					} else if (operation === 'get') {
						const emailId = this.getNodeParameter('emailId', i) as string;
						const markAsRead = this.getNodeParameter('markAsReadOnGet', i) as boolean;
						const qs: Record<string, string> = {};
						if (markAsRead) qs.markAsRead = 'true';
						const email = await apiRequest({ method: 'GET', url: `/v1/emails/${emailId}`, qs });
						returnData.push({ json: toDataObject(email), pairedItem: { item: i } });

					} else if (operation === 'getContent') {
						const emailId = this.getNodeParameter('emailId', i) as string;
						const content = await apiRequest({ method: 'GET', url: `/v1/emails/${emailId}/content` });
						returnData.push({ json: toDataObject(content), pairedItem: { item: i } });

					} else if (operation === 'delete') {
						const emailId = this.getNodeParameter('emailId', i) as string;
						await apiRequest({ method: 'DELETE', url: `/v1/emails/${emailId}` });
						returnData.push({ json: { deleted: true, emailId }, pairedItem: { item: i } });

					} else if (operation === 'markAsRead') {
						const emailId = this.getNodeParameter('emailId', i) as string;
						const email = await apiRequest({ method: 'PATCH', url: `/v1/emails/${emailId}/read` });
						returnData.push({ json: toDataObject(email), pairedItem: { item: i } });

					} else if (operation === 'markAsUnread') {
						const emailId = this.getNodeParameter('emailId', i) as string;
						const email = await apiRequest({ method: 'PATCH', url: `/v1/emails/${emailId}/unread` });
						returnData.push({ json: toDataObject(email), pairedItem: { item: i } });

				} else if (operation === 'downloadEml') {
					const emailId = this.getNodeParameter('emailId', i) as string;
					const response = await apiRequest({
						method: 'GET', url: `/v1/emails/${emailId}/eml`,
						returnFullResponse: true, encoding: 'arraybuffer',
					});
					const filename = response.headers?.['content-disposition']
						? response.headers['content-disposition'].split('filename=')[1]?.replace(/"/g, '')
						: `email-${emailId}.eml`;
					const binaryData = new Uint8Array(response.body as ArrayBuffer) as unknown as Buffer;
					returnData.push({
						json: { filename, contentType: 'message/rfc822' },
						binary: { data: await this.helpers.prepareBinaryData(binaryData, filename, 'message/rfc822') },
						pairedItem: { item: i },
					});

				} else if (operation === 'downloadAttachment') {
					const emailId = this.getNodeParameter('emailId', i) as string;
					const attachmentId = this.getNodeParameter('attachmentId', i) as string;
					const response = await apiRequest({
						method: 'GET', url: `/v1/emails/${emailId}/attachments/${attachmentId}`,
						returnFullResponse: true, encoding: 'arraybuffer',
					});
					const filename = response.headers?.['content-disposition']
						? response.headers['content-disposition'].split('filename=')[1]?.replace(/"/g, '')
						: `attachment-${attachmentId}`;
					const contentType = (response.headers?.['content-type'] as string) || 'application/octet-stream';
					const binaryData = new Uint8Array(response.body as ArrayBuffer) as unknown as Buffer;
					returnData.push({
						json: { filename, contentType },
						binary: { data: await this.helpers.prepareBinaryData(binaryData, filename, contentType) },
						pairedItem: { item: i },
					});
				}

				} else if (resource === 'inbox') {
					if (operation === 'list') {
						const items = await apiRequestArray({ method: 'GET', url: '/v1/inboxes' });
						for (const item of items) returnData.push({ json: toDataObject(item), pairedItem: { item: i } });
					} else if (operation === 'get') {
						const inboxId = this.getNodeParameter('inboxId', i) as string;
						const result = await apiRequest({ method: 'GET', url: `/v1/inboxes/${inboxId}` });
						returnData.push({ json: toDataObject(result), pairedItem: { item: i } });
					} else if (operation === 'create') {
						const name = this.getNodeParameter('inboxName', i) as string;
						const domainId = this.getNodeParameter('inboxDomainId', i, '') as string;
						const body: IDataObject = { name };
						if (domainId) body.domainId = domainId;
						const result = await apiRequest({ method: 'POST', url: '/v1/inboxes', body });
						returnData.push({ json: toDataObject(result), pairedItem: { item: i } });
					}

				} else if (resource === 'webhook') {
					if (operation === 'list') {
						const items = await apiRequestArray({ method: 'GET', url: '/v1/webhooks' });
						for (const item of items) returnData.push({ json: toDataObject(item), pairedItem: { item: i } });
					} else if (operation === 'get') {
						const webhookId = this.getNodeParameter('webhookId', i) as string;
						const result = await apiRequest({ method: 'GET', url: `/v1/webhooks/${webhookId}` });
						returnData.push({ json: toDataObject(result), pairedItem: { item: i } });
					} else if (operation === 'create') {
						const url = this.getNodeParameter('webhookUrl', i) as string;
						const events = this.getNodeParameter('webhookEvents', i) as string[];
						const inboxId = this.getNodeParameter('webhookInboxId', i, '') as string;
						const body: IDataObject = { url, events };
						if (inboxId) body.inboxId = inboxId;
						const result = await apiRequest({ method: 'POST', url: '/v1/webhooks', body });
						returnData.push({ json: toDataObject(result), pairedItem: { item: i } });
					} else if (operation === 'update') {
						const webhookId = this.getNodeParameter('webhookId', i) as string;
						const updateFields = this.getNodeParameter('webhookUpdateFields', i, {}) as { url?: string; active?: boolean };
						const body: IDataObject = {};
						if (updateFields.url) body.url = updateFields.url;
						if (updateFields.active !== undefined) body.active = updateFields.active;
						const result = await apiRequest({ method: 'PATCH', url: `/v1/webhooks/${webhookId}`, body });
						returnData.push({ json: toDataObject(result), pairedItem: { item: i } });
					} else if (operation === 'delete') {
						const webhookId = this.getNodeParameter('webhookId', i) as string;
						await apiRequest({ method: 'DELETE', url: `/v1/webhooks/${webhookId}` });
						returnData.push({ json: { deleted: true, webhookId }, pairedItem: { item: i } });
					}

				} else if (resource === 'utility') {
					if (operation === 'verifyWebhook') {
						const payload = this.getNodeParameter('webhookPayload', i) as string;
						const signature = this.getNodeParameter('webhookSignature', i) as string;
						const secret = this.getNodeParameter('webhookSecret', i) as string;
						const isValid = await verifyWebhookSignature(payload, signature, secret);
						returnData.push({ json: { valid: isValid }, pairedItem: { item: i } });
					}
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}