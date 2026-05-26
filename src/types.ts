export interface Mailbox {
  id: string;
  address: string;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  mailboxId: string;
  fromText: string;
  fromEmail: string;
  subject: string;
  textBody: string | null;
  htmlBody: string | null;
  messageId: string | null;
  read: boolean;
  createdAt: string;
}
