#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js'
import axios, { AxiosInstance } from 'axios'

interface EmailListParams {
  page?: number
  perPage?: number
  from?: string
  to?: string
  subject?: string
  startDate?: string
  endDate?: string
}

interface WaitForEmailParams {
  from?: string
  to?: string
  subject?: string
  lookbackWindow?: number
  initialDelay?: number
  timeout?: number
  pollInterval?: number
  maxRetries?: number
}

interface Email {
  id: string
  from: string
  to: string[]
  subject: string
  createdAt: string
  text?: string
  html?: string
  headers?: Record<string, string>
  attachments?: Array<{
    filename: string
    contentType: string
    size: number
  }>
}

interface EmailListResponse {
  data: Email[]
  currentPage: number
  perPage: number
  totalItems: number
  totalPages: number
  hasNextPage: boolean
}

interface Domain {
  id: string
  domain: string
  verified: boolean
  enabled: boolean
  createdAt: string
  updatedAt: string
}

class MailhooksAPI {
  private client: AxiosInstance

  constructor(apiKey: string, baseUrl: string = 'https://mailhooks.dev') {
    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
    })
  }

  async listEmails(params: EmailListParams = {}): Promise<EmailListResponse> {
    // Build query params with proper structure for the API
    const queryParams: any = {
      page: params.page,
      perPage: params.perPage,
    }

    // Add filter parameters if provided
    if (params.from || params.to || params.subject || params.startDate || params.endDate) {
      if (params.from) queryParams['filter.from'] = params.from
      if (params.to) queryParams['filter.to'] = params.to
      if (params.subject) queryParams['filter.subject'] = params.subject
      if (params.startDate) queryParams['filter.createdAfter'] = params.startDate
      if (params.endDate) queryParams['filter.createdBefore'] = params.endDate
    }

    const response = await this.client.get('/api/v1/emails', { params: queryParams })
    return response.data
  }

  async waitForEmail(params: WaitForEmailParams = {}): Promise<Email> {
    const {
      from,
      to,
      subject,
      lookbackWindow = 10000,
      initialDelay = 0,
      timeout = 30000,
      pollInterval = 1000,
      maxRetries = null,
    } = params

    const startTime = Date.now()
    let retries = 0
    let lastCheckedTime: Date | null = null

    const checkForEmail = async (isFirstCheck: boolean = false): Promise<Email | null> => {
      try {
        const now = new Date()
        let startDateFilter: string

        if (isFirstCheck && lookbackWindow) {
          startDateFilter = new Date(now.getTime() - lookbackWindow).toISOString()
        } else if (lastCheckedTime) {
          startDateFilter = lastCheckedTime.toISOString()
        } else {
          startDateFilter = new Date(now.getTime() - lookbackWindow).toISOString()
        }

        const searchParams: EmailListParams = {
          from,
          to,
          subject,
          startDate: startDateFilter,
          perPage: 10,
        }

        const response = await this.listEmails(searchParams)
        lastCheckedTime = now

        if (response.data.length > 0) {
          // Return the most recent matching email
          return response.data[0]
        }

        return null
      } catch (error) {
        console.error('Error checking for email:', error)
        return null
      }
    }

    // Check immediately for existing emails
    const existingEmail = await checkForEmail(true)
    if (existingEmail) {
      return existingEmail
    }

    // Apply initial delay if specified
    if (initialDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, initialDelay))
    }

    // Start polling
    while (true) {
      // Check timeout
      if (timeout && Date.now() - startTime > timeout) {
        throw new Error(`Timeout waiting for email after ${timeout}ms`)
      }

      // Check max retries
      if (maxRetries !== null && retries >= maxRetries) {
        throw new Error(`Max retries (${maxRetries}) exceeded waiting for email`)
      }

      // Check for email
      const email = await checkForEmail()
      if (email) {
        return email
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval))
      retries++
    }
  }

  async getEmail(emailId: string): Promise<Email> {
    const [metadataResponse, contentResponse] = await Promise.all([
      this.client.get(`/api/v1/emails/${emailId}`),
      this.client.get(`/api/v1/emails/${emailId}/content`),
    ])

    // Merge metadata and content
    return {
      ...metadataResponse.data,
      text: contentResponse.data.text,
      html: contentResponse.data.html,
    }
  }

  async listDomains(): Promise<Domain[]> {
    const response = await this.client.get('/api/v1/domains')
    return response.data
  }
}

