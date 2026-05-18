import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { generateSimpleContent } from '@/lib/gemini';
import { buildFirstQuestionPrompt } from '@/lib/prompts';
import { PROJECTS } from '@/lib/projectData';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, email, persona, projectId = 'greenairy' } = body;

    const project = PROJECTS[projectId] || PROJECTS['greenairy'];
    const projectName = project.projectName;

    if (!name || !email) {
      return NextResponse.json(
        { error: 'Name and email are required' },
        { status: 400 }
      );
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();

    // Always create a fresh candidate record for every new session
    // This ensures each session has its own candidate entry and names never bleed across sessions
    const { data: candidate, error: candidateError } = await supabase
      .from('candidates')
      .insert({ name, phone: email }) // Storing email in the phone column for DB compatibility
      .select()
      .single();

    if (candidateError) {
      throw new Error(`Failed to create candidate: ${candidateError.message}`);
    }

    // Select initial persona (from request or default to easy-going)
    const initialPersona = persona || 'easy-going';

    // Generate first AI question
    const firstQuestionPrompt = buildFirstQuestionPrompt(initialPersona, projectId);
    const firstQuestion = await generateSimpleContent(firstQuestionPrompt);

    // Create session
    const initialTranscript = [
      { role: 'ai', content: firstQuestion, timestamp: new Date().toISOString() }
    ];

    const initialPersonaTransitions = [
      { question: 0, to: initialPersona, reason: 'Initial persona', timestamp: new Date().toISOString() }
    ];

    const initialConversationHistory = [
      { role: 'ai', content: firstQuestion }
    ];

    // Attempt to insert session with project tracking
    const sessionData = {
      candidate_id: candidate.id,
      transcript: initialTranscript,
      audio_urls: [],
      persona_transitions: initialPersonaTransitions,
      current_question: 1,
      current_persona: initialPersona,
      conversation_history: initialConversationHistory,
      status: 'active',
      project_id: projectId,
      project_name: projectName,
    };

    let { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert(sessionData)
      .select()
      .single();

    // Graceful degradation: If project_id column is missing, retry without it
    if (sessionError && sessionError.message.includes('project_id')) {
      console.warn('Supabase schema missing project_id column. Retrying without project tracking.');

      const legacySessionData = { ...sessionData };
      delete legacySessionData.project_id;
      delete legacySessionData.project_name;

      const { data: legacySession, error: legacyError } = await supabase
        .from('sessions')
        .insert(legacySessionData)
        .select()
        .single();

      session = legacySession;
      sessionError = legacyError;
    }

    if (sessionError) {
      throw new Error(`Failed to create session: ${sessionError.message}`);
    }

    return NextResponse.json({
      success: true,
      session_id: session.id,
      candidate_id: candidate.id,
      candidate_name: candidate.name,
      first_question: firstQuestion,
      persona: initialPersona,
      question_number: 1,
      total_questions: 10,
      projectId: projectId,
      projectName: projectName,
    });

  } catch (error) {
    console.error('Start session error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to start session' },
      { status: 500 }
    );
  }
}