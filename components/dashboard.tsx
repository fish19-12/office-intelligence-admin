"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";

type Overview = {
  registered_user_count: number;
  active_user_count: number;
  execution_user_count: number;
  execution_count: number;
  uploaded_file_count: number;
  uploaded_bytes: number;
  current_library_file_count: number;
  current_library_bytes: number;
  untracked_library_file_count: number;
  analyzed_file_count: number;
  conversation_count: number;
};
type OfficeUser = {
  user_id: string;
  email: string;
  full_name: string | null;
  username: string | null;
  registered_at: string;
  execution_count: number;
  completed_execution_count: number;
  failed_execution_count: number;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  uploaded_file_count: number;
  uploaded_bytes: number;
  conversation_count: number;
  message_count: number;
  last_activity_at: string | null;
};
type OfficeData = {
  users: OfficeUser[];
  totalCount: number;
  overview: Overview;
  activities: Record<string, unknown>[];
  uploadedFiles: Record<string, unknown>[];
  page: number;
  limit: number;
};
type PlatformUser = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
  stats: { subscription: string; agents_count: number; executions_count: number };
};
type Payment = {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  payment_method: "cbe" | "telebirr";
  amount_etb: number;
  proof_url: string | null;
  status: "pending" | "approved" | "rejected";
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
};
type Section = "overview" | "users" | "payments";

