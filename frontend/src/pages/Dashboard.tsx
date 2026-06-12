import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  TrendingUp, TrendingDown, Activity, CheckCircle, Cpu,
  ShieldCheck, ShoppingCart, RefreshCw, CalendarCheck,
  ExternalLink, Plus, BarChart2, Monitor, Layers,
  AlertTriangle, Package, CheckCircle2, ChevronRight, Wrench, Lock
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AttentionItem {
  type: 'wo_overdue' | 'wo_behind' | 'station_down' | 'ncr_critical' | 'stock_low' | 'po_late';
  severity: 'red' | 'amber';
  label: string;
  detail: string;
  link: string;
}

interface DailyBrief {
  attention: AttentionItem[];
  kpis: {
    completed_today: number;
    vs_7day_avg_pct: number | null;
    active_now: number;
    pass_rate_7d: number | null;
    schedule_adherence: number | null;
    work_orders_on_track: number;
    work_orders_total: number;
  };
  due_soon: Array<{
    id: string; work_order_number: string; part_name: string;
    department_name: string | null; quantity: number; quantity_completed: number;
    completion_pct: number; scheduled_end: string; priority: string;
    schedule_status: string;
  }>;
  throughput_7d: Array<{ date: string; count: number }>;
  week_avg_per_day: number;
  is_pro: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

const ATTENTION_ICONS: Record<AttentionItem['type'], React.ReactNode> = {
  wo_overdue:   <CalendarCheck size={15} />,
  wo_behind:    <CalendarCheck size={15} />,
  station_down: <Wrench size={15} />,
  ncr_critical: <ShieldCheck size={15} />,
  stock_low:    <Package size={15} />,
  po_late:      <ShoppingCart size={15} />,
};

const ATTENTION_TYPE_LABELS: Record<AttentionItem['type'], string> = {
  wo_overdue:   'Work order overdue',
  wo_behind:    'Work order behind',
  station_down: 'Station down',
  ncr_critical: 'Critical NCR',
  stock_low:    'Low stock',
  po_late:      'Late delivery',
};

const SCHEDULE_PILL: Record<string, string> = {
  on_track:    'bg-green-100 text-green-700',
  at_risk:     'bg-amber-100 text-amber-700',
  behind:      'bg-red-100 text-red-700',
  overdue:     'bg-red-200 text-red-800',
  not_started: 'bg-gray-100 text-gray-600',
  completed:   'bg-blue-100 text-blue-700',
};

function SkeletonBox({ className = '' }: { className?: string }) {
  return <div className={`bg-gray-200 animate-pulse rounded ${className}`} />;
}

// ─── KPI card with delta ──────────────────────────────────────────────────────

function DeltaStatCard({ label, value, delta, deltaLabel, icon, iconBg, iconColor, pulse }: {
  label: string;
  value: React.ReactNode;
  delta?: number | null;
  deltaLabel?: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  pulse?: boolean;
}) {
  return (
    <div className="stat-card">
      <div className="flex items-start gap-3">
        <div className={`relative w-10 h-10 ${iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
          <span className={iconColor}>{icon}</span>
          {pulse && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400">
              <span className="absolute inset-0 rounded-full bg-amber-400 animate-ping opacity-75" />
            </span>
          )}
        </div>
        <div className="min-w-0">
          <div className="text-2xl font-bold text-gray-900 leading-none">{value}</div>
          <div className="text-xs font-medium text-gray-600 mt-0.5">{label}</div>
          {delta !== undefined && delta !== null ? (
            <div className={`flex items-center gap-1 text-xs mt-0.5 font-medium ${delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {delta >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              {delta >= 0 ? '+' : ''}{delta}% {deltaLabel}
            </div>
          ) : deltaLabel ? (
            <div className="text-xs text-gray-400 mt-0.5">{deltaLabel}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─── Quick Action ─────────────────────────────────────────────────────────────

function QuickAction({ icon, label, to, newTab, color = 'text-gray-600' }: {
  icon: React.ReactNode; label: string; to: string; newTab?: boolean; color?: string;
}) {
  const navigate = useNavigate();
  const handleClick = () => {
    if (newTab) window.open(to, '_blank');
    else navigate(to);
  };
  return (
    <button
      onClick={handleClick}
      className="card p-4 flex flex-col items-center gap-2 hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 cursor-pointer text-center group"
    >
      <div className={`w-10 h-10 rounded-lg bg-gray-50 group-hover:bg-blue-50 flex items-center justify-center transition-colors ${color} group-hover:text-blue-600`}>
        {icon}
      </div>
      <span className="text-xs font-medium text-gray-700 group-hover:text-blue-700 transition-colors leading-tight">
        {label}
      </span>
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user, isAtLeast } = useAuth();
  const [brief, setBrief] = useState<DailyBrief | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    const [briefRes, cfgRes] = await Promise.allSettled([
      api.getDailyBrief(),
      api.getCompanySettings(),
    ]);
    if (briefRes.status === 'fulfilled') setBrief(briefRes.value);
    if (cfgRes.status === 'fulfilled') setCompanyName(cfgRes.value?.company_name ?? '');
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(), 60000);
    return () => clearInterval(interval);
  }, [loadData]);

  const kpis = brief?.kpis;
  const attention = brief?.attention ?? [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {getGreeting()}{user?.display_name ? `, ${user.display_name.split(' ')[0]}` : ''}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {formatDate()}{companyName ? ` · ${companyName}` : ''}
          </p>
        </div>
        <button
          onClick={() => loadData(true)}
          className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 shadow-sm"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin text-blue-500' : ''} />
          Refresh
        </button>
      </div>

      {/* Needs attention */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={16} className={attention.length > 0 ? 'text-red-500' : 'text-gray-300'} />
          <h2 className="font-semibold text-gray-900">Needs Attention</h2>
          {attention.length > 0 && (
            <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full">
              {attention.length}
            </span>
          )}
        </div>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <SkeletonBox key={i} className="h-12 w-full" />)}
          </div>
        ) : attention.length === 0 ? (
          <div className="text-center py-6">
            <CheckCircle2 size={30} className="text-green-400 mx-auto mb-2" />
            <p className="text-gray-500 text-sm font-medium">Nothing needs your attention right now</p>
            <p className="text-gray-400 text-xs mt-0.5">Work orders are on schedule, no critical issues open.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {attention.map((item, i) => (
              <Link
                key={`${item.type}-${i}`}
                to={item.link}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors group ${
                  item.severity === 'red'
                    ? 'bg-red-50 border-red-200 hover:bg-red-100'
                    : 'bg-amber-50 border-amber-200 hover:bg-amber-100'
                }`}
              >
                <span className={`flex-shrink-0 ${item.severity === 'red' ? 'text-red-500' : 'text-amber-500'}`}>
                  {ATTENTION_ICONS[item.type]}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[11px] font-semibold uppercase tracking-wide ${item.severity === 'red' ? 'text-red-600' : 'text-amber-600'}`}>
                      {ATTENTION_TYPE_LABELS[item.type]}
                    </span>
                    <span className="text-sm font-medium text-gray-900 truncate">{item.label}</span>
                  </div>
                  {item.detail && <div className="text-xs text-gray-500 truncate">{item.detail}</div>}
                </div>
                <ChevronRight size={15} className="text-gray-300 group-hover:text-gray-500 flex-shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          [1, 2, 3, 4].map(i => <SkeletonBox key={i} className="h-24 w-full" />)
        ) : (
          <>
            <DeltaStatCard
              label="Completed Today"
              value={kpis?.completed_today ?? 0}
              delta={kpis?.vs_7day_avg_pct}
              deltaLabel="vs 7-day avg"
              icon={<CheckCircle size={18} />} iconBg="bg-green-50" iconColor="text-green-600"
            />
            <DeltaStatCard
              label="Schedule Adherence"
              value={kpis?.schedule_adherence !== null ? `${kpis?.schedule_adherence}%` : '—'}
              deltaLabel={`${kpis?.work_orders_on_track ?? 0} of ${kpis?.work_orders_total ?? 0} WOs on track`}
              icon={<CalendarCheck size={18} />} iconBg="bg-teal-50" iconColor="text-teal-600"
            />
            <DeltaStatCard
              label="Pass Rate (7 days)"
              value={kpis?.pass_rate_7d !== null ? `${kpis?.pass_rate_7d}%` : '—'}
              deltaLabel="from QC results"
              icon={<TrendingUp size={18} />} iconBg="bg-purple-50" iconColor="text-purple-600"
            />
            <DeltaStatCard
              label="Active Now"
              value={kpis?.active_now ?? 0}
              deltaLabel="processes running"
              icon={<Activity size={18} />} iconBg="bg-blue-50" iconColor="text-blue-600"
              pulse={(kpis?.active_now ?? 0) > 0}
            />
          </>
        )}
      </div>

      {/* Due soon + throughput */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Due in the Next 48 Hours</h2>
            <Link to="/schedule" className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
              View schedule <ChevronRight size={12} />
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <SkeletonBox key={i} className="h-14 w-full" />)}</div>
          ) : (brief?.due_soon ?? []).length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 size={26} className="text-green-400 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">Nothing due in the next two days</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {brief!.due_soon.map(wo => (
                <div key={wo.id} className="border border-gray-100 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold text-xs text-gray-900">{wo.work_order_number}</span>
                      <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${SCHEDULE_PILL[wo.schedule_status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {wo.schedule_status.replace('_', ' ')}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      due {new Date(wo.scheduled_end).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 truncate mb-1.5">
                    {wo.part_name}{wo.department_name ? ` · ${wo.department_name}` : ''}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          wo.schedule_status === 'overdue' || wo.schedule_status === 'behind' ? 'bg-red-500' :
                          wo.schedule_status === 'at_risk' ? 'bg-amber-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${wo.completion_pct}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-gray-500 tabular-nums">{wo.quantity_completed}/{wo.quantity}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Output — Last 7 Days</h2>
            <Link to="/analytics" className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
              Analytics <ChevronRight size={12} />
            </Link>
          </div>
          {loading ? (
            <SkeletonBox className="h-52 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={brief?.throughput_7d ?? []} margin={{ left: 0, right: 10, top: 5, bottom: 0 }}>
                <defs>
                  <linearGradient id="throughputFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis
                  dataKey="date" tick={{ fontSize: 10 }}
                  tickFormatter={d => new Date(d + 'T00:00:00').toLocaleDateString([], { weekday: 'short' })}
                />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={28} />
                <Tooltip
                  labelFormatter={d => new Date(d + 'T00:00:00').toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
                  formatter={(v: any) => [v, 'Completions']}
                />
                {(brief?.week_avg_per_day ?? 0) > 0 && (
                  <ReferenceLine
                    y={brief!.week_avg_per_day}
                    stroke="#9ca3af" strokeDasharray="5 4"
                    label={{ value: `avg ${brief!.week_avg_per_day}`, position: 'insideTopRight', style: { fontSize: 10, fill: '#9ca3af' } }}
                  />
                )}
                <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} fill="url(#throughputFill)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="font-semibold text-gray-700 text-sm mb-3">Quick Actions</h2>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          <QuickAction icon={<ExternalLink size={18} />} label="Start Operator Session" to="/operator" newTab color="text-green-600" />
          {isAtLeast('supervisor') && (
            <QuickAction icon={<Plus size={18} />} label="New Work Order" to="/schedule" color="text-blue-600" />
          )}
          {isAtLeast('supervisor') && (
            <QuickAction icon={<Layers size={18} />} label="New App" to="/apps" color="text-purple-600" />
          )}
          <QuickAction icon={<BarChart2 size={18} />} label="View Analytics" to="/analytics" color="text-indigo-600" />
          <QuickAction icon={<Cpu size={18} />} label="OEE Dashboard" to="/oee" color="text-amber-600" />
          <QuickAction icon={<Monitor size={18} />} label="Plant View" to="/plant" color="text-pink-600" />
        </div>
      </div>

      {/* Free-tier upgrade banner */}
      {brief && !brief.is_pro && (
        <Link to="/settings" className="flex items-center gap-3 p-4 rounded-xl border border-dashed border-amber-300 bg-amber-50 hover:bg-amber-100 transition-colors group">
          <div className="w-9 h-9 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600 flex-shrink-0">
            <Lock size={16} />
          </div>
          <div className="flex-1">
            <span className="text-sm font-semibold text-gray-800">Inventory, Quality and Purchasing alerts are available on Pro</span>
            <span className="text-xs text-gray-500 block">Low-stock, critical NCR and late-PO warnings will appear in Needs Attention after upgrading.</span>
          </div>
          <ChevronRight size={16} className="text-amber-400 group-hover:text-amber-600" />
        </Link>
      )}
    </div>
  );
}
