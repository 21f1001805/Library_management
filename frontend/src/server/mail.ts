import nodemailer from 'nodemailer';

import { env } from '@/server/env';

// Mirrors backend/src/app/core/mail.py. Node's I/O is already non-blocking, so there's
// no equivalent needed for the Python version's asyncio.to_thread wrapper.
const SMTP_TIMEOUT_MS = 10_000;

export async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  if (!env.SMTP_HOST) {
    // No SMTP configured — log instead of failing so the reminder flow still works
    // end-to-end in dev. Email bodies can contain password-reset bearer tokens, so only
    // the subject is logged, never the body.
    console.info(`email not configured, skipping send: to=${to} subject=${JSON.stringify(subject)}`);
    return;
  }

  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: false,
    requireTLS: env.SMTP_USE_TLS,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    connectionTimeout: SMTP_TIMEOUT_MS,
  });

  await transport.sendMail({
    from: env.SMTP_FROM || env.SMTP_USER,
    to,
    subject,
    text: body,
  });
}
