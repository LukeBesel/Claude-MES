import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import {
  AnalyticsOverview, WorkOrder, OEEMachine, InventorySummary,
  QualitySummary, NCR, InventoryItem
} from '../types';
import {
  TrendingUp, Activity, CheckCircle, Timer, Cpu,
  Package, ShieldCheck, ShoppingCart, RefreshCw,
  ArrowRight, ExternalLink, Plus, BarChart2, Monitor, Layers,
  AlertTriangle, Lock
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid
} from 'recharts';

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

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString();
}

function formatLastRefreshed(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatCurrency(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toFixed(0)}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SkeletonBox({ className = '' }: { className?: string }) {
  return <div className={`bg-gray-200 animate-pulse rounded ${className}`} />;
}

function UpgradeTeaser({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <div className="card p-5 flex flex-col items-center justify-center text-center gap-3 border border-dashed border-amber-300 bg-amber-50 min-h-[200px]">
      <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600">
        <Lock size={20} />
      </div>
      <div>
        <p className="font-semibold text-gray-800 text-sm">{title}</p>
        <p className="text-xs text-gray-500 mt-1">Available on Pro &amp; Enterprise plans</p>
      </div>
      <Link to="/settings" className="btn-primary text-xs px-3 py-1.5">
        Upgrade Plan
      </Link>
    </div>
  );
}

// ─── KPI Stat Card ────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  pulse?: boolean;
}

function StatCard({ label, value, sub, icon, iconBg, iconColor, pulse }: StatCardProps) {
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
          {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
        </div>
      </div>
    </div>
  );
}

// ─── Work Order Status Pills ──────────────────────────────────────────────────

