import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { transcribeAudio, generateNextQuestion } from '@/lib/gemini';
import { buildInterviewSystemPrompt } from '@/lib/prompts';
import { v4 as uuidv4 } from 'uuid';
import { PROJECTS } from '@/lib/projectData';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio');
    const sessionId = formData.get('session_id');

    if (!audioFile || !sessionId) {
      return NextResponse.json(
        { error: 'Audio file and session_id are required' },
        { status: 400 }
      );
    }

    const supabase = getServiceSupabase();

    // Get current session
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*, candidates(*)')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    if (session.status !== 'active') {
      return NextResponse.json(
        { error: 'Session is no longer active' },
        { status: 400 }
      );
    }

    // Convert audio to buffer and base64
    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
    const audioBase64 = audioBuffer.toString('base64');
    const mimeType = audioFile.type || 'audio/webm';

    // Upload audio to Supabase storage
    const audioFileName = `${sessionId}/${uuidv4()}.webm`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('audio-files')
      .upload(audioFileName, audioBuffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error('Audio upload error:', uploadError);
      // Don't fail the whole request if upload fails
    }

    // Get public URL for the uploaded audio
    let audioUrl = '';
    if (uploadData) {
      const { data: urlData } = supabase.storage
        .from('audio-files')
        .getPublicUrl(audioFileName);
      audioUrl = urlData?.publicUrl || '';
    }

    // Transcribe audio to English using Gemini
    const transcribedText = await transcribeAudio(audioBase64, mimeType);

    if (transcribedText === '[inaudible]') {
      return NextResponse.json({
        success: false,
        error: 'Could not understand the audio. Please speak clearly and try again.',
        retry: true,
      });
    }

    // Get conversation history
    const conversationHistory = session.conversation_history || [];
    const currentQuestion = session.current_question || 1;
    const totalQuestions = 10;

    // Keep persona fixed throughout the interview
    const newPersona = session.current_persona;
    const personaChanged = false;
    const personaTransitions = session.persona_transitions || [];

    // Update conversation history with user's answer
    conversationHistory.push({ role: 'user', content: transcribedText });

    // Check if interview is complete
    const isLastQuestion = currentQuestion >= totalQuestions;

    // Detect project if missing from database column
    let projectId = session.project_id;
    if (!projectId) {
      const firstAiMessage = session.transcript?.[0]?.content || '';
      const foundId = Object.keys(PROJECTS).find(id => 
        firstAiMessage.toLowerCase().includes(PROJECTS[id].projectName.toLowerCase())
      );
      projectId = foundId || 'greenairy';
      console.log(`Detected projectId from transcript: ${projectId}`);
    }

    let aiResponse = '';
    if (!isLastQuestion) {
      // Generate next AI question with updated persona
      const systemPrompt = buildInterviewSystemPrompt(
        newPersona,
        currentQuestion + 1,
        totalQuestions,
        projectId
      );
      aiResponse = await generateNextQuestion(systemPrompt, conversationHistory, transcribedText);
      conversationHistory.push({ role: 'ai', content: aiResponse });
    } else {
      // Final closing from AI
      const systemPrompt = buildInterviewSystemPrompt(newPersona, totalQuestions, totalQuestions, projectId);
      aiResponse = await generateNextQuestion(systemPrompt, conversationHistory, transcribedText);
      conversationHistory.push({ role: 'ai', content: aiResponse });
    }

    // Update transcript
    const transcript = session.transcript || [];
    transcript.push({
      role: 'user',
      content: transcribedText,
      audio_url: audioUrl,
      timestamp: new Date().toISOString(),
    });
    transcript.push({
      role: 'ai',
      content: aiResponse,
      timestamp: new Date().toISOString(),
    });

    // Update audio URLs
    const audioUrls = session.audio_urls || [];
    if (audioUrl) {
      audioUrls.push({
        question: currentQuestion,
        url: audioUrl,
        timestamp: new Date().toISOString(),
      });
    }

    // Update session in database
    const newStatus = isLastQuestion ? 'completed' : 'active';
    const { error: updateError } = await supabase
      .from('sessions')
      .update({
        transcript,
        audio_urls: audioUrls,
        persona_transitions: personaTransitions,
        current_question: currentQuestion + 1,
        current_persona: newPersona,
        conversation_history: conversationHistory,
        status: newStatus,
      })
      .eq('id', sessionId);

    if (updateError) {
      throw new Error(`Failed to update session: ${updateError.message}`);
    }

    return NextResponse.json({
      success: true,
      transcribed_text: transcribedText,
      ai_response: aiResponse,
      persona: newPersona,
      persona_changed: personaChanged,
      persona_reason: null,
      question_number: currentQuestion + 1,
      total_questions: totalQuestions,
      is_complete: isLastQuestion,
      audio_url: audioUrl,
    });

  } catch (error) {
    console.error('Submit audio error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process audio' },
      { status: 500 }
    );
  }
}

