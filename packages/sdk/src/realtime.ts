import { MailhooksConfig } from './types';
import { EventSource as EvtSource } from 'eventsource';

// Auto-polyfill EventSource for Node.js environments
if (typeof globalThis.EventSource === 'undefined') {
  (globalThis as any).EventSource = EvtSource;
}

/**
 * Connection mode for SSE subscriptions
 * - broadcast: All connected clients receive every event (default)
 * - distributed: Only ONE client per API key group receives each event (load balancing)
 */
export type ConnectionMode = 'broadcast' | 'distributed';

/**
 * Event types for push notifications
 */
export enum RealtimeEventType {
  EMAIL_RECEIVED = 'email.received',
  EMAIL_UPDATED = 'email.updated',
  HEARTBEAT = 'heartbeat',
  CONNECTED = 'connected',
}

/**
 * Email received event payload
 */
export interface EmailReceivedPayload {
  id: string;
  from: string;
  to: string[];
  subject: string;
  domainId?: string;
  domain?: string;
  createdAt: string;
  hasAttachments: boolean;
  attachmentCount: number;
}

/**
 * Email updated event payload
 */
export interface EmailUpdatedPayload {
  id: string;
  changes: {
    read?: boolean;
  };
}

/**
 * Connected event payload
 */
export interface ConnectedPayload {
  tenantId: string;
  connectedAt: string;
  mode?: ConnectionMode;
  connectionId?: string;
}

/**
 * Heartbeat event payload
 */
export interface HeartbeatPayload {
  timestamp: string;
}

/**
 * Base realtime event structure
 */
export interface RealtimeEvent<T = unknown> {
  type: RealtimeEventType;
  timestamp: string;
  data: T;
}

/**
 * Callback handlers for realtime events
 */
export interface RealtimeCallbacks {
  onEmailReceived?: (payload: EmailReceivedPayload) => void;
  onEmailUpdated?: (payload: EmailUpdatedPayload) => void;
  onConnected?: (payload: ConnectedPayload) => void;
  onHeartbeat?: (payload: HeartbeatPayload) => void;
  onError?: (error: Error) => void;
  onDisconnect?: () => void;
}

/**
 * Subscription options
 */
export interface SubscribeOptions extends RealtimeCallbacks {
  /**
   * Connection mode (default: 'broadcast')
   * - broadcast: All connected clients receive every event
   * - distributed: Only ONE client per API key group receives each event (load balancing for workers)
   */
  mode?: ConnectionMode;
  /** Auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean;
  /** Reconnect delay in milliseconds (default: 5000) */
  reconnectDelay?: number;
}

/**
 * Subscription handle returned from subscribe()
 */
export interface RealtimeSubscription {
  /** Disconnect from the SSE stream */
  disconnect: () => void;
  /** Whether currently connected */
  isConnected: () => boolean;
}

/**
 * Realtime resource for subscribing to email notifications via SSE
 *
 * @example
 * ```typescript
 * const mailhooks = new Mailhooks({ apiKey: 'your-api-key' });
 *
 * // Subscribe to real-time notifications
 * const subscription = mailhooks.realtime.subscribe({
 *   onEmailReceived: (email) => {
 *     console.log('New email:', email.subject);
 *   },
 *   onError: (error) => {
 *     console.error('Connection error:', error);
 *   },
 * });
 *
 * // Later, disconnect
 * subscription.disconnect();
 * ```
 */
export class RealtimeResource {
  private config: MailhooksConfig;
  private eventSource: EventSource | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(config: MailhooksConfig) {
    this.config = config;
  }

  /**
   * Subscribe to real-time email notifications via Server-Sent Events (SSE)
   *
   * Note: This method requires the EventSource API, which is available in browsers
   * and can be polyfilled in Node.js using packages like 'eventsource'.
   *
   * @param options Subscription options and callbacks
   * @returns Subscription handle with disconnect method
   *
   * @example
   * ```typescript
   * const subscription = mailhooks.realtime.subscribe({
   *   onEmailReceived: (email) => {
   *     console.log('New email from:', email.from);
   *     console.log('Subject:', email.subject);
   *   },
   *   onConnected: () => {
   *     console.log('Connected to real-time notifications');
   *   },
   *   onError: (error) => {
   *     console.error('Error:', error);
   *   },
   *   autoReconnect: true,
   *   reconnectDelay: 5000,
   * });
   *
   * // Disconnect when done
   * subscription.disconnect();
   * ```
   */
  subscribe(options: SubscribeOptions = {}): RealtimeSubscription {
    const {
      mode = 'broadcast',
      onEmailReceived,
      onEmailUpdated,
      onConnected,
      onHeartbeat,
      onError,
      onDisconnect,
      autoReconnect = true,
      reconnectDelay = 5000,
    } = options;

    // Clean up any existing connection before creating a new one
    // This prevents resource leaks if subscribe() is called multiple times
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    // Check if EventSource is available
    if (typeof EventSource === 'undefined') {
      throw new Error(
        'EventSource is not available. In Node.js, install and import the "eventsource" package.'
      );
    }

    const baseUrl = this.config.baseUrl ?? 'https://mailhooks.dev/api';
    const url = `${baseUrl}/v1/realtime/events?mode=${mode}`;

    const apiKey = this.config.apiKey;
    
    const connect = () => {
      // Use custom fetch to add X-API-Key header (works with eventsource v3+)
      // Falls back to token query param for environments without fetch option support
      const urlWithToken = `${url}&token=${encodeURIComponent(apiKey)}`;
      
      const eventSourceOptions = {
        fetch: (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
          fetch(input, {
            ...init,
            headers: {
              ...(init?.headers || {}),
              'X-API-Key': apiKey,
            },
          }),
      };
      
      try {
        // Try with custom fetch first (eventsource v3+)
        this.eventSource = new (EventSource as any)(url, eventSourceOptions);
      } catch {
        // Fall back to URL token for older packages or browsers
        this.eventSource = new EventSource(urlWithToken);
      }

      const es = this.eventSource!;
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as RealtimeEvent;

          switch (data.type) {
            case RealtimeEventType.CONNECTED:
              onConnected?.(data.data as ConnectedPayload);
              break;
            case RealtimeEventType.EMAIL_RECEIVED:
              onEmailReceived?.(data.data as EmailReceivedPayload);
              break;
            case RealtimeEventType.EMAIL_UPDATED:
              onEmailUpdated?.(data.data as EmailUpdatedPayload);
              break;
            case RealtimeEventType.HEARTBEAT:
              onHeartbeat?.(data.data as HeartbeatPayload);
              break;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          onError?.(new Error(`Failed to parse event: ${message}`));
        }
      };

      es.onerror = () => {
        onError?.(new Error('SSE connection error'));

        // Close the connection
        this.eventSource?.close();
        this.eventSource = null;
        onDisconnect?.();

        // Attempt to reconnect if enabled
        if (autoReconnect) {
          // Clear any existing timeout to prevent accumulating multiple pending timeouts
          if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
          }
          this.reconnectTimeout = setTimeout(() => {
            connect();
          }, reconnectDelay);
        }
      };
    };

    // Start the connection
    connect();

    // Return subscription handle
    return {
      disconnect: () => {
        if (this.reconnectTimeout) {
          clearTimeout(this.reconnectTimeout);
          this.reconnectTimeout = null;
        }
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
          onDisconnect?.();
        }
      },
      isConnected: () => {
        return this.eventSource?.readyState === EventSource.OPEN;
      },
    };
  }
}
