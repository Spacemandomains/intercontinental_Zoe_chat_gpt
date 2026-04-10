import { Resend } from 'resend';
import { randomUUID } from 'node:crypto';
import { getConfig } from '../config.js';
import { logger } from '../logger.js';
import type { CanonicalData } from '../data/types.js';

export type LeadType =
  | 'consultation'
  | 'guide'
  | 'rental'
  | 'merchandise'
  | 'donation'
  | 'general';

export interface LeadInput {
  leadType: LeadType;
  name: string;
  email: string;
  message: string;
  destinationId?: string;
  serviceId?: string;
  productId?: string;
}

export interface LeadResult {
  leadId: string;
  status: 'sent' | 'pending' | 'email-skipped';
  paypalLink?: string;
  crispLink?: string;
  summary: string;
}

let resendClient: Resend | undefined;

function getResend(): Resend | undefined {
  if (resendClient) return resendClient;
  const config = getConfig();
  if (!config.RESEND_API_KEY) return undefined;
  resendClient = new Resend(config.RESEND_API_KEY);
  return resendClient;
}

export function resetResendForTests(client?: Resend): void {
  resendClient = client;
}

function buildSummary(input: LeadInput, data: CanonicalData): string {
  const lines: string[] = [];
  lines.push(`Lead type: ${input.leadType}`);
  lines.push(`Name: ${input.name}`);
  lines.push(`Email: ${input.email}`);
  if (input.destinationId) {
    const dest = data.destinations.find((d) => d.id === input.destinationId);
    lines.push(`Destination: ${dest?.name ?? input.destinationId}`);
  }
  if (input.serviceId) {
    const svc = data.services.find((s) => s.id === input.serviceId);
    lines.push(`Service: ${svc?.name ?? input.serviceId}`);
  }
  if (input.productId) {
    const prod = data.products.find((p) => p.id === input.productId);
    lines.push(`Product: ${prod?.title ?? input.productId}`);
  }
  lines.push(``);
  lines.push(`Message:`);
  lines.push(input.message);
  return lines.join('\n');
}

export async function createLead(
  input: LeadInput,
  data: CanonicalData,
): Promise<LeadResult> {
  const leadId = `lead_${randomUUID()}`;
  const config = getConfig();
  const summary = buildSummary(input, data);

  // Resolve PayPal + Crisp links from canonical data
  let paypalLink: string | undefined;
  let crispLink: string | undefined;
  if (input.serviceId) {
    const svc = data.services.find((s) => s.id === input.serviceId);
    if (svc) {
      paypalLink = svc.paypalPaymentLink;
      crispLink = svc.crispChatUrl;
    }
  }
  // Fallback: use the first service's Crisp link if we still don't have one
  if (!crispLink && data.services.length > 0) {
    crispLink = data.services[0].crispChatUrl;
  }

  const resend = getResend();
  if (!resend || !config.LEAD_EMAIL_TO || !config.LEAD_EMAIL_FROM) {
    logger.warn({ leadId }, 'Resend not configured; lead captured but email skipped');
    return {
      leadId,
      status: 'email-skipped',
      paypalLink,
      crispLink,
      summary,
    };
  }

  try {
    await resend.emails.send({
      from: config.LEAD_EMAIL_FROM,
      to: config.LEAD_EMAIL_TO,
      subject: `[Intercontinental Zoe MCP] New ${input.leadType} lead: ${input.name}`,
      text: summary,
      replyTo: input.email,
    });
    logger.info({ leadId, leadType: input.leadType }, 'Lead email sent');
    return {
      leadId,
      status: 'sent',
      paypalLink,
      crispLink,
      summary,
    };
  } catch (err) {
    logger.error({ leadId, err: (err as Error).message }, 'Failed to send lead email');
    return {
      leadId,
      status: 'pending',
      paypalLink,
      crispLink,
      summary,
    };
  }
}
