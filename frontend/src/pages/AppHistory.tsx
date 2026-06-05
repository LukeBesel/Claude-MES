import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { ChevronLeft, ChevronRight, Play, Clock, User, CheckCircle, TrendingUp, BarChart2, AlertTriangle, Loader2, Award } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function formatDur(s: number): string {
  if (!s) return '—';
  const m = Math.floor(Math.abs(s) / 60);
  const sec = Math.round(Math.abs(s) % 60);
  return `${m}m ${String(sec).padStart(2,'0')}s`;
}

export default function AppHistory() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [app, setApp] = useState<any>(null);
  const [history, setHistory] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const LIMIT = 25;

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([api.getApp(id), api.getAppHistory(id, page, LIMIT)]).then(([a, h]) => {
      setApp(a); setHistory(h); setLoading(false);
    }).catch(() => setLoading(false));
  }, [id, page]);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 size={24} className="animate-spin text-blue-500" /></div>;
  if (!app) return <div className="p-6 text-center text-gray-400">App not found</div>;

  const totalPages = Math.ceil((history?.total || 0) / LIMIT);
  const trendData = (history?.trend || []).map((t: any) => ({ date: (t.date||'').slice(5), avg: Math.round((t.avg_minutes||0)*10)/10 }));
  const stepData = (history?.step_averages || []).map((s: any) => ({
    name: (s.name||'').length > 12 ? s.name.slice(0,11)+'…' : s.name,
    avg: Math.round(s.avg_seconds||0), takt: s.takt_seconds||0
  }));

  const kpis = [
    { icon: <BarChart2 size={16} className="text-blue-600"/>, bg:'bg-blue-50', label:'Total Runs', value: history?.total||0 },
    { icon: <Clock size={16} className="text-purple-600"/>, bg:'bg-purple-50', label:'Avg Duration', value: history?.avg_duration ? formatDur(history.avg_duration*60):'—' },
    { icon: <Award size={16} className="text-emerald-600"/>, bg:'bg-emerald-50', label:'Best Time', value: history?.best_time ? formatDur(history.best_time*60):'—' },
    { icon: <TrendingUp size={16} className="text-amber-600"/>, bg:'bg-amber-50', label:'Pass Rate', value:`${history?.pass_rate??0}%` },
  ];

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/apps')} className="p-2 hover:bg-gray-100 rounded-xl text-gray-500"><ChevronLeft size={18}/></button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{app.name}</h1>
            <p className="text-gray-500 text-sm mt-0.5">Completion History</p>
          </div>
        </div>
        <Link to={`/play/${id}`} className="btn-primary"><Play size={14}/> Run App</Link>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="stat-card flex items-center gap-3">
            <div className={`w-9 h-9 ${k.bg} rounded-xl flex items-center justify-center`}>{k.icon}</div>
            <div><div className="text-xl font-bold text-gray-900">{k.value}</div><div className="text-xs text-gray-500">{k.label}</div></div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Cycle Time Trend</h3>
          {!trendData.length ? <div className="h-40 flex items-center justify-center text-gray-300 text-sm">No data yet</div> : (
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                <XAxis dataKey="date" tick={{fontSize:10}}/>
                <YAxis tick={{fontSize:10}} unit="m"/>
                <Tooltip formatter={(v:any)=>[`${v}m`,'Avg']}/>
                <Line type="monotone" dataKey="avg" stroke="#3b82f6" strokeWidth={2} dot={false}/>
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Avg Time per Step</h3>
          {!stepData.length ? <div className="h-40 flex items-center justify-center text-gray-300 text-sm">No data yet</div> : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={stepData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false}/>
                <XAxis type="number" tick={{fontSize:10}} tickFormatter={v=>`${Math.floor(v/60)}m`}/>
                <YAxis type="category" dataKey="name" tick={{fontSize:10}} width={70}/>
                <Tooltip formatter={(v:any)=>[formatDur(Number(v)),'Avg']}/>
                <Bar dataKey="avg" fill="#3b82f6" radius={[0,4,4,0]} maxBarSize={20}/>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">All Completions</h3>
          <span className="text-xs text-gray-400">{history?.total||0} total</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {['Date & Time','Operator','Duration','Quality','Work Order','Takt Status',''].map(h=>(
                <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {!(history?.items?.length) && <tr><td colSpan={7} className="text-center py-10 text-gray-400 text-sm">No completions yet</td></tr>}
            {(history?.items||[]).map((c:any) => {
              const dur = c.completed_at ? Math.round((new Date(c.completed_at).getTime()-new Date(c.started_at).getTime())/1000) : null;
              const hasPass = Object.values(c.data||{}).some(v=>v==='Pass');
              const hasFail = Object.values(c.data||{}).some(v=>v==='Fail');
              const exceeded = (c.takt_exceeded_steps||[]).length > 0;
              return (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={()=>navigate(`/completions/${c.id}`)}>
                  <td className="px-5 py-3.5"><div className="font-medium text-gray-900">{new Date(c.started_at).toLocaleDateString()}</div><div className="text-gray-400 text-xs">{new Date(c.started_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div></td>
                  <td className="px-5 py-3.5"><div className="flex items-center gap-1.5"><User size={12} className="text-gray-400"/><span className="text-gray-700">{c.operator_name||'—'}</span></div></td>
                  <td className="px-5 py-3.5 font-mono text-gray-800 font-medium">{dur ? formatDur(dur):'—'}</td>
                  <td className="px-5 py-3.5">{hasFail?<span className="badge badge-red">Fail</span>:hasPass?<span className="badge badge-green">Pass</span>:<span className="text-gray-300">—</span>}</td>
                  <td className="px-5 py-3.5 text-xs text-gray-500">{c.work_order_number||<span className="text-gray-300">—</span>}</td>
                  <td className="px-5 py-3.5">{exceeded?<span className="badge badge-amber"><AlertTriangle size={10}/>Exceeded</span>:<span className="badge badge-green"><CheckCircle size={10}/>OK</span>}</td>
                  <td className="px-5 py-3.5"><Link to={`/completions/${c.id}`} onClick={e=>e.stopPropagation()} className="text-blue-600 hover:text-blue-700 text-xs font-medium">View →</Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100">
            <span className="text-xs text-gray-400">Page {page} of {totalPages}</span>
            <div className="flex gap-1">
              <button disabled={page===1} onClick={()=>setPage(p=>p-1)} className="p-1.5 hover:bg-gray-100 rounded-lg disabled:opacity-30 text-gray-500"><ChevronLeft size={14}/></button>
              <button disabled={page===totalPages} onClick={()=>setPage(p=>p+1)} className="p-1.5 hover:bg-gray-100 rounded-lg disabled:opacity-30 text-gray-500"><ChevronRight size={14}/></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
