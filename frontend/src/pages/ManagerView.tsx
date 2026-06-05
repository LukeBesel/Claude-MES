import { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import {
  Users, Clock, CheckCircle2, AlertTriangle, TrendingUp, Activity,
  RefreshCw, ChevronRight, Zap, Timer, Package
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ActiveCompletion {
  id: string;
  app_name: string;
  operator_name: string;
  station_id: string | null;
  started_at: string;
  work_order_number: string | null;
  work_order_id: string | null;
}

interface WorkOrder {
  id: string;
  work_order_number: string;
  part_number: string;
  part_name: string;
  app_id: string;
  app_name: string;
  department: string;
  quantity_total: number;
  quantity_completed: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  schedule_status: 'on_track' | 'at_risk' | 'behind' | 'not_started';
  scheduled_start: string;
  scheduled_end: string;
  takt_time: number;
  notes: string;
}

interface DepartmentStat {
  department: string;
  active_operators: number;
  completions_today: number;
  avg_cycle_time: number;
  takt_time: number;
}

interface ManagerViewData {
  active_completions: ActiveCompletion[];
  work_orders: WorkOrder[];
  department_stats: DepartmentStat[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SCHEDULE_STATUS_MAP: Record<string, { label: string; cls: string }> = {
  on_track:    { label: 'On Track',    cls: 'bg-green-100 text-green-700 border border-green-200' },
  at_risk:     { label: 'At Risk',     cls: 'bg-amber-100 text-amber-700 border border-amber-200' },
  behind:      { label: 'Behind',      cls: 'bg-red-100 text-red-700 border border-red-200' },
  not_started: { label: 'Not Started', cls: 'bg-gray-100 text-gray-600 border border-gray-200' },
};

const PRIORITY_MAP: Record<string, { label: string; cls: string }> = {
  critical: { label: 'Critical', cls: 'bg-red-600 text-white' },
  high:     { label: 'High',     cls: 'bg-orange-500 text-white' },
  medium:   { label: 'Medium',   cls: 'bg-blue-500 text-white' },
  low:      { label: 'Low',      cls: 'bg-gray-400 text-white' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function useElapsedSeconds(startedAt: string) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const update = () => setElapsed(Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [startedAt]);
  return elapsed;
}

function formatElapsed(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function calcETA(wo: WorkOrder): string {
  if (wo.quantity_completed >= wo.quantity_total) return 'Complete';
  const remaining = wo.quantity_total - wo.quantity_completed;
  const etaMinutes = remaining * wo.takt_time;
  if (etaMinutes < 60) return `~${Math.round(etaMinutes)}m`;
  return `~${(etaMinutes / 60).toFixed(1)}h`;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ActiveRunCard({ run }: { run: ActiveCompletion }) {
  const elapsed = useElapsedSeconds(run.started_at);
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse flex-shrink-0 mt-0.5" />
          <span className="font-semibold text-sm text-gray-900 leading-tight">{run.app_name}</span>
        </div>
        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium flex-shrink-0">Running</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Users size={12} />
        <span>{run.operator_name || 'Unknown'}</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-700 font-mono font-medium">
        <Timer size={12} className="text-blue-500" />
        <span className="tabular-nums">{formatElapsed(elapsed)}</span>
      </div>
      {run.work_order_number && (
        <div className="flex items-center gap-1.5 text-xs text-blue-600">
          <Package size={11} />
          <span>WO: {run.work_order_number}</span>
        </div>
      )}
    </div>
  );
}

function WorkOrderCard({ wo }: { wo: WorkOrder }) {
  const pct = wo.quantity_total > 0 ? Math.round((wo.quantity_completed / wo.quantity_total) * 100) : 0;
  const status = SCHEDULE_STATUS_MAP[wo.schedule_status] ?? SCHEDULE_STATUS_MAP.not_started;
  const priority = PRIORITY_MAP[wo.priority] ?? PRIORITY_MAP.low;
  const barColor =
    wo.schedule_status === 'on_track' ? 'bg-green-500' :
    wo.schedule_status === 'at_risk'  ? 'bg-amber-500' :
    wo.schedule_status === 'behind'   ? 'bg-red-500'   : 'bg-gray-300';

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs text-gray-400 font-mono">{wo.work_order_number}</div>
          <div className="font-bold text-sm text-gray-900 leading-tight truncate">{wo.part_name}</div>
          <div className="text-xs text-gray-500">{wo.part_number}</div>
        </div>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${priority.cls}`}>
          {priority.label}
        </span>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-gray-500">{wo.quantity_completed} / {wo.quantity_total} units</span>
          <span className="text-xs font-semibold text-gray-900">{pct}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Status + Takt + ETA */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.cls}`}>{status.label}</span>
        <span className="text-xs text-gray-400">|</span>
        <span className="text-xs text-gray-600 flex items-center gap-1">
          <Clock size={10} className="flex-shrink-0" />
          Takt: {wo.takt_time}m
        </span>
        <span className="text-xs text-gray-400">|</span>
        <span className="text-xs text-gray-600">ETA: {calcETA(wo)}</span>
      </div>

      {/* Schedule */}
      <div className="flex items-center gap-1.5 text-xs text-gray-400">
        <ChevronRight size={10} />
        {formatDate(wo.scheduled_start)} – {formatDate(wo.scheduled_end)}
        <span className="ml-auto text-gray-500">{wo.department}</span>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

const ALL_DEPARTMENTS = 'All';

export default function ManagerView() {
  const [data, setData] = useState<ManagerViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeDept, setActiveDept] = useState(ALL_DEPARTMENTS);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      const [mvData, woData] = await Promise.all([
        (api as any).getManagerView(),
        (api as any).getWorkOrders(),
      ]);
      // merge: manager view already has work_orders but we prefer the richer endpoint
      setData({ ...mvData, work_orders: woData ?? mvData.work_orders ?? [] });
    } catch {
      // keep stale
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(true);
    intervalRef.current = setInterval(() => load(false), 15000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [load]);

  const departments = [ALL_DEPARTMENTS, ...Array.from(new Set((data?.work_orders ?? []).map(wo => wo.department).filter(Boolean)))];

  const filteredWOs = (data?.work_orders ?? []).filter(wo =>
    activeDept === ALL_DEPARTMENTS || wo.department === activeDept
  );

  const activeCompletions = data?.active_completions ?? [];
  const deptStats = data?.department_stats ?? [];

  // Aggregate quick stats
  const totalActive = activeCompletions.length;
  const completionsToday = deptStats.reduce((sum, d) => sum + d.completions_today, 0);
  const avgCycleTime = deptStats.length > 0
    ? (deptStats.reduce((s, d) => s + d.avg_cycle_time, 0) / deptStats.length).toFixed(1)
    : '—';
  const avgTakt = deptStats.length > 0
    ? (deptStats.reduce((s, d) => s + d.takt_time, 0) / deptStats.length).toFixed(1)
    : '—';

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Activity size={20} className="text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Operations Manager</h1>
          </div>
          <p className="text-gray-500 text-sm mt-0.5">Live production floor view — auto-refreshes every 15s</p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-60"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin text-blue-500' : ''} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw size={28} className="animate-spin text-blue-500" />
            <span className="text-gray-500 text-sm">Loading operations data…</span>
          </div>
        </div>
      ) : (
        <>
          {/* Quick Stats Bar */}
          <div className="grid grid-cols-4 gap-4">
            <QuickStat
              icon={<Users size={18} className="text-blue-600" />}
              bg="bg-blue-50"
              label="Active Operators"
              value={totalActive}
            />
            <QuickStat
              icon={<CheckCircle2 size={18} className="text-green-600" />}
              bg="bg-green-50"
              label="Completions Today"
              value={completionsToday}
            />
            <QuickStat
              icon={<Clock size={18} className="text-purple-600" />}
              bg="bg-purple-50"
              label="Avg Cycle Time"
              value={`${avgCycleTime}m`}
            />
            <QuickStat
              icon={<TrendingUp size={18} className="text-orange-600" />}
              bg="bg-orange-50"
              label="Target Takt Time"
              value={`${avgTakt}m`}
            />
          </div>

          {/* Live Active Runs */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
              <h2 className="text-base font-semibold text-gray-900">Live Active Runs</h2>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                {activeCompletions.length} running
              </span>
            </div>
            {activeCompletions.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm py-8 text-center text-gray-400 text-sm">
                <Zap size={24} className="mx-auto mb-2 text-gray-300" />
                No active runs at the moment
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {activeCompletions.map(run => (
                  <ActiveRunCard key={run.id} run={run} />
                ))}
              </div>
            )}
          </section>

          {/* Department filter tabs */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit overflow-x-auto">
            {departments.map(dept => (
              <button
                key={dept}
                onClick={() => setActiveDept(dept)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                  activeDept === dept
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {dept}
              </button>
            ))}
          </div>

          {/* Work Order Grid */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-gray-900">Work Orders</h2>
              <Link to="/schedule" className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
                Manage Schedule <ChevronRight size={12} />
              </Link>
            </div>
            {filteredWOs.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm py-12 text-center text-gray-400 text-sm">
                <Package size={28} className="mx-auto mb-2 text-gray-300" />
                No work orders found
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                {filteredWOs.map(wo => (
                  <WorkOrderCard key={wo.id} wo={wo} />
                ))}
              </div>
            )}
          </section>

          {/* Department Stats */}
          {deptStats.length > 0 && (
            <section>
              <h2 className="text-base font-semibold text-gray-900 mb-3">Department Summary</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {deptStats.map(dept => {
                  const cycleVsTakt = dept.takt_time > 0 ? dept.avg_cycle_time / dept.takt_time : 0;
                  const statusColor =
                    cycleVsTakt <= 1    ? 'text-green-600 bg-green-50' :
                    cycleVsTakt <= 1.1  ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50';
                  const barColor =
                    cycleVsTakt <= 1    ? 'bg-green-500' :
                    cycleVsTakt <= 1.1  ? 'bg-amber-500' : 'bg-red-500';
                  return (
                    <div key={dept.department} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="font-semibold text-gray-900">{dept.department}</div>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor}`}>
                          {dept.active_operators} active
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                        <div>
                          <div className="text-xs text-gray-400">Completions Today</div>
                          <div className="font-bold text-gray-900">{dept.completions_today}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-400">Avg Cycle vs Takt</div>
                          <div className="font-bold text-gray-900">{dept.avg_cycle_time.toFixed(1)}m / {dept.takt_time}m</div>
                        </div>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${barColor}`}
                          style={{ width: `${Math.min(100, cycleVsTakt * 100)}%` }}
                        />
                      </div>
                      {cycleVsTakt > 1 && (
                        <div className="flex items-center gap-1.5 mt-2 text-xs text-red-500">
                          <AlertTriangle size={11} />
                          {((cycleVsTakt - 1) * 100).toFixed(0)}% over takt
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function QuickStat({ icon, bg, label, value }: {
  icon: React.ReactNode;
  bg: string;
  label: string;
  value: string | number;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center gap-3">
      <div className={`w-9 h-9 ${bg} rounded-lg flex items-center justify-center flex-shrink-0`}>{icon}</div>
      <div>
        <div className="text-xl font-bold text-gray-900">{value}</div>
        <div className="text-xs text-gray-500">{label}</div>
      </div>
    </div>
  );
}
