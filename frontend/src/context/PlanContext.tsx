import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { api } from '../api/client';
import type { Plan } from '../types';

interface PlanContextValue {
  plan: Plan | null;
  loading: boolean;
  refresh: () => void;
  canCreateApp: boolean;
  canCreateDashboard: boolean;
  isPro: boolean;
  isEnterprise: boolean;
  isFree: boolean;
}

const PlanContext = createContext<PlanContextValue | null>(null);

export function PlanProvider({ children }: { children: ReactNode }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    api.getPlan().then(p => setPlan(p)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const isPro        = plan?.tier === 'pro' || plan?.tier === 'enterprise';
  const isEnterprise = plan?.tier === 'enterprise';
  const isFree       = plan?.tier === 'free' || !plan;

  const canCreateApp = !plan || plan.app_limit < 0 || (plan.app_count ?? 0) < plan.app_limit;
  const canCreateDashboard = !plan || plan.dashboard_limit < 0 || (plan.dashboard_count ?? 0) < plan.dashboard_limit;

  return (
    <PlanContext.Provider value={{ plan, loading, refresh, canCreateApp, canCreateDashboard, isPro, isEnterprise, isFree }}>
      {children}
    </PlanContext.Provider>
  );
}

export function usePlan(): PlanContextValue {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error('usePlan must be used within PlanProvider');
  return ctx;
}
