export { Mailhooks } from './mailhooks';
export { EmailsResource } from './resources/emails';
export { InboxesResource } from './resources/inboxes';
export * from './types';

// Webhook verification utilities
export {
  verifyWebhookSignature,
  parseWebhookPayload,
  constructSignature,
  type WebhookPayload,
} from './webhooks';

// EML parsing utilities
export { parseEml, type ParsedEmail } from './parseEml';

// Real-time notification utilities
export {
  RealtimeResource,
  RealtimeEventType,
  type RealtimeEvent,
  type RealtimeCallbacks,
  type RealtimeSubscription,
  type SubscribeOptions,
  type EmailReceivedPayload,
  type EmailUpdatedPayload,
  type ConnectedPayload,
  type HeartbeatPayload,
} from './realtime';

// Default export for convenience
import { Mailhooks } from './mailhooks';
export default Mailhooks;
