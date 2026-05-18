import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { evaluateInterview } from '@/lib/gemini';
import { buildEvaluationPrompt } from '@/lib/prompts';
import { generatePDFReport } from '@/lib/pdfGenerator';
import { sendReportEmail } from '@/lib/emailService';
import { PROJECTS } from '@/lib/projectData';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json();
    const { session_id } = body;

    if (!session_id) {
      return NextResponse.json(
        { error: 'session_id is required' },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();

    // Get session with candidate info
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*, candidates(*)')
      .eq('id', session_id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    if (session.status === 'evaluated') {
      // Return success without scores (user should NOT see them)
      return NextResponse.json({
        success: true,
        already_evaluated: true,
        message: 'Interview has already been evaluated. Report sent to admin.',
      });
    }

    const candidate = session.candidates;
    const transcript = session.transcript || [];

    // Build evaluation prompt
    let projectId = session.project_id;
    if (!projectId) {
      const firstAiMessage = session.transcript?.[0]?.content || '';
      const foundId = Object.keys(PROJECTS).find(id =>
        firstAiMessage.toLowerCase().includes(PROJECTS[id].projectName.toLowerCase())
      );
      projectId = foundId || 'greenairy';
    }

    const evaluationPrompt = buildEvaluationPrompt(transcript, candidate.name, projectId);

    // Evaluate using Claude
    const evaluationResult = await evaluateInterview(transcript, evaluationPrompt);

    // Generate PDF report
    const pdfBuffer = await generatePDFReport(
      { name: candidate.name, phone: candidate.phone },
      session,
      evaluationResult
    );

    // Upload PDF to Supabase storage
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
    } else if (pdfUploadError) {
      console.error('[STORAGE] PDF Upload error:', pdfUploadError);
    }

    // Create report in database
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .insert({
        session_id: session_id,
        candidate_id: candidate.id,
        scores: evaluationResult.scores || {},
        final_score: evaluationResult.final_score || 0,
        feedback: evaluationResult.overall_feedback || '',
        pdf_url: pdfUrl,
      })
      .select()
      .single();

    if (reportError) {
      console.error('Failed to create report:', reportError);
    }

    // Update session status to evaluated
    await supabase
      .from('sessions')
      .update({ status: 'evaluated' })
      .eq('id', session_id);

    // Send email to admin (non-blocking, with retry)
    sendReportEmail(
      candidate.name,
      session_id,
      pdfBuffer,
      evaluationResult.final_score || 0
    ).catch(err => console.error('[EMAIL] Background send failed:', err));

    // Return success WITHOUT evaluation details (user must NOT see scores)
    return NextResponse.json({
      success: true,
      message: 'Interview evaluated successfully. Report sent to admin.',
      pdf_url: pdfUrl,
      report_id: report?.id,
    });

  } catch (error) {
    console.error('Evaluate error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to evaluate interview' },
      { status: 500 }
    );
  }
}
