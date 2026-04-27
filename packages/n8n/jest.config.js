/** @type {import('jest').Config} */
module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	roots: ['<rootDir>/nodes', '<rootDir>/credentials'],
	testMatch: ['**/__tests__/**/*.test.ts'],
	moduleNameMapper: {
		'^n8n-workflow$': '<rootDir>/__mocks__/n8n-workflow.ts',
	},
	transformIgnorePatterns: [
		'node_modules/',
	],
};