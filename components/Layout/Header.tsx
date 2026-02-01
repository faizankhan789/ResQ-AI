import React from 'react';
import { Icons } from '../Shared/Icons';
import { AppState } from '../../types';

interface HeaderProps {
  state: AppState;
  onProfileClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({ state, onProfileClick }) => {
  return (
    <header className="sticky top-0 z-50 w-full bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex justify-between items-center transition-colors duration-300">
      <div className="flex items-center space-x-3">
        {/* AI Status Indicator */}
        <div className={`flex items-center justify-center h-8 w-8 rounded-full ${
          state.aiStatus === 'ready' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' :
          state.aiStatus === 'thinking' ? 'bg-amber-100 text-amber-600 animate-pulse' :
          'bg-slate-200 text-slate-500'
        }`}>
          <Icons.AI size={18} />
        </div>
        
        <div className="flex flex-col">
          <span className="text-xs font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
            ResQ-AI
          </span>
          <div className="flex items-center space-x-1">
             <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></div>
             <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
               System Active
             </span>
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {/* Connectivity Status */}
        <div className="hidden sm:flex items-center space-x-1 text-xs font-medium text-slate-500 dark:text-slate-400">
          {state.connectivity === 'online' ? (
            <>
              <Icons.Wifi size={14} />
              <span>Online</span>
            </>
          ) : (
            <>
              <Icons.WifiOff size={14} />
              <span>Offline</span>
            </>
          )}
        </div>

        {/* Profile Button */}
        <button 
          onClick={onProfileClick}
          className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-200"
          aria-label="Profile"
        >
          <Icons.Profile size={20} />
        </button>
      </div>
    </header>
  );
};
