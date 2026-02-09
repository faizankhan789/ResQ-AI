import React, { useState, useEffect } from 'react';
import { Header } from './components/Layout/Header';
import { EmergencyFAB } from './components/Layout/EmergencyFAB';
import { HomeView } from './components/Dashboard/HomeView';
import { InteractiveMode } from './components/Modules/InteractiveMode';
import { LearningMode } from './components/Modules/LearningMode';
import { EmergencyBridge } from './components/Modules/EmergencyBridge';
import { MedicalReportView } from './components/Modules/MedicalReportView';
import { MedicalReportProvider } from './components/Context/MedicalReportContext';
import { LearningProfileProvider } from './components/Context/LearningProfileContext';
import { View, AppState } from './types';

const App: React.FC = () => {
  // Application State
  const [appState, setAppState] = useState<AppState>({
    currentView: 'HOME',
    isEmergencyActive: false,
    isCriticalMode: false,
    aiStatus: 'ready',
    connectivity: 'online',
    location: null,
  });

  // Handle browser connectivity
  useEffect(() => {
    const handleOnline = () => setAppState(prev => ({ ...prev, connectivity: 'online' }));
    const handleOffline = () => setAppState(prev => ({ ...prev, connectivity: 'offline' }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const navigateTo = (view: View) => {
    setAppState(prev => ({ ...prev, currentView: view }));
  };

  const handleEmergencyTrigger = () => {
    // Triggers direct bridge access for instant 911
    setAppState(prev => ({ 
      ...prev, 
      currentView: 'BRIDGE', 
      isEmergencyActive: true 
    }));
  };
  
  const setCriticalMode = (isCritical: boolean) => {
    setAppState(prev => ({ ...prev, isCriticalMode: isCritical }));
  };

  const renderContent = () => {
    switch (appState.currentView) {
      case 'HOME':
        return <HomeView onNavigate={navigateTo} />;
      case 'INTERACTIVE':
        return (
          <InteractiveMode 
            onBack={() => navigateTo('HOME')} 
            isCritical={appState.isCriticalMode}
            setCritical={setCriticalMode}
            onEmergency={handleEmergencyTrigger}
          />
        );
      case 'LEARNING':
        return (
          <LearningMode onBack={() => navigateTo('HOME')} />
        );
      case 'BRIDGE':
         return (
          <EmergencyBridge onBack={() => navigateTo('HOME')} />
        );
      case 'REPORT':
        return (
          <MedicalReportView onBack={() => navigateTo('HOME')} />
        );
      case 'ANALYSIS':
        return (
          <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6 animate-fade-in">
             <div className="bg-purple-100 dark:bg-purple-900/30 p-4 rounded-full mb-4 text-purple-600 dark:text-purple-400">
               <span className="text-4xl font-bold">🩺</span>
             </div>
             <h2 className="text-xl font-bold text-slate-900 dark:text-white">Analysis Mode</h2>
             <p className="text-slate-500 dark:text-slate-400 mt-2">AI Health Scan module loading...</p>
             <button onClick={() => navigateTo('HOME')} className="mt-6 text-blue-600 hover:underline">Return Home</button>
             <button onClick={() => navigateTo('REPORT')} className="mt-4 px-4 py-2 bg-slate-200 dark:bg-slate-800 rounded-lg text-sm font-bold">View Incident Reports</button>
          </div>
        );
      default:
        return <HomeView onNavigate={navigateTo} />;
    }
  };

  // Determine if we need bottom padding for the FAB
  // We remove it for INTERACTIVE (full screen), BRIDGE (full screen), and LEARNING (has its own layout)
  const shouldAddBottomPadding = appState.currentView !== 'INTERACTIVE' && appState.currentView !== 'BRIDGE' && appState.currentView !== 'LEARNING';

  return (
    <MedicalReportProvider>
      <LearningProfileProvider>
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-300 flex flex-col h-screen overflow-hidden">
          
          {/* Conditionally Render Header - Hide in Bridge/Critical/Interactive Mode to reduce distraction */}
          {appState.currentView !== 'BRIDGE' && appState.currentView !== 'INTERACTIVE' && !appState.isCriticalMode && (
            <Header
              state={appState}
              onProfileClick={() => navigateTo('REPORT')}
            />
          )}
          
          <main className={`relative z-0 flex-1 flex flex-col overflow-hidden ${shouldAddBottomPadding ? 'pb-24' : ''}`}>
            {renderContent()}
          </main>

          {/* Conditionally Render Global FAB - Hide in Critical/Bridge Mode AND Interactive Mode */}
          {appState.currentView !== 'BRIDGE' && appState.currentView !== 'INTERACTIVE' && !appState.isCriticalMode && (
            <EmergencyFAB onPress={handleEmergencyTrigger} />
          )}
        </div>
      </LearningProfileProvider>
    </MedicalReportProvider>
  );
};

export default App;