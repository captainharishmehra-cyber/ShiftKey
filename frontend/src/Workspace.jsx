import { useEffect, useState } from "react";
import "./features.css";
import { ArrowDownToLine, Database, FileClock, Pencil, Plus, RefreshCw, ShieldCheck, Trash2, X } from "lucide-react";

async function api(path, options = {}) {
  const headers = { "X-Requested-With": "ShiftKey", ...(options.headers || {}) };
  if (options.json !== undefined) { headers["Content-Type"] = "application/json"; options.body = JSON.stringify(options.json); delete options.json; }
  const response = await fetch(path, { credentials: "same-origin", ...options, headers });
  if (response.status === 204) return null;
  const type = response.headers.get("content-type") || "";
  const body = type.includes("json") ? await response.json() : await response.text();
  if (!response.ok) throw new Error(body?.detail || "Request failed (" + response.status + ")");
  return body;
}
const fmt = v => v ? new Date(v).toLocaleString() : "—";
function Panel({ title, subtitle, actions, children }) {
  return <section className="feature-panel"><div className="feature-head"><div><h2>{title}</h2><p>{subtitle}</p></div><div>{actions}</div></div>{children}</section>;
}
function Table({ columns, rows }) {
  return <div className="feature-table-wrap"><table className="feature-table"><thead><tr>{columns.map(c=><th key={c}>{c}</th>)}</tr></thead><tbody>{rows.length ? rows : <tr><td className="feature-empty" colSpan={columns.length}>No records found.</td></tr>}</tbody></table></div>;
}
function Dialog({ title, close, children }) {
  return <div className="feature-overlay" onMouseDown={e=>e.target===e.currentTarget&&close()}><section className="feature-dialog"><header><h3>{title}</h3><button className="icon-btn" onClick={close}><X size={18}/></button></header>{children}</section></div>;
}
function Field({ label, children }) { return <label className="feature-field"><span>{label}</span>{children}</label>; }

