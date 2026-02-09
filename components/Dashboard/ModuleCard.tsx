import React from 'react';
import { ModuleCardProps } from '../../types';
import { Icons } from '../Shared/Icons';

export const ModuleCard: React.FC<ModuleCardProps> = ({ 
  id, 
  label, 
  subtitle, 
  icon: Icon, 
  colorClass, 
  onClick 
}) => {
  return (
    <button
      onClick={() => onClick(id)}
      className="relative w-full text-left group overflow-hidden rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all duration-300 p-6 flex flex-col justify-between min-h-[160px]"
    >
      <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity duration-300 ${colorClass}`}>
        <Icon size={80} />
      </div>

      <div className={`p-3 rounded-xl w-fit mb-4 ${colorClass} bg-opacity-10 dark:bg-opacity-20`}>
        <Icon size={24} className={colorClass.replace('text-', 'text-current ')} />
      </div>

      <div className="z-10">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {label}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
          {subtitle}
        </p>
      </div>

      <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transform translate-x-4 group-hover:translate-x-0 transition-all duration-300 text-slate-400">
        <Icons.Send size={20} />
      </div>
    </button>
  );
};
