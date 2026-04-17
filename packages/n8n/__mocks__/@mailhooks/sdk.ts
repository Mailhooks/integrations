// Mock for @mailhooks/sdk — ESM module that Jest can't transform by default.

export const verifyWebhookSignature = jest.fn(() => true);
export const parseWebhookSignature = jest.fn(() => true);
export const parseWebhookPayload = jest.fn((body: string) => JSON.parse(body));
export const parseEml = jest.fn(() => Promise.resolve({ subject: 'test', from: 'test@test.com' }));
export const constructSignature = jest.fn(() => 'sig');

export class Mailhooks {
	emails = {
		list: jest.fn(() => Promise.resolve({ data: [], currentPage: 1, totalPages: 0, totalItems: 0, perPage: 20, hasNextPage: false })),
		getEmail: jest.fn(() => Promise.resolve({ id: '1', from: 'test@test.com', subject: 'test' })),
		getContent: jest.fn(() => Promise.resolve({ html: '<p>test</p>', text: 'test' })),
		deleteEmail: jest.fn(() => Promise.resolve(undefined)),
		markAsRead: jest.fn(() => Promise.resolve({ id: '1', read: true })),
		markAsUnread: jest.fn(() => Promise.resolve({ id: '1', read: false })),
		downloadEml: jest.fn(() => Promise.resolve({ data: new ArrayBuffer(0), filename: 'test.eml', contentType: 'message/rfc822' })),
		downloadAttachment: jest.fn(() => Promise.resolve({ data: new ArrayBuffer(0), filename: 'test.txt', contentType: 'text/plain' })),
		waitFor: jest.fn(() => Promise.resolve({ id: '1', from: 'test@test.com', subject: 'test' })),
	};
	realtime = {
		subscribe: jest.fn(),
	};
}

export class RealtimeResource {}
export const RealtimeEventType = { EMAIL_RECEIVED: 'email.received' };

export interface WebhookPayload { [key: string]: unknown }
export interface ParsedEmail { [key: string]: unknown }
export interface RealtimeEvent { [key: string]: unknown }
export interface RealtimeCallbacks { [key: string]: unknown }
export interface RealtimeSubscription { [key: string]: unknown }
export interface SubscribeOptions { [key: string]: unknown }
export interface EmailReceivedPayload { [key: string]: unknown }
export interface EmailUpdatedPayload { [key: string]: unknown }
export interface ConnectedPayload { [key: string]: unknown }
export interface HeartbeatPayload { [key: string]: unknown }