'use client';

import { useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Suspense } from 'react';

const ERROR_MESSAGES = {
  AccessDenied: 'Access denied. Only @chandakgroup.com email accounts are allowed.',
  OAuthSignin:  'Could not start the Microsoft sign-in flow. Please try again.',
  OAuthCallback:'An error occurred during the Microsoft sign-in callback. Please try again.',
  Configuration:'Server configuration error. Please contact IT support.',
  Default:      'An unexpected authentication error occurred.',
};

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const errorCode = searchParams.get('error') ?? 'Default';
  const message = ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.Default;

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
      <header className="top-bar" style={{ padding: '32px 48px' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Chandak CMIS</h1>
      </header>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px' }}>
        <div style={{ width: '100%', maxWidth: '440px' }}>

          <div style={{ marginBottom: '48px' }}>
            <p style={{
              fontFamily: 'var(--font-data)',
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: '#8B0000',
              marginBottom: '16px',
            }}>
              auth.error
            </p>
            <h2 style={{ fontSize: '2.5rem', marginBottom: '16px' }}>Access Denied</h2>
          </div>

          <div style={{
            padding: '20px',
            border: '1px solid #8B0000',
            marginBottom: '40px',
            fontFamily: 'var(--font-data)',
            fontSize: '0.85rem',
            color: '#8B0000',
            lineHeight: 1.6,
          }}>
            ERR [{errorCode}]: {message}
          </div>

          <button
            className="btn btn-primary"
            style={{ width: '100%', padding: '16px' }}
            onClick={() => signIn('azure-ad', { callbackUrl: '/' })}
          >
            Try Again with Microsoft
          </button>

          <div style={{ marginTop: '24px' }}>
            <a href="/" className="nav-link" style={{ fontFamily: 'var(--font-data)', fontSize: '0.8rem' }}>
              ← Back to Login
            </a>
          </div>

        </div>
      </div>
    </main>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense>
      <AuthErrorContent />
    </Suspense>
  );
}
