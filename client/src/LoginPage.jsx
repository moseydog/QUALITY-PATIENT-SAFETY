import React, { useState } from 'react';

export default function LoginPage({ onLogin }) {
  const initialPortal = window.location.pathname.toLowerCase().includes('admin') ? 'admin' : 'volunteer';
  const [portal, setPortal] = useState(initialPortal);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/${portal}-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }
      onLogin(data);
    } catch (err) {
      setError('Could not reach the server. Try again.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface-2 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-panel text-panel-text rounded-t px-6 py-5">
          <span className="bg-panel-text text-panel text-xs font-bold px-2 py-1 rounded">QPS</span>
          <h1 className="text-base font-semibold mt-3 leading-snug">Quality and Patient Safety Volunteer Program</h1>
          <p className="text-[11px] text-panel-muted mt-1">Falls &amp; pressure injury prevention · Hospital #1</p>
        </div>
        <div className="flex border-x border-rule">
          <button
            type="button"
            onClick={() => setPortal('volunteer')}
            className={`flex-1 py-2.5 text-sm font-medium transition ${portal === 'volunteer' ? 'bg-surface text-ink border-b-2 border-ink' : 'bg-surface-2 text-text-muted border-b border-rule hover:text-ink'}`}
          >
            Volunteer
          </button>
          <button
            type="button"
            onClick={() => setPortal('admin')}
            className={`flex-1 py-2.5 text-sm font-medium transition ${portal === 'admin' ? 'bg-surface text-ink border-b-2 border-ink' : 'bg-surface-2 text-text-muted border-b border-rule hover:text-ink'}`}
          >
            Admin
          </button>
        </div>
        <form onSubmit={handleSubmit} className="bg-surface border-x border-b border-rule rounded-b p-6 space-y-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-dim">{portal === 'admin' ? 'Administrator sign-in' : 'Volunteer sign-in'}</p>
          <div>
            <label className="text-xs text-text-muted">Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border border-rule rounded px-3 py-2 text-sm mt-1"
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label className="text-xs text-text-muted">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-rule rounded px-3 py-2 text-sm mt-1"
              autoComplete="current-password"
              required
            />
          </div>
          {error && <p className="text-sm text-status-bad">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-ink text-paper rounded py-2 text-sm font-medium disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
