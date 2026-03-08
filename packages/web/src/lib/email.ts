import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.EMAIL_FROM || "Glop <noreply@glop.dev>";

export async function sendInvitationEmail({
  to,
  inviterName,
  workspaceName,
  signupUrl,
}: {
  to: string;
  inviterName: string;
  workspaceName: string;
  signupUrl: string;
}) {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `${inviterName} invited you to join ${workspaceName} on Glop`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
          <h2 style="font-size: 20px; font-weight: 600; margin: 0 0 16px;">You've been invited to ${workspaceName}</h2>
          <p style="color: #555; font-size: 14px; line-height: 1.6; margin: 0 0 8px;">
            <strong>${inviterName}</strong> has invited you to join the <strong>${workspaceName}</strong> workspace on Glop.
          </p>
          <p style="color: #555; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
            Sign up or log in to accept the invitation. You'll be automatically added to the workspace.
          </p>
          <a href="${signupUrl}" style="display: inline-block; background: #171717; color: #fff; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500;">
            Accept Invitation
          </a>
          <p style="color: #999; font-size: 12px; margin-top: 32px;">
            This invitation expires in 7 days. If you weren't expecting this email, you can safely ignore it.
          </p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Failed to send invitation email:", error);
    // Don't throw — invitation is still created in DB even if email fails
  }
}

export async function sendAccessRequestEmail({
  to,
  requesterName,
  requesterEmail,
  sessionTitle,
  runUrl,
}: {
  to: string;
  requesterName: string;
  requesterEmail: string;
  sessionTitle: string;
  runUrl: string;
}) {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `${requesterName} requested access to your session`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
          <h2 style="font-size: 20px; font-weight: 600; margin: 0 0 16px;">Access request</h2>
          <p style="color: #555; font-size: 14px; line-height: 1.6; margin: 0 0 8px;">
            <strong>${requesterName}</strong> (${requesterEmail}) has requested access to your session:
          </p>
          <p style="color: #555; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
            <strong>${sessionTitle}</strong>
          </p>
          <a href="${runUrl}" style="display: inline-block; background: #171717; color: #fff; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500;">
            View Session
          </a>
          <p style="color: #999; font-size: 12px; margin-top: 32px;">
            You can share this session or add the requester to your workspace from the session page.
          </p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Failed to send access request email:", error);
    // Don't throw — access request is still created in DB even if email fails
  }
}