export default function Workspace({ view, user, notify }) {
  const [rows,setRows]=useState([]), [depts,setDepts]=useState([]), [runs,setRuns]=useState([]), [connections,setConnections]=useState([]), [catalog,setCatalog]=useState(null);
  const [error,setError]=useState(""), [dialog,setDialog]=useState(""), [editing,setEditing]=useState(null), [form,setForm]=useState({});
  const [period,setPeriod]=useState("7d"), [filters,setFilters]=useState({q:"",category:"",outcome:""}), [events,setEvents]=useState([]), [hasMore,setHasMore]=useState(false), [before,setBefore]=useState(null), [stats,setStats]=useState(null);
  const admin=user.role==="admin";
  const set=(k,v)=>setForm(old=>({...old,[k]:v}));
  async function load() {
    setError("");
    try {
      if(view==="corrections") setRows(await api("/api/corrections?limit=1000"));
      if(view==="users"){const r=await Promise.all([api("/api/users"),api("/api/departments")]);setRows(r[0]);setDepts(r[1]);}
      if(view==="shifts") setRows(await api("/api/shifts"));
      if(view==="audit"){const a=await api("/api/audit/actions");setCatalog(a);await loadAudit(true);}
      if(view==="integrations"){const r=await Promise.all([api("/api/sync/catalog"),api("/api/connections"),api("/api/sync/jobs"),api("/api/sync/runs?limit=40")]);setCatalog(r[0]);setConnections(r[1]);setRows(r[2]);setDepts(r[0].dialects||[]);setRuns(r[3]);}
    } catch(e){setError(e.message);}
  }
  useEffect(()=>{load();},[view]);
  async function loadAudit(reset) {
    const p=new URLSearchParams({period,limit:"100"});
    if(filters.q)p.set("q",filters.q);if(filters.category)p.set("category",filters.category);if(filters.outcome)p.set("outcome",filters.outcome);if(!reset&&before)p.set("before_id",String(before));
    const r=await Promise.all([api("/api/audit?"+p),reset?api("/api/audit/stats?period="+period):Promise.resolve(stats)]);
    setEvents(old=>reset?r[0].events:old.concat(r[0].events));setHasMore(r[0].has_more);setBefore(r[0].next_before_id);if(reset)setStats(r[1]);
  }
  async function remove(path){if(!window.confirm("Delete this item?"))return;try{await api(path,{method:"DELETE"});notify?.("Deleted");load();}catch(e){setError(e.message);}}
  function userDialog(u){setEditing(u);setForm(u?{...u,password:""}:{role:"hod",segment:"indian",departments:[],is_active:true,must_change_password:true});setDialog("user");}
  async function saveUser(e){e.preventDefault();const b={full_name:form.full_name||"",role:form.role,segment:form.segment||"all",departments:form.departments||[],must_change_password:form.must_change_password!==false};try{if(editing){if(form.password)b.password=form.password;b.is_active=form.is_active;await api("/api/users/"+editing.id,{method:"PATCH",json:b});}else{b.username=form.username;b.password=form.password;await api("/api/users",{method:"POST",json:b});}setDialog("");notify?.("User saved");load();}catch(e){setError(e.message);}}
  async function saveShift(e){e.preventDefault();try{await api("/api/shifts/"+encodeURIComponent(form.code),{method:"PUT",json:{name:form.name,start:form.start,end:form.end}});setDialog("");load();}catch(e){setError(e.message);}}
  async function saveConn(e){e.preventDefault();const b={name:form.name,dialect:form.dialect||"mssql",host:form.host,port:Number(form.port)||null,database:form.database,username:form.username,password:form.password||null,options:{},read_only:true,notes:form.notes||""};try{await api(editing?"/api/connections/"+editing.id:"/api/connections",{method:editing?"PATCH":"POST",json:b});setDialog("");load();}catch(e){setError(e.message);}}
  async function testConn(c){try{const r=c?await api("/api/connections/"+c.id+"/test",{method:"POST"}):await api("/api/connections/test",{method:"POST",json:{name:form.name,dialect:form.dialect||"mssql",host:form.host,port:Number(form.port)||null,database:form.database,username:form.username,password:form.password||null,options:{},read_only:true}});notify?.(r.message|| (r.ok?"Connection successful":"Connection failed"));}catch(e){setError(e.message);}}
  async function runJob(id){const from=window.prompt("Start date (YYYY-MM-DD)",new Date().toISOString().slice(0,10));if(!from)return;const to=window.prompt("End date (YYYY-MM-DD)",from);if(!to)return;try{await api("/api/sync/jobs/"+id+"/run",{method:"POST",json:{date_from:from,date_to:to}});notify?.("Sync run requested");load();}catch(e){setError(e.message);}}

  if(view==="corrections") return <Panel title="Correction history" subtitle="Original and corrected attendance values, including reverts." actions={<button className="secondary-btn" onClick={load}><RefreshCw size={15}/> Refresh</button>}>
    {error&&<p className="feature-error">{error}</p>}<Table columns={["WHEN","DATE","EMPLOYEE","DEPARTMENT","ACTION","ORIGINAL","CORRECTED","BY","REMARK"]} rows={rows.map(c=><tr key={c.id}><td>{fmt(c.at)}</td><td>{c.report_date}</td><td><b>{c.name}</b><small>{c.paycode}</small></td><td>{c.dept_name||c.dept_code}</td><td>{c.action}</td><td>{c.original?.time_in||"—"} → {c.original?.time_out||"—"}<small>{c.original?.status}</small></td><td>{c.corrected?.time_in||"—"} → {c.corrected?.time_out||"—"}<small>{c.corrected?.status}</small></td><td>{c.by}</td><td>{c.remark||"—"}</td></tr>)}/></Panel>;

  if(view==="audit") return <Panel title="Audit trail" subtitle="Searchable activity history with integrity verification." actions={<><button className="secondary-btn" onClick={async()=>{try{const r=await api("/api/audit/verify",{method:"POST"});notify?.(r.ok?"Audit chain intact · "+r.checked+" events":"Audit chain broken at "+r.broken_at);}catch(e){setError(e.message);}}}><ShieldCheck size={15}/> Verify integrity</button><a className="secondary-btn" href={"/api/audit/export?format=csv&period="+period}><ArrowDownToLine size={15}/> Export CSV</a></>}>
    {error&&<p className="feature-error">{error}</p>}<div className="feature-filters"><input placeholder="Search activity" value={filters.q} onChange={e=>setFilters({...filters,q:e.target.value})}/><select value={period} onChange={e=>setPeriod(e.target.value)}><option value="24h">24 hours</option><option value="7d">7 days</option><option value="30d">30 days</option><option value="90d">90 days</option><option value="all">All time</option></select><select value={filters.outcome} onChange={e=>setFilters({...filters,outcome:e.target.value})}><option value="">All outcomes</option><option value="success">Success</option><option value="failure">Failure</option><option value="denied">Denied</option></select><button className="secondary-btn" onClick={()=>loadAudit(true)}>Apply</button></div>
    {stats&&<div className="feature-metrics"><div><b>{stats.total_events||0}</b><small>Total events</small></div><div><b>{stats.period_events||0}</b><small>Selected period</small></div></div>}
    <div className="audit-feed">{events.map(e=><details key={e.id} className="audit-event"><summary><span><b>{e.summary}</b><small>{fmt(e.ts)} · {e.actor?.name||e.actor?.username||"System"} · {e.action_label}</small></span><span className="status-pill">{e.outcome}</span></summary><div className="audit-detail"><p>{e.action} · {e.ip||"No IP"} · #{e.id}</p>{e.changes?.map((c,i)=><p key={i}>{c.field}: {String(c.from)} → {String(c.to)}</p>)}<pre>{JSON.stringify(e.meta||{},null,2)}</pre></div></details>)}</div>{hasMore&&<button className="secondary-btn" onClick={()=>loadAudit(false)}>Load older events</button>}
  </Panel>;

  if(view==="users") return <Panel title="User administration" subtitle="Manage accounts, roles, department access and password resets." actions={<button className="primary-btn" onClick={()=>userDialog(null)}><Plus size={15}/> New user</button>}>
    {error&&<p className="feature-error">{error}</p>}<Table columns={["USERNAME","NAME","ROLE","SCOPE","STATUS","LAST LOGIN","ACTIONS"]} rows={rows.map(u=><tr key={u.id}><td><b>{u.username}</b>{u.id===user.id&&<small>YOU</small>}</td><td>{u.full_name}</td><td>{u.role.toUpperCase()}</td><td>{u.role==="hod"?(u.departments||[]).join(", "):u.role==="hr"?(u.segment_label+" staff"):"Full access"}</td><td>{u.is_active?(u.must_change_password?"Password reset required":"Active"):"Disabled"}</td><td>{fmt(u.last_login_at)}</td><td><button className="icon-btn" onClick={()=>userDialog(u)}><Pencil size={15}/></button>{u.id!==user.id&&<button className="icon-btn" onClick={()=>remove("/api/users/"+u.id)}><Trash2 size={15}/></button>}</td></tr>)}/>
    {dialog==="user"&&<Dialog title={editing?"Edit "+editing.username:"Create user"} close={()=>setDialog("")}><form className="feature-form" onSubmit={saveUser}>
      {!editing&&<Field label="Username"><input required minLength="2" value={form.username||""} onChange={e=>set("username",e.target.value)}/></Field>}
      <Field label="Full name"><input value={form.full_name||""} onChange={e=>set("full_name",e.target.value)}/></Field>
      <Field label="Role"><select value={form.role||"hod"} onChange={e=>set("role",e.target.value)}><option value="admin">Administrator</option><option value="hr">HR</option><option value="hod">HOD</option></select></Field>
      {form.role==="hr"&&<Field label="HR segment"><select value={form.segment||"indian"} onChange={e=>set("segment",e.target.value)}><option value="indian">Indian</option><option value="local">Local</option><option value="all">All</option></select></Field>}
      {form.role==="hod"&&<Field label="Departments"><div className="feature-checks">{depts.map(d=><label key={d.code}><input type="checkbox" checked={(form.departments||[]).includes(d.code)} onChange={e=>set("departments",e.target.checked?[...(form.departments||[]),d.code]:(form.departments||[]).filter(x=>x!==d.code))}/>{d.name}</label>)}</div></Field>}
      <Field label={editing?"Reset password (optional)":"Initial password"}><input type="password" required={!editing} value={form.password||""} onChange={e=>set("password",e.target.value)}/></Field>
      <Field label="Account"><select value={String(form.is_active!==false)} onChange={e=>set("is_active",e.target.value==="true")}><option value="true">Active</option><option value="false">Disabled</option></select></Field>
      <label className="feature-inline-check"><input type="checkbox" checked={form.must_change_password!==false} onChange={e=>set("must_change_password",e.target.checked)}/> Require password change at next sign-in</label><button className="primary-btn">Save user</button></form></Dialog>}
  </Panel>;

  if(view==="shifts") return <Panel title="Shift management" subtitle="Maintain shift names and scheduled start/end times." actions={<button className="primary-btn" onClick={()=>{setEditing(null);setForm({code:"",name:"",start:"08:00",end:"17:00"});setDialog("shift");}}><Plus size={15}/> Add shift</button>}>
    {error&&<p className="feature-error">{error}</p>}<Table columns={["CODE","NAME","START","END","SOURCE","ACTIONS"]} rows={rows.map(s=><tr key={s.code}><td><b>{s.code}</b></td><td>{s.name||"—"}</td><td>{s.start||"—"}</td><td>{s.end||"—"}</td><td>{s.source}</td><td><button className="icon-btn" onClick={()=>{setEditing(s);setForm({...s});setDialog("shift");}}><Pencil size={15}/></button><button className="icon-btn" onClick={()=>remove("/api/shifts/"+encodeURIComponent(s.code))}><Trash2 size={15}/></button></td></tr>)}/>
    {dialog==="shift"&&<Dialog title={editing?"Edit shift":"Add shift"} close={()=>setDialog("")}><form className="feature-form" onSubmit={saveShift}><Field label="Code"><input required disabled={!!editing} value={form.code||""} onChange={e=>set("code",e.target.value)}/></Field><Field label="Name"><input value={form.name||""} onChange={e=>set("name",e.target.value)}/></Field><Field label="Start"><input type="time" value={form.start||""} onChange={e=>set("start",e.target.value)}/></Field><Field label="End"><input type="time" value={form.end||""} onChange={e=>set("end",e.target.value)}/></Field><button className="primary-btn">Save shift</button></form></Dialog>}
  </Panel>;

  if(view==="integrations") return <Panel title="Starlink & SQL integrations" subtitle="Manage SQL connections, synchronization jobs and run history." actions={<><button className="secondary-btn" onClick={load}><RefreshCw size={15}/> Refresh</button><button className="primary-btn" onClick={()=>{setEditing(null);setForm({name:"Starlink SQL",dialect:"mssql",port:1433});setDialog("connection");}}><Plus size={15}/> Add connection</button></>}>
    {error&&<p className="feature-error">{error}</p>}<h3 className="feature-subhead"><Database size={16}/> Database connections</h3>
    <div className="connection-grid">{connections.map(c=><article className="connection-card" key={c.id}><div><b>{c.name}</b><small>{c.dialect_label} · {[c.host,c.database].filter(Boolean).join(" / ")}</small><small>{c.last_test_message|| (c.last_test_ok===null?"Not tested":c.last_test_ok?"Connection OK":"Connection failed")}</small></div><div className="connection-actions"><button className="secondary-btn" onClick={()=>testConn(c)}>Test</button><button className="icon-btn" onClick={()=>{setEditing(c);setForm({...c,password:""});setDialog("connection");}}><Pencil size={15}/></button><button className="icon-btn" onClick={()=>remove("/api/connections/"+c.id)}><Trash2 size={15}/></button></div></article>)}</div>
    <h3 className="feature-subhead"><Database size={16}/> Sync jobs</h3><Table columns={["JOB","DIRECTION","CONNECTION","MODE / DATASET","SCHEDULE","LAST STATUS","ACTION"]} rows={rows.map(j=><tr key={j.id}><td><b>{j.name}</b><small>{j.description}</small></td><td>{j.direction}</td><td>{j.connection_name}</td><td>{j.direction==="pull"?j.mode:(j.dataset+" → "+j.target_table)}</td><td>{j.schedule_enabled?("Daily "+j.schedule_time):"Manual"}</td><td>{j.last_status||"Never"}</td><td><button className="secondary-btn" onClick={()=>runJob(j.id)}>Run</button><button className="icon-btn" onClick={()=>remove("/api/sync/jobs/"+j.id)}><Trash2 size={15}/></button></td></tr>)}/>
    <h3 className="feature-subhead"><FileClock size={16}/> Recent runs</h3><Table columns={["STARTED","JOB","TRIGGER","STATUS","ROWS","MESSAGE"]} rows={runs.map(r=><tr key={r.id}><td>{fmt(r.started_at)}</td><td>{r.job_name}</td><td>{r.trigger}</td><td>{r.status}</td><td>{r.rows_in} in / {r.rows_out} out</td><td>{r.message}</td></tr>)}/>
    {dialog==="connection"&&<Dialog title={editing?"Edit connection":"Add SQL connection"} close={()=>setDialog("")}><form className="feature-form" onSubmit={saveConn}>
      <Field label="Connection name"><input required value={form.name||""} onChange={e=>set("name",e.target.value)}/></Field>
      <Field label="Database type"><select value={form.dialect||"mssql"} onChange={e=>set("dialect",e.target.value)}>{depts.map(d=><option key={d.key} value={d.key}>{d.label}</option>)}</select></Field>
      <Field label="Host / server"><input value={form.host||""} onChange={e=>set("host",e.target.value)}/></Field><Field label="Port"><input type="number" value={form.port||""} onChange={e=>set("port",e.target.value)}/></Field>
      <Field label="Database"><input value={form.database||""} onChange={e=>set("database",e.target.value)}/></Field><Field label="Username"><input value={form.username||""} onChange={e=>set("username",e.target.value)}/></Field><Field label="Password (leave blank to keep existing)"><input type="password" value={form.password||""} onChange={e=>set("password",e.target.value)}/></Field>
      <div className="feature-form-actions"><button type="button" className="secondary-btn" onClick={()=>testConn(null)}>Test connection</button><button className="primary-btn">Save connection</button></div>
    </form></Dialog>}
  </Panel>;
  return null;
}
