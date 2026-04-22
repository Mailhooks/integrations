import type { EmailFilter } from '@mailhooks/sdk';

export interface FilterFlags {
  from?: string;
  to?: string;
  subject?: string;
  since?: string;
  until?: string;
  read?: boolean;
  unread?: boolean;
}

export function buildFilter(flags: FilterFlags): EmailFilter | undefined {
  const filter: EmailFilter = {};
  if (flags.from) filter.from = flags.from;
  if (flags.to) filter.to = flags.to;
  if (flags.subject) filter.subject = flags.subject;
  if (flags.since) filter.startDate = normaliseDate(flags.since);
  if (flags.until) filter.endDate = normaliseDate(flags.until);
  if (flags.read && flags.unread) {
    throw new Error('Cannot pass both --read and --unread');
  }
  if (flags.read) filter.read = true;
  if (flags.unread) filter.read = false;
  return Object.keys(filter).length ? filter : undefined;
}

function normaliseDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }
  return d.toISOString();
}
