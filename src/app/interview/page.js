'use client';

import { useState, useEffect, useRef, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { Mic, Volume2, RotateCcw } from 'lucide-react';

const PERSONA_LABEL = {
  'arrogant': 'Arrogant',
  'confused': 'Confused',
  'easy-going': 'Easy-going',
};

const READ_TIME_SECONDS = 45;


export default function InterviewPage({ params, searchParams }) {
  const unwrappedParams = use(params);
  const unwrappedSearchParams = use(searchParams);
  const router = useRouter();
  const [sessionData, setSessionData] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState('');
  const [persona, setPersona] = useState('easy-going');
  const [questionNumber, setQuestionNumber] = useState(1);
  const [isComplete, setIsComplete] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationDone, setEvaluationDone] = useState(false);
  const [error, setError] = useState('');
  const [personaChanged, setPersonaChanged] = useState(false);

  const [readTimer, setReadTimer] = useState(READ_TIME_SECONDS);
  const [timerActive, setTimerActive] = useState(false);

  const [decisionPhase, setDecisionPhase] = useState('none');
  const [decisionTimer, setDecisionTimer] = useState(10);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const readTimerRef = useRef(null);
  const streamRef = useRef(null);
  const audioRef = useRef(null);
  const playbackRef = useRef(null);

  const startRecordingRef = useRef(() => { });
  const submitRecordingRef = useRef(() => { });

  const currentTtsSourceRef = useRef(null);
  const audioContextRef = useRef(null);
  const ttsRequestIdRef = useRef(0);

  const playAudioFromBase64 = useCallback(async (audio, requestId) => {
    if (!audio) return;
    if (requestId && ttsRequestIdRef.current !== requestId) return;
    try {
      if (currentTtsSourceRef.current) {
        currentTtsSourceRef.current.onended = null;
        currentTtsSourceRef.current.stop();
        currentTtsSourceRef.current = null;
      }

      setIsPlayingAudio(true);

      const binary = atob(audio);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') await ctx.resume();

      const audioBuffer = await ctx.decodeAudioData(bytes.buffer);
      
      if (requestId && ttsRequestIdRef.current !== requestId) {
        setIsPlayingAudio(false);
        return;
      }

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      currentTtsSourceRef.current = source;

      source.onended = () => {
        setIsPlayingAudio(false);
        currentTtsSourceRef.current = null;
      };
      source.start(0);
    } catch (err) {
      console.warn('[Sarvam TTS] Playback failed:', err);
      setIsPlayingAudio(false);
    }
  }, []);

  const speakText = useCallback(async (text) => {
    if (!text || typeof window === 'undefined') return;

    ttsRequestIdRef.current += 1;
    const currentRequestId = ttsRequestIdRef.current;

    try {
      if (currentTtsSourceRef.current) {
        currentTtsSourceRef.current.onended = null;
        currentTtsSourceRef.current.stop();
        currentTtsSourceRef.current = null;
        setIsPlayingAudio(false);
      }
    } catch (_) { /* already stopped */ }

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (ttsRequestIdRef.current !== currentRequestId) return;

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.warn('[Sarvam TTS] API error:', err);
        return;
      }

      const { audio } = await res.json();
      if (ttsRequestIdRef.current !== currentRequestId) return;
      await playAudioFromBase64(audio, currentRequestId);
    } catch (err) {
      console.warn('[Sarvam TTS] speakText failed:', err);
      if (ttsRequestIdRef.current === currentRequestId) {
        setIsPlayingAudio(false);
      }
    }
  }, [playAudioFromBase64]);

  // Cleanup AudioContext on unmount
  useEffect(() => {
    return () => {
      try {
        if (currentTtsSourceRef.current) {
          currentTtsSourceRef.current.onended = null;
          currentTtsSourceRef.current.stop();
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close();
        }
      } catch (_) { /* ignore cleanup errors */ }
    };
  }, []);

  useEffect(() => {
    const stored = sessionStorage.getItem('interview_session');
    if (!stored) {
      router.push('/');
      return;
    }

    const data = JSON.parse(stored);
    setSessionData(data);
    setPersona(data.persona || 'easy-going');

    setMessages([{
      role: 'ai',
      content: data.first_question,
      timestamp: new Date().toISOString(),
    }]);

    setTimerActive(true);
    setReadTimer(READ_TIME_SECONDS);

    // Speak the first question on load
    speakText(data.first_question);
  }, [router, speakText]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (personaChanged) {
      const timer = setTimeout(() => setPersonaChanged(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [personaChanged]);

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
      setRecordingTime(0);
    }
    return () => clearInterval(timerRef.current);
  }, [isRecording]);

  useEffect(() => {
    if (timerActive && readTimer > 0 && !isRecording && !isProcessing && !recordedAudioBlob && decisionPhase === 'none') {
      readTimerRef.current = setInterval(() => {
        setReadTimer(prev => {
          if (prev <= 1) {
            setTimerActive(false);
            clearInterval(readTimerRef.current);
            startRecordingRef.current();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(readTimerRef.current);
  }, [timerActive, readTimer, isRecording, isProcessing, recordedAudioBlob, decisionPhase]);

  useEffect(() => {
    if ((decisionPhase === 'initial' || decisionPhase === 'post-listen') && decisionTimer > 0) {
      const interval = setInterval(() => {
        setDecisionTimer(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            submitRecordingRef.current();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [decisionPhase, decisionTimer]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    ttsRequestIdRef.current += 1;
    setIsPlayingAudio(false);
    try {
      if (currentTtsSourceRef.current) {
        currentTtsSourceRef.current.onended = null;
        currentTtsSourceRef.current.stop();
        currentTtsSourceRef.current = null;
      }
    } catch (_) { /* already stopped */ }
    try {
      setError('');
      setTimerActive(false);
      clearInterval(readTimerRef.current);
      setDecisionPhase('none');

      if (playbackRef.current) {
        playbackRef.current.pause();
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      streamRef.current = stream;
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const checkVolume = () => {
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const average = sum / dataArray.length;
        if (average > 1) {
          // Volume detected
        }
        requestAnimationFrame(checkVolume);
      };
      checkVolume();

      mediaRecorder.onstop = () => {
        try {
          const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
          const chunks = audioChunksRef.current;
          console.log(`[AudioPipeline] onstop: chunks=${chunks.length}, type=${mimeType}`);

          if (chunks.length === 0) {
            throw new Error('No audio data captured');
          }

          const audioBlob = new Blob(chunks, { type: mimeType });
          if (!audioBlob || audioBlob.size < 100) {
            throw new Error(`Recording too small (${audioBlob?.size || 0} bytes)`);
          }

          console.log('[AudioPipeline] Blob created:', audioBlob.size, 'bytes');
          const url = URL.createObjectURL(audioBlob);

          setRecordedAudioBlob(audioBlob);
          setRecordedAudioUrl(url);
          setDecisionPhase('initial');
          setDecisionTimer(10);
        } catch (err) {
          console.error('[AudioPipeline] onstop error:', err.message);
          setError(`Recording failed: ${err.message}. Please check your microphone.`);
        } finally {
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
          }
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Microphone error:', err);
      setError('Microphone access denied. Please allow microphone access and try again.');
    }
  };

  startRecordingRef.current = startRecording;

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  const submitRecording = () => {
    if (recordedAudioBlob) {
      if (playbackRef.current) {
        playbackRef.current.pause();
        playbackRef.current = null;
      }

      const blobToSubmit = recordedAudioBlob;
      const urlToRevoke = recordedAudioUrl;

      setRecordedAudioBlob(null);
      setRecordedAudioUrl('');
      setDecisionPhase('none');

      handleAudioSubmit(blobToSubmit).finally(() => {
        if (urlToRevoke) URL.revokeObjectURL(urlToRevoke);
      });
    }
  };

  submitRecordingRef.current = submitRecording;

  const discardRecording = () => {
    if (playbackRef.current) {
      playbackRef.current.pause();
      playbackRef.current = null;
    }

    const urlToRevoke = recordedAudioUrl;
    setRecordedAudioBlob(null);
    setRecordedAudioUrl('');
    setDecisionPhase('none');
    setTimerActive(false);
    setReadTimer(0);

    setTimeout(() => {
      if (urlToRevoke) URL.revokeObjectURL(urlToRevoke);
      startRecordingRef.current();
    }, 100);
  };

  const listenToRecording = () => {
    if (recordedAudioUrl) {
      if (playbackRef.current) {
        playbackRef.current.pause();
      }

      setDecisionPhase('listening');
      const audio = new Audio(recordedAudioUrl);
      playbackRef.current = audio;

      audio.onended = onAudioEnded;
      audio.onerror = (e) => {
        console.warn('Playback error', e);
        onAudioEnded();
      };

      audio.play().catch(err => {
        console.warn('Playback failed', err);
        onAudioEnded();
      });
    }
  };

  const onAudioEnded = () => {
    setDecisionPhase('post-listen');
    setDecisionTimer(10);
  };

  const handleAudioSubmit = async (audioBlob) => {
    if (!sessionData) return;

    setIsProcessing(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('session_id', sessionData.session_id);

      const response = await fetch('/api/submit-audio', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process audio');
      }

      if (data.retry) {
        setError(data.error + ' Auto-restarting microphone in 5 seconds...');
        setIsProcessing(false);
        setTimeout(() => {
          if (startRecordingRef.current) {
            startRecordingRef.current();
          }
        }, 5000);
        return;
      }

      setMessages(prev => [...prev, {
        role: 'user',
        content: data.transcribed_text,
        timestamp: new Date().toISOString(),
      }]);

      const aiText = data.ai_response;

      // Fire TTS fetch immediately in parallel — don't wait for it before showing text
      ttsRequestIdRef.current += 1;
      const currentRequestId = ttsRequestIdRef.current;

      const ttsPromise = fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: aiText }),
      });

      // Show text immediately without any delay
      setMessages(prev => [...prev, {
        role: 'ai',
        content: aiText,
        timestamp: new Date().toISOString(),
      }]);

      if (!data.is_complete) {
        setReadTimer(READ_TIME_SECONDS);
        setTimerActive(true);
        setDecisionPhase('none');
      }

      // Play audio from the already-in-flight request
      ttsPromise.then(async (res) => {
        if (!res.ok) return;
        if (ttsRequestIdRef.current !== currentRequestId) return;
        const { audio } = await res.json();
        if (ttsRequestIdRef.current !== currentRequestId) return;
        await playAudioFromBase64(audio, currentRequestId);
      }).catch(err => {
        console.warn('[Sarvam TTS] Fetch failed:', err);
      });

      if (data.persona_changed) {
        setPersona(data.persona);
        setPersonaChanged(true);
      }

      setQuestionNumber(data.question_number);

      if (data.is_complete) {
        setIsComplete(true);
        triggerBackgroundEvaluation();
      }
    } catch (err) {
      console.error('[AudioPipeline] Audio submit failed:', err);
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const triggerBackgroundEvaluation = async () => {
    if (!sessionData) return;
    setIsEvaluating(true);
    try {
      const response = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionData.session_id }),
        keepalive: true,
      });
      if (response.ok) {
        setEvaluationDone(true);
      }
    } catch (err) {
      console.error('Background evaluation error:', err.message);
    } finally {
      setIsEvaluating(false);
    }
  };

  if (!sessionData) {
    return (
      <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-primary)' }}>
        <div className="spinner" />
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
      <header className="top-bar" style={{ padding: '32px 48px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Chandak CMIS</h1>
          <span style={{ color: 'var(--border-default)' }}>/</span>
          <span style={{ fontFamily: 'var(--font-data)', fontSize: '0.85rem', color: 'var(--color-mid-dark)', textTransform: 'uppercase' }}>Session: {sessionData.session_id.split('-')[0]}</span>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => {
          sessionStorage.removeItem('interview_session');
          router.push('/');
        }}>End Session</button>
      </header>

      <div style={{ padding: '32px 48px', flex: 1, display: 'flex', flexDirection: 'column', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontSize: '2rem', marginBottom: '8px' }}>Interview Simulator</h2>
            <div style={{ display: 'flex', gap: '16px', fontFamily: 'var(--font-data)', fontSize: '0.75rem', color: 'var(--color-mid-dark)', textTransform: 'uppercase' }}>
              <span>candidate: {sessionData.candidate_name}</span>
              <span>•</span>
              <span>persona: {PERSONA_LABEL[persona]}</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'var(--font-data)', fontSize: '1.25rem', color: 'var(--text-black)' }}>
              Q{Math.min(questionNumber, 10)} / 10
            </div>
          </div>
        </div>

        {personaChanged && (
          <div style={{ padding: '12px 16px', border: '1px solid var(--text-primary)', marginBottom: '24px', fontFamily: 'var(--font-data)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
            ■ Persona updated → {PERSONA_LABEL[persona]}
          </div>
        )}

        <div className="chat-container">
          <div className="chat-header">
            <span className={`status-indicator status-${isComplete ? 'completed' : 'active'}`}>
              {isComplete ? 'completed' : 'active_session'}
            </span>

            {!isComplete && !isRecording && !isProcessing && decisionPhase === 'none' && (
              <div style={{ fontFamily: 'var(--font-data)', fontSize: '0.85rem' }}>
                {timerActive && readTimer > 0 ? (
                  <>timer: {formatTime(readTimer)}</>
                ) : (
                  <>mic starting...</>
                )}
              </div>
            )}
          </div>

          <div className="chat-messages">
            {messages.map((msg, idx) => {
              const isLastAiMsg = msg.role === 'ai' && idx === messages.map(m => m.role).lastIndexOf('ai');
              return (
                <div key={idx} className={`message message-${msg.role === 'ai' ? 'ai' : 'user'}`}>
                  <div className="message-sender" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <span>{msg.role === 'ai' ? 'ai_customer' : 'candidate'} / {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                    {isLastAiMsg && (
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        {isPlayingAudio && (
                          <div className="audio-playing-indicator">
                            <Volume2 size={14} className="mic-pulsing" color="var(--text-muted)" />
                            <span>speaking</span>
                          </div>
                        )}
                        <button
                          onClick={() => speakText(msg.content)}
                          className="btn-text hover-opacity"
                          title="Replay Audio"
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', background: 'none', border: 'none', color: 'var(--text-muted)', fontFamily: 'var(--font-data)', fontSize: '0.7rem', textTransform: 'uppercase' }}
                        >
                          <RotateCcw size={12} /> Replay
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="message-bubble">
                    {msg.content}
                  </div>
                </div>
              );
            })}

            {isProcessing && (
              <div className="message message-ai">
                <div className="message-sender">ai_customer / processing</div>
                <div className="message-bubble">
                  <div className="spinner" style={{ width: '16px', height: '16px' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input-area">
            {!isComplete ? (
              decisionPhase !== 'none' ? (
                <div style={{ width: '100%' }}>
                  {decisionPhase === 'listening' ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-data)', fontSize: '0.85rem', textTransform: 'uppercase' }}>
                        ■ Playing back recording
                      </span>
                      <div style={{ display: 'flex', gap: '16px' }}>
                        <button className="btn" onClick={discardRecording} disabled={isProcessing}>Discard</button>
                        <button className="btn btn-primary" onClick={() => submitRecordingRef.current()} disabled={isProcessing}>Submit</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-data)', fontSize: '0.85rem', textTransform: 'uppercase' }}>
                        ■ Auto-submit in {decisionTimer}s
                      </span>
                      <div style={{ display: 'flex', gap: '16px' }}>
                        <button className="btn" onClick={discardRecording} disabled={isProcessing}>Discard</button>
                        {decisionPhase === 'initial' && (
                          <button className="btn" onClick={listenToRecording} disabled={isProcessing}>Listen</button>
                        )}
                        <button className="btn btn-primary" onClick={() => submitRecordingRef.current()} disabled={isProcessing}>Submit</button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <div style={{ fontFamily: 'var(--font-data)', fontSize: '0.85rem', textTransform: 'uppercase' }}>
                    {isProcessing ? '■ Processing audio' : isRecording ? '■ Recording audio' : '■ Idle'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    {isRecording && (
                      <span className="record-timer">{formatTime(recordingTime)}</span>
                    )}
                    <button
                      className={`record-btn ${isRecording ? 'record-btn-recording' : ''}`}
                      onClick={isRecording ? stopRecording : startRecording}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <div className="spinner" style={{ width: '20px', height: '20px' }} />
                      ) : isRecording ? (
                        <Mic size={24} className="mic-pulsing" color="var(--bg-primary)" />
                      ) : (
                        <Mic size={24} color="var(--text-primary)" />
                      )}
                    </button>
                  </div>
                </div>
              )
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <span style={{ fontFamily: 'var(--font-data)', fontSize: '0.85rem', textTransform: 'uppercase' }}>
                  {isEvaluating ? '■ Evaluating...' : evaluationDone ? '■ Evaluated' : '■ Completed'}
                </span>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    sessionStorage.removeItem('interview_session');
                    router.push('/');
                  }}
                >
                  New Session
                </button>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div style={{ marginTop: '24px', padding: '12px 16px', border: '1px solid #8B0000', color: '#8B0000', fontFamily: 'var(--font-data)', fontSize: '0.85rem' }}>
            ERR: {error}
          </div>
        )}
      </div>
    </main>
  );
}