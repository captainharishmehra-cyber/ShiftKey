import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, AlertCircle, AlertTriangle, ArrowDownToLine, CalendarDays,
  CheckCircle2, ChevronDown, ChevronRight, Clock3, FileSpreadsheet,
  Filter, LogOut, RefreshCw, Search, ShieldCheck, Users, XCircle
} from "lucide-react";

async function api(path, options = {}) {
  const headers = { "X-Requested-With": "ShiftKey", ...(options.headers || {}) };
  if (options.json !== undefined) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(options.json);
    delete options.json;
  }
  const response = await fetch(path, { credentials: "same-origin", ...options, headers });
  if (response.status === 204) return null;
  const type = response.headers.get("content-type") || "";
  const body = type.includes("json") ? await response.json() : await response.text();
  if (!response.ok) {
    const error = new Error(body?.detail || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return body;
}

const number = value => Number(value || 0).toLocaleString();
const dateLabel = value => {
  if (!value) return "—";
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: "short", day: "numeric", month: "short", year: "numeric"
  });
};

function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const user = await api("/api/auth/login", { method: "POST", json: { username: username.trim(), password } });
      setPassword(""); onLogin(user);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <main className="login-wrap">
    <form className="login-card" onSubmit={submit}>
      <div className="brand-mark large">S</div>
      <p className="eyebrow">HUMAN RESOURCES MANAGEMENT</p>
      <h1>Welcome to ShiftKey</h1>
      <p className="muted">Sign in to continue to your attendance workspace.</p>
      <label>Username<input autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} required /></label>
      <label>Password<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
      {error && <div className="error-line"><AlertCircle size={16}/>{error}</div>}
      <button className="primary-btn full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
    </form>
  </main>;
}

function Metric({ icon: Icon, label, value, tone, note }) {
  return <article className="metric-card">
    <div className={`metric-icon ${tone || ""}`}><Icon size={19}/></div>
    <div className="metric-copy"><span>{label}</span><strong>{number(value)}</strong>{note && <small>{note}</small>}</div>
  </article>;
}

function StatusPill({ record }) {
  let cls = "neutral", label = record.status_label || record.status || "Unknown";
  if (record.is_corrected) { cls = "corrected"; label = "Resolved"; }
  else if (record.is_halfday) cls = "halfday";
  else if (record.flag_mispunch || record.is_mispunch) { cls = "mispunch"; label = "Mispunch"; }
  else if (record.flag_warning || record.has_warning) { cls = "warning"; label = "Review"; }
  else if (record.is_absent) cls = "absent";
  else if (record.is_present) cls = "present";
  return <span className={`status-pill ${cls}`}>{label}</span>;
}

