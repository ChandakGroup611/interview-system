'use client';

import { useState, useEffect, use, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function SessionDetailPage({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authChecking, setAuthChecking] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('transcript');
  const [evaluating, setEvaluating] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [playingAudioId, setPlayingAudioId] = useState(null);
  const audioObjRef = useRef(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/admin/auth-check');
      if (!res.ok) {
        router.push('/admin/login');
        return;
      }
      setAuthChecking(false);
      fetchSession();
    } catch {
      router.push('/admin/login');
    }
  };

  const fetchSession = async () => {
    try {
      const res = await fetch(`/api/admin/session/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSession(data.session);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEvaluate = async () => {
    setEvaluating(true);
    try {
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      fetchSession();
    } catch (err) {
      setError(err.message);
    } finally {
      setEvaluating(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setResendMessage('');
    try {
      const res = await fetch('/api/admin/resend-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResendMessage(data.message);
      fetchSession();
    } catch (err) {
      setResendMessage(`Error: ${err.message}`);
    } finally {
      setResending(false);
    }
  };

  const playAudio = (url, id) => {
    if (audioObjRef.current) {
      audioObjRef.current.pause();
    }
    setPlayingAudioId(id);
    const audio = new Audio(url);
    audioObjRef.current = audio;
    audio.onended = () => setPlayingAudioId(null);
    audio.onerror = () => setPlayingAudioId(null);
    audio.play().catch(() => setPlayingAudioId(null));
  };

  if (authChecking || loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--bg-primary)' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--bg-primary)' }}>
        <p style={{ color: '#8B0000', fontFamily: 'var(--font-data)' }}>ERR: {error || 'Session not found'}</p>
        <button className="btn" onClick={() => router.push('/admin')} style={{ marginTop: '16px' }}>Return to Pipeline</button>
      </div>
    );
  }

  const candidate = session.candidates;
  const report = session.reports?.[0];
  const transcript = session.transcript || [];
  const audioUrls = session.audio_urls || [];
  const personaTransitions = session.persona_transitions || [];

  const tabs = [
    { key: 'transcript', label: 'transcript' },
    { key: 'audio', label: 'audio_urls' },
    { key: 'personas', label: 'persona_transitions' },
    ...(report ? [{ key: 'scores', label: 'reports.scores' }] : []),
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Sidebar Navigation */}
      <aside style={{ width: '240px', borderRight: '1px solid var(--border-default)', padding: '32px 24px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginBottom: '48px' }}>
          <h2 style={{ fontSize: '1.25rem', color: 'var(--text-black)' }}>Inspect Row</h2>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
          <span className="nav-link" style={{ cursor: 'pointer' }} onClick={() => router.push('/admin')}>← Back to Table</span>
        </nav>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <header className="top-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Chandak CMIS</h1>
            <span style={{ color: 'var(--border-default)' }}>/</span>
            <span style={{ fontFamily: 'var(--font-data)', fontSize: '0.85rem', color: 'var(--color-mid-dark)', textTransform: 'uppercase' }}>
              id: {session.id.split('-')[0]}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            {session.status !== 'evaluated' && session.status === 'completed' && (
              <button className="btn btn-primary" onClick={handleEvaluate} disabled={evaluating}>
                {evaluating ? 'Processing...' : 'Run Evaluation Pipeline'}
              </button>
            )}
            {report && (
              <button className="btn" onClick={handleResend} disabled={resending}>
                {resending ? 'Sending...' : 'Resend Report'}
              </button>
            )}
            {report?.pdf_url && (
              <a href={report.pdf_url} target="_blank" rel="noopener noreferrer" className="btn">
                Export PDF
              </a>
            )}
          </div>
          {resendMessage && (
            <div style={{ position: 'absolute', top: '60px', right: '48px', padding: '8px 16px', background: resendMessage.startsWith('Error') ? '#8B0000' : '#27ae60', color: '#fff', fontSize: '0.8rem', fontFamily: 'var(--font-data)', borderRadius: '4px' }}>
              {resendMessage}
            </div>
          )}
        </header>

        <div style={{ padding: '32px 48px', flex: 1, overflowY: 'auto', maxWidth: '1000px' }}>
          
          {/* Metadata Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', marginBottom: '48px' }}>
            <div className="card">
              <div className="form-label">candidates.name</div>
              <div className="text-mono" style={{ fontSize: '1rem', color: 'var(--text-black)' }}>{candidate?.name || 'null'}</div>
            </div>
            <div className="card">
              <div className="form-label">Chandak Mail id</div>
              <div className="text-mono" style={{ fontSize: '1rem', color: 'var(--text-black)' }}>{candidate?.phone || 'null'}</div>
            </div>
            <div className="card">
              <div className="form-label">sessions.status</div>
              <div className="text-mono" style={{ fontSize: '1rem', color: 'var(--text-black)' }}>
                <span className={`status-indicator status-${session.status}`}>{session.status}</span>
              </div>
            </div>
            <div className="card">
              <div className="form-label">reports.final_score</div>
              <div className="text-mono" style={{ fontSize: '1rem', color: 'var(--text-black)' }}>
                {report ? report.final_score.toFixed(1) : 'null'}
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div style={{ display: 'flex', gap: '32px', borderBottom: '1px solid var(--border-default)', paddingBottom: '16px', marginBottom: '32px' }}>
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontFamily: 'var(--font-data)',
                  fontSize: '0.85rem',
                  textTransform: 'uppercase',
                  color: activeTab === tab.key ? 'var(--text-black)' : 'var(--color-mid-dark)',
                  cursor: 'pointer',
                  padding: 0,
                  position: 'relative'
                }}
              >
                {tab.label}
                {activeTab === tab.key && (
                  <span style={{ position: 'absolute', bottom: '-17px', left: 0, right: 0, height: '1px', background: 'var(--text-black)' }} />
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div style={{ minHeight: '400px' }}>
            
            {activeTab === 'transcript' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {transcript.length === 0 ? (
                  <div className="text-mono" style={{ color: 'var(--color-mid-dark)', fontSize: '0.85rem' }}>[]</div>
                ) : (
                  transcript.map((entry, idx) => (
                    <div key={idx} style={{ 
                      padding: '16px', 
                      background: 'var(--bg-secondary)', 
                      borderLeft: entry.role === 'ai' ? '2px solid var(--color-mid)' : '2px solid var(--text-black)'
                    }}>
                      <div className="text-mono" style={{ fontSize: '0.75rem', color: 'var(--color-mid-dark)', marginBottom: '8px' }}>
                        role: "{entry.role}" | ts: {entry.timestamp ? new Date(entry.timestamp).toISOString() : 'null'}
                      </div>
                      <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                        {entry.content}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'audio' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {audioUrls.length === 0 ? (
                  <div className="text-mono" style={{ color: 'var(--color-mid-dark)', fontSize: '0.85rem' }}>[]</div>
                ) : (
                  audioUrls.map((audio, idx) => (
                    <div key={idx} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px' }}>
                      <div className="text-mono" style={{ fontSize: '0.85rem', color: 'var(--text-black)' }}>
                        Q{audio.question}.webm
                      </div>
                      <button 
                        className="btn btn-sm" 
                        onClick={() => playAudio(audio.url, idx)}
                        disabled={!audio.url}
                      >
                        {playingAudioId === idx ? 'Playing...' : 'Play Audio'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'personas' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {personaTransitions.length === 0 ? (
                  <div className="text-mono" style={{ color: 'var(--color-mid-dark)', fontSize: '0.85rem' }}>[]</div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>question</th>
                        <th>from</th>
                        <th>to</th>
                        <th>reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {personaTransitions.map((t, idx) => (
                        <tr key={idx}>
                          <td className="text-mono text-right">{t.question}</td>
                          <td className="text-mono">{t.from || 'null'}</td>
                          <td className="text-mono">{t.to}</td>
                          <td style={{ fontSize: '0.85rem' }}>{t.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {activeTab === 'scores' && report && (
              <div>
                <div style={{ marginBottom: '48px' }}>
                  <div className="form-label">reports.feedback</div>
                  <div style={{ padding: '24px', background: 'var(--bg-secondary)', fontSize: '0.95rem', lineHeight: 1.8 }}>
                    {report.feedback || 'null'}
                  </div>
                </div>

                <div className="form-label">reports.scores (JSON)</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                  {report.scores && Object.entries(report.scores).map(([key, data]) => (
                    <div key={key} className="card" style={{ padding: '24px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <span className="text-mono" style={{ fontSize: '0.85rem', color: 'var(--text-black)' }}>
                          "{key}":
                        </span>
                        <span className="text-mono" style={{ fontSize: '1.25rem', color: 'var(--text-black)' }}>
                          {data.score}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                        {data.feedback}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
          </div>
        </div>
      </main>
    </div>
  );
}
