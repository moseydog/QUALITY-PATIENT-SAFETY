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
    <div className="min-h-screen bg-paper flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex border border-rule mb-6">
          <button
            type="button"
            onClick={() => setPortal('volunteer')}
            className={`flex-1 py-2 text-sm font-medium transition ${portal === 'volunteer' ? 'bg-hapi-accent text-white' : 'bg-white text-slate-500'}`}
          >
            Volunteer
          </button>
          <button
            type="button"
            onClick={() => setPortal('admin')}
            className={`flex-1 py-2 text-sm font-medium transition ${portal === 'admin' ? 'bg-ink text-white' : 'bg-white text-slate-500'}`}
          >
            Admin
          </button>
        </div>
        <form onSubmit={handleSubmit} className="bg-white border-t-2 border-ink border-x border-b border-rule p-6 space-y-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-editorial mb-1">{portal === 'admin' ? 'Administrator access' : 'Volunteer access'}</p>
            <h1 className="font-serif text-xl font-semibold text-ink">Quality and Patient Safety Volunteer Program</h1>
          </div>
          <div>
            <label className="text-xs text-slate-500">Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border border-rule rounded px-3 py-2 text-sm mt-1"
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Password</label>
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
            className="w-full bg-ink text-white rounded py-2 text-sm font-medium disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
