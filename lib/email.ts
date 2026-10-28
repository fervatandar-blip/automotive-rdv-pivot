import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_EMAIL = process.env.EMAIL_FROM ?? "RDV <onboarding@resend.dev>";

/**
 * Escapes user-controlled text (garage names, client names, service names)
 * before interpolating it into an email's HTML body -- otherwise a garage
 * could name itself `<a href=...>` and have that rendered in other people's
 * inboxes.
 */
export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!resend) {
    console.log(
      `[email:mock] to=${to}\n[email:mock] subject=${subject}\n[email:mock] body:\n${html}\n`
    );
    return;
  }

  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    html,
  });

  if (error) {
    console.error("[email] failed to send:", error);
  }
}
