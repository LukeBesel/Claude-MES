import { Outlet, NavLink } from 'react-router-dom';
import {
  LayoutDashboard, AppWindow, Database, BarChart3, Monitor,
  Calendar, Factory, Settings, Activity, Building2, ClipboardList
} from 'lucide-react';

const NAV = [
  {
    group: 'Operations',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true },
      { to: '/apps', icon: AppWindow, label: 'App Library' },
      { to: '/schedule', icon: Calendar, label: 'Schedule' },
    ]
  },
  {
    group: 'Monitoring',
    items: [
      { to: '/plant', icon: Building2, label: 'Plant View' },
      { to: '/manager', icon: ClipboardList, label: 'Manager View' },
      { to: '/stations', icon: Monitor, label: 'Stations' },
    ]
  },
  {
    group: 'Data & Analytics',
    items: [
      { to: '/analytics', icon: BarChart3, label: 'Analytics' },
      { to: '/tables', icon: Database, label: 'Tables' },
    ]
  },
];

export default function Layout() {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 flex flex-col" style={{ backgroundColor: '#0a1628' }}>
        {/* Logo */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg">
              <Activity size={18} className="text-white" />
            </div>
            <div>
              <div className="text-white font-bold text-base leading-tight tracking-tight">HartMonitor</div>
              <div className="text-blue-300/70 text-[11px] font-medium">Manufacturing Intelligence</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 overflow-y-auto space-y-5">
          {NAV.map(({ group, items }) => (
            <div key={group}>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 px-3 mb-1.5">{group}</div>
              <div className="space-y-0.5">
                {items.map(({ to, icon: Icon, label, exact }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={exact}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/50'
                          : 'text-gray-400 hover:text-white hover:bg-white/8'
                      }`
                    }
                  >
                    <Icon size={15} className="flex-shrink-0" />
                    {label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-white/10">
          <button className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:text-white hover:bg-white/8 w-full transition-all">
            <Settings size={15} />
            Settings
          </button>
          <div className="mt-3 px-3 py-2.5 rounded-xl bg-white/5">
            <div className="text-[10px] text-gray-500 mb-0.5">Version</div>
            <div className="text-xs text-gray-400 font-medium">HartMonitor v1.0</div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
