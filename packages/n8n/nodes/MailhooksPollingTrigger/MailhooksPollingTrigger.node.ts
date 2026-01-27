import type {
	IPollFunctions,
	INodeType,
	INodeTypeDescription,
	INodeExecutionData,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeApiError } from 'n8n-workflow';
import { Mailhooks as MailhooksSDK } from '@mailhooks/sdk';

export class MailhooksPollingTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Mailhooks Polling Trigger',
		name: 'mailhooksPollingTrigger',
		icon: 'file:mailhooks-logo.png',
		group: ['trigger'],
		version: 1,
		subtitle: 'Poll for new emails',
		description: 'Starts the workflow when new emails are received (polling)',
		defaults: {
			name: 'Mailhooks Polling Trigger',
		},
		credentials: [
			{
				name: 'mailhooksApi',
				required: true,
			},
		],
		polling: true,
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		properties: [
			{
				displayName: 'Filter Options',
				name: 'filterOptions',
				type: 'collection',
				placeholder: 'Add Filter',
				default: {},
				options: [
					{
						displayName: 'From',
						name: 'from',
						type: 'string',
						default: '',
						description: 'Filter emails by sender address (partial match)',
					},
					{
						displayName: 'To',
						name: 'to',
						type: 'string',
						default: '',
						description: 'Filter emails by recipient address (partial match)',
					},
					{
						displayName: 'Subject',
						name: 'subject',
						type: 'string',
						default: '',
						description: 'Filter emails by subject (partial match)',
					},
				],
			},
		],
		usableAsTool: true,
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const credentials = await this.getCredentials('mailhooksApi');
		const filterOptions = this.getNodeParameter('filterOptions', {}) as {
			from?: string;
			to?: string;
			subject?: string;
		};

		const mailhooks = new MailhooksSDK({
			apiKey: credentials.apiKey as string,
			baseUrl: credentials.baseUrl as string,
		});

		// Get the last poll time from workflow static data
		const webhookData = this.getWorkflowStaticData('node');
		const lastPollTime = webhookData.lastPollTime as string | undefined;
		const processedIds = (webhookData.processedIds as string[]) || [];

		const now = new Date();

		// First run: set lastPollTime to now and return nothing
		// This ensures only emails received AFTER workflow activation are processed
		if (!lastPollTime) {
			webhookData.lastPollTime = now.toISOString();
			return null;
		}

		// Build filter using last poll time
		const filter: {
			from?: string;
			to?: string;
			subject?: string;
			startDate?: string;
		} = {
			startDate: lastPollTime,
		};

		if (filterOptions.from) filter.from = filterOptions.from;
		if (filterOptions.to) filter.to = filterOptions.to;
		if (filterOptions.subject) filter.subject = filterOptions.subject;

		try {
			const response = await mailhooks.emails.list({
				filter,
				sort: { field: 'createdAt', order: 'asc' },
				perPage: 100,
			});

			// Update last poll time for next iteration
			webhookData.lastPollTime = now.toISOString();

			if (response.data.length === 0) {
				return null;
			}

			// Filter out already processed emails by ID
			const newEmails = response.data.filter(
				(email) => !processedIds.includes(email.id)
			);

			if (newEmails.length === 0) {
				return null;
			}

			// Update processed IDs - keep only recent ones to avoid memory bloat
			// Keep IDs from current batch plus last 100 to handle edge cases
			const newProcessedIds = [
				...newEmails.map((email) => email.id),
				...processedIds.slice(0, 100),
			];
			webhookData.processedIds = newProcessedIds;

			return [
				newEmails.map((email) => ({
					json: {
						id: email.id,
						from: email.from,
						to: email.to,
						subject: email.subject,
						read: email.read,
						createdAt: email.createdAt,
						attachments: email.attachments,
						usesCustomStorage: email.usesCustomStorage,
						storageConfig: email.storageConfig,
						storagePath: email.storagePath,
					},
				})),
			];
		} catch (error) {
			throw new NodeApiError(this.getNode(), {
				message: `Failed to poll for emails: ${(error as Error).message}`,
			});
		}
	}
}
