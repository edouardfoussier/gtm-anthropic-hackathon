export type SignalKind =
  | "job_change"
  | "hiring"
  | "funding"
  | "competitor_engagement";

export interface Signal {
  id: string;
  kind: SignalKind;
  label: string;
}

export interface Contact {
  id: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  linkedin: string;
}

export type RelationshipKind = "signal_source" | "champion" | "decision_maker";

export interface Relationship {
  id: string;
  contactId: string;
  kind: RelationshipKind;
  /** Which signal this relationship was inferred from, if any. */
  signalId?: string;
}

export type QueueStatus = "queued" | "generating" | "ready";

export interface QueueItem {
  id: string;
  companyName: string;
  contact: Contact;
  status: QueueStatus;
  queuedAt: number;
}

export interface Prospect {
  id: string;
  companyName: string;
  signals: Signal[];
  contacts: Contact[];
  relationships: Relationship[];
}
