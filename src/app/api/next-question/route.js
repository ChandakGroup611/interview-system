import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'session_id is required' },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();

    const { data: session, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error || !session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    const transcript = session.transcript || [];
    const lastAiMessage = transcript.filter(t => t.role === 'ai').pop();

    return NextResponse.json({
      success: true,
      session_id: session.id,
      current_question: session.current_question,
      total_questions: 10,
      current_persona: session.current_persona,
      status: session.status,
      last_ai_message: lastAiMessage?.content || '',
      is_complete: session.status === 'completed' || session.status === 'evaluated',
      transcript,
    });

  } catch (error) {
    console.error('Next question error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get next question' },
      { status: 500 }
    );
  }
}
