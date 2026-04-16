// Mock for n8n-workflow types used in n8n community node tests.
// n8n-workflow is a peer dependency and not installed in test environment.

export const NodeConnectionTypes = {
	Main: 'main',
};

export class NodeOperationError extends Error {
	constructor(node: unknown, error: Error | string) {
		super(typeof error === 'string' ? error : error.message);
		this.name = 'NodeOperationError';
	}
}

export class NodeApiError extends Error {
	constructor(node: unknown, error: { message: string }) {
		super(error.message);
		this.name = 'NodeApiError';
	}
}