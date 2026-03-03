import nodemailer from 'nodemailer';

// ─── Gmail SMTP Setup using App Password ───────────────────────────────
// 1. Go to https://myaccount.google.com/security
// 2. Enable 2-Step Verification
// 3. Go to https://myaccount.google.com/apppasswords
// 4. Create an App Password (select "Mail" and "Other")
// 5. Copy the 16-character password (e.g. abcd efgh ijkl mnop)
// 6. Set SMTP_USER = your Gmail address, SMTP_PASS = the 16-char app password
// ────────────────────────────────────────────────────────────────────────

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for 587
  auth: {
    user: process.env.SMTP_USER, // your Gmail address e.g. you@gmail.com
    pass: process.env.SMTP_PASS, // 16-char Google App Password e.g. abcdefghijklmnop
  },
});

const defaultFrom = process.env.SMTP_USER
  ? `"PixelPrompt" <${process.env.SMTP_USER}>`
  : '"PixelPrompt" <support@pixel-prompt.app>';

export async function sendWelcomeEmail(to: string) {
  try {
    await transporter.sendMail({
      from: defaultFrom,
      to,
      subject: "Welcome to PixelPrompt! 🚀",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome to PixelPrompt!</h2>
          <p>Hi there,</p>
          <p>Thank you for signing up. We're excited to have you on board!</p>
          <p>With PixelPrompt, you can build stunning websites powered by AI in seconds.</p>
          <br/>
          <a href="https://pixel-prompt.app" style="background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Go to Dashboard</a>
        </div>
      `,
    });
    console.log(`[Mail] Sent welcome email to ${to}`);
  } catch (error) {
    console.error(`[Mail Error] Failed to send welcome email to ${to}:`, error);
  }
}

export async function sendPasswordResetEmail(to: string, token: string) {
  try {
    const resetUrl = `https://pixel-prompt.app/reset-password?token=${token}`;
    await transporter.sendMail({
      from: defaultFrom,
      to,
      subject: "Reset your PixelPrompt Password",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Reset Request</h2>
          <p>We received a request to reset your password. Click the button below to set a new one. This link will expire in 1 hour.</p>
          <br/>
          <a href="${resetUrl}" style="background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
          <br/> <br/>
          <p style="font-size: 12px; color: #666;">If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    });
    console.log(`[Mail] Sent password reset email to ${to}`);
  } catch (error) {
    console.error(`[Mail Error] Failed to send password reset email to ${to}:`, error);
  }
}

export async function sendPaymentSuccessEmail(to: string, amountBaseUnit: number) {
  try {
    const amount = (amountBaseUnit / 100).toFixed(2);
    await transporter.sendMail({
      from: defaultFrom,
      to,
      subject: "Payment Receipt - PixelPrompt Pro",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Payment Successful! 🎉</h2>
          <p>Thank you for upgrading to PixelPrompt Pro.</p>
          <p>Amount Paid: <strong>₹${amount}</strong></p>
          <p>You now have unlimited AI generations and full export capabilities!</p>
          <br/>
          <a href="https://pixel-prompt.app" style="background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Start Building</a>
        </div>
      `,
    });
    console.log(`[Mail] Sent payment receipt to ${to}`);
  } catch (error) {
    console.error(`[Mail Error] Failed to send payment receipt to ${to}:`, error);
  }
}

export async function sendQueryNotificationToAdmin(queryName: string, queryEmail: string, subject: string, message: string) {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || defaultFrom;

    await transporter.sendMail({
      from: defaultFrom,
      to: adminEmail,
      subject: `New Contact Query: ${subject}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>New User Query Submitted</h2>
          <p><strong>From:</strong> ${queryName} (${queryEmail})</p>
          <p><strong>Subject:</strong> ${subject}</p>
          <hr/>
          <p>${message}</p>
          <hr/>
          <p>Login to the admin dashboard to reply to this query.</p>
        </div>
      `,
    });
    console.log(`[Mail] Sent query notification to admin`);
  } catch (error) {
    console.error(`[Mail Error] Failed to send query notification:`, error);
  }
}

export async function sendQueryResponseToUser(to: string, originalSubject: string, replyMessage: string) {
  try {
    await transporter.sendMail({
      from: defaultFrom,
      to,
      subject: `Re: ${originalSubject}`,
      html: `
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
      `,
    });
    console.log(`[Mail] Sent query response to user ${to}`);
  } catch (error) {
    console.error(`[Mail Error] Failed to send query response to ${to}:`, error);
  }
}
