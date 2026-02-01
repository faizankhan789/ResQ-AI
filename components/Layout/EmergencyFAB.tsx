import React from 'react';
import { Icons } from '../Shared/Icons';

interface EmergencyFABProps {
  onPress: () => void;
}

export const EmergencyFAB: React.FC<EmergencyFABProps> = ({ onPress }) => {
  return (
    <div className="fixed bottom-6 right-6 z-50">
      <button
        onClick={onPress}
        className="group relative flex items-center justify-center w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/30 transition-all duration-300 transform hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-red-500/50"
        aria-label="Emergency SOS"
      >
        <span className="absolute inset-0 rounded-full bg-red-600 animate-ping opacity-20 duration-1000"></span>
        <Icons.Emergency size={32} strokeWidth={2} />
      </button>
    </div>
  );
};
