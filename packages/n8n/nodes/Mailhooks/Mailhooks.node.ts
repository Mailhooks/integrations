import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IDataObject,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { Mailhooks as MailhooksSDK, verifyWebhookSignature, parseEml } from '@mailhooks/sdk';

function toDataObject<T>(obj: T): IDataObject {
	return JSON.parse(JSON.stringify(obj)) as IDataObject;
}

export class Mailhooks implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Mailhooks',
		name: 'mailhooks',
		icon: 'file:mailhooks-logo.png',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interact with the Mailhooks API',
		defaults: {
			name: 'Mailhooks',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'mailhooksApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Email',
						value: 'email',
					},
					{
						name: 'Utility',
						value: 'utility',
					},
				],
				default: 'email',
			},
			// Email Operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['email'],
					},
				},
				options: [
					{
						name: 'Download Attachment',
						value: 'downloadAttachment',
						description: 'Download a specific attachment',
						action: 'Download attachment',
					},
					{
						name: 'Download EML',
						value: 'downloadEml',
						description: 'Download email in EML format',
						action: 'Download email as EML',
					},
					{
						name: 'Get',
						value: 'get',
						description: 'Get a specific email by ID',
						action: 'Get email',
					},
					{
						name: 'Get Content',
						value: 'getContent',
						description: 'Get the HTML and text content of an email',
						action: 'Get email content',
					},
					{
						name: 'List',
						value: 'list',
						description: 'List emails with optional filters',
						action: 'List emails',
					},
					{
						name: 'Mark as Read',
						value: 'markAsRead',
						description: 'Mark an email as read',
						action: 'Mark email as read',
					},
					{
						name: 'Mark as Unread',
						value: 'markAsUnread',
						description: 'Mark an email as unread',
						action: 'Mark email as unread',
					},
					{
						name: 'Wait For',
						value: 'waitFor',
						description: 'Wait for an email matching filters',
						action: 'Wait for email',
					},
				],
				default: 'list',
			},
			// Utility Operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['utility'],
					},
				},
				options: [
					{
						name: 'Parse EML',
						value: 'parseEml',
						description: 'Parse raw EML content into structured data',
						action: 'Parse EML file',
					},
					{
						name: 'Verify Webhook',
						value: 'verifyWebhook',
						description: 'Verify a webhook signature',
						action: 'Verify webhook signature',
					},
				],
				default: 'parseEml',
			},
			// Email ID (for get, getContent, markAsRead, markAsUnread, downloadEml)
			{
				displayName: 'Email ID',
				name: 'emailId',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						resource: ['email'],
						operation: ['get', 'getContent', 'markAsRead', 'markAsUnread', 'downloadEml', 'downloadAttachment'],
					},
				},
				description: 'The ID of the email',
			},
			// Attachment ID (for downloadAttachment)
			{
				displayName: 'Attachment ID',
				name: 'attachmentId',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						resource: ['email'],
						operation: ['downloadAttachment'],
					},
				},
				description: 'The ID of the attachment to download',
			},
			// Mark as read option (for get)
			{
				displayName: 'Mark as Read',
				name: 'markAsReadOnGet',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: {
						resource: ['email'],
						operation: ['get'],
					},
				},
				description: 'Whether to mark the email as read when fetching',
			},
			// List filters
			{
				displayName: 'Filters',
				name: 'filters',
				type: 'collection',
				placeholder: 'Add Filter',
				default: {},
				displayOptions: {
					show: {
						resource: ['email'],
						operation: ['list'],
					},
				},
				options: [
					{
						displayName: 'End Date',
						name: 'endDate',
						type: 'dateTime',
						default: '',
						description: 'Filter emails received before this date',
					},
					{
						displayName: 'From',
						name: 'from',
						type: 'string',
						default: '',
						description: 'Filter by sender email address',
					},
					{
						displayName: 'Read Status',
						name: 'read',
						type: 'options',
						options: [
							{ name: 'All', value: '' },
							{ name: 'Read', value: 'true' },
							{ name: 'Unread', value: 'false' },
						],
						default: '',
						description: 'Filter by read status',
					},
					{
						displayName: 'Start Date',
						name: 'startDate',
						type: 'dateTime',
						default: '',
						description: 'Filter emails received after this date',
					},
					{
						displayName: 'Subject',
						name: 'subject',
						type: 'string',
						default: '',
						description: 'Filter by subject',
					},
					{
						displayName: 'To',
						name: 'to',
						type: 'string',
						default: '',
						description: 'Filter by recipient email address',
					},
				],
			},
			// List pagination
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: {
					show: {
						resource: ['email'],
						operation: ['list'],
					},
				},
				options: [
					{
						displayName: 'Page',
						name: 'page',
						type: 'number',
						default: 1,
						description: 'Page number',
					},
					{
						displayName: 'Per Page',
						name: 'perPage',
						type: 'number',
						default: 20,
						description: 'Number of results per page',
					},
					{
						displayName: 'Sort Field',
						name: 'sortField',
						type: 'options',
						options: [
							{ name: 'Created At', value: 'createdAt' },
							{ name: 'From', value: 'from' },
							{ name: 'Subject', value: 'subject' },
						],
						default: 'createdAt',
						description: 'Field to sort by',
					},
					{
						displayName: 'Sort Order',
						name: 'sortOrder',
						type: 'options',
						options: [
							{ name: 'Ascending', value: 'asc' },
							{ name: 'Descending', value: 'desc' },
						],
						default: 'desc',
					},
				],
			},
			// Wait For options
			{
				displayName: 'Wait For Filters',
				name: 'waitForFilters',
				type: 'collection',
				placeholder: 'Add Filter',
				default: {},
				displayOptions: {
					show: {
						resource: ['email'],
						operation: ['waitFor'],
					},
				},
				options: [
					{
						displayName: 'From',
						name: 'from',
						type: 'string',
						default: '',
						description: 'Filter by sender email address',
					},
					{
						displayName: 'To',
						name: 'to',
						type: 'string',
						default: '',
						description: 'Filter by recipient email address',
					},
					{
						displayName: 'Subject',
						name: 'subject',
						type: 'string',
						default: '',
						description: 'Filter by subject',
					},
				],
			},
			{
				displayName: 'Wait For Options',
				name: 'waitForOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				displayOptions: {
					show: {
						resource: ['email'],
						operation: ['waitFor'],
					},
				},
				options: [
					{
						displayName: 'Timeout (Ms)',
						name: 'timeout',
						type: 'number',
						default: 30000,
						description: 'Maximum time to wait for email (in milliseconds)',
					},
					{
						displayName: 'Poll Interval (Ms)',
						name: 'pollInterval',
						type: 'number',
						default: 1000,
						description: 'How often to check for new emails (in milliseconds)',
					},
					{
						displayName: 'Lookback Window (Ms)',
						name: 'lookbackWindow',
						type: 'number',
						default: 10000,
						description: 'Only consider emails from this time window (in milliseconds)',
					},
				],
			},
			// Parse EML input
			{
				displayName: 'EML Content',
				name: 'emlContent',
				type: 'string',
				typeOptions: {
					rows: 10,
				},
				required: true,
				default: '',
				displayOptions: {
					show: {
						resource: ['utility'],
						operation: ['parseEml'],
					},
				},
				description: 'The raw EML content to parse',
			},
			// Verify Webhook inputs
			{
				displayName: 'Payload',
				name: 'webhookPayload',
				type: 'string',
				typeOptions: {
					rows: 5,
				},
				required: true,
				default: '',
				displayOptions: {
					show: {
						resource: ['utility'],
						operation: ['verifyWebhook'],
					},
				},
				description: 'The raw webhook payload body',
			},
			{
				displayName: 'Signature',
				name: 'webhookSignature',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						resource: ['utility'],
						operation: ['verifyWebhook'],
					},
				},
				description: 'The X-Webhook-Signature header value',
			},
			{
				displayName: 'Webhook Secret',
				name: 'webhookSecret',
				type: 'string',
				typeOptions: { password: true },
				required: true,
				default: '',
				displayOptions: {
					show: {
						resource: ['utility'],
						operation: ['verifyWebhook'],
					},
				},
				description: 'Your webhook secret (starts with whsec_)',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		const credentials = await this.getCredentials('mailhooksApi');
		const mailhooks = new MailhooksSDK({
			apiKey: credentials.apiKey as string,
			baseUrl: credentials.baseUrl as string,
		});

		for (let i = 0; i < items.length; i++) {
			try {
				if (resource === 'email') {
					if (operation === 'list') {
						const filters = this.getNodeParameter('filters', i, {}) as {
							from?: string;
							to?: string;
							subject?: string;
							read?: string;
							startDate?: string;
							endDate?: string;
						};
						const options = this.getNodeParameter('options', i, {}) as {
							page?: number;
							perPage?: number;
							sortField?: 'createdAt' | 'from' | 'subject';
							sortOrder?: 'asc' | 'desc';
						};

						const response = await mailhooks.emails.list({
							filter: {
								from: filters.from,
								to: filters.to,
								subject: filters.subject,
								read: filters.read ? filters.read === 'true' : undefined,
								startDate: filters.startDate,
								endDate: filters.endDate,
							},
							page: options.page,
							perPage: options.perPage,
							sort: options.sortField
								? { field: options.sortField, order: options.sortOrder }
								: undefined,
						});

						returnData.push({
							json: toDataObject(response),
						});
					} else if (operation === 'get') {
						const emailId = this.getNodeParameter('emailId', i) as string;
						const markAsRead = this.getNodeParameter('markAsReadOnGet', i) as boolean;
						const email = await mailhooks.emails.getEmail(emailId, markAsRead);
						returnData.push({ json: toDataObject(email) });
					} else if (operation === 'getContent') {
						const emailId = this.getNodeParameter('emailId', i) as string;
						const content = await mailhooks.emails.getContent(emailId);
						returnData.push({ json: toDataObject(content) });
					} else if (operation === 'markAsRead') {
						const emailId = this.getNodeParameter('emailId', i) as string;
						const email = await mailhooks.emails.markAsRead(emailId);
						returnData.push({ json: toDataObject(email) });
					} else if (operation === 'markAsUnread') {
						const emailId = this.getNodeParameter('emailId', i) as string;
						const email = await mailhooks.emails.markAsUnread(emailId);
						returnData.push({ json: toDataObject(email) });
					} else if (operation === 'downloadEml') {
						const emailId = this.getNodeParameter('emailId', i) as string;
						const response = await mailhooks.emails.downloadEml(emailId);
						returnData.push({
							json: {
								filename: response.filename,
								contentType: response.contentType,
							},
							binary: {
								data: await this.helpers.prepareBinaryData(
									Buffer.from(response.data),
									response.filename || `email-${emailId}.eml`,
									response.contentType || 'message/rfc822',
								),
							},
						});
					} else if (operation === 'downloadAttachment') {
						const emailId = this.getNodeParameter('emailId', i) as string;
						const attachmentId = this.getNodeParameter('attachmentId', i) as string;
						const response = await mailhooks.emails.downloadAttachment(emailId, attachmentId);
						returnData.push({
							json: {
								filename: response.filename,
								contentType: response.contentType,
							},
							binary: {
								data: await this.helpers.prepareBinaryData(
									Buffer.from(response.data),
									response.filename || `attachment-${attachmentId}`,
									response.contentType || 'application/octet-stream',
								),
							},
						});
					} else if (operation === 'waitFor') {
						const filters = this.getNodeParameter('waitForFilters', i, {}) as {
							from?: string;
							to?: string;
							subject?: string;
						};
						const options = this.getNodeParameter('waitForOptions', i, {}) as {
							timeout?: number;
							pollInterval?: number;
							lookbackWindow?: number;
						};

						const email = await mailhooks.emails.waitFor({
							filter: filters,
							timeout: options.timeout,
							pollInterval: options.pollInterval,
							lookbackWindow: options.lookbackWindow,
						});
						returnData.push({ json: toDataObject(email) });
					}
				} else if (resource === 'utility') {
					if (operation === 'parseEml') {
						const emlContent = this.getNodeParameter('emlContent', i) as string;
						const parsed = await parseEml(emlContent);
						returnData.push({ json: toDataObject(parsed) });
					} else if (operation === 'verifyWebhook') {
						const payload = this.getNodeParameter('webhookPayload', i) as string;
						const signature = this.getNodeParameter('webhookSignature', i) as string;
						const secret = this.getNodeParameter('webhookSecret', i) as string;

						const isValid = verifyWebhookSignature(payload, signature, secret);
						returnData.push({ json: { valid: isValid } });
					}
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