class MailhooksMCPServer {
  private server: Server
  private api: MailhooksAPI

  constructor() {
    this.server = new Server(
      {
        name: 'mcp-mailhooks',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    )

    const apiKey = process.env.MAILHOOKS_API_KEY
    const apiUrl = process.env.MAILHOOKS_API_URL || 'https://mailhooks.dev'

    if (!apiKey) {
      throw new Error('MAILHOOKS_API_KEY environment variable is required')
    }

    this.api = new MailhooksAPI(apiKey, apiUrl)
    this.setupHandlers()
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.getTools(),
    }))

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params

      try {
        switch (name) {
          case 'list_emails':
            return await this.handleListEmails(args)
          case 'read_email':
            return await this.handleReadEmail(args)
          case 'list_domains':
            return await this.handleListDomains(args)
          case 'wait_for_email':
            return await this.handleWaitForEmail(args)
          default:
            throw new Error(`Unknown tool: ${name}`)
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${errorMessage}`,
            },
          ],
        }
      }
    })
  }

  private getTools(): Tool[] {
    return [
      {
        name: 'list_emails',
        description:
          'List emails from your Mailhooks account with optional filtering',
        inputSchema: {
          type: 'object',
          properties: {
            page: {
              type: 'number',
              description: 'Page number (default: 1)',
            },
            perPage: {
              type: 'number',
              description: 'Number of emails per page (default: 20, max: 100)',
            },
            from: {
              type: 'string',
              description: 'Filter by sender email address',
            },
            to: {
              type: 'string',
              description: 'Filter by recipient email address',
            },
            subject: {
              type: 'string',
              description: 'Filter by subject (partial match)',
            },
          },
        },
      },
      {
        name: 'read_email',
        description: 'Read the full content of a specific email by ID',
        inputSchema: {
          type: 'object',
          properties: {
            emailId: {
              type: 'string',
              description: 'The ID of the email to read',
            },
          },
          required: ['emailId'],
        },
      },
      {
        name: 'list_domains',
        description: 'List all domains configured in your Mailhooks account',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'wait_for_email',
        description: 'Wait for an email that matches specific filters. Useful for testing and automation.',
        inputSchema: {
          type: 'object',
          properties: {
            from: {
              type: 'string',
              description: 'Filter by sender email address',
            },
            to: {
              type: 'string',
              description: 'Filter by recipient email address',
            },
            subject: {
              type: 'string',
              description: 'Filter by subject (partial match)',
            },
            lookbackWindow: {
              type: 'number',
              description: 'How far back to look for emails on first check in ms (default: 10000)',
            },
            initialDelay: {
              type: 'number',
              description: 'Delay before starting to poll in ms (default: 0)',
            },
            timeout: {
              type: 'number',
              description: 'Maximum time to wait in ms (default: 30000)',
            },
            pollInterval: {
              type: 'number',
              description: 'Time between checks in ms (default: 1000)',
            },
            maxRetries: {
              type: 'number',
              description: 'Maximum number of polling attempts (default: unlimited)',
            },
          },
        },
      },
    ]
  }

  private async handleListEmails(args: any) {
    const params: EmailListParams = {
      page: args.page || 1,
      perPage: args.perPage || 20,
      from: args.from,
      to: args.to,
      subject: args.subject,
    }

    const response = await this.api.listEmails(params)

    const emailSummaries = response.data
      .map(
        (email) =>
          `📧 ID: ${email.id}
   From: ${email.from}
   To: ${email.to.join(', ')}
   Subject: ${email.subject}
   Received: ${new Date(email.createdAt).toLocaleString()}
`
      )
      .join('\n')

    const summary = `Found ${response.totalItems} emails (Page ${response.currentPage}/${response.totalPages})

${emailSummaries}`

    return {
      content: [
        {
          type: 'text',
          text: summary,
        },
      ],
    }
  }

  private async handleReadEmail(args: any) {
    if (!args.emailId) {
      throw new Error('emailId is required')
    }

    const email = await this.api.getEmail(args.emailId)

    const attachmentInfo = email.attachments?.length
      ? `\nAttachments: ${email.attachments
          .map((a) => `${a.filename} (${a.contentType}, ${a.size} bytes)`)
          .join(', ')}`
      : ''

    const content = `Email Details:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ID: ${email.id}
From: ${email.from}
To: ${email.to.join(', ')}
Subject: ${email.subject}
Received: ${new Date(email.createdAt).toLocaleString()}${attachmentInfo}

Content (Text):
${email.text || '(No text content)'}

${
  email.html
    ? `Content (HTML preview):
${email.html.substring(0, 500)}${email.html.length > 500 ? '...' : ''}`
    : ''
}`

    return {
      content: [
        {
          type: 'text',
          text: content,
        },
      ],
    }
  }

  private async handleListDomains(_args: any) {
    const domains = await this.api.listDomains()

    if (!domains || domains.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'No domains configured in your Mailhooks account.',
          },
        ],
      }
    }

    const domainList = domains
      .map(
        (domain) =>
          `🌐 Domain: ${domain.domain}
   ID: ${domain.id}
   Status: ${domain.enabled ? '✅ Enabled' : '❌ Disabled'}
   Verified: ${domain.verified ? '✅ Yes' : '❌ No'}
   Created: ${new Date(domain.createdAt).toLocaleDateString()}`
      )
      .join('\n\n')

    const summary = `Found ${domains.length} domain${domains.length === 1 ? '' : 's'}:\n\n${domainList}`

    return {
      content: [
        {
          type: 'text',
          text: summary,
        },
      ],
    }
  }

  private async handleWaitForEmail(args: any) {
    const params: WaitForEmailParams = {
      from: args.from,
      to: args.to,
      subject: args.subject,
      lookbackWindow: args.lookbackWindow || 10000,
      initialDelay: args.initialDelay || 0,
      timeout: args.timeout || 30000,
      pollInterval: args.pollInterval || 1000,
      maxRetries: args.maxRetries || null,
    }

    try {
      const startTime = Date.now()
      const email = await this.api.waitForEmail(params)
      const elapsed = Date.now() - startTime

      const attachmentInfo = email.attachments?.length
        ? `\nAttachments: ${email.attachments
            .map((a) => `${a.filename} (${a.contentType}, ${a.size} bytes)`)
            .join(', ')}`
        : ''

      const content = `✅ Email found after ${Math.round(elapsed / 1000)} seconds:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ID: ${email.id}
From: ${email.from}
To: ${email.to.join(', ')}
Subject: ${email.subject}
Received: ${new Date(email.createdAt).toLocaleString()}${attachmentInfo}

Use 'read_email' with ID "${email.id}" to view the full content.`

      return {
        content: [
          {
            type: 'text',
            text: content,
          },
        ],
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      // Provide helpful context based on the error
      let helpText = ''
      if (errorMessage.includes('Timeout')) {
        helpText = '\n\nTip: Try increasing the timeout or checking if your filters are too restrictive.'
      } else if (errorMessage.includes('Max retries')) {
        helpText = '\n\nTip: The email may not exist yet. Try increasing maxRetries or removing this limit.'
      }

      return {
        content: [
          {
            type: 'text',
            text: `❌ Failed to find email: ${errorMessage}${helpText}`,
          },
        ],
      }
    }
  }

  async start() {
    const transport = new StdioServerTransport()
    await this.server.connect(transport)
    console.error('Mailhooks MCP server started')
  }
}

async function main() {
  try {
    const server = new MailhooksMCPServer()
    await server.start()
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

main()