function WOStatusPills({ workOrders }: { workOrders: WorkOrder[] }) {
  const groups: Record<string, number> = {};
  for (const wo of workOrders) {
    groups[wo.status] = (groups[wo.status] ?? 0) + 1;
  }

  const config: Record<string, { label: string; color: string }> = {
    in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700' },
    pending:     { label: 'Pending',     color: 'bg-gray-100 text-gray-600' },
    overdue:     { label: 'Overdue',     color: 'bg-red-100 text-red-700' },
    completed:   { label: 'Completed',   color: 'bg-green-100 text-green-700' },
    cancelled:   { label: 'Cancelled',   color: 'bg-gray-100 text-gray-400' },
  };

  const order = ['in_progress', 'pending', 'overdue', 'completed', 'cancelled'];
  const entries = order.filter(s => (groups[s] ?? 0) > 0);

  if (entries.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-4">No work orders</p>;
  }

  return (
    <div className="space-y-2">
      {entries.map(status => (
        <div key={status} className="flex items-center justify-between">
          <span className="text-sm text-gray-700">{config[status]?.label ?? status}</span>
          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${config[status]?.color ?? 'bg-gray-100 text-gray-600'}`}>
            {groups[status]}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Quick Action Card ────────────────────────────────────────────────────────

interface QuickActionProps {
  icon: React.ReactNode;
  label: string;
  to: string;
  newTab?: boolean;
  color?: string;
}

function QuickAction({ icon, label, to, newTab, color = 'text-gray-600' }: QuickActionProps) {
  const navigate = useNavigate();
  const handleClick = () => {
    if (newTab) {
      window.open(to, '_blank');
    } else {
      navigate(to);
    }
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

// ─── Stock Progress Bar ───────────────────────────────────────────────────────

function StockBar({ current, reorder }: { current: number; reorder: number }) {
  // Show how current qty compares to 2x reorder point as full scale
  const scale = reorder > 0 ? reorder * 2 : 10;
  const pct = Math.min((current / scale) * 100, 100);
  const isLow = current <= reorder;
  return (
    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
      <div
        className={`h-full rounded-full transition-all ${isLow ? 'bg-red-500' : 'bg-green-500'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ─── Severity Badge ───────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    critical: 'badge badge-red',
    major:    'badge badge-amber',
    minor:    'badge badge-blue',
  };
  return <span className={map[severity] ?? 'badge'}>{severity}</span>;
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const [overview, setOverview]             = useState<AnalyticsOverview | null>(null);
  const [throughput, setThroughput]         = useState<{ date: string; count: number }[]>([]);
  const [oee, setOee]                       = useState<OEEMachine[]>([]);
  const [workOrders, setWorkOrders]         = useState<WorkOrder[]>([]);
  const [qualitySummary, setQualitySummary] = useState<QualitySummary | null>(null);
  const [criticalNCRs, setCriticalNCRs]     = useState<NCR[]>([]);
  const [invSummary, setInvSummary]         = useState<InventorySummary | null>(null);
  const [lowStockItems, setLowStockItems]   = useState<InventoryItem[]>([]);
  const [purchasingSummary, setPurchasingSummary] = useState<any | null>(null);
  const [companyName, setCompanyName]       = useState<string>('');
  const [recentCompletions, setRecentCompletions] = useState<any[]>([]);

  // Module availability flags (failed = likely not on plan)
  const [invFailed, setInvFailed]           = useState(false);
  const [qualFailed, setQualFailed]         = useState(false);
  const [purchFailed, setPurchFailed]       = useState(false);

  const [loading, setLoading]               = useState(true);
  const [lastRefreshed, setLastRefreshed]   = useState<Date>(new Date());

  const loadData = useCallback(async () => {
    const [
      ovRes, tpRes, oeeRes, woRes, qualRes, critRes, invRes, lowRes, purRes, cfgRes, compRes,
    ] = await Promise.allSettled([
      api.getOverview(),
      api.getThroughput(7),
      api.getOEE(),
      api.getWorkOrders(),
      api.getQualitySummary(),
      api.getNCRs({ status: 'open', severity: 'critical' }),
      api.getInventorySummary(),
      api.getInventoryItems({ low_stock: true }),
      api.getPurchasingSummary(),
      api.getCompanySettings(),
      api.getCompletions({ limit: 10 }),
    ]);

    if (ovRes.status   === 'fulfilled') setOverview(ovRes.value);
    if (tpRes.status   === 'fulfilled') setThroughput(tpRes.value);
    if (oeeRes.status  === 'fulfilled') setOee(oeeRes.value);
    if (woRes.status   === 'fulfilled') setWorkOrders(woRes.value);

    if (qualRes.status === 'fulfilled') { setQualitySummary(qualRes.value); setQualFailed(false); }
    else setQualFailed(true);

    if (critRes.status === 'fulfilled') setCriticalNCRs(critRes.value.slice(0, 4));
    if (invRes.status  === 'fulfilled') { setInvSummary(invRes.value); setInvFailed(false); }
    else setInvFailed(true);

    if (lowRes.status  === 'fulfilled') setLowStockItems(lowRes.value.slice(0, 4));
    if (purRes.status  === 'fulfilled') { setPurchasingSummary(purRes.value); setPurchFailed(false); }
    else setPurchFailed(true);

    if (cfgRes.status  === 'fulfilled') setCompanyName(cfgRes.value?.company_name ?? '');
    if (compRes.status === 'fulfilled') setRecentCompletions(compRes.value);

    setLastRefreshed(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60_000);
    return () => clearInterval(interval);
  }, [loadData]);

  // ── Derived KPIs ─────────────────────────────────────────────────────────────

  const avgOEE = oee.length > 0
    ? Math.round(oee.reduce((sum, m) => sum + (m.oee?.oee ?? 0), 0) / oee.length)
    : null;

  const passRate = overview?.passRate ?? null;

  const passRateColor =
    passRate === null ? 'text-gray-600' :
    passRate >= 95    ? 'text-green-600' :
    passRate >= 85    ? 'text-amber-600' :
    'text-red-600';

  const passRateIconColor =
    passRate === null ? 'text-gray-400' :
    passRate >= 95    ? 'text-green-600' :
    passRate >= 85    ? 'text-amber-600' :
    'text-red-600';

  const passRateIconBg =
    passRate === null ? 'bg-gray-50' :
    passRate >= 95    ? 'bg-green-50' :
    passRate >= 85    ? 'bg-amber-50' :
    'bg-red-50';

  const oeeBg =
    avgOEE === null  ? 'bg-gray-50' :
    avgOEE >= 80     ? 'bg-green-50' :
    avgOEE >= 60     ? 'bg-amber-50' :
    'bg-red-50';

  const oeeColor =
    avgOEE === null ? 'text-gray-400' :
    avgOEE >= 80    ? 'text-green-600' :
    avgOEE >= 60    ? 'text-amber-600' :
    'text-red-600';

  // ── Throughput chart tooltip ─────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const chartData = throughput.map(d => ({
    ...d,
    isToday: d.date === today,
    shortDate: d.date.slice(5),
  }));

  // ── Purchase summary ─────────────────────────────────────────────────────────
  const byStatus = purchasingSummary?.by_status as Record<string, number> | undefined;

  return (
    <div className="p-6 space-y-6 bg-[#f8fafc] min-h-screen">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {getGreeting()}{companyName ? `, ${companyName}` : ''}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Here's what's happening on the floor right now</p>
          <p className="text-xs text-gray-400 mt-0.5">{formatDate()}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-gray-400">
            Refreshed {formatLastRefreshed(lastRefreshed)}
          </span>
          <button
            onClick={loadData}
            className="btn-ghost flex items-center gap-1.5 text-sm"
            title="Refresh now"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Row 1: Production KPIs ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="stat-card">
              <SkeletonBox className="h-10 w-10 mb-2" />
              <SkeletonBox className="h-6 w-16 mb-1" />
              <SkeletonBox className="h-3 w-24" />
            </div>
          ))
        ) : (
          <>
            <StatCard
              label="Today's Output"
              value={overview?.todayCompletions ?? '—'}
              sub={`${overview?.totalCompletions ?? 0} total all-time`}
              icon={<TrendingUp size={20} />}
              iconBg="bg-blue-50"
              iconColor="text-blue-600"
            />
            <StatCard
              label="In Progress"
              value={overview?.inProgress ?? '—'}
              sub={`${overview?.activeStations ?? 0} active stations`}
              icon={<Activity size={20} />}
              iconBg="bg-amber-50"
              iconColor="text-amber-600"
              pulse={(overview?.inProgress ?? 0) > 0}
            />
            <StatCard
              label="Pass Rate"
              value={passRate !== null ? (
                <span className={passRateColor}>{passRate}%</span>
              ) : '—'}
              sub="quality checks"
              icon={<CheckCircle size={20} />}
              iconBg={passRateIconBg}
              iconColor={passRateIconColor}
            />
            <StatCard
              label="Avg Cycle Time"
              value={overview ? `${overview.avgCycleTime}m` : '—'}
              sub="per completion"
              icon={<Timer size={20} />}
              iconBg="bg-gray-50"
              iconColor="text-gray-500"
            />
            <StatCard
              label="Plant OEE"
              value={avgOEE !== null ? (
                <span className={oeeColor}>{avgOEE}%</span>
              ) : '—'}
              sub={oee.length > 0 ? `${oee.length} machines` : 'No machines configured'}
              icon={<Cpu size={20} />}
              iconBg={oeeBg}
              iconColor={oeeColor}
            />
          </>
        )}
      </div>

      {/* ── Row 2: Throughput Chart + Work Orders ── */}
      <div className="grid grid-cols-3 gap-6">

        {/* 7-Day Throughput (2/3) */}
        <div className="col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">7-Day Throughput</h2>
            <span className="text-xs text-gray-400">Last 7 days</span>
          </div>
          {loading ? (
            <SkeletonBox className="h-48 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="tpGradDash" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="shortDate"
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <CartesianGrid vertical={false} stroke="#f1f5f9" />
                <Tooltip
                  formatter={(v: any) => [v, 'Completions']}
                  labelFormatter={(l: string) => `Date: ${l}`}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  fill="url(#tpGradDash)"
                  dot={(props: any) => {
                    const { cx, cy, payload } = props;
                    if (!payload.isToday) return <g key={props.key} />;
                    return (
                      <circle key={props.key} cx={cx} cy={cy} r={5} fill="#2563eb" stroke="white" strokeWidth={2} />
                    );
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Work Orders (1/3) */}
        <div className="card p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Work Orders</h2>
            <span className="text-xs font-medium text-gray-500">{workOrders.length} total</span>
          </div>
          <div className="flex-1">
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <SkeletonBox key={i} className="h-6 w-full" />)}
              </div>
            ) : (
              <WOStatusPills workOrders={workOrders} />
            )}
          </div>
          <div className="pt-4 border-t border-gray-100 mt-4">
            <Link
              to="/schedule"
              className="flex items-center justify-between text-sm text-blue-600 hover:text-blue-700"
            >
              <span>View all work orders</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>

      {/* ── Row 3: Inventory / Quality / Purchasing ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Inventory Alerts */}
        {invFailed ? (
          <UpgradeTeaser title="Inventory Management" icon={<Package size={20} />} />
        ) : (
          <div className="card p-5 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 bg-orange-50 rounded-md flex items-center justify-center">
                <Package size={15} className="text-orange-600" />
              </div>
              <h2 className="font-semibold text-gray-900">Inventory Alerts</h2>
            </div>

            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <SkeletonBox key={i} className="h-5 w-full" />)}
              </div>
            ) : (
              <>
                {/* Summary */}
                <div className="flex gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-lg font-bold text-gray-900">{invSummary?.total_items ?? 0}</div>
                    <div className="text-xs text-gray-500">Items</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-gray-900">
                      {formatCurrency(invSummary?.total_value ?? 0)}
                    </div>
                    <div className="text-xs text-gray-500">Value</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-lg font-bold ${(invSummary?.low_stock ?? 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {invSummary?.low_stock ?? 0}
                    </div>
                    <div className="text-xs text-gray-500">Low Stock</div>
                  </div>
                </div>

                {/* Low stock items */}
                {lowStockItems.length > 0 && (
                  <div className="space-y-2.5 flex-1">
                    {lowStockItems.map(item => (
                      <div key={item.id} className="text-xs">
                        <div className="flex justify-between items-baseline mb-0.5">
                          <span className="font-medium text-gray-800 truncate max-w-[120px]">{item.name}</span>
                          <span className="text-gray-400 ml-1 flex-shrink-0">{item.sku}</span>
                        </div>
                        <div className="flex justify-between text-gray-500 mb-0.5">
                          <span>Qty: <span className="font-medium text-red-600">{item.total_quantity}</span></span>
                          <span>Reorder: {item.reorder_point}</span>
                        </div>
                        <StockBar current={item.total_quantity} reorder={item.reorder_point} />
                      </div>
                    ))}
                  </div>
                )}

                {lowStockItems.length === 0 && invSummary && (
                  <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                    <CheckCircle size={13} /> All stock levels healthy
                  </p>
                )}
              </>
            )}

            <div className="pt-4 border-t border-gray-100 mt-auto">
              <Link
                to="/inventory"
                className="flex items-center justify-between text-sm text-blue-600 hover:text-blue-700"
              >
                <span>View Inventory</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        )}

        {/* Quality Alerts */}
        {qualFailed ? (
          <UpgradeTeaser title="Quality Management (NCRs)" icon={<ShieldCheck size={20} />} />
        ) : (
          <div className="card p-5 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 bg-blue-50 rounded-md flex items-center justify-center">
                <ShieldCheck size={15} className="text-blue-600" />
              </div>
              <h2 className="font-semibold text-gray-900">Quality</h2>
            </div>

            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <SkeletonBox key={i} className="h-5 w-full" />)}
              </div>
            ) : (
              <>
                {/* Summary counts */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                    <div className="text-lg font-bold text-gray-900">{qualitySummary?.open ?? 0}</div>
                    <div className="text-xs text-gray-500">Open</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2.5 text-center">
                    <div className="text-lg font-bold text-gray-900">{qualitySummary?.investigating ?? 0}</div>
                    <div className="text-xs text-gray-500">Investigating</div>
                  </div>
                  <div className={`rounded-lg p-2.5 text-center ${(qualitySummary?.critical ?? 0) > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                    <div className={`text-lg font-bold ${(qualitySummary?.critical ?? 0) > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                      {qualitySummary?.critical ?? 0}
                    </div>
                    <div className="text-xs text-gray-500">Critical</div>
                  </div>
                  <div className={`rounded-lg p-2.5 text-center ${(qualitySummary?.overdue ?? 0) > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                    <div className={`text-lg font-bold ${(qualitySummary?.overdue ?? 0) > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                      {qualitySummary?.overdue ?? 0}
                    </div>
                    <div className="text-xs text-gray-500">Overdue</div>
                  </div>
                </div>

                {/* Critical open NCRs */}
                {criticalNCRs.length > 0 && (
                  <div className="space-y-1.5 flex-1">
                    <p className="text-xs font-semibold text-red-600 flex items-center gap-1 mb-1">
                      <AlertTriangle size={12} /> Critical Open NCRs
                    </p>
                    {criticalNCRs.map(ncr => (
                      <div key={ncr.id} className="flex items-start gap-2 bg-red-50 rounded-lg p-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-gray-800 truncate">{ncr.title}</div>
                          <div className="text-xs text-gray-500">{ncr.ncr_number}</div>
                        </div>
                        <SeverityBadge severity={ncr.severity} />
                      </div>
                    ))}
                  </div>
                )}

                {criticalNCRs.length === 0 && qualitySummary && (
                  <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                    <CheckCircle size={13} /> No critical open NCRs
                  </p>
                )}
              </>
            )}

            <div className="pt-4 border-t border-gray-100 mt-auto">
              <Link
                to="/quality"
                className="flex items-center justify-between text-sm text-blue-600 hover:text-blue-700"
              >
                <span>View Quality</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        )}

        {/* Purchasing */}
        {purchFailed ? (
          <UpgradeTeaser title="Purchasing Management" icon={<ShoppingCart size={20} />} />
        ) : (
          <div className="card p-5 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 bg-purple-50 rounded-md flex items-center justify-center">
                <ShoppingCart size={15} className="text-purple-600" />
              </div>
              <h2 className="font-semibold text-gray-900">Purchasing</h2>
            </div>

            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <SkeletonBox key={i} className="h-5 w-full" />)}
              </div>
            ) : (
              <>
                <div className="flex gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-lg font-bold text-gray-900">{purchasingSummary?.open_pos ?? 0}</div>
                    <div className="text-xs text-gray-500">Open POs</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-gray-900">{purchasingSummary?.total_vendors ?? 0}</div>
                    <div className="text-xs text-gray-500">Vendors</div>
                  </div>
                </div>

                {/* Status breakdown */}
                {byStatus && Object.keys(byStatus).length > 0 && (
                  <div className="space-y-2 flex-1">
                    <p className="text-xs text-gray-500 font-medium">By Status</p>
                    {Object.entries(byStatus)
                      .filter(([, cnt]) => (cnt as number) > 0)
                      .map(([status, cnt]) => {
                        const colorMap: Record<string, string> = {
                          draft:    'bg-gray-100 text-gray-600',
                          sent:     'bg-blue-100 text-blue-700',
                          partial:  'bg-amber-100 text-amber-700',
                          received: 'bg-green-100 text-green-700',
                          cancelled:'bg-gray-100 text-gray-400',
                        };
                        return (
                          <div key={status} className="flex items-center justify-between">
                            <span className="text-sm text-gray-700 capitalize">{status}</span>
                            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${colorMap[status] ?? 'bg-gray-100 text-gray-600'}`}>
                              {cnt as number}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                )}

                {(!byStatus || Object.keys(byStatus).length === 0) && (
                  <p className="text-xs text-gray-400 flex-1">No purchase orders found</p>
                )}
              </>
            )}

            <div className="pt-4 border-t border-gray-100 mt-auto">
              <Link
                to="/purchasing"
                className="flex items-center justify-between text-sm text-blue-600 hover:text-blue-700"
              >
                <span>View Purchasing</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* ── Row 4: Quick Actions ── */}
      <div>
        <h2 className="font-semibold text-gray-700 text-sm mb-3">Quick Actions</h2>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          <QuickAction icon={<ExternalLink size={18} />} label="Start Operator Session" to="/operator" newTab color="text-green-600" />
          <QuickAction icon={<Plus size={18} />}         label="New Work Order"          to="/schedule" color="text-blue-600" />
          <QuickAction icon={<Layers size={18} />}       label="New App"                 to="/apps" color="text-purple-600" />
          <QuickAction icon={<BarChart2 size={18} />}    label="View Analytics"          to="/analytics" color="text-indigo-600" />
          <QuickAction icon={<Cpu size={18} />}          label="OEE Dashboard"           to="/oee" color="text-amber-600" />
          <QuickAction icon={<Monitor size={18} />}      label="Custom Dashboards"       to="/dashboards" color="text-pink-600" />
        </div>
      </div>

      {/* ── Row 5: Recent Activity ── */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Recent Activity</h2>
          <Link to="/analytics" className="text-xs text-blue-600 hover:text-blue-700">
            View all
          </Link>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => <SkeletonBox key={i} className="h-10 w-full" />)}
          </div>
        ) : recentCompletions.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-6">No completions yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-gray-500 pb-2">App</th>
                  <th className="text-left text-xs font-medium text-gray-500 pb-2">Operator</th>
                  <th className="text-left text-xs font-medium text-gray-500 pb-2">Status</th>
                  <th className="text-right text-xs font-medium text-gray-500 pb-2">Cycle Time</th>
                  <th className="text-right text-xs font-medium text-gray-500 pb-2">When</th>
                  <th className="text-right text-xs font-medium text-gray-500 pb-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentCompletions.map((c: any) => {
                  const cycleSeconds = c.completed_at
                    ? (new Date(c.completed_at).getTime() - new Date(c.started_at).getTime()) / 1000
                    : null;
                  const cycleMins = cycleSeconds !== null ? (cycleSeconds / 60).toFixed(1) : null;
                  const taktMins = c.takt_time_seconds ? c.takt_time_seconds / 60 : null;
                  const underTakt = taktMins !== null && cycleMins !== null && parseFloat(cycleMins) <= taktMins;

                  return (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-2.5 pr-3">
                        <span className="font-medium text-gray-900 truncate max-w-[160px] block">{c.app_name}</span>
                      </td>
                      <td className="py-2.5 pr-3 text-gray-600">{c.operator_name || '—'}</td>
                      <td className="py-2.5 pr-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          c.status === 'completed'   ? 'bg-green-100 text-green-700' :
                          c.status === 'in_progress' ? 'bg-amber-100 text-amber-700' :
                          c.status === 'abandoned'   ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {c.status === 'in_progress' ? 'In Progress' :
                           c.status === 'completed'   ? 'Completed'   :
                           c.status === 'abandoned'   ? 'Abandoned'   : c.status}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-right">
                        {cycleMins !== null ? (
                          <span className={`font-medium ${underTakt ? 'text-green-600' : 'text-gray-700'}`}>
                            {cycleMins}m
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-right text-gray-400 text-xs whitespace-nowrap">
                        {formatTime(c.started_at)}
                      </td>
                      <td className="py-2.5 text-right">
                        <Link
                          to={`/completions/${c.id}`}
                          className="text-xs text-blue-600 hover:text-blue-700"
                        >
                          Detail
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
