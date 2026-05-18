'use client';

import { useState, use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';

// ── Step 1: Login screen (Microsoft SSO) ─────────────────────────────────────
function LoginStep({ onSuccess }) {
  const { data: session, status } = useSession();
  const [signingIn, setSigningIn] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch: don't render session-dependent UI until client is ready
  useEffect(() => { setMounted(true); }, []);

  // Once the user completes OAuth and session is ready → advance to Step 2
  useEffect(() => {
    if (mounted && status === 'authenticated' && session?.user?.email) {
      const email = session.user.email.toLowerCase();
      const localPart = email.split('@')[0];
      const derivedName = session.user.name || localPart
        .split(/[._-]/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      onSuccess({ email, name: derivedName, employeeId: '' });
    }
  }, [mounted, status, session, onSuccess]);

  const handleSSO = () => {
    setSigningIn(true);
    signIn('azure-ad', { callbackUrl: '/' });
  };

  // Render nothing until client hydration is complete
  if (!mounted) return null;

  return (
    <div style={{ width: '100%', maxWidth: '440px' }} suppressHydrationWarning>
      <div style={{ marginBottom: '48px' }}>
        <p style={{
          fontFamily: 'var(--font-data)',
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: 'var(--color-mid-dark)',
          marginBottom: '16px',
        }}>
          Step 01 / 02
        </p>
        <h2 style={{ fontSize: '2.5rem', marginBottom: '16px' }}>Staff Login</h2>
        <p style={{
          color: 'var(--color-mid-dark)',
          fontFamily: 'var(--font-data)',
          fontSize: '0.85rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          auth: microsoft sso · chandakgroup.com
        </p>
      </div>

      {/* Microsoft SSO Button */}
      <button
        id="sso-login-btn"
        type="button"
        onClick={handleSSO}
        disabled={signingIn || status === 'loading'}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          padding: '16px 20px',
          background: 'var(--text-primary)',
          color: 'var(--bg-primary)',
          border: '1px solid var(--text-primary)',
          borderRadius: 'var(--radius-max)',
          cursor: signingIn ? 'not-allowed' : 'pointer',
          opacity: signingIn ? 0.6 : 1,
          fontFamily: 'var(--font-body)',
          fontSize: '1rem',
          fontWeight: 500,
          transition: 'all var(--transition-fast)',
        }}
      >
        {/* Microsoft logo */}
        <svg width="20" height="20" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
          <rect x="1" y="1" width="9" height="9" fill="#F25022" />
          <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
          <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
          <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
        </svg>
        <span>
          {signingIn || status === 'loading' ? 'Redirecting to Microsoft...' : 'Sign in with Microsoft'}
        </span>
      </button>

      <div style={{ marginTop: '48px', borderTop: '1px solid var(--border-default)', paddingTop: '24px' }}>
        <p style={{
          fontFamily: 'var(--font-data)',
          fontSize: '0.75rem',
          color: 'var(--color-mid-dark)',
          lineHeight: 1.6,
        }}>
          Access restricted to Chandak Group staff.<br />
          Only @chandakgroup.com accounts are accepted.<br />
          Contact IT for access issues.
        </p>
      </div>
    </div>
  );
}


// ── Step 2: Interview setup ───────────────────────────────────────────────────
function SetupStep({ userInfo, onBack }) {
  const router = useRouter();
  const [name, setName] = useState(userInfo.name);
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

    setLoading(true);

    try {
      const response = await fetch('/api/start-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: userInfo.email,
          employeeId: userInfo.employeeId,
          persona,
          projectId,
        }),
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
    <div style={{ width: '100%', maxWidth: '440px' }}>
      <div style={{ marginBottom: '48px' }}>
        <p style={{
          fontFamily: 'var(--font-data)',
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: 'var(--color-mid-dark)',
          marginBottom: '16px'
        }}>
          Step 02 / 02
        </p>
        <h2 style={{ fontSize: '2.5rem', marginBottom: '16px' }}>Interview Simulator</h2>
        <p style={{
          color: 'var(--color-mid-dark)',
          fontFamily: 'var(--font-data)',
          fontSize: '0.85rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>
          schema: candidates → sessions
        </p>
      </div>

      {/* Logged-in badge */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 16px',
        border: '1px solid var(--border-default)',
        marginBottom: '32px',
        background: 'var(--bg-secondary)',
      }}>
        <div style={{
          width: '8px',
          height: '8px',
          background: 'var(--color-mid-dark)',
          borderRadius: '50%',
          flexShrink: 0,
        }} />
        <div>
          <p style={{
            fontFamily: 'var(--font-data)',
            fontSize: '0.72rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--color-mid-dark)',
            marginBottom: '2px',
          }}>Logged in as</p>
          <p style={{
            fontFamily: 'var(--font-data)',
            fontSize: '0.85rem',
            color: 'var(--text-primary)',
          }}>
            {userInfo.email} &nbsp;·&nbsp; ID: {userInfo.employeeId}
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          style={{
            marginLeft: 'auto',
            background: 'none',
            border: 'none',
            fontFamily: 'var(--font-data)',
            fontSize: '0.72rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          Switch
        </button>
      </div>

      <form onSubmit={handleStart}>
        <div className="form-group">
          <label className="form-label" htmlFor="candidate-name">candidates.name</label>
          <input
            id="candidate-name"
            type="text"
            className="form-input"
            placeholder="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
            autoComplete="name"
            autoFocus
            suppressHydrationWarning
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
          Instructions:<br />
          - Answer 10 dynamic questions via voice.<br />
          - Transcripts logged to sessions.transcript.<br />
          - Final scores logged to reports.scores.
        </p>
      </div>
    </div>
  );
}

// ── Root page ─────────────────────────────────────────────────────────────────
export default function EntryPage({ params, searchParams }) {
  use(params);
  use(searchParams);

  const [step, setStep] = useState(1);           // 1 = login, 2 = setup
  const [userInfo, setUserInfo] = useState(null); // { email, employeeId, name }

  const handleLoginSuccess = (info) => {
    setUserInfo(info);
    setStep(2);
  };

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
      {/* Top Nav */}
      <header className="top-bar" style={{ padding: '32px 48px' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Chandak CMIS</h1>
        <a href="/admin/login" className="nav-link">Admin Access</a>
      </header>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px' }}>
        {step === 1 && <LoginStep onSuccess={handleLoginSuccess} />}
        {step === 2 && (
          <SetupStep
            userInfo={userInfo}
            onBack={() => setStep(1)}
          />
        )}
      </div>
    </main>
  );
}
