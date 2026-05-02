import type {
	IPollFunctions,
	INodeType,
	INodeTypeDescription,
	INodeExecutionData,
	IDataObject,
	IHttpRequestOptions,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

export class MailhooksPollingTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Mailhooks Polling Trigger',
		name: 'mailhooksPollingTrigger',
		icon: 'file:mailhooks-logo.svg',
		group: ['trigger'],
		version: 1,
		description: 'Poll Mailhooks for new emails',
		defaults: { name: 'Mailhooks Polling Trigger' },
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		subtitle: '=Poll every {{$parameter.pollInterval || 30}}s',
		credentials: [{ name: 'mailhooksApi', required: true }],
		properties: [
			{
				displayName: 'Inbox ID',
				name: 'inboxId',
				type: 'string',
				default: '',
				description: 'Optional: poll only a specific inbox',
			},
			{
				displayName: 'Poll Interval (Seconds)',
				name: 'pollInterval',
				type: 'number',
				default: 30,
				description: 'How often to check for new emails',
			},
		],
		usableAsTool: true,
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const credentials = await this.getCredentials('mailhooksApi');
		const baseUrl = (credentials.baseUrl as string) || 'https://mailhooks.dev/api';
		const inboxId = this.getNodeParameter('inboxId') as string;

		const options: IHttpRequestOptions = {
			method: 'GET',
			url: inboxId ? `${baseUrl}/v1/inboxes/${inboxId}/emails` : `${baseUrl}/v1/emails`,
			qs: { perPage: '50', 'sort[field]': 'createdAt', 'sort[order]': 'desc' },
		};

		const response = await this.helpers.httpRequestWithAuthentication.call(
			this,
			'mailhooksApi',
			options,
		);

		const emails = response?.data ?? response;
		 
		const emailList = Array.isArray(emails) ? emails : [];

		const lastRunDate = this.getWorkflowStaticData('node').lastRunDate as string | undefined;
		const newEmails = lastRunDate
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			? emailList.filter((e: any) => new Date(e.createdAt) > new Date(lastRunDate))
			: emailList;

		if (newEmails.length === 0) {
			return null;
		}

		this.getWorkflowStaticData('node').lastRunDate = new Date().toISOString();

		return [newEmails.map(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(e: any) => ({ json: e as IDataObject }),
		)];
	}
}