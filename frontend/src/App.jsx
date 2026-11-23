import { useCallback, useEffect, useMemo, useState } from "react";
import Workspace from "./Workspace.jsx";
import {
  Activity, AlertCircle, AlertTriangle, ArrowDownToLine, CalendarDays,
  CheckCircle2, ChevronDown, ChevronRight, Clock3, FileSpreadsheet,
  Filter, KeyRound, LogOut, RefreshCw, Search, ShieldCheck, Users, XCircle
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
  const [view, setView] = useState("reports");
  const [fixRecord, setFixRecord] = useState(null);
  const [fixForm, setFixForm] = useState({action:"shift_time",field:"out",time:"",remark:""});
  const [historyRecord, setHistoryRecord] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({current_password:"",new_password:""});
  const [passwordError, setPasswordError] = useState("");
  const [authReady, setAuthReady] = useState(false);
  const [reports, setReports] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [department, setDepartment] = useState("all");
  const [exportFormat, setExportFormat] = useState("xlsx");
  const [exportOnly, setExportOnly] = useState("");
  const [exportSegment, setExportSegment] = useState("");

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

  useEffect(() => { if (user) { loadReports(); if (user.must_change_password) setShowPassword(true); } }, [user, loadReports]);
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

  function exportUrl() {
    const p = new URLSearchParams({format:exportFormat,highlight:"true",summary:"true"});
    if(exportOnly)p.set("only",exportOnly);if(exportSegment)p.set("segment",exportSegment);
    if(department!=="all"){const rec=records.find(r=>r._department===department);if(rec?.dept_code)p.set("dept",rec.dept_code);}
    return `/api/reports/${detail.id}/export?${p.toString()}`;
  }
  async function deleteReport() {
    if(!window.confirm("Delete this attendance report and its associated correction history?"))return;
    try{await api(`/api/reports/${selectedId}`,{method:"DELETE"});setDetail(null);setSelectedId(null);await loadReports();}catch(err){setError(err.message);}
  }
  async function openHistory(record) { try { setHistoryRecord(await api(`/api/records/${record.id}/history`)); } catch (err) { setError(err.message); } }

  function startFix(record) {
    const field = record.time_in && !record.time_out ? "out" : (!record.time_in && record.time_out ? "in" : "out");
    const shiftTime = field === "out" ? record.shift_end : record.shift_start;
    setFixRecord(record); setFixForm({action:shiftTime ? "shift_time" : "set_time",field,time:shiftTime || "",remark:""});
  }
  async function submitFix(event) {
    event.preventDefault(); if (!fixRecord) return;
    try {
      const body = {action:fixForm.action,field:fixForm.field,remark:fixForm.remark};
      if (fixForm.action === "set_time") body.time = fixForm.time;
      await api(`/api/records/${fixRecord.id}/correction`,{method:"POST",json:body});
      setFixRecord(null); await loadDetail(selectedId); await loadReports();
    } catch(err) { setError(err.message); }
  }
  async function undoFix(record) {
    if (!window.confirm("Revert this correction to the original machine values?")) return;
    try { await api(`/api/records/${record.id}/correction`,{method:"DELETE"}); await loadDetail(selectedId); await loadReports(); }
    catch(err) { setError(err.message); }
  }

  async function changePassword(event) {
    event.preventDefault(); setPasswordError("");
    try { const updated = await api("/api/me/password",{method:"POST",json:passwordForm}); setUser(updated); setPasswordForm({current_password:"",new_password:""}); setShowPassword(false); }
    catch(err) { setPasswordError(err.message); }
  }

  async function logout() {
    try { await api("/api/auth/logout", { method: "POST" }); } catch {}
    setUser(null); setView("reports"); setReports([]); setDetail(null); setSelectedId(null);
  }

  if (!authReady) return <div className="boot-screen"><div className="brand-mark">S</div><span>Loading ShiftKey…</span></div>;
  if (!user) return <Login onLogin={u=>{setUser(u);setView("reports");}} />;

  const summary = detail?.summary || {};
  return <div className="app-frame">
    <header className="topbar">
      <div className="brand"><div className="brand-mark">S</div><div><b>ShiftKey</b><small>People & attendance</small></div></div>
      <nav className="app-nav">
        {["reports","corrections","audit",...(user.role === "admin" ? ["users","shifts","integrations"] : [])].map(item =>
          <button key={item} className={view === item ? "active" : ""} onClick={() => setView(item)}>{item[0].toUpperCase()+item.slice(1)}</button>
        )}
      </nav>
      <div className="top-actions">
        <span className="connection"><i/> Connected</span>
        <div className="user-chip"><span className="avatar">{(user.full_name || user.username || "U").slice(0,1).toUpperCase()}</span><span><b>{user.full_name || user.username}</b><small>{user.role?.toUpperCase()}</small></span></div>
        <button className="icon-btn" title="Change password" onClick={()=>{setPasswordError("");setShowPassword(true);}}><KeyRound size={18}/></button><button className="icon-btn" title="Sign out" onClick={logout}><LogOut size={18}/></button>
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
      <main className="content">{view === "reports" ? <>{
        <div className="page-heading">
          <div><p className="eyebrow">ATTENDANCE OVERVIEW</p><h1>Daily reports</h1><p className="muted">Review attendance, identify exceptions and track resolutions.</p></div>
          <div className="heading-actions"><button className="secondary-btn" onClick={loadReports}><RefreshCw size={16}/> Refresh</button>
            {detail && <><select className="export-select" value={exportFormat} onChange={e=>setExportFormat(e.target.value)}><option value="xlsx">Excel</option><option value="csv">CSV</option></select><select className="export-select" value={exportOnly} onChange={e=>setExportOnly(e.target.value)}><option value="">All employees</option><option value="flagged">Flagged</option><option value="pending">Pending</option><option value="halfday">Half day</option><option value="mispunch">Mispunch</option><option value="absent">Absent</option><option value="corrected">Resolved</option></select><select className="export-select" value={exportSegment} onChange={e=>setExportSegment(e.target.value)}><option value="">All segments</option><option value="indian">Indian</option><option value="local">Local</option><option value="other">Other</option></select><a className="primary-btn link-btn" href={exportUrl()}><ArrowDownToLine size={16}/> Export</a>{user.role==="admin"&&<button className="secondary-btn" onClick={deleteReport}>Delete report</button>}</>}
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
            <Metric icon={AlertTriangle} label="Needs review" value={summary.warnings ?? detail.warnings} tone="violet"/>
            <Metric icon={Clock3} label="Pending action" value={summary.pending ?? detail.pending} tone="orange"/>
            <Metric icon={CheckCircle2} label="Resolved" value={summary.corrected ?? detail.corrected} tone="green"/>
          </section>
          <section className="table-panel">
            <div className="panel-heading"><div><h2>Employee attendance</h2><p>{number(filtered.length)} of {number(records.length)} employees shown</p></div><span className="live-tag"><i/> Report data</span></div>
            <div className="filters">
              <div className="search-box"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search employee or paycode…"/>{query && <button className="clear-search" onClick={() => setQuery("")}><XCircle size={15}/></button>}</div>
              <div className="select-wrap"><Filter size={15}/><select value={department} onChange={e => setDepartment(e.target.value)}><option value="all">All departments</option>{departments.map(d => <option key={d} value={d}>{d}</option>)}</select><ChevronDown size={14}/></div>
              <div className="select-wrap"><select value={status} onChange={e => setStatus(e.target.value)}><option value="all">All statuses</option><option value="present">Present</option><option value="absent">Absent</option><option value="halfday">Half day</option><option value="mispunch">Mispunch</option><option value="review">Needs review</option><option value="pending">Pending action</option><option value="resolved">Resolved</option></select><ChevronDown size={14}/></div>
            </div>
            <div className="table-scroll"><table><thead><tr><th>EMPLOYEE</th><th>PAYCODE</th><th>DEPARTMENT</th><th>SHIFT</th><th>IN</th><th>OUT</th><th>HOURS</th><th>STATUS</th><th>ACTIONS</th></tr></thead>
              <tbody>{filtered.slice(0, 500).map(record => <tr key={record.id}><td><b className="employee-name">{record.name || "—"}</b>{record.correction?.remark && <small className="row-note">{record.correction.remark}</small>}</td><td className="mono">{record.paycode || "—"}</td><td>{record.dept_name || record._department || "—"}</td><td>{record.shift || "—"}</td><td className="mono">{record.time_in || "—"}</td><td className="mono">{record.time_out || "—"}</td><td className="mono">{record.hrs || "—"}</td><td><StatusPill record={record}/></td><td className="row-actions">{["admin","hod"].includes(user.role) && (record.is_corrected ? <button className="text-action" onClick={()=>undoFix(record)}>Undo</button> : <button className="text-action" onClick={()=>startFix(record)}>Correct</button>)} <button className="text-action" onClick={()=>openHistory(record)}>History</button></td></tr>)}</tbody>
            </table></div>
            {filtered.length > 500 && <div className="table-footnote">Showing first 500 rows. Use search or filters to narrow the list.</div>}
            {!filtered.length && <div className="empty-table">No employees match these filters.</div>}
          </section>
        </>}
        {fixRecord && <div className="feature-overlay"><section className="feature-dialog"><header><h3>Correct attendance · {fixRecord.name}</h3><button className="icon-btn" onClick={()=>setFixRecord(null)}>×</button></header><form className="feature-form" onSubmit={submitFix}>
          <p className="muted">Current punches: {fixRecord.time_in || "—"} → {fixRecord.time_out || "—"} · {fixRecord.status_label || fixRecord.status}</p>
          <label className="feature-field"><span>Correction method</span><select value={fixForm.action} onChange={e=>setFixForm(f=>({...f,action:e.target.value}))}><option value="shift_time">Use scheduled shift time</option><option value="set_time">Enter a time manually</option></select></label>
          <label className="feature-field"><span>Punch to correct</span><select value={fixForm.field} onChange={e=>setFixForm(f=>({...f,field:e.target.value}))}><option value="in">IN punch</option><option value="out">OUT punch</option></select></label>
          {fixForm.action==="set_time" && <label className="feature-field"><span>Time (HH:MM)</span><input type="time" required value={fixForm.time} onChange={e=>setFixForm(f=>({...f,time:e.target.value}))}/></label>}
          <label className="feature-field"><span>Remark</span><input maxLength="300" value={fixForm.remark} onChange={e=>setFixForm(f=>({...f,remark:e.target.value}))}/></label>
          <button className="primary-btn">Save correction</button>
        </form></section></div>}
        {historyRecord && <div className="feature-overlay" onMouseDown={e=>e.target===e.currentTarget&&setHistoryRecord(null)}><section className="feature-dialog"><header><h3>Attendance history</h3><button className="icon-btn" onClick={()=>setHistoryRecord(null)}>×</button></header><div className="feature-form"><b>{historyRecord.record?.name} · {historyRecord.record?.paycode}</b><p>{historyRecord.report?.report_date} · {historyRecord.report?.source_filename}</p><h4>Event history</h4>{(historyRecord.events||[]).map(e=><div className="history-line" key={e.id}><b>{e.action_label || e.action}</b><small>{e.ts} · {e.actor?.name || e.actor?.username || "System"}</small><p>{e.summary}</p></div>)}<h4>Other attendance days</h4>{(historyRecord.other_days||[]).map(d=><p key={d.record_id}>{d.report_date}: {d.time_in||"—"} → {d.time_out||"—"} · {d.status}</p>)}</div></section></div>}
        <footer className="page-footer">ShiftKey · React frontend preview <span>Existing HRMS services and data</span></footer>
      }</> : <Workspace view={view} user={user} notify={message => setError(message)} />}</main>
    </div>
    {showPassword && <div className="feature-overlay"><section className="feature-dialog"><header><h3>{user.must_change_password ? "Set a new password" : "Change password"}</h3>{!user.must_change_password && <button className="icon-btn" onClick={()=>setShowPassword(false)}>×</button>}</header><form className="feature-form" onSubmit={changePassword}>
      <p className="muted">{user.must_change_password ? "Your account requires a password update before you continue." : "Choose a new password for your ShiftKey account."}</p>
      <label className="feature-field"><span>Current password</span><input type="password" autoComplete="current-password" required value={passwordForm.current_password} onChange={e=>setPasswordForm(f=>({...f,current_password:e.target.value}))}/></label>
      <label className="feature-field"><span>New password</span><input type="password" autoComplete="new-password" required minLength="10" value={passwordForm.new_password} onChange={e=>setPasswordForm(f=>({...f,new_password:e.target.value}))}/></label>
      {passwordError && <p className="feature-error">{passwordError}</p>}<button className="primary-btn">Update password</button>
    </form></section></div>}
  </div>;
}

export default App;