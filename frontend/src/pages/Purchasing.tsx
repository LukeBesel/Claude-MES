import { RefreshCw } from 'lucide-react';

export default function Purchasing() {
  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
      <div className="text-center text-gray-400">
        <RefreshCw size={32} className="animate-spin mx-auto mb-3" />
        <div className="text-sm">Loading Purchasing module…</div>
      </div>
    </div>
  );
}
