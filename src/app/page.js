'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function EntryPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [projectId, setProjectId] = useState('greenairy');
  const [persona, setPersona] = useState('easy-going');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleStart = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!phone.trim() || phone.trim().length < 10) {
      setError('Please enter a valid phone number');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/start-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim(), persona, projectId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start session');
      }

      sessionStorage.setItem('interview_session', JSON.stringify({
        session_id: data.session_id,
        candidate_id: data.candidate_id,
        candidate_name: data.candidate_name,
        first_question: data.first_question,
        persona: data.persona,
        projectId: data.projectId,
        projectName: data.projectName,
      }));

      router.push('/interview');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
      {/* Top Nav */}
      <header className="top-bar" style={{ padding: '32px 48px' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Chandak CMIS</h1>
        <a href="/admin/login" className="nav-link">Admin Access</a>
      </header>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px' }}>
        <div style={{ width: '100%', maxWidth: '440px' }}>
          
          <div style={{ marginBottom: '48px' }}>
            <h2 style={{ fontSize: '2.5rem', marginBottom: '16px' }}>Interview Simulator</h2>
            <p style={{ color: 'var(--color-mid-dark)', fontFamily: 'var(--font-data)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              schema: candidates → sessions
            </p>
          </div>

          <form onSubmit={handleStart}>
            <div className="form-group">
              <label className="form-label" htmlFor="name">candidates.name</label>
              <input
                id="name"
                type="text"
                className="form-input"
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                autoComplete="name"
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="phone">candidates.phone</label>
              <input
                id="phone"
                type="tel"
                className="form-input"
                placeholder="Phone Number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={loading}
                autoComplete="tel"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="persona">sessions.current_persona</label>
              <select
                id="persona"
                className="form-input"
                value={persona}
                onChange={(e) => setPersona(e.target.value)}
                disabled={loading}
                style={{ appearance: 'none', borderRadius: 0, cursor: 'pointer' }}
              >
                <option value="easy-going">Easy-going (Friendly & Understanding)</option>
                <option value="confused">Confused (Needs lots of clarification)</option>
                <option value="arrogant">Arrogant (Demanding & Critical)</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: '48px' }}>
              <label className="form-label" htmlFor="projectId">sessions.project_id</label>
              <select
                id="projectId"
                className="form-input"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                disabled={loading}
                style={{ appearance: 'none', borderRadius: 0, cursor: 'pointer' }}
              >
                <option value="greenairy">Chandak GreenAiry</option>
                <option value="sarvam">Chandak Sarvam</option>
                <option value="vansham">Chandak Vansham</option>
                <option value="highscape">Chandak Highscape City</option>
                <option value="treesourus">Chandak Treesourus</option>
              </select>
            </div>

            {error && (
              <div style={{
                padding: '12px 0',
                color: '#8B0000',
                fontFamily: 'var(--font-data)',
                fontSize: '0.85rem',
                marginBottom: '24px',
                borderBottom: '1px solid #8B0000'
              }}>
                ERR: {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '16px' }}
              disabled={loading}
            >
              {loading ? 'Initializing Session...' : 'Start Session'}
            </button>
          </form>

          <div style={{ marginTop: '48px', borderTop: '1px solid var(--border-default)', paddingTop: '24px' }}>
            <p style={{ fontFamily: 'var(--font-data)', fontSize: '0.75rem', color: 'var(--color-mid-dark)', lineHeight: 1.6 }}>
              Instructions:<br/>
              - Answer 10 dynamic questions via voice.<br/>
              - Transcripts logged to sessions.transcript.<br/>
              - Final scores logged to reports.scores.
            </p>
          </div>

        </div>
      </div>
    </main>
  );
}