async function api<T>(path: string, options?: { method?: string; body?: unknown }): Promise<T> {
  const response = await fetch(`/api/data/${path}`, {
    method: options?.method || "GET",
    headers: options?.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: options?.body === undefined ? undefined : JSON.stringify(options.body),
    credentials: "same-origin",
    cache: "no-store",
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
  return payload as T;
}

function number(value: number | null | undefined): string {
  return new Intl.NumberFormat().format(value || 0);
}
function date(value: string | null | undefined): string {
  if (!value) return "No recent activity";
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? "—" : parsed.toLocaleString();
}
function bytes(value: number | null | undefined): string {
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}
function initials(value: string): string {
  return value.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase() || "OI";
}

export default function Dashboard() {
  const [section, setSection] = useState<Section>("overview");
  const [email, setEmail] = useState("");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [officeUsers, setOfficeUsers] = useState<OfficeUser[]>([]);
  const [platformUsers, setPlatformUsers] = useState<PlatformUser[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [activities, setActivities] = useState<Record<string, unknown>[]>([]);
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("pending");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [activityOwner, setActivityOwner] = useState("");
  const [activityError, setActivityError] = useState("");
  const [workingId, setWorkingId] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    const searchQuery = search.trim() ? `&search=${encodeURIComponent(search.trim())}` : "";
    const results = await Promise.allSettled([
      api<OfficeData>(`office-intelligence/usage?page=1&limit=100${searchQuery}`),
      api<{ users: PlatformUser[] }>(`users?page=1&limit=100${searchQuery}`),
      api<{ requests: Payment[] }>(`office-intelligence-payments?status=${paymentFilter}`),
    ]);
    const failures: string[] = [];

    if (results[0].status === "fulfilled") {
      const office = results[0].value;
      setOverview(office.overview);
      setOfficeUsers(office.users);
      const latestUser = office.users[0];
      if (latestUser) {
        setActivityOwner(latestUser.email);
        setActivityError("");
        try {
          const activity = await api<OfficeData>(
            `office-intelligence/usage?page=1&limit=100&user_id=${encodeURIComponent(latestUser.user_id)}`
          );
          setActivities(activity.activities || []);
        } catch (cause) {
          setActivities([]);
          setActivityError(cause instanceof Error ? cause.message : "Could not load recent activity.");
        }
      } else {
        setActivityOwner("");
        setActivities([]);
        setActivityError("");
      }
    } else {
      failures.push(`Office Intelligence: ${results[0].reason instanceof Error ? results[0].reason.message : "request failed"}`);
    }

    if (results[1].status === "fulfilled") setPlatformUsers(results[1].value.users || []);
    else failures.push(`Users: ${results[1].reason instanceof Error ? results[1].reason.message : "request failed"}`);

    if (results[2].status === "fulfilled") setPayments(results[2].value.requests || []);
    else failures.push(`Payments: ${results[2].reason instanceof Error ? results[2].reason.message : "request failed"}`);

    setError(failures.join(" "));
    setLoading(false);
  }, [paymentFilter, search]);

  useEffect(() => {
    void fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          window.location.replace("/login");
          return null;
        }
        return response.json();
      })
      .then((session) => {
        if (session?.email) {
          setEmail(session.email);
          setAuthenticated(true);
        }
      })
      .catch(() => {
        window.location.replace("/login");
      });
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    const timeout = window.setTimeout(() => void loadData(), search ? 300 : 0);
    return () => window.clearTimeout(timeout);
  }, [authenticated, loadData, refreshKey, search]);

  const officeUserById = useMemo(() => new Map(officeUsers.map((user) => [user.user_id, user])), [officeUsers]);

  async function review(payment: Payment, decision: "approve" | "reject") {
    const note = decision === "reject" ? window.prompt("Optional note for the customer:") : "";
    if (note === null) return;
    if (decision === "approve" && !window.confirm(`Approve ${payment.full_name}'s 299 ETB payment and activate one month?`)) return;
    setWorkingId(payment.id);
    setError("");
    setNotice("");
    try {
      const result = await api<{ emailSent?: boolean }>("office-intelligence-payments", {
        method: "PATCH",
        body: { requestId: payment.id, decision, note },
      });
      setNotice(
        decision === "approve"
          ? result.emailSent === false
            ? "Payment approved and access activated. The confirmation email could not be sent."
            : "Payment approved; one month of access was activated and the user was emailed."
          : result.emailSent === false
            ? "Payment rejected. The rejection email could not be sent."
            : "Payment rejected and the user was emailed.",
      );
      await loadData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not review payment.");
    } finally {
      setWorkingId("");
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    window.location.replace("/login");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="Office Intelligence Admin home">
          <span className="brand-mark">OI</span>
          <span className="brand-label"><strong>Office Intelligence</strong><small>OPERATIONS CONSOLE</small></span>
        </Link>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Admin sections">
          <button className={section === "overview" ? "nav-item active" : "nav-item"} onClick={() => setSection("overview")}><span className="nav-icon">◫</span>Overview</button>
          <button className={section === "users" ? "nav-item active" : "nav-item"} onClick={() => setSection("users")}><span className="nav-icon">♙</span>Users<span className="nav-count">{overview ? number(overview.registered_user_count) : "—"}</span></button>
          <button className={section === "payments" ? "nav-item active" : "nav-item"} onClick={() => setSection("payments")}><span className="nav-icon">＄</span>Payments{payments.filter((item) => item.status === "pending").length > 0 && <span className="nav-badge">{payments.filter((item) => item.status === "pending").length}</span>}</button>
        </nav>
        <div className="sidebar-bottom">
          <div className="connection-card"><span className={error ? "live-dot disconnected" : "live-dot"} /><span><strong>{error ? "Connection needs attention" : "Denbegnaye API"}</strong><small>{loading ? "Refreshing data…" : error ? "Some data could not load" : "Connected · live data"}</small></span></div>
          <button className="profile-button" onClick={() => void logout()} title={`Sign out ${email}`}>
            <span className="avatar">{initials(email.split("@")[0] || "Admin")}</span>
            <span className="profile-copy"><strong>{email || "Administrator"}</strong><small>Sign out securely</small></span>
            <span className="logout-icon">↗</span>
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div><p className="breadcrumb">DENBEGNAYE <span>/</span> OFFICE INTELLIGENCE</p><p className="topbar-caption">Operations overview</p></div>
          <div className="top-actions"><span className="live-status"><span className="live-dot" /> Live data</span><button className="icon-button" onClick={() => setRefreshKey((key) => key + 1)} aria-label="Refresh dashboard" title="Refresh">↻</button></div>
        </header>
        <div className="page-content">
          <section className="welcome-row">
            <div><p className="eyebrow">MONDAY · OFFICE OPERATIONS</p><h1>{section === "overview" ? "Office at a glance" : section === "users" ? "Your Office users" : "Payment review"}</h1><p className="muted">{section === "overview" ? "A clear view of usage, adoption, and the work happening across Office Intelligence." : section === "users" ? "Accounts and Office Intelligence activity from your Denbegnaye platform." : "Review transfer receipts and manage monthly Office Intelligence access."}</p></div>
            <label className="search-box"><span>⌕</span><input aria-label="Search users" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search users…" /></label>
          </section>
          {error && <div role="alert" className="alert error-box"><strong>Could not load data</strong><span>{error}</span><button onClick={() => setRefreshKey((key) => key + 1)}>Try again</button></div>}
          {notice && <div role="status" className="alert success-box"><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss">×</button></div>}

          {section === "overview" && (
            <>
              <section className="stats-grid" aria-label="Office Intelligence overview">
                <StatCard label="Registered users" value={number(overview?.registered_user_count)} detail={`${number(overview?.active_user_count)} active accounts`} accent="blue" icon="♙" loading={loading} />
                <StatCard label="AI executions" value={number(overview?.execution_count)} detail={`${number(overview?.execution_user_count)} users have run an agent`} accent="violet" icon="✳" loading={loading} />
                <StatCard label="Conversations" value={number(overview?.conversation_count)} detail="Saved Office Intelligence chats" accent="teal" icon="▤" loading={loading} />
                <StatCard label="Files in library" value={number(overview?.current_library_file_count)} detail={`${bytes(overview?.current_library_bytes)} current storage`} accent="amber" icon="▧" loading={loading} />
              </section>
              <section className="content-grid">
                <div className="panel activity-panel">
                  <div className="panel-heading"><div><p className="eyebrow">ADOPTION</p><h2>Office Intelligence users</h2></div><button className="text-button" onClick={() => setSection("users")}>View users <span>→</span></button></div>
                  {loading ? <LoadingRows /> : officeUsers.length === 0 ? <EmptyState title="No users found" description="Users who have signed up will appear here." /> : (
                    <div className="table-wrap"><table><thead><tr><th>USER</th><th>EXECUTIONS</th><th>FILES</th><th>LAST ACTIVE</th></tr></thead><tbody>{officeUsers.slice(0, 6).map((user) => <tr key={user.user_id}><td><div className="user-cell"><span className="avatar">{initials(user.full_name || user.email)}</span><span><strong>{user.full_name || user.email.split("@")[0]}</strong><small>{user.email}</small></span></div></td><td>{number(user.execution_count)}</td><td>{number(user.uploaded_file_count)}</td><td className="muted-cell">{date(user.last_activity_at)}</td></tr>)}</tbody></table></div>
                  )}
                  <div className="panel-footer"><span>Showing {number(Math.min(officeUsers.length, 6))} of {number(overview?.registered_user_count)} registered users</span><button className="text-button" onClick={() => setSection("users")}>Explore users →</button></div>
                </div>
                <aside className="panel quick-panel"><p className="eyebrow">QUICK INSIGHTS</p><h2>Usage snapshot</h2><Insight label="Files uploaded" value={number(overview?.uploaded_file_count)} detail={bytes(overview?.uploaded_bytes)} /><Insight label="Files analyzed" value={number(overview?.analyzed_file_count)} detail="Processed in agent runs" /><Insight label="Token usage" value={number(officeUsers.reduce((total, user) => total + (user.total_tokens || 0), 0))} detail="Provider-reported usage on this page" /><div className="quick-payment"><span className="quick-payment-icon">＄</span><div><strong>Manual payments</strong><small>299 ETB · monthly access</small></div><button onClick={() => setSection("payments")} aria-label="Open payment review">→</button></div></aside>
              </section>
              <section className="panel activity-feed"><div className="panel-heading"><div><p className="eyebrow">RECENT ACTIVITY</p><h2>Recent runs{activityOwner ? ` · ${activityOwner}` : ""}</h2></div></div>{activityError && <div role="alert" className="alert error-box">{activityError}</div>}{loading ? <LoadingRows /> : activities.length === 0 ? <EmptyState title={activityError ? "Activity unavailable" : "No recent runs"} description={activityError ? "Check the Office Intelligence API response above." : "The most recently active Office Intelligence user has no recorded runs yet."} /> : <div className="table-wrap"><table><thead><tr><th>MODEL</th><th>STATUS</th><th>TOKENS</th><th>WHEN</th></tr></thead><tbody>{activities.slice(0, 8).map((item, index) => <tr key={`${String(item.execution_id || index)}-${index}`}><td>{String(item.model_name || "—")}</td><td><span className={`status-pill status-${String(item.status || "unknown")}`}>{String(item.status || "unknown")}</span></td><td>{number(Number(item.total_tokens || 0))}</td><td className="muted-cell">{date(String(item.created_at || ""))}</td></tr>)}</tbody></table></div>}</section>
            </>
          )}

          {section === "users" && (
            <section className="panel">
              <div className="panel-heading"><div><p className="eyebrow">PLATFORM ACCOUNTS</p><h2>Users & Office activity</h2></div><span className="result-count">{number(platformUsers.length)} accounts</span></div>
              {loading ? <LoadingRows /> : platformUsers.length === 0 ? <EmptyState title="No matching users" description="Try a different name, email, or username." /> : <div className="table-wrap"><table><thead><tr><th>ACCOUNT</th><th>ROLE</th><th>OFFICE RUNS</th><th>CHATS</th><th>FILES</th><th>LAST OFFICE ACTIVITY</th></tr></thead><tbody>{platformUsers.map((user) => {const office = officeUserById.get(user.id);return <tr key={user.id}><td><div className="user-cell"><span className="avatar">{initials(user.full_name || user.email)}</span><span><strong>{user.full_name || "Unnamed user"}</strong><small>{user.email}</small></span></div></td><td><span className={`role-pill role-${user.role}`}>{user.role}</span></td><td>{number(office?.execution_count)}</td><td>{number(office?.conversation_count)}</td><td>{number(office?.uploaded_file_count)}</td><td className="muted-cell">{date(office?.last_activity_at)}</td></tr>;})}</tbody></table></div>}
              <div className="panel-footer"><span>Showing the first 100 matching platform accounts</span><span>Search filters update automatically</span></div>
            </section>
          )}

          {section === "payments" && (
            <section className="panel">
              <div className="panel-heading payment-heading"><div><p className="eyebrow">299 ETB · MONTHLY</p><h2>Office Intelligence payments</h2><p className="muted">Check the private receipt, then decide whether to activate access.</p></div><label className="filter-label">Show<select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}><option value="pending">Awaiting review</option><option value="all">All requests</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></label></div>
              {loading ? (
                <LoadingRows />
              ) : payments.length === 0 ? (
                <EmptyState
                  title="No payment requests"
                  description={paymentFilter === "pending" ? "New submissions are shown here when users send their receipt." : "No requests match this filter."}
                />
              ) : (
                <div className="payment-list">
                  {payments.map((payment) => (
                    <article className="payment-card" key={payment.id}>
                      <div className="payment-user">
                        <span className="avatar large">{initials(payment.full_name)}</span>
                        <div>
                          <div className="payment-name">
                            {payment.full_name}
                            <span className={`status-pill status-${payment.status}`}>{payment.status}</span>
                          </div>
                          <p>{payment.email} · {payment.phone}</p>
                          <small>Submitted {date(payment.created_at)}</small>
                        </div>
                      </div>
                      <div className="payment-meta">
                        <span className="amount">{number(payment.amount_etb)} ETB</span>
                        <span className="method-pill">
                          {payment.payment_method === "cbe" ? "Commercial Bank of Ethiopia" : "Telebirr"}
                        </span>
                      </div>
                      <div className="payment-proof">
                        {payment.proof_url ? (
                          <a href={payment.proof_url} target="_blank" rel="noreferrer">
                            <Image
                              src={payment.proof_url}
                              alt={`Payment receipt from ${payment.full_name}`}
                              width={1200}
                              height={800}
                              unoptimized
                            />
                            <span>Open full receipt ↗</span>
                          </a>
                        ) : (
                          <div className="proof-missing">Receipt unavailable</div>
                        )}
                      </div>
                      {payment.admin_note && (
                        <p className="review-note"><strong>Review note</strong> {payment.admin_note}</p>
                      )}
                      {payment.status === "pending" && (
                        <div className="review-actions">
                          <button
                            className="approve-button"
                            disabled={workingId === payment.id}
                            onClick={() => void review(payment, "approve")}
                          >
                            {workingId === payment.id ? "Working…" : "Approve & activate"}
                          </button>
                          <button
                            className="reject-button"
                            disabled={workingId === payment.id}
                            onClick={() => void review(payment, "reject")}
                          >
                            Reject request
                          </button>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
              <div className="panel-footer"><span>Private receipt links expire after 10 minutes.</span><span>Actions are applied to Denbegnaye immediately.</span></div>
            </section>
          )}
          <footer className="page-footer"><span>Denbegnaye Office Intelligence · Admin workspace</span><span>Data is read securely from the connected platform.</span></footer>
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, detail, accent, icon, loading }: { label: string; value: string; detail: string; accent: string; icon: string; loading: boolean }) {
  return <article className={`stat-card accent-${accent}`}><div className="stat-top"><span>{label}</span><span className="stat-icon">{icon}</span></div><strong className={loading ? "skeleton-number" : ""}>{value}</strong><small>{detail}</small><div className="stat-line" /></article>;
}
function Insight({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="insight"><div><span>{label}</span><strong>{value}</strong></div><small>{detail}</small></div>;
}
function LoadingRows() {
  return <div className="loading-rows"><span /><span /><span /><span /></div>;
}
function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="empty-state"><span className="empty-icon">◌</span><strong>{title}</strong><p>{description}</p></div>;
}
