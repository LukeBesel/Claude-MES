import {
  LayoutDashboard, AppWindow, Database, BarChart3, Monitor,
  Calendar, ClipboardList, Trophy,
  Timer, Users, Cpu, LayoutGrid,
  Package, ShoppingCart, ShieldCheck, Building2,
} from 'lucide-react';

export type NavItem = {
  to: string; icon: React.ElementType; label: string;
  exact?: boolean; proOnly?: boolean; minRole?: string;
  /** Items that can't be hidden via the Sidebar settings (always shown). */
  pinned?: boolean;
};

export type NavGroup = { group: string; items: NavItem[] };

export const NAV: NavGroup[] = [
  {
    group: 'Operations',
    items: [
      { to: '/',         icon: LayoutDashboard, label: 'Command Center',  exact: true, pinned: true },
      { to: '/apps',     icon: AppWindow,       label: 'App Library' },
      { to: '/schedule', icon: Calendar,        label: 'Schedule' },
    ]
  },
  {
    group: 'Monitoring',
    items: [
      { to: '/plant',    icon: Building2,       label: 'Plant View' },
      { to: '/manager',  icon: ClipboardList,   label: 'Manager View',  minRole: 'manager' },
      { to: '/oee',      icon: Cpu,             label: 'OEE Tracker',   minRole: 'supervisor' },
      { to: '/stations', icon: Monitor,         label: 'Stations' },
    ]
  },
  {
    group: 'Inventory & Supply',
    items: [
      { to: '/inventory',  icon: Package,      label: 'Inventory',   proOnly: true },
      { to: '/purchasing', icon: ShoppingCart, label: 'Purchasing',  proOnly: true, minRole: 'supervisor' },
    ]
  },
  {
    group: 'Quality',
    items: [
      { to: '/quality', icon: ShieldCheck, label: 'NCR / Quality', proOnly: true },
    ]
  },
  {
    group: 'Analytics',
    items: [
      { to: '/dashboards',   icon: LayoutGrid, label: 'Dashboards' },
      { to: '/leaderboard',  icon: Trophy,     label: 'Leaderboard' },
      { to: '/step-metrics', icon: Timer,      label: 'Step Metrics',  minRole: 'supervisor' },
      { to: '/capacity',     icon: Users,      label: 'Capacity Plan', minRole: 'manager' },
      { to: '/analytics',    icon: BarChart3,  label: 'Analytics' },
      { to: '/tables',       icon: Database,   label: 'Tables',        minRole: 'supervisor' },
    ]
  },
];
