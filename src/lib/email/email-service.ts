/**
 * Email delivery service using Resend REST API.
 * Gracefully logs to console in development/testing if RESEND_API_KEY is not configured.
 */

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail({ to, subject, html, text }: SendEmailParams): Promise<{ success: boolean; id?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || "Pickleball Matcher <onboarding@resend.dev>";

  if (!apiKey) {
    // In local development or testing environments where RESEND_API_KEY is not provided,
    // log the email details clearly without failing so the application remains fully testable.
    console.info(`[Email Service - Mock Dispatch] To: ${to} | Subject: "${subject}"`);
    return { success: true, id: `mock_${Date.now()}` };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
        text,
      }),
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as { message?: string; name?: string };
      console.error("[Email Service - Delivery Error]", errorData);
      const errorMessage =
        errorData?.message && typeof errorData.message === "string"
          ? errorData.message
          : "Failed to dispatch email via provider.";
      return { success: false, error: errorMessage };
    }

    const data = (await response.json()) as { id?: string };
    return { success: true, id: data.id };
  } catch (error) {
    console.error("[Email Service - Network Error]", error);
    return { success: false, error: "Network error delivering email." };
  }
}

export async function sendPasswordResetEmail({
  to,
  name,
  resetUrl,
}: {
  to: string;
  name: string;
  resetUrl: string;
}) {
  const subject = "Reset your Pickleball Matcher password";
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${subject}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 24px;">
        <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border: 3px solid #000000; box-shadow: 6px 6px 0 #000000; padding: 32px;">
          <h1 style="font-size: 24px; font-weight: 900; text-transform: uppercase; margin-top: 0; letter-spacing: -0.5px;">Pickleball Matcher</h1>
          <p style="font-size: 16px; color: #111111; line-height: 1.5;">Hi ${name},</p>
          <p style="font-size: 16px; color: #111111; line-height: 1.5;">We received a request to reset your password. Click the button below to choose a new password:</p>
          <div style="margin: 32px 0;">
            <a href="${resetUrl}" style="background-color: #ccff00; color: #000000; text-decoration: none; font-weight: 800; font-size: 16px; padding: 14px 28px; border: 2px solid #000000; display: inline-block; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 3px 3px 0 #000000;">Reset Password →</a>
          </div>
          <p style="font-size: 14px; color: #555555; line-height: 1.5;">This link will expire in <strong>1 hour</strong>. If you didn't request a password reset, you can safely ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
          <p style="font-size: 12px; color: #888888; word-break: break-all;">Button not working? Copy and paste this URL into your browser:<br/><a href="${resetUrl}" style="color: #000000;">${resetUrl}</a></p>
        </div>
      </body>
    </html>
  `;
  const text = `Hi ${name},\n\nWe received a request to reset your Pickleball Matcher password. Visit the link below to choose a new password:\n\n${resetUrl}\n\nThis link will expire in 1 hour. If you didn't request this, you can ignore this email.`;

  return sendEmail({ to, subject, html, text });
}

export async function sendEmailVerificationEmail({
  to,
  name,
  verifyUrl,
}: {
  to: string;
  name: string;
  verifyUrl: string;
}) {
  const subject = "Verify your Pickleball Matcher recovery email";
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${subject}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 24px;">
        <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border: 3px solid #000000; box-shadow: 6px 6px 0 #000000; padding: 32px;">
          <h1 style="font-size: 24px; font-weight: 900; text-transform: uppercase; margin-top: 0; letter-spacing: -0.5px;">Pickleball Matcher</h1>
          <p style="font-size: 16px; color: #111111; line-height: 1.5;">Hi ${name},</p>
          <p style="font-size: 16px; color: #111111; line-height: 1.5;">Please confirm that this is your recovery email address so you can use it to reset your password if you ever forget it.</p>
          <div style="margin: 32px 0;">
            <a href="${verifyUrl}" style="background-color: #ccff00; color: #000000; text-decoration: none; font-weight: 800; font-size: 16px; padding: 14px 28px; border: 2px solid #000000; display: inline-block; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 3px 3px 0 #000000;">Verify Email →</a>
          </div>
          <p style="font-size: 14px; color: #555555; line-height: 1.5;">This link will expire in <strong>24 hours</strong>. If you didn't add this recovery email, you can safely ignore this message.</p>
          <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
          <p style="font-size: 12px; color: #888888; word-break: break-all;">Button not working? Copy and paste this URL into your browser:<br/><a href="${verifyUrl}" style="color: #000000;">${verifyUrl}</a></p>
        </div>
      </body>
    </html>
  `;
  const text = `Hi ${name},\n\nPlease confirm your recovery email address for Pickleball Matcher by visiting this link:\n\n${verifyUrl}\n\nThis link will expire in 24 hours.`;

  return sendEmail({ to, subject, html, text });
}