function App() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [reports, setReports] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [department, setDepartment] = useState("all");

  const loadReports = useCallback(async () => {
    setBusy(true); setError("");
    try {
      const rows = await api("/api/reports");
      setReports(rows);
      setSelectedId(current => current && rows.some(r => r.id === current) ? current : rows[0]?.id ?? null);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }, []);

  const loadDetail = useCallback(async id => {
    if (!id) { setDetail(null); return; }
    try { setDetail(await api(`/api/reports/${id}`)); setError(""); }
    catch (err) { setError(err.message); }
  }, []);

  useEffect(() => {
    (async () => {
      try { setUser(await api("/api/me")); } catch { setUser(null); }
      setAuthReady(true);
    })();
  }, []);

  useEffect(() => { if (user) loadReports(); }, [user, loadReports]);
  useEffect(() => { if (selectedId) loadDetail(selectedId); else setDetail(null); }, [selectedId, loadDetail]);

  const records = useMemo(() => (detail?.departments || []).flatMap(group =>
    (group.records || []).map(record => ({ ...record, _department: group.name || group.code }))
  ), [detail]);

  const departments = useMemo(() => [...new Set(records.map(r => r._department).filter(Boolean))].sort(), [records]);

  const filtered = useMemo(() => records.filter(record => {
    const haystack = [record.name, record.paycode, record._department, record.shift].join(" ").toLowerCase();
    if (query && !haystack.includes(query.toLowerCase())) return false;
    if (department !== "all" && record._department !== department) return false;
    if (status === "present" && !record.is_present) return false;
    if (status === "absent" && !record.is_absent) return false;
    if (status === "halfday" && !record.is_halfday) return false;
    if (status === "mispunch" && !(record.flag_mispunch || record.is_mispunch)) return false;
    if (status === "review" && !(record.flag_warning || record.has_warning)) return false;
    if (status === "pending" && !record.needs_action) return false;
    if (status === "resolved" && !record.is_corrected) return false;
    return true;
  }), [records, query, department, status]);

  async function logout() {
    try { await api("/api/auth/logout", { method: "POST" }); } catch {}
    setUser(null); setReports([]); setDetail(null); setSelectedId(null);
  }

  if (!authReady) return <div className="boot-screen"><div className="brand-mark">S</div><span>Loading ShiftKey…</span></div>;
  if (!user) return <Login onLogin={setUser} />;

  const summary = detail?.summary || {};
  const canAdmin = user.role === "admin";
  return <div className="app-frame">
    <header className="topbar">
      <div className="brand"><div className="brand-mark">S</div><div><b>ShiftKey</b><small>People & attendance</small></div></div>
      <div className="top-actions">
        <span className="connection"><i/> Connected</span>
        <div className="user-chip"><span className="avatar">{(user.full_name || user.username || "U").slice(0,1).toUpperCase()}</span><span><b>{user.full_name || user.username}</b><small>{user.role?.toUpperCase()}</small></span></div>
        <button className="icon-btn" title="Sign out" onClick={logout}><LogOut size={18}/></button>
      </div>
    </header>
    <div className="workspace">
      <aside className="sidebar">
        <div className="side-label">WORKSPACE</div>
        <div className="nav-item active"><Activity size={17}/> Reports <span className="nav-count">{reports.length}</span></div>
        <div className="side-label report-label">ATTENDANCE REPORTS</div>
        <div className="report-list-head"><span>Daily reports</span><button className="icon-btn small" onClick={loadReports} title="Refresh"><RefreshCw size={15}/></button></div>
        <div className="report-list">
          {reports.map(report => <button key={report.id} className={`report-link ${selectedId === report.id ? "selected" : ""}`} onClick={() => setSelectedId(report.id)}>
            <span className="report-date"><CalendarDays size={15}/>{dateLabel(report.report_date)}</span>
            <span className="report-mini"><span>{number(report.total)} staff</span>{report.pending > 0 && <em>{number(report.pending)} pending</em>}</span>
          </button>)}
          {!reports.length && <p className="empty-side">{busy ? "Loading reports…" : "No reports available."}</p>}
        </div>
        <div className="sidebar-foot"><ShieldCheck size={16}/><span>Role-based access enabled</span></div>
      </aside>
      <main className="content">
        <div className="page-heading">
          <div><p className="eyebrow">ATTENDANCE OVERVIEW</p><h1>Daily reports</h1><p className="muted">Review attendance, identify exceptions and track resolutions.</p></div>
          <div className="heading-actions"><button className="secondary-btn" onClick={loadReports}><RefreshCw size={16}/> Refresh</button>
            {detail && <a className="primary-btn link-btn" href={`/api/reports/${detail.id}/export?format=xlsx&highlight=true&summary=true`}><ArrowDownToLine size={16}/> Export Excel</a>}
          </div>
        </div>
        {error && <div className="notice-error"><AlertCircle size={17}/>{error}</div>}
        {!detail ? <section className="empty-state"><FileSpreadsheet size={34}/><h2>Select a daily report</h2><p>Choose a date from the report list to see its attendance summary.</p></section> : <>
          <section className="report-banner"><div><span className="banner-kicker">SELECTED REPORT</span><h2>{dateLabel(detail.report_date)}</h2><p>{detail.company || "ShiftKey"}{detail.title ? ` · ${detail.title}` : ""}</p></div><div className="banner-meta"><span>{detail.source_filename || "Attendance report"}</span><small>Imported {detail.uploaded_at ? new Date(detail.uploaded_at).toLocaleString() : "—"}</small></div></section>
          <section className="metrics-grid">
            <Metric icon={Users} label="Total employees" value={summary.total ?? detail.total} tone="blue" note="In your access scope"/>
            <Metric icon={CheckCircle2} label="Present" value={summary.present ?? detail.present} tone="green"/>
            <Metric icon={XCircle} label="Absent" value={summary.absent ?? detail.absent} tone="slate"/>
            <Metric icon={Clock3} label="Half day" value={summary.halfday ?? detail.halfday} tone="orange"/>
            <Metric icon={AlertCircle} label="Mispunch" value={summary.mispunch ?? detail.mispunch} tone="red"/>
            <Metric icon={AlertTriangle} label="Needs review" value={summary.pending ?? detail.pending ?? summary.warnings} tone="violet"/>
          </section>
          <section className="table-panel">
            <div className="panel-heading"><div><h2>Employee attendance</h2><p>{number(filtered.length)} of {number(records.length)} employees shown</p></div><span className="live-tag"><i/> Report data</span></div>
            <div className="filters">
              <div className="search-box"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search employee or paycode…"/>{query && <button className="clear-search" onClick={() => setQuery("")}><XCircle size={15}/></button>}</div>
              <div className="select-wrap"><Filter size={15}/><select value={department} onChange={e => setDepartment(e.target.value)}><option value="all">All departments</option>{departments.map(d => <option key={d} value={d}>{d}</option>)}</select><ChevronDown size={14}/></div>
              <div className="select-wrap"><select value={status} onChange={e => setStatus(e.target.value)}><option value="all">All statuses</option><option value="present">Present</option><option value="absent">Absent</option><option value="halfday">Half day</option><option value="mispunch">Mispunch</option><option value="review">Needs review</option><option value="pending">Pending action</option><option value="resolved">Resolved</option></select><ChevronDown size={14}/></div>
            </div>
            <div className="table-scroll"><table><thead><tr><th>EMPLOYEE</th><th>PAYCODE</th><th>DEPARTMENT</th><th>SHIFT</th><th>IN</th><th>OUT</th><th>HOURS</th><th>STATUS</th></tr></thead>
              <tbody>{filtered.slice(0, 500).map(record => <tr key={record.id}><td><b className="employee-name">{record.name || "—"}</b>{record.correction?.remark && <small className="row-note">{record.correction.remark}</small>}</td><td className="mono">{record.paycode || "—"}</td><td>{record.dept_name || record._department || "—"}</td><td>{record.shift || "—"}</td><td className="mono">{record.time_in || "—"}</td><td className="mono">{record.time_out || "—"}</td><td className="mono">{record.hrs || "—"}</td><td><StatusPill record={record}/></td></tr>)}</tbody>
            </table></div>
            {filtered.length > 500 && <div className="table-footnote">Showing first 500 rows. Use search or filters to narrow the list.</div>}
            {!filtered.length && <div className="empty-table">No employees match these filters.</div>}
          </section>
        </>}
        <footer className="page-footer">ShiftKey · React frontend preview <span>Existing HRMS services and data</span></footer>
      </main>
    </div>
  </div>;
}

export default App;