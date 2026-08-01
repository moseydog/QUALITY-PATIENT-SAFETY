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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex rounded-lg overflow-hidden border border-slate-200 mb-6">
          <button
            type="button"
            onClick={() => setPortal('volunteer')}
            className={`flex-1 py-2 text-sm font-medium transition ${portal === 'volunteer' ? 'bg-teal-600 text-white' : 'bg-white text-slate-500'}`}
          >
            Volunteer
          </button>
          <button
            type="button"
            onClick={() => setPortal('admin')}
            className={`flex-1 py-2 text-sm font-medium transition ${portal === 'admin' ? 'bg-slate-800 text-white' : 'bg-white text-slate-500'}`}
          >
            Admin
          </button>
        </div>
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <div>
            <h1 className="text-lg font-bold text-slate-800">{portal === 'admin' ? 'Admin login' : 'Volunteer login'}</h1>
            <p className="text-sm text-slate-500 mt-0.5">Quality and Patient Safety Volunteer Program</p>
          </div>
          <div>
            <label className="text-xs text-slate-500">Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1"
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
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mt-1"
              autoComplete="current-password"
              required
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-800 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
