import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { SITE } from "@/config/site";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  cid: string;
  contentType?: string;
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
}

export async function sendEmail({ to, subject, html, text, attachments }: SendEmailOptions) {
  return transporter.sendMail({
    from: `"${process.env.SMTP_FROM_NAME || SITE.appName}" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
    to,
    subject,
    html,
    text: text || subject,
    attachments: attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
      cid: a.cid,
      contentType: a.contentType,
      contentDisposition: "inline" as const,
    })),
  });
}

/** Send email and log to database */
export async function sendAndLogEmail(
  options: SendEmailOptions & { type: string; preview?: string; metadata?: Record<string, unknown> },
) {
  const { type, preview, metadata, ...emailOptions } = options;
  await sendEmail(emailOptions);
  try {
    await prisma.emailLog.create({
      data: {
        type,
        to: emailOptions.to,
        subject: emailOptions.subject,
        preview: preview || emailOptions.text?.slice(0, 200),
        metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch {
    // logging failure should never break email sending
  }
}
