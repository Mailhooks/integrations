#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { Command } from 'commander';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { MailhooksMCPServer } from './server.js';

const program = new Command()
  .name('mcp-mailhooks')
  .description('Mailhooks MCP server — full API coverage for AI assistants')
  .version('2.0.0')
  .option(
    '--transport <type>',
    'Transport mode: stdio or sse (default: stdio)',
    'stdio',
  )
  .option(
    '--port <number>',
    'Port for SSE transport (default: 4000)',
    '4000',
  );

program.parse();
const opts = program.opts();

const apiKey = process.env.MAILHOOKS_API_KEY;
if (!apiKey) {
  console.error('Error: MAILHOOKS_API_KEY environment variable is required');
  process.exit(1);
}

const apiUrl = process.env.MAILHOOKS_API_URL;

async function startStdio() {
  const mcpServer = new MailhooksMCPServer(apiKey!, apiUrl);
  const transport = new StdioServerTransport();
  await mcpServer.getServer().connect(transport);
  console.error('Mailhooks MCP server running on stdio');
}

async function startSSE(port: number) {
  const app = createMcpExpressApp();

  const transports: Map<string, SSEServerTransport> = new Map();

  app.get('/sse', async (_req, res) => {
    const mcpServer = new MailhooksMCPServer(apiKey!, apiUrl);
    const transport = new SSEServerTransport('/messages', res);
    const sessionId = transport.sessionId;
    transports.set(sessionId, transport);
    await mcpServer.getServer().connect(transport);
    console.error(`SSE client connected: ${sessionId}`);

    transport.onclose = () => {
      transports.delete(sessionId);
      console.error(`SSE client disconnected: ${sessionId}`);
    };
  });

  app.post('/messages', async (req, res) => {
    const sessionId = req.query.sessionId as string;
    const transport = sessionId ? transports.get(sessionId) : transports.values().next().value;
    if (transport) {
      await transport.handlePostMessage(req, res, req.body);
    } else {
      res.status(503).json({ error: 'No active SSE connection' });
    }
  });

  app.listen(port, () => {
    console.error(`Mailhooks MCP server (SSE) listening on port ${port}`);
    console.error(`  SSE endpoint:  http://localhost:${port}/sse`);
    console.error(`  POST endpoint: http://localhost:${port}/messages`);
  });
}

const transport = opts.transport as string;
const port = parseInt(opts.port as string, 10);

if (transport === 'sse') {
  startSSE(port).catch((err) => {
    console.error('Failed to start SSE server:', err);
    process.exit(1);
  });
} else if (transport === 'stdio') {
  startStdio().catch((err) => {
    console.error('Failed to start stdio server:', err);
    process.exit(1);
  });
} else {
  console.error(`Unknown transport: ${transport}. Use "stdio" or "sse".`);
  process.exit(1);
}