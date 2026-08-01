import React, { useState, useEffect } from 'react';
import LoginPage from './LoginPage.jsx';
import Dashboard from './Dashboard.jsx';

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = checking session, null = logged out

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setUser(data))
      .catch(() => setUser(null));
  }, []);

  function handleLogout() {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).finally(() => setUser(null));
  }

  if (user === undefined) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400 text-sm">Loading…</div>;
  }
  if (!user) {
    return <LoginPage onLogin={setUser} />;
  }
  return <Dashboard user={user} onLogout={handleLogout} />;
}
