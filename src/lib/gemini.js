const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const CLAUDE_MODEL = 'claude-sonnet-4-6';
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

// Sarvam AI Saaras V3 configuration (Batch STT for all audio)
const SARVAM_API_KEY = process.env.SARVAM_API_KEY || '';
const SARVAM_BASE_URL = 'https://api.sarvam.ai/speech-to-text';

// Internal helper to call the Claude Messages API
async function callClaude(messages, systemPrompt = '', options = {}) {
  const maxTokens = options.maxTokens || 1000;

  const body = {
    model: CLAUDE_MODEL,
    max_tokens: maxTokens,
    messages,
  };

  if (systemPrompt) {
    body.system = systemPrompt;
  }

  const response = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Claude API error (${response.status}): ${errorBody}`);
  }

  const result = await response.json();
  // Extract text from the first content block
  const textBlock = result.content?.find(b => b.type === 'text');
  return textBlock?.text || '';
}

// Generate simple text content (used by start-session for first question)
export async function generateSimpleContent(prompt) {
  return callClaude([{ role: 'user', content: prompt }]);
}

// Transcribe audio using Sarvam AI Saaras V3 (Batch STT API)
// Uses the official Sarvam batch workflow:
//   1. POST /job/init → get job_id, input_storage_path, output_storage_path
//   2. Upload audio to Azure Blob via input_storage_path SAS URL
//   3. POST /job → start processing with job_id + parameters
//   4. GET /job/{id}/status → poll until Completed
//   5. List + Download output blobs from output_storage_path SAS URL
export async function transcribeAudio(audioBase64, mimeType = 'audio/webm', lastAiQuestion = '') {
  // Validate minimum audio size - very small payloads are likely silence
  const audioSizeBytes = Math.ceil(audioBase64.length * 3 / 4);
  const normalizedMimeType = mimeType.includes('codecs=opus') ? 'audio/webm' : mimeType;

  if (audioSizeBytes < 1000) {
    console.warn(`Audio too small (${audioSizeBytes} bytes), likely silent`);
    return { text: '[inaudible]', metadata: null };
  }

  if (!SARVAM_API_KEY) {
    console.error('SARVAM_API_KEY is not set in environment variables');
    throw new Error('STT service not configured: missing SARVAM_API_KEY');
  }

  const audioBuffer = Buffer.from(audioBase64, 'base64');
  const extMap = {
    'audio/webm': 'webm', 'audio/wav': 'wav', 'audio/mp3': 'mp3',
    'audio/mpeg': 'mp3', 'audio/ogg': 'ogg', 'audio/flac': 'flac',
    'audio/mp4': 'm4a', 'audio/aac': 'aac',
  };
  const ext = extMap[mimeType] || 'webm';
  const filename = `recording.${ext}`;

  console.log(`Sarvam STT: audio ${audioSizeBytes} bytes, ${normalizedMimeType}`);
  console.log('Audio header:', audioBuffer.slice(0, 8).toString('hex'));

  // --- STRATEGY 1: Attempt Synchronous STT for speed ---
  try {
    console.log('Sarvam: Attempting Synchronous STT for speed...');
    const syncFormData = new FormData();
    const audioBlob = new Blob([audioBuffer], { type: normalizedMimeType });
    syncFormData.append('file', audioBlob, 'audio.webm');
    syncFormData.append('model', 'saaras:v3');
    syncFormData.append('mode', 'translate');
    // Allow auto-detection of language for better accuracy across Hindi/English

    const syncRes = await fetch(SARVAM_BASE_URL, {
      method: 'POST',
      headers: {
        'API-Subscription-Key': SARVAM_API_KEY,
      },
      body: syncFormData,
    });

    if (syncRes.ok) {
      const syncData = await syncRes.json();
      let syncTranscript = (syncData.transcript || '').trim();
      if (syncTranscript && syncTranscript !== '[inaudible]') {
        console.log('Sarvam Synchronous STT success');
        return await englishifyResult(syncTranscript, { provider: 'sarvam-sync' });
      }
      console.warn('Sarvam Synchronous STT returned empty or inaudible, trying Batch...');
    } else {
      const syncErrText = await syncRes.text();
      console.warn(`Sarvam Synchronous STT failed (${syncRes.status}): ${syncErrText.slice(0, 100)}. Falling back to Batch...`);
    }
  } catch (syncErr) {
    console.warn('Sarvam Synchronous STT exception, falling back to Batch:', syncErr.message);
  }

  // --- STRATEGY 2: Fallback to Batch STT ---
  try {
    console.log('Sarvam Batch: proceeding with batch workflow...');

    // Step 1: Initialize job → get storage paths
    console.log('Sarvam Batch: initializing job...');
    const initRes = await fetch(`${SARVAM_BASE_URL}/job/init`, {
      method: 'POST',
      headers: {
        'API-Subscription-Key': SARVAM_API_KEY,
        'Content-Type': 'application/json'
      },
      body: '{}',
    });

    if (!initRes.ok) {
      const err = await initRes.text();
      throw new Error(`Job init failed (${initRes.status}): ${err}`);
    }

    const initData = await initRes.json();
    const jobId = initData.job_id;
    const inputStoragePath = initData.input_storage_path;
    const outputStoragePath = initData.output_storage_path;
    console.log(`Sarvam Batch: job ${jobId} created`);

    if (!inputStoragePath || !outputStoragePath) {
      throw new Error('Job init did not return storage paths');
    }

    // Step 2: Upload audio to Azure Blob via SAS URL
    console.log('Sarvam Batch: uploading audio to Azure...');
    const inputUrl = new URL(inputStoragePath);
    const uploadBlobUrl = `${inputUrl.origin}${inputUrl.pathname}/${filename}${inputUrl.search}`;

    const uploadRes = await fetch(uploadBlobUrl, {
      method: 'PUT',
      headers: { 'Content-Type': normalizedMimeType, 'x-ms-blob-type': 'BlockBlob' },
      body: audioBuffer,
    });

    if (!uploadRes.ok) throw new Error(`Azure upload failed (${uploadRes.status})`);

    // Step 3: Start the job
    console.log('Sarvam Batch: starting job...');
    const startRes = await fetch(`${SARVAM_BASE_URL}/job`, {
      method: 'POST',
      headers: {
        'API-Subscription-Key': SARVAM_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        job_id: jobId,
        job_parameters: { mode: 'translate', with_timestamps: false },
      }),
    });

    if (!startRes.ok) throw new Error(`Job start failed (${startRes.status})`);

    // Step 4: Poll for completion
    const maxPolls = 40;
    const pollIntervalMs = 4000;
    let jobState = 'Processing';

    for (let i = 0; i < maxPolls; i++) {
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
      const statusRes = await fetch(`${SARVAM_BASE_URL}/job/${jobId}/status`, {
        method: 'GET',
        headers: { 'API-Subscription-Key': SARVAM_API_KEY },
      });
      if (!statusRes.ok) continue;
      const statusData = await statusRes.json();
      jobState = statusData.job_state || statusData.status || 'Unknown';
      if (jobState === 'Completed' || jobState === 'completed') break;
    }

    // Step 5: Download results
    console.log('Sarvam Batch: downloading results...');
    const outputUrl = new URL(outputStoragePath);
    const pathParts = outputUrl.pathname.split('/').filter(p => p);
    const containerName = pathParts[0];
    const prefix = pathParts.slice(1).join('/');
    const listUrl = `${outputUrl.origin}/${containerName}?restype=container&comp=list&prefix=${prefix ? prefix + '/' : ''}&${outputUrl.searchParams.toString()}`;

    let outputFiles = [];
    try {
      const listRes = await fetch(listUrl);
      if (listRes.ok) {
        const listXml = await listRes.text();
        const nameMatches = listXml.match(/<Name>([^<]+)<\/Name>/g) || [];
        outputFiles = nameMatches.map(m => {
          let name = m.replace(/<\/?Name>/g, '');
          if (prefix && name.startsWith(prefix + '/')) name = name.substring(prefix.length + 1);
          return name;
        });
      }
    } catch (e) { }

    if (outputFiles.length === 0) {
      outputFiles = [`recording.json`, `recording.webm.json`, `0.json`, `output.json`];
    }

    let transcript = '';
    const metadata = { batch_job_id: jobId, provider: 'sarvam-batch' };

    for (const blobName of outputFiles) {
      if (!blobName.endsWith('.json')) continue;
      try {
        const pathParts = outputUrl.pathname.split('/').filter(p => p);
        const containerName = pathParts[0];
        const dirPath = pathParts.slice(1).join('/');
        const blobPath = dirPath ? `/${containerName}/${dirPath}/${blobName}` : `/${containerName}/${blobName}`;
        const downloadUrl = `${outputUrl.origin}${blobPath}${outputUrl.search}`;
        const dlRes = await fetch(downloadUrl);
        if (!dlRes.ok) continue;
        const resultData = await dlRes.json();

        if (typeof resultData === 'string') transcript = resultData;
        else if (Array.isArray(resultData)) transcript = resultData.map(r => r.translated_text || r.transcript || r.text || '').join(' ');
        else {
          transcript = resultData.translated_text || resultData.transcript || resultData.text || '';
          if (!transcript && resultData.results) {
            transcript = Array.isArray(resultData.results) ? resultData.results.map(r => r.translated_text || r.transcript || r.text || '').join(' ') : (resultData.results.translated_text || resultData.results.transcript || '');
          }
        }
        if (transcript.trim()) {
          metadata.source_file = blobName;
          break;
        }
      } catch (e) { }
    }

    transcript = transcript.trim();
    if (!transcript) return { text: '[inaudible]', metadata };

    return await englishifyResult(transcript, metadata);

  } catch (error) {
    console.error('Sarvam STT pipeline error:', error);
    throw new Error(`Failed to transcribe audio: ${error.message}`);
  }
}

// Helper to ensure transcript is in English script and metadata is attached
async function englishifyResult(transcript, metadata) {
  console.log(`Sarvam raw result: ${transcript.slice(0, 100)}...`);

  // Ensure text is in English script (translate Devanagari/Hinglish to English)
  const containsDevanagari = /[\u0900-\u097F]/.test(transcript);
  if (containsDevanagari) {
    console.log('Transcript contains Devanagari, translating to English using Claude...');
    try {
      const translated = await callClaude(
        [{ role: 'user', content: `Translate this text (which may be Hinglish or Hindi) into clear, natural English script. Maintain the exact same meaning and tone. Return ONLY the English text.\n\nText: ${transcript}` }],
        'You are a helpful translator specialized in converting Hindi/Hinglish to clear English.'
      );
      if (translated && translated.trim()) {
        transcript = translated.trim();
        console.log(`Claude translation successful: ${transcript}`);
      }
    } catch (transErr) {
      console.error('Claude translation failed, using original transcript:', transErr.message);
    }
  }

  return { text: transcript, metadata };
}

// Generate AI response for interview conversation
export async function generateInterviewResponse(systemPrompt, conversationHistory) {
  const messages = conversationHistory.map(msg => ({
    role: msg.role === 'ai' ? 'assistant' : 'user',
    content: msg.content,
  }));

  // Claude requires the first message to be from the user
  if (messages.length > 0 && messages[0].role === 'assistant') {
    messages.unshift({ role: 'user', content: 'I am ready to begin the interview.' });
  }

  // Add a continuation prompt as the final user message
  messages.push({ role: 'user', content: 'Continue the interview conversation based on the context.' });

  return callClaude(messages, systemPrompt, { maxTokens: 1000 });
}

// Generate interview question based on context
export async function generateNextQuestion(systemPrompt, conversationHistory, candidateAnswer) {
  const messages = conversationHistory.map(msg => ({
    role: msg.role === 'ai' ? 'assistant' : 'user',
    content: msg.content,
  }));

  // Claude requires the first message to be from the user
  if (messages.length > 0 && messages[0].role === 'assistant') {
    messages.unshift({ role: 'user', content: 'I am ready to begin the interview.' });
  }

  // Add the candidate's answer as the final user message
  messages.push({ role: 'user', content: candidateAnswer });

  return callClaude(messages, systemPrompt, { maxTokens: 1000 });
}

// Evaluate the full interview
export async function evaluateInterview(transcript, evaluationPrompt) {
  const text = await callClaude(
    [{ role: 'user', content: evaluationPrompt }],
    '',
    { maxTokens: 4096 }
  );

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
