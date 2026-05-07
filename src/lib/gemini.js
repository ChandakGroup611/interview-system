import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Get Gemini model for text generation
export function getGeminiModel() {
  return genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
}

// Get Gemini model for audio transcription (multimodal)
export function getGeminiMultimodalModel() {
  return genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
}

// Transcribe audio using Gemini multimodal
export async function transcribeAudio(audioBase64, mimeType = 'audio/webm') {
  const model = getGeminiMultimodalModel();

  const audioPart = {
    inlineData: {
      data: audioBase64,
      mimeType: mimeType,
    },
  };

  const prompt = `You are a speech-to-text transcription system. Transcribe the following audio into ENGLISH text only. 
The speaker may be speaking in Hinglish (a mix of Hindi and English). 
Convert ALL content to proper English regardless of the source language.
Return ONLY the transcribed English text, nothing else. No labels, no formatting, just the plain English text.
If the audio is unclear or silent, return "[inaudible]".`;

  try {
    const result = await model.generateContent([prompt, audioPart]);
    const response = await result.response;
    const text = response.text().trim();
    return text || '[inaudible]';
  } catch (error) {
    console.error('Transcription error:', error);
    throw new Error(`Failed to transcribe audio: ${error.message}`);
  }
}

// Generate AI response for interview conversation
export async function generateInterviewResponse(systemPrompt, conversationHistory) {
  const model = getGeminiModel();

  const messages = conversationHistory.map(msg => ({
    role: msg.role === 'ai' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  if (messages.length > 0 && messages[0].role === 'model') {
    messages.unshift({
      role: 'user',
      parts: [{ text: 'I am ready to begin the interview.' }]
    });
  }

  const chat = model.startChat({
    history: messages,
    generationConfig: {
      temperature: 0.4,
      topP: 0.85,
      topK: 30,
      maxOutputTokens: 1024,
    },
    systemInstruction: {
      role: 'system',
      parts: [{ text: systemPrompt }]
    },
  });

  // Send a prompt to continue the conversation
  const result = await chat.sendMessage('Continue the interview conversation based on the context.');
  const response = await result.response;
  return response.text();
}

// Generate interview question based on context
export async function generateNextQuestion(systemPrompt, conversationHistory, candidateAnswer) {
  const model = getGeminiModel();

  const messages = conversationHistory.map(msg => ({
    role: msg.role === 'ai' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  if (messages.length > 0 && messages[0].role === 'model') {
    messages.unshift({
      role: 'user',
      parts: [{ text: 'I am ready to begin the interview.' }]
    });
  }

  const chat = model.startChat({
    history: messages,
    generationConfig: {
      temperature: 0.4,
      topP: 0.85,
      topK: 30,
      maxOutputTokens: 1024,
    },
    systemInstruction: {
      role: 'system',
      parts: [{ text: systemPrompt }]
    },
  });

  const result = await chat.sendMessage(candidateAnswer);
  const response = await result.response;
  return response.text();
}

// Evaluate the full interview
export async function evaluateInterview(transcript, evaluationPrompt) {
  const model = getGeminiModel();

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: evaluationPrompt }] }],
    generationConfig: {
      temperature: 0.3,
      topP: 0.8,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
    },
  });

  const response = await result.response;
  const text = response.text();

  let cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();

  try {
    return JSON.parse(cleanText);
  } catch (e) {
    // Fallback: try to extract substring between first { and last }
    const startIndex = cleanText.indexOf('{');
    const endIndex = cleanText.lastIndexOf('}');
    if (startIndex !== -1 && endIndex !== -1) {
      try {
        return JSON.parse(cleanText.slice(startIndex, endIndex + 1));
      } catch (e2) {
        throw new Error('Failed to parse evaluation response as JSON after cleanup');
      }
    }
    throw new Error('Failed to parse evaluation response as JSON');
  }
}

