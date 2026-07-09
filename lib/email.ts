import { Resend } from "resend";

/**
 * Branded pitch email for AutoDeck. Built email-safe on purpose: inline styles,
 * table layout, web-safe fonts (Anton/Inter never load in mail clients), and the
 * video shipped as a LINK — never an attachment — so deliverability stays clean.
 */
export interface PitchEmailContent {
  firstName: string;
  company: string;
  senderName: string;
  shareUrl: string;
  posterUrl: string;
}

export interface SendPitchEmailInput extends PitchEmailContent {
  to: string;
}

export interface SendPitchEmailResult {
  sent: boolean;
  skipped?: boolean;
  id?: string;
  error?: string;
}

/** AutoDeck editorial palette, hard-coded because email clients strip CSS vars. */
const BG = "#F7F7F5";
const INK = "#111111";
const ORANGE = "#FF6500";
const MUTED = "#6B6B68";
const HAIRLINE = "#E3E3DF";
const WHITE = "#FFFFFF";
const FONT = "Arial, Helvetica, sans-serif";
const CONTENT_WIDTH = 560;

const DEFAULT_FROM = "AutoDeck <onboarding@resend.dev>";

/** Escape values interpolated into HTML so a stray angle bracket can't break markup. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function autodeckEmailHtml(p: PitchEmailContent): string {
  const firstName = escapeHtml(p.firstName);
  const company = escapeHtml(p.company);
  const senderName = escapeHtml(p.senderName);
  const shareUrl = escapeHtml(p.shareUrl);
  const posterUrl = escapeHtml(p.posterUrl);

  const preheader = `A 60-second pitch, made just for ${company}.`;

  return `<!-- preheader --><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${BG};font-size:1px;line-height:1px;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${BG};margin:0;padding:0;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="${CONTENT_WIDTH + 40}" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:${CONTENT_WIDTH + 40}px;background-color:${BG};border:1px solid ${HAIRLINE};">
        <tr>
          <td style="padding:28px 28px 0 28px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="left" style="font-family:${FONT};font-size:22px;font-weight:bold;letter-spacing:0.22em;text-transform:uppercase;color:${INK};">AUTODECK</td>
                <td align="right" style="font-family:${FONT};font-size:10px;font-weight:bold;letter-spacing:0.24em;text-transform:uppercase;color:${MUTED};">GTM Autopilot</td>
              </tr>
            </table>
            <div style="height:1px;line-height:1px;font-size:1px;background-color:${INK};margin-top:20px;">&nbsp;</div>
          </td>
        </tr>

        <tr>
          <td style="padding:26px 28px 0 28px;">
            <div style="font-family:${FONT};font-size:11px;font-weight:bold;letter-spacing:0.22em;text-transform:uppercase;color:${ORANGE};">01 — Your pitch</div>
            <h1 style="margin:12px 0 0 0;font-family:${FONT};font-size:30px;line-height:1.08;font-weight:bold;letter-spacing:-0.01em;color:${INK};">A 60-second pitch for ${company}, ${firstName}.</h1>
          </td>
        </tr>

        <tr>
          <td style="padding:24px 28px 0 28px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${INK};">
              <tr>
                <td style="font-size:0;line-height:0;">
                  <a href="${shareUrl}" target="_blank" style="text-decoration:none;">
                    <img src="${posterUrl}" width="${CONTENT_WIDTH}" alt="Play the video" style="display:block;width:100%;max-width:${CONTENT_WIDTH}px;height:auto;border:0;outline:none;text-decoration:none;" />
                  </a>
                </td>
              </tr>
              <tr>
                <td align="center" bgcolor="${INK}" style="background-color:${INK};padding:12px 16px;">
                  <a href="${shareUrl}" target="_blank" style="font-family:${FONT};font-size:13px;font-weight:bold;letter-spacing:0.16em;text-transform:uppercase;color:${WHITE};text-decoration:none;"><span style="color:${ORANGE};">&#9654;</span>&nbsp;&nbsp;Play the 60-second pitch</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:24px 28px 0 28px;font-family:${FONT};font-size:15px;line-height:1.6;color:${INK};">
            <p style="margin:0 0 12px 0;">Hi ${firstName},</p>
            <p style="margin:0;">I recorded you a quick, personalized demo — 60 seconds, made just for ${company}. It walks through exactly why I think this is worth your time. Hit play whenever you have a minute.</p>
          </td>
        </tr>

        <tr>
          <td style="padding:24px 28px 4px 28px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" bgcolor="${ORANGE}" style="background-color:${ORANGE};border-radius:2px;">
                  <a href="${shareUrl}" target="_blank" style="display:inline-block;padding:15px 30px;font-family:${FONT};font-size:15px;font-weight:bold;letter-spacing:0.02em;color:${WHITE};text-decoration:none;">&#9654;&nbsp;&nbsp;Watch your pitch</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:22px 28px 0 28px;">
            <div style="height:1px;line-height:1px;font-size:1px;background-color:${HAIRLINE};">&nbsp;</div>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 28px 28px 28px;font-family:${FONT};font-size:14px;line-height:1.5;color:${INK};">
            <div style="font-weight:bold;">${senderName}</div>
            <div style="color:${MUTED};">${senderName} &middot; AutoDeck</div>
          </td>
        </tr>
      </table>

      <table role="presentation" width="${CONTENT_WIDTH + 40}" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:${CONTENT_WIDTH + 40}px;">
        <tr>
          <td align="center" style="padding:16px 20px 0 20px;font-family:${FONT};font-size:11px;line-height:1.5;color:${MUTED};">
            The video is a link, not an attachment. Sent by AutoDeck.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

export function autodeckEmailText(p: PitchEmailContent): string {
  return [
    "AUTODECK",
    "",
    `A 60-second pitch for ${p.company}, ${p.firstName}.`,
    "",
    `Hi ${p.firstName},`,
    "",
    `I recorded you a quick, personalized demo — 60 seconds, made just for ${p.company}.`,
    "It walks through exactly why I think this is worth your time.",
    "",
    `Watch your pitch: ${p.shareUrl}`,
    "",
    "(It's a link, not an attachment.)",
    "",
    `— ${p.senderName} · AutoDeck`,
  ].join("\n");
}

export async function sendPitchEmail(
  p: SendPitchEmailInput,
): Promise<SendPitchEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, skipped: true };

  const from = process.env.EMAIL_FROM ?? DEFAULT_FROM;
  const resend = new Resend(apiKey);

  try {
    const result = await resend.emails.send({
      from,
      to: p.to,
      subject: `A pitch for ${p.company}, ${p.firstName} 🎬`,
      html: autodeckEmailHtml(p),
      text: autodeckEmailText(p),
    });
    if (result.error) return { sent: false, error: result.error.message };
    return { sent: true, id: result.data.id };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : "send failed" };
  }
}
