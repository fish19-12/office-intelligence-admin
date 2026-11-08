"use client";

import { FormEvent, useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ email, password }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Sign in failed.");
      window.location.assign("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign in.");
      setBusy(false);
    }
  }

  return (
    <main className="login-shell">
      <div className="login-art" aria-hidden="true">
        <div className="art-orb orb-one" />
        <div className="art-orb orb-two" />
        <div className="art-grid" />
        <div className="art-copy">
          <div className="brand-mark">OI</div>
          <p className="eyebrow">DENBEGNAYE · OPERATIONS</p>
          <h1>Clarity for your<br />intelligent office.</h1>
          <p className="art-description">A private operations console for Office Intelligence users, activity, and payments.</p>
          <div className="art-footer"><span className="live-dot" /> SECURE ADMIN WORKSPACE</div>
        </div>
      </div>
      <section className="login-panel">
        <div className="mobile-brand"><span className="brand-mark">OI</span><span>Office Intelligence</span></div>
        <div className="login-card">
          <p className="eyebrow">ADMIN ACCESS</p>
          <h2>Welcome back</h2>
          <p className="muted">Sign in to manage your Office Intelligence operation.</p>
          <form onSubmit={submit} className="login-form">
            <label htmlFor="email">Administrator email</label>
            <input id="email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" />
            <label htmlFor="password">Password</label>
            <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" />
            {error && <div role="alert" className="error-box">{error}</div>}
            <button type="submit" className="primary-button login-button" disabled={busy}>{busy ? "Verifying access…" : "Sign in securely"}<span aria-hidden="true">→</span></button>
          </form>
          <div className="login-note"><span className="lock-icon">●</span> Protected with encrypted, HTTP-only admin sessions.</div>
        </div>
        <p className="login-copyright">© {new Date().getFullYear()} Denbegnaye · Office Intelligence Admin</p>
      </section>
    </main>
  );
}
