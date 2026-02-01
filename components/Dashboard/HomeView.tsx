import React from 'react';
import { View } from '../../types';
import { ModuleCard } from './ModuleCard';
import { Icons } from '../Shared/Icons';

interface HomeViewProps {
  onNavigate: (view: View) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onNavigate }) => {
  return (
    <div className="p-4 max-w-5xl mx-auto w-full animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Emergency Command
        </h1>
        <p className="text-slate-500 dark:text-slate-400">
          Select a mode to begin assistance
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ModuleCard
          id="INTERACTIVE"
          label="Live Emergency Assistant"
          subtitle="Talk, show, and get guided help"
          icon={Icons.Interactive}
          colorClass="text-blue-600"
          onClick={onNavigate}
        />
        <ModuleCard
          id="LEARNING"
          label="Emergency Skills Training"
          subtitle="Train daily, stay ready"
          icon={Icons.Learning}
          colorClass="text-emerald-600"
          onClick={onNavigate}
        />
        <ModuleCard
          id="ANALYSIS"
          label="AI Health Scan"
          subtitle="Upload video, get instant triage"
          icon={Icons.Analysis}
          colorClass="text-purple-600"
          onClick={onNavigate}
        />
        <ModuleCard
          id="BRIDGE"
          label="Emergency Bridge"
          subtitle="Call EMS, contacts, location"
          icon={Icons.Bridge}
          colorClass="text-red-600"
          onClick={onNavigate}
        />
      </div>

      {/* Quick Stats / Info Footer (Optional context for 'production-grade' feel) */}
      <div className="mt-8 p-4 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-start space-x-3">
        <Icons.Warning className="text-amber-500 shrink-0 mt-0.5" size={20} />
        <div>
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">System Ready</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Last diagnostic check completed 2 minutes ago. All sensors active.
            AI Models loaded: 2.5 Flash, 3 Pro Preview.
          </p>
        </div>
      </div>
    </div>
  );
};
