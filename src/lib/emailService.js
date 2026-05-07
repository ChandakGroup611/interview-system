import nodemailer from 'nodemailer';
import { getServiceSupabase } from './supabase';

// Create reusable SMTP transporter
function createTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    console.warn('SMTP credentials not configured. Email sending will fail.');
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    pool: true,
    maxConnections: 3,
    maxMessages: 10,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

// Log email attempt to database
async function logEmailAttempt({ candidateName, sessionId, status, errorMessage = null, attempt = 1 }) {
  try {
    const supabase = getServiceSupabase();
    await supabase.from('email_logs').insert({
      candidate_name: candidateName,
      session_id: sessionId,
      status,
      error_message: errorMessage,
      attempt_number: attempt,
      sent_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Failed to log email attempt to DB:', err.message);
  }
}

// Sleep helper for retry backoff
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Send PDF report to admin via email with retry mechanism
export async function sendReportEmail(candidateName, sessionId, pdfBuffer, finalScore) {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@yourcompany.com';
  const transporter = createTransporter();

  if (!transporter) {
    const reason = 'SMTP credentials not configured';
    console.error(`[EMAIL] ${reason}. Skipping email for session ${sessionId}`);
    await logEmailAttempt({ candidateName, sessionId, status: 'failed', errorMessage: reason });
    return { success: false, reason };
  }

  const scoreColor = finalScore >= 70 ? '🟢' : finalScore >= 50 ? '🟡' : '🔴';
  const htmlContent = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px; border-radius: 12px 12px 0 0;">
        <h1 style="color: #ffffff; margin: 0; font-size: 22px;">Interview Report</h1>
        <p style="color: #a0a0c0; margin: 5px 0 0 0;">AI Real Estate Closing Manager Interview System</p>
      </div>
      <div style="background: #f8f9fa; padding: 25px; border: 1px solid #e0e0e0; border-top: none;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #666;">Candidate:</td>
            <td style="padding: 8px 0; font-weight: bold; color: #333;">${candidateName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Session ID:</td>
            <td style="padding: 8px 0; font-family: monospace; color: #333;">${sessionId}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Final Score:</td>
            <td style="padding: 8px 0; font-weight: bold; font-size: 18px; color: ${finalScore >= 70 ? '#27ae60' : finalScore >= 50 ? '#f39c12' : '#e74c3c'};">${finalScore.toFixed(1)} / 100</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Date:</td>
            <td style="padding: 8px 0; color: #333;">${new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
          </tr>
        </table>
      </div>
      <div style="background: #ffffff; padding: 20px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="color: #666; font-size: 13px;">The detailed PDF report is attached. Please review the full transcript and scores in the admin dashboard.</p>
      </div>
    </div>
  `;

  const mailOptions = {
    from: `Interview System <${process.env.SMTP_USER}>`,
    to: adminEmail,
    subject: `${scoreColor} Interview Report: ${candidateName} - Score: ${finalScore.toFixed(1)}/100`,
    html: htmlContent,
    attachments: [
      {
        filename: `interview-report-${candidateName.replace(/\s+/g, '-').toLowerCase()}-${sessionId.slice(0, 8)}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  };

  // Retry mechanism: 3 attempts with exponential backoff
  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[EMAIL] Attempt ${attempt}/${MAX_RETRIES} — Sending to ${adminEmail} for session ${sessionId}`);
      const info = await transporter.sendMail(mailOptions);
      console.log(`[EMAIL] ✅ Sent successfully. MessageId: ${info.messageId}`);
      await logEmailAttempt({ candidateName, sessionId, status: 'sent', attempt });
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error(`[EMAIL] ❌ Attempt ${attempt} failed:`, error.message);
      await logEmailAttempt({
        candidateName,
        sessionId,
        status: attempt < MAX_RETRIES ? 'retrying' : 'failed',
        errorMessage: error.message,
        attempt,
      });

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
