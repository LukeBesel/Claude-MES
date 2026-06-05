import { X, Zap, Check, ArrowRight } from 'lucide-react';
import { usePlan } from '../../context/PlanContext';
import { api } from '../../api/client';
import { useState } from 'react';

interface Props {
  onClose: () => void;
  feature?: string;
  reason?: string;
}

const PRO_FEATURES = [
  'Unlimited Apps & Dashboards',
  'Inventory Management (Items, Stock, Movements)',
  'Purchasing & Vendor Management (POs)',
  'Quality / NCR Management',
  'Full Data Export (CSV & JSON)',
  'Advanced Analytics & Reports',
  'All future features',
];

export default function UpgradeModal({ onClose, feature, reason }: Props) {
  const { refresh } = usePlan();
  const [upgrading, setUpgrading] = useState(false);
  const [done, setDone] = useState(false);

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      await api.updatePlan({ tier: 'pro' });
      refresh();
      setDone(true);
      setTimeout(() => onClose(), 1500);
    } finally {
      setUpgrading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 bg-gradient-to-br from-blue-600 to-blue-700 relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-blue-200 hover:text-white transition-colors">
            <X size={18} />
          </button>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Zap size={20} className="text-white" />
            </div>
            <div>
              <div className="text-white font-bold text-lg leading-tight">Upgrade to Pro</div>
              <div className="text-blue-200 text-xs">Unlock the full HartMonitor platform</div>
            </div>
          </div>
          {reason && (
            <div className="text-sm text-blue-100 bg-blue-800/30 rounded-lg px-3 py-2">
              {reason}
            </div>
          )}
        </div>

        {/* Features list */}
        <div className="px-6 py-4">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Everything in Pro includes:</div>
          <ul className="space-y-2">
            {PRO_FEATURES.map(f => (
              <li key={f} className="flex items-center gap-2.5 text-sm text-gray-700">
                <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <Check size={11} className="text-green-600" />
                </div>
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* CTA */}
        <div className="px-6 pb-6 space-y-2">
          {done ? (
            <div className="w-full py-3 rounded-xl bg-green-500 text-white text-center font-semibold text-sm">
              ✓ Upgraded to Pro! Reloading…
            </div>
          ) : (
            <button
              onClick={handleUpgrade}
              disabled={upgrading}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-dark))' }}
            >
              {upgrading ? 'Activating…' : (
                <>Activate Pro — Free Demo <ArrowRight size={14} /></>
              )}
            </button>
          )}
          <button onClick={onClose} className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors">
            Maybe later
          </button>
          <p className="text-center text-xs text-gray-400">This is a demo — upgrade is instant and free.</p>
        </div>
      </div>
    </div>
  );
}
