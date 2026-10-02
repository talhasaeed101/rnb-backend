import nodemailer from "nodemailer";
import { env } from "../config/env.js";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function brandWrapper(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#F8F8F8;font-family:Arial,sans-serif;color:#020A1D;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F8F8F8;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid rgba(2,10,29,0.08);">
        <tr><td style="background:linear-gradient(180deg,#005AFA 0%,#30B1FD 100%);padding:20px 28px;">
          <p style="margin:0;font-size:18px;font-weight:700;color:#ffffff;">RNB Collections</p>
        </td></tr>
        <tr><td style="padding:28px;">${bodyHtml}</td></tr>
        <tr><td style="padding:16px 28px 24px;font-size:12px;color:#787878;">
          If you did not request this, you can ignore this email.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function isSmtpConfigured(): boolean {
  return Boolean(env.smtp.host && env.smtp.user && env.smtp.pass && env.smtp.from);
}

function createTransport() {
  if (!isSmtpConfigured()) {
    throw new Error("SMTP is not configured");
  }
  return nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: {
      user: env.smtp.user,
      pass: env.smtp.pass,
    },
  });
}

async function sendMail(options: {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  bcc?: string | string[];
}) {
  const transporter = createTransport();
  await transporter.sendMail({
    from: `"${env.smtp.fromName}" <${env.smtp.from}>`,
    to: options.to,
    bcc: options.bcc,
    subject: options.subject,
    html: options.html,
    text: options.text,
  });
}

export async function sendVerificationEmail(options: {
  to: string;
  name: string;
  otp: string;
}) {
  const safeName = escapeHtml(options.name || "there");
  const html = brandWrapper(
    "Verify your RNB Collections account",
    `
      <p style="margin:0 0 12px;font-size:16px;">Hi ${safeName},</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#333;">
        Use this code to verify your RNB Collections account. It expires in about 10 minutes.
      </p>
      <p style="margin:0 0 16px;font-size:28px;font-weight:700;letter-spacing:6px;color:#005AFA;">${escapeHtml(options.otp)}</p>
      <p style="margin:0;font-size:13px;color:#787878;">Enter this code on the verification page to continue.</p>
    `,
  );
  await sendMail({
    to: options.to,
    subject: "Verify your RNB Collections account",
    html,
    text: `Hi ${options.name || "there"}, your RNB Collections verification code is ${options.otp}. It expires in about 10 minutes.`,
  });
}

export async function sendPasswordResetEmail(options: {
  to: string;
  name: string;
  otp: string;
}) {
  const safeName = escapeHtml(options.name || "there");
  const html = brandWrapper(
    "Reset your RNB Collections password",
    `
      <p style="margin:0 0 12px;font-size:16px;">Hi ${safeName},</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#333;">
        Use this code to reset your RNB Collections password. It expires in about 10 minutes.
      </p>
      <p style="margin:0 0 16px;font-size:28px;font-weight:700;letter-spacing:6px;color:#005AFA;">${escapeHtml(options.otp)}</p>
      <p style="margin:0;font-size:13px;color:#787878;">Enter this code to continue resetting your password.</p>
    `,
  );
  await sendMail({
    to: options.to,
    subject: "Reset your RNB Collections password",
    html,
    text: `Hi ${options.name || "there"}, your RNB Collections password reset code is ${options.otp}. It expires in about 10 minutes.`,
  });
}

export async function sendOrderEmail(options: {
  to: string;
  name: string;
  orderNumber: string;
  status: string;
  total: number;
}) {
  const safeName = escapeHtml(options.name || "Customer");
  const html = brandWrapper(
    `Order ${options.status}: ${options.orderNumber}`,
    `
      <p style="margin:0 0 12px;font-size:16px;">Hi ${safeName},</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#333;">
        Your order <strong>${options.orderNumber}</strong> status is now: <strong>${options.status}</strong>.
      </p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#333;">
        Total: Rs. ${options.total.toLocaleString()}
      </p>
    `,
  );
  const rnbEmail = env.admin.rnbNotifyEmail;
  try {
    await sendMail({
      to: options.to,
      bcc: rnbEmail || undefined,
      subject: `Order ${options.status}: ${options.orderNumber}`,
      html,
      text: `Hi ${safeName}, your order ${options.orderNumber} is now ${options.status}. Total: Rs. ${options.total}`,
    });
  } catch (err) {
    console.error("Order email error:", err);
  }
}

export async function sendAdminOrderEmail(options: {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  paymentMethod: string;
  total: number;
  itemsCount: number;
}) {
  const adminEmail = env.admin.email;
  const rnbEmail = env.admin.rnbNotifyEmail;

  // Build recipient list: admin + RNB Gmail (deduplicated)
  const recipients = [...new Set([adminEmail, rnbEmail].filter(Boolean))];

  const html = brandWrapper(
    `New Order Received: ${options.orderNumber}`,
    `
      <p style="margin:0 0 12px;font-size:16px;">Hello,</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#333;">
        A new order <strong>${options.orderNumber}</strong> has been placed.
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:16px;">
        <tr><td style="padding:6px 0;color:#555;width:140px;">Customer</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(options.customerName)}</td></tr>
        <tr><td style="padding:6px 0;color:#555;">Email</td><td style="padding:6px 0;">${escapeHtml(options.customerEmail)}</td></tr>
        ${options.customerPhone ? `<tr><td style="padding:6px 0;color:#555;">Phone</td><td style="padding:6px 0;">${escapeHtml(options.customerPhone)}</td></tr>` : ""}
        <tr><td style="padding:6px 0;color:#555;">Payment</td><td style="padding:6px 0;">${escapeHtml(options.paymentMethod)}</td></tr>
        <tr><td style="padding:6px 0;color:#555;">Items</td><td style="padding:6px 0;">${options.itemsCount}</td></tr>
        <tr><td style="padding:6px 0;color:#555;">Total</td><td style="padding:6px 0;font-weight:700;color:#005AFA;">Rs. ${options.total.toLocaleString()}</td></tr>
      </table>
    `,
  );
  try {
    await sendMail({
      to: recipients,
      subject: `New Order: ${options.orderNumber} — ${options.customerName}`,
      html,
      text: `New order ${options.orderNumber} by ${options.customerName} (${options.customerEmail}). Payment: ${options.paymentMethod}. Total: Rs. ${options.total}.`,
    });
  } catch (err) {
    console.error("Admin order email error:", err);
  }
}
