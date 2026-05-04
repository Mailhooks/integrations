import { MailhooksConfig } from './types';
import { EmailsResource } from './resources/emails';
import { InboxesResource } from './resources/inboxes';
import { RealtimeResource } from './realtime';

export class Mailhooks {
  public emails: EmailsResource;
  public inboxes: InboxesResource;
  public realtime: RealtimeResource;

  constructor(config: MailhooksConfig) {
    this.emails = new EmailsResource(config);
    this.inboxes = new InboxesResource(config);
    this.realtime = new RealtimeResource(config);
  }

  /**
   * Create a new Mailhooks SDK instance
   */
  static create(config: MailhooksConfig): Mailhooks {
    return new Mailhooks(config);
  }
}
