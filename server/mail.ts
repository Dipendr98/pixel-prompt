import nodemailer from 'nodemailer';
import { Resend } from 'resend';

// ─── Email Provider Selection ──────────────────────────────────────────
// Set EMAIL_PROVIDER in your .env to choose:
//   "resend"  → Uses Resend API (recommended for production)
//   "gmail"   → Uses Gmail SMTP with App Password (default)
// ───────────────────────────────────────────────────────────────────────

const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || 'gmail';

// ─── Resend Setup ──────────────────────────────────────────────────────
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// ─── Gmail SMTP Setup ──────────────────────────────────────────────────
export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ─── Unified Send Email Function ───────────────────────────────────────
const defaultFrom = process.env.SMTP_USER
  ? `"PixelPrompt" <${process.env.SMTP_USER}>`
  : '"PixelPrompt" <support@pixel-prompt.app>';

const resendFrom = process.env.RESEND_FROM || 'PixelPrompt <onboarding@resend.dev>';

async function sendEmail(to: string, subject: string, html: string) {
  if (EMAIL_PROVIDER === 'resend' && resend) {
    // ── Use Resend API ──
    const { error } = await resend.emails.send({
      from: resendFrom,
      to,
      subject,
      html,
    });
    if (error) throw new Error(`Resend error: ${error.message}`);
    console.log(`[Mail/Resend] Sent "${subject}" to ${to}`);
  } else {
    // ── Use Gmail SMTP ──
    await transporter.sendMail({ from: defaultFrom, to, subject, html });
    console.log(`[Mail/Gmail] Sent "${subject}" to ${to}`);
  }
}

// ─── Email Templates ───────────────────────────────────────────────────

export async function sendWelcomeEmail(to: string) {
  try {
    await sendEmail(to, "Welcome to PixelPrompt! 🚀", `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to PixelPrompt!</h2>
        <p>Hi there,</p>
        <p>Thank you for signing up. We're excited to have you on board!</p>
        <p>With PixelPrompt, you can build stunning websites powered by AI in seconds.</p>
        <br/>
        <a href="https://pixel-prompt.app" style="background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Go to Dashboard</a>
      </div>
    `);
  } catch (error) {
    console.error(`[Mail Error] Failed to send welcome email to ${to}:`, error);
  }
}

export async function sendPasswordResetEmail(to: string, token: string) {
  try {
    const resetUrl = `https://pixel-prompt.app/reset-password?token=${token}`;
    await sendEmail(to, "Reset your PixelPrompt Password", `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request</h2>
        <p>We received a request to reset your password. Click the button below to set a new one. This link will expire in 1 hour.</p>
        <br/>
        <a href="${resetUrl}" style="background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
        <br/><br/>
        <p style="font-size: 12px; color: #666;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `);
  } catch (error) {
    console.error(`[Mail Error] Failed to send password reset email to ${to}:`, error);
  }
}

export async function sendPaymentSuccessEmail(to: string, amountBaseUnit: number) {
  try {
    const amount = (amountBaseUnit / 100).toFixed(2);
    await sendEmail(to, "Payment Receipt - PixelPrompt Pro", `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Payment Successful! 🎉</h2>
        <p>Thank you for upgrading to PixelPrompt Pro.</p>
        <p>Amount Paid: <strong>₹${amount}</strong></p>
        <p>You now have unlimited AI generations and full export capabilities!</p>
        <br/>
        <a href="https://pixel-prompt.app" style="background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Start Building</a>
      </div>
    `);
  } catch (error) {
    console.error(`[Mail Error] Failed to send payment receipt to ${to}:`, error);
  }
}

export async function sendQueryNotificationToAdmin(queryName: string, queryEmail: string, subject: string, message: string) {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || defaultFrom;
    await sendEmail(adminEmail, `New Contact Query: ${subject}`, `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>New User Query Submitted</h2>
        <p><strong>From:</strong> ${queryName} (${queryEmail})</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <hr/>
        <p>${message}</p>
        <hr/>
        <p>Login to the admin dashboard to reply to this query.</p>
      </div>
    `);
  } catch (error) {
    console.error(`[Mail Error] Failed to send query notification:`, error);
  }
}

export async function sendQueryResponseToUser(to: string, originalSubject: string, replyMessage: string) {
  try {
    await sendEmail(to, `Re: ${originalSubject}`, `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Response to your query</h2>
        <p>Hi,</p>
        <p>An admin has replied to your recent query regarding "${originalSubject}":</p>
        <div style="background: #f4f4f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p>${replyMessage}</p>
        </div>
        <p>Best regards,</p>
        <p>The PixelPrompt Team</p>
      </div>
    `);
  } catch (error) {
    console.error(`[Mail Error] Failed to send query response to ${to}:`, error);
  }
}
