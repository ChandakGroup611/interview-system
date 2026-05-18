'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminDashboard({ params, searchParams }) {
  use(params);
  use(searchParams);
  const router = useRouter();
  const [activeSection, setActiveSection] = useState('sessions');
  const [data, setData] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authChecking, setAuthChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchData(page);
    }
  }, [activeSection, isAuthenticated, page]);

  useEffect(() => {
    if (!isAuthenticated) return;
    
    const interval = setInterval(() => {
      fetchData(page);
    }, 30000);
    
    return () => clearInterval(interval);
  }, [isAuthenticated, activeSection, page]);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/admin/auth-check');
      if (!res.ok) {
        router.push('/admin/login');
        return;
      }
      setIsAuthenticated(true);
      setAuthChecking(false);
    } catch {
      router.push('/admin/login');
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
      router.push('/admin/login');
    } catch {
      router.push('/admin/login');
    }
  };

  const fetchData = async (pageNum = 1) => {
    setLoading(true);
    setError('');
    try {
      if (activeSection === 'sessions') {
        const res = await fetch(`/api/admin/sessions?page=${pageNum}&limit=15`);
        const result = await res.json();
        if (!res.ok) throw new Error(result.error);
        setData(result.sessions || []);
        setAnalytics(result.analytics || null);
        setPagination(result.pagination || null);
      } else {
        const res = await fetch(`/api/admin/data?table=${activeSection}&page=${pageNum}&limit=15`);
        const result = await res.json();
        if (!res.ok) throw new Error(result.error);
        setData(result.data || []);
        setPagination(result.pagination || null);
        setAnalytics(null);
      }
      setPage(pageNum);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkEvaluate = async () => {
    const pendingSessions = data.filter(s => s.status === 'completed');
    if (pendingSessions.length === 0) return;
    
    setLoading(true);
    try {
      for (const session of pendingSessions) {
        await fetch('/api/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: session.id }),
        });
      }
      fetchData(page);
    } catch (err) {
      setError(`Bulk eval error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePdfDirectly = async (sessionId) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/resend-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      fetchData(page);
    } catch (err) {
      setError(`Failed to generate PDF: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString('en-US', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false
    }).replace(',', '');
  };

  if (authChecking) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const renderTableHeaders = () => {
    switch (activeSection) {
      case 'sessions':
        return (
          <tr>
            <th>id (UUID)</th>
            <th>candidate_id</th>
            <th>project_name</th>
            <th className="text-right">current_question</th>
            <th>status</th>
            <th className="text-right">final_score</th>
            <th className="text-right">created_at</th>
            <th>actions</th>
          </tr>
        );
      case 'candidates':
        return (
          <tr>
            <th>id</th>
            <th>name</th>
            <th>Chandak Mail id</th>
            <th className="text-right">created_at</th>
          </tr>
        );
      case 'reports':
        return (
          <tr>
            <th>id</th>
            <th>session_id</th>
            <th className="text-right">final_score</th>
            <th>pdf</th>
            <th className="text-right">created_at</th>
          </tr>
        );
      case 'admin_login_logs':
        return (
          <tr>
            <th>id</th>
            <th>user_id</th>
            <th>ip_address</th>
            <th>status</th>
            <th className="text-right">created_at</th>
          </tr>
        );
      default:
        return null;
    }
  };

  const renderTableRows = () => {
    if (loading) {
      return (
        <tr>
          <td colSpan="8" style={{ textAlign: 'center', padding: '48px' }}>
            <div className="spinner" style={{ margin: '0 auto' }} />
          </td>
        </tr>
      );
    }
    if (data.length === 0) {
      return (
        <tr>
          <td colSpan="8" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
            0 rows returned.
          </td>
        </tr>
      );
    }

    return data.map((item) => {
      switch (activeSection) {
        case 'sessions': {
          const report = item.reports?.[0];
          const score = report?.final_score ?? null;
          return (
            <tr key={item.id}>
              <td className="text-mono" style={{ fontSize: '0.75rem', color: 'var(--color-mid-dark)' }}>{item.id?.split('-')[0] || '—'}...</td>
              <td className="text-mono" style={{ fontSize: '0.75rem' }}>{item.candidates?.name || item.candidate_id?.split('-')[0] || '—'}</td>
              <td>{item.project_name || 'null'}</td>
              <td className="text-right text-mono">{item.current_question || 0}</td>
              <td>
                <span className={`status-indicator status-${item.status}`}>
                  {item.status}
                </span>
              </td>
              <td className="text-right text-mono">
                {score !== null ? score.toFixed(1) : 'null'}
              </td>
              <td className="text-right text-mono" style={{ fontSize: '0.75rem' }}>
                {formatDate(item.created_at)}
              </td>
              <td>
                <a href={`/admin/session/${item.id}`} className="nav-link" style={{ fontSize: '0.7rem' }}>
                  Inspect Row
                </a>
              </td>
            </tr>
          );
        }
        case 'candidates':
          return (
            <tr key={item.id}>
              <td className="text-mono" style={{ fontSize: '0.75rem', color: 'var(--color-mid-dark)' }}>{item.id.split('-')[0]}...</td>
              <td>{item.name}</td>
              <td className="text-mono">{item.phone}</td>
              <td className="text-right text-mono" style={{ fontSize: '0.75rem' }}>{formatDate(item.created_at)}</td>
            </tr>
          );
        case 'reports':
          return (
            <tr key={item.id}>
              <td className="text-mono" style={{ fontSize: '0.75rem', color: 'var(--color-mid-dark)' }}>{item.id?.split('-')[0] || '—'}...</td>
              <td className="text-mono" style={{ fontSize: '0.75rem' }}>{item.session_id?.split('-')[0] || '—'}...</td>
              <td className="text-right text-mono">{item.final_score?.toFixed(1) || 'null'}</td>
              <td>
                {item.pdf_url ? (
                  <a href={item.pdf_url} target="_blank" rel="noopener noreferrer" className="nav-link" style={{ fontSize: '0.7rem' }}>
                    Download PDF
                  </a>
                ) : (
                  <button
                    className="btn btn-sm"
                    onClick={() => handleGeneratePdfDirectly(item.session_id)}
                    style={{ fontSize: '0.65rem', padding: '2px 8px' }}
                  >
                    Generate PDF
                  </button>
                )}
              </td>
              <td className="text-right text-mono" style={{ fontSize: '0.75rem' }}>{formatDate(item.created_at)}</td>
            </tr>
          );
        case 'admin_login_logs':
          return (
            <tr key={item.id}>
              <td className="text-mono" style={{ fontSize: '0.75rem', color: 'var(--color-mid-dark)' }}>{item.id.split('-')[0]}...</td>
              <td className="text-mono">{item.user_id}</td>
              <td className="text-mono">{item.ip_address}</td>
              <td>
                <span className={`status-indicator status-${item.status}`}>
                  {item.status}
                </span>
              </td>
              <td className="text-right text-mono" style={{ fontSize: '0.75rem' }}>{formatDate(item.created_at)}</td>
            </tr>
          );
        default:
          return null;
      }
    });
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Sidebar Navigation */}
      <aside style={{ width: '240px', borderRight: '1px solid var(--border-default)', padding: '32px 24px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginBottom: '48px' }}>
          <h2 style={{ fontSize: '1.25rem', color: 'var(--text-black)' }}>Sources</h2>
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
          {['sessions', 'candidates', 'reports', 'admin_login_logs'].map(section => (
            <span
              key={section}
              className="nav-link"
              onClick={() => { setActiveSection(section); setPage(1); }}
              style={{
                fontWeight: activeSection === section ? '600' : '400',
                color: activeSection === section ? 'var(--text-black)' : 'var(--text-primary)',
                cursor: 'pointer'
              }}
            >
              {section}
            </span>
          ))}
        </nav>
        <div style={{ marginTop: 'auto' }}>
          <button onClick={handleLogout} className="btn" style={{ width: '100%', justifyContent: 'flex-start', padding: '8px 0', border: 'none' }}>
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Top Nav */}
        <header className="top-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Chandak CMIS</h1>
            <span style={{ color: 'var(--border-default)' }}>/</span>
            <span style={{ fontFamily: 'var(--font-data)', fontSize: '0.85rem', color: 'var(--color-mid-dark)', textTransform: 'uppercase' }}>
              Table: {activeSection}
            </span>
          </div>
          <button className="btn btn-primary" onClick={() => router.push('/')}>
            New Session
          </button>
        </header>

        <div style={{ padding: '32px 48px', flex: 1, overflowY: 'auto' }}>
          {error && (
            <div style={{ padding: '12px 16px', border: '1px solid #8B0000', color: '#8B0000', marginBottom: '24px', fontFamily: 'var(--font-data)', fontSize: '0.85rem' }}>
              ERR: {error}
            </div>
          )}

          {/* Pipeline Metadata (Stat Cards) */}
          {activeSection === 'sessions' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', marginBottom: '48px' }}>
              <div className="card">
                <div className="form-label">Total Rows</div>
                <div className="text-mono" style={{ fontSize: '2rem', color: 'var(--text-black)' }}>
                  {loading ? '...' : pagination?.total || 0}
                </div>
              </div>
              <div className="card">
                <div className="form-label">Evaluated Sessions</div>
                <div className="text-mono" style={{ fontSize: '2rem', color: 'var(--text-black)' }}>
                  {loading ? '...' : analytics?.totalInterviews || 0}
                </div>
              </div>
              <div className="card">
                <div className="form-label">Avg Quality Score</div>
                <div className="text-mono" style={{ fontSize: '2rem', color: 'var(--text-black)' }}>
                  {loading ? '...' : (analytics?.averageScore || 0).toFixed(1)}
                </div>
              </div>
              <div className="card">
                <div className="form-label">Last Sync</div>
                <div className="text-mono" style={{ fontSize: '1.25rem', color: 'var(--text-black)', marginTop: '8px' }}>
                  {loading ? '...' : 'LIVE'}
                </div>
              </div>
            </div>
          )}

          <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.25rem', margin: 0 }}>Table: {activeSection}</h3>
            <div style={{ display: 'flex', gap: '16px' }}>
              {activeSection === 'sessions' && data.some(s => s.status === 'completed') && (
                <button className="btn btn-primary btn-sm" onClick={handleBulkEvaluate}>Process All Pending</button>
              )}
              <button className="btn btn-sm" onClick={() => fetchData(page)}>Force Sync</button>
            </div>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                {renderTableHeaders()}
              </thead>
              <tbody>
                {renderTableRows()}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px' }}>
              <div className="text-mono" style={{ fontSize: '0.75rem', color: 'var(--color-mid-dark)' }}>
                Showing page {page} of {pagination.totalPages}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-sm"
                  disabled={page <= 1}
                  onClick={() => fetchData(page - 1)}
                >
                  Prev
                </button>
                <button
                  className="btn btn-sm"
                  disabled={page >= pagination.totalPages}
                  onClick={() => fetchData(page + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
