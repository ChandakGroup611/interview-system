import { Resend } from 'resend';
import { getServiceSupabase } from './supabase';

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[EMAIL] RESEND_API_KEY not configured. Email sending will fail.');
    return null;
  }
  return new Resend(apiKey);
}

// Sleep helper for retry backoff
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Send PDF report to admin via Resend with retry mechanism
export async function sendReportEmail(candidateName, sessionId, pdfBuffer, finalScore) {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@yourcompany.com';
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'CMIS <onboarding@resend.dev>';
  const resend = getResendClient();

  if (!resend) {
    const reason = 'RESEND_API_KEY not configured';
    console.error(`[EMAIL] ${reason}. Skipping email for session ${sessionId}`);
    return { success: false, reason };
  }

  const scoreColor = finalScore >= 70 ? '🟢' : finalScore >= 50 ? '🟡' : '🔴';
  const htmlContent = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #1a1108 0%, #2a1f10 100%); padding: 30px; border-radius: 12px 12px 0 0;">
        <h1 style="color: #FAF7F2; margin: 0; font-size: 22px;">Interview Report</h1>
        <p style="color: #C9A882; margin: 5px 0 0 0;">Chandak CMIS — Closing Manager Interview System</p>
      </div>
      <div style="background: #FAF7F2; padding: 25px; border: 1px solid #E2D5C3; border-top: none;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #A8875A;">Candidate:</td>
            <td style="padding: 8px 0; font-weight: bold; color: #1A1108;">${candidateName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #A8875A;">Session ID:</td>
            <td style="padding: 8px 0; font-family: monospace; color: #1A1108;">${sessionId}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #A8875A;">Final Score:</td>
            <td style="padding: 8px 0; font-weight: bold; font-size: 18px; color: ${finalScore >= 70 ? '#27ae60' : finalScore >= 50 ? '#f39c12' : '#e74c3c'};">${finalScore.toFixed(1)} / 100</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #A8875A;">Date:</td>
            <td style="padding: 8px 0; color: #1A1108;">${new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
          </tr>
        </table>
      </div>
      <div style="background: #F0EBE1; padding: 20px; border: 1px solid #E2D5C3; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="color: #A8875A; font-size: 13px; margin: 0;">The detailed PDF report is attached. Please review the full transcript and scores in the admin dashboard.</p>
      </div>
    </div>
  `;

  const pdfFilename = `interview-report-${candidateName.replace(/\s+/g, '-').toLowerCase()}-${sessionId.slice(0, 8)}.pdf`;

  // Convert Buffer to base64 for Resend attachment
  const pdfBase64 = Buffer.isBuffer(pdfBuffer)
    ? pdfBuffer.toString('base64')
    : Buffer.from(pdfBuffer).toString('base64');

  // Retry mechanism: 3 attempts with exponential backoff
  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[EMAIL] Attempt ${attempt}/${MAX_RETRIES} — Sending to ${adminEmail} for session ${sessionId}`);

      const { data, error } = await resend.emails.send({
        from: fromEmail,
        to: [adminEmail],
        subject: `${scoreColor} Interview Report: ${candidateName} - Score: ${finalScore.toFixed(1)}/100`,
        html: htmlContent,
        attachments: [
          {
            filename: pdfFilename,
            content: pdfBase64,
          },
        ],
      });

      if (error) {
        throw new Error(error.message || JSON.stringify(error));
      }

      console.log(`[EMAIL] ✅ Sent successfully. Resend ID: ${data?.id}`);
      return { success: true, messageId: data?.id };
    } catch (error) {
      console.error(`[EMAIL] ❌ Attempt ${attempt} failed:`, error.message);

      if (attempt < MAX_RETRIES) {
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s
        console.log(`[EMAIL] Retrying in ${delay / 1000}s...`);
        await sleep(delay);
      } else {
        console.error(`[EMAIL] All ${MAX_RETRIES} attempts failed for session ${sessionId}`);
        return { success: false, reason: error.message };
      }
    }
  }
}
