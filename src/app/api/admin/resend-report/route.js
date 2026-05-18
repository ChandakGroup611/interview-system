import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { generatePDFReport } from '@/lib/pdfGenerator';
import { sendReportEmail } from '@/lib/emailService';

export const dynamic = 'force-dynamic';

// POST /api/admin/resend-report — Re-generates PDF and sends email for an evaluated session
export async function POST(request) {
  try {
    const body = await request.json();
    const { session_id } = body;

    if (!session_id) {
      return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
    }

    const supabase = getServiceSupabase();

    // Get session with candidate + report
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*, candidates(*), reports(*)')
      .eq('id', session_id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const report = session.reports?.[0];
    if (!report) {
      return NextResponse.json({ error: 'No report found for this session. Run evaluation first.' }, { status: 400 });
    }

    const candidate = session.candidates;
    const evaluationData = {
      scores: report.scores || {},
      final_score: report.final_score || 0,
      overall_feedback: report.feedback || '',
      strengths: report.strengths || [],
      improvements: report.improvements || [],
    };

    // Re-generate PDF with updated template
    console.log('[RESEND] Generating PDF for session:', session_id);
    const pdfBuffer = await generatePDFReport(
      { name: candidate.name, phone: candidate.phone },
      session,
      evaluationData
    );

    // Upload new PDF to Supabase storage
    const pdfFileName = `${session_id}/report-${Date.now()}.pdf`;
    const { data: pdfUpload, error: pdfUploadError } = await supabase.storage
      .from('pdf-reports')
      .upload(pdfFileName, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    let pdfUrl = '';
    if (pdfUpload && !pdfUploadError) {
      const { data: urlData } = supabase.storage
        .from('pdf-reports')
        .getPublicUrl(pdfFileName);
      pdfUrl = urlData?.publicUrl || '';

      // Update report with new PDF URL
      await supabase
        .from('reports')
        .update({ pdf_url: pdfUrl })
        .eq('id', report.id);
    } else if (pdfUploadError) {
      console.error('[STORAGE] PDF Upload error in resend:', pdfUploadError);
      return NextResponse.json({
        error: `Supabase Storage upload failed: ${pdfUploadError.message}. Please ensure you have created the 'pdf-reports' bucket in your Supabase Dashboard and added a Public INSERT policy.`
      }, { status: 500 });
    }

    // Send email
    console.log('[RESEND] Sending email for session:', session_id);
    const emailResult = await sendReportEmail(
      candidate.name,
      session_id,
      pdfBuffer,
      report.final_score || 0
    );

    return NextResponse.json({
      success: true,
      pdf_url: pdfUrl,
      email: emailResult,
      message: emailResult.success 
        ? 'PDF regenerated and email sent successfully!' 
        : `PDF regenerated but email failed: ${emailResult.reason}`,
    });

  } catch (error) {
    console.error('[RESEND] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to resend report' },
      { status: 500 }
    );
  }
}
