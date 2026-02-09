import React, { useState, useEffect, useRef } from 'react';
import { Icons } from '../Shared/Icons';
import { EmergencyContact } from '../../types';
import { useMedicalReport } from '../Context/MedicalReportContext';

interface EmergencyBridgeProps {
  onBack: () => void;
}

type CallStatus = 'IDLE' | 'DIALING' | 'CONNECTED' | 'ENDED';

export const EmergencyBridge: React.FC<EmergencyBridgeProps> = ({ onBack }) => {
  const { currentReport, generateLiveReport, isGeneratingReport } = useMedicalReport();

  // --- STATE ---
  const [callStatus, setCallStatus] = useState<CallStatus>('IDLE');
  const [callDuration, setCallDuration] = useState(0);
  const [location, setLocation] = useState<{lat: number, lng: number, address: string} | null>(null);
  const [contacts, setContacts] = useState<EmergencyContact[]>([
    { id: '1', name: 'Jane Doe', relation: 'Spouse', phone: '555-0123', notified: false },
    { id: '2', name: 'Mom', relation: 'Parent', phone: '555-0987', notified: false }
  ]);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [autoCallTimer, setAutoCallTimer] = useState<number | null>(null);

  const mapRef = useRef<HTMLDivElement>(null);

  // --- EFFECTS ---

  // 1. Get Location on Mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          // Mock address lookup
          setLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            address: "1234 Emergency Ln, Tech City, CA" 
          });
        },
        (err) => console.error(err),
        { enableHighAccuracy: true }
      );
    }
  }, []);

  // 2. Ensure Report is Fresh
  useEffect(() => {
    generateLiveReport();
  }, []);

  // 3. Call Timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (callStatus === 'CONNECTED') {
      interval = setInterval(() => setCallDuration(d => d + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [callStatus]);

  // --- ACTIONS ---

  const handleCall911 = () => {
    setCallStatus('DIALING');
    setTimeout(() => {
      setCallStatus('CONNECTED');
      notifyContacts();
    }, 2000);
  };

  const handleEndCall = () => {
    setCallStatus('ENDED');
    setIsAISpeaking(false);
    window.speechSynthesis.cancel();
  };

  const notifyContacts = () => {
    // Simulate API call to SMS service
    setContacts(prev => prev.map(c => ({ ...c, notified: true })));
  };

  const toggleAISpeak = () => {
    if (isAISpeaking) {
      window.speechSynthesis.cancel();
      setIsAISpeaking(false);
    } else if (currentReport) {
      setIsAISpeaking(true);
      const u = new SpeechSynthesisUtterance(
        `Emergency Handoff. ${currentReport.summary}. 
         Patient is located at ${location?.address || 'coordinates provided'}. 
         Vitals: ${currentReport.vitalsEstimate.consciousness}, ${currentReport.vitalsEstimate.breathing}.`
      );
      u.onend = () => setIsAISpeaking(false);
      window.speechSynthesis.speak(u);
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // --- RENDER ---

  if (callStatus === 'CONNECTED' || callStatus === 'DIALING') {
    return (
      <div className="absolute inset-0 bg-black z-50 flex flex-col text-white animate-fade-in">
        {/* Cockpit Header */}
        <div className="bg-red-900/50 p-4 flex justify-between items-center backdrop-blur-md border-b border-red-500/30">
          <div className="flex items-center space-x-3">
            <button onClick={onBack} className="p-2 rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors">
              <Icons.Back size={20} />
            </button>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <span className="font-mono font-bold tracking-widest text-red-100">
                {callStatus === 'DIALING' ? 'CONNECTING TO EMS...' : 'LIVE WITH 911'}
              </span>
            </div>
          </div>
          <div className="font-mono text-xl font-black">
            {formatTime(callDuration)}
          </div>
        </div>

        {/* Main Cockpit Content */}
        <div className="flex-1 flex flex-col p-6 space-y-6 overflow-hidden relative">
           
           {/* Background Map Effect */}
           <div className="absolute inset-0 opacity-20 z-0">
             <div className="w-full h-full bg-[radial-gradient(#ffffff33_1px,transparent_1px)] [background-size:16px_16px]"></div>
           </div>

           {/* Location Card */}
           <div className="z-10 bg-slate-900/80 border border-slate-700 p-4 rounded-2xl flex items-center space-x-4 shadow-lg">
             <div className="bg-blue-600 p-3 rounded-full animate-pulse">
               <Icons.Navigation size={24} className="text-white" />
             </div>
             <div>
               <h3 className="text-xs text-slate-400 uppercase font-bold tracking-wider">Emergency Location</h3>
               <p className="text-lg font-bold leading-tight">{location?.address || "Acquiring Satellite Lock..."}</p>
               <p className="text-xs font-mono text-slate-500 mt-1">
                 {location ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}` : "GPS ACTIVE"}
               </p>
             </div>
           </div>

           {/* Triage Handoff Card */}
           <div className="z-10 flex-1 bg-white/10 backdrop-blur-md border border-white/10 rounded-3xl p-6 flex flex-col justify-center items-center text-center shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent"></div>
              
              <Icons.Report size={48} className="text-red-400 mb-4" />
              <h2 className="text-red-100 font-bold text-sm uppercase tracking-widest mb-2">Digital Paramedic Handoff</h2>
              
              {isGeneratingReport ? (
                <div className="flex flex-col items-center justify-center space-y-2 py-6">
                   <div className="w-8 h-8 border-4 border-red-400 border-t-transparent rounded-full animate-spin"></div>
                   <span className="text-red-200 text-sm animate-pulse">Updating live report...</span>
                </div>
              ) : (
                <>
                  <div className="bg-black/40 p-6 rounded-xl w-full mb-6 border border-white/5">
                    <p className="text-xl md:text-2xl font-medium leading-relaxed text-white">
                      "{currentReport?.summary || "No active medical timeline yet."}"
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-4 w-full">
                    <div className="bg-slate-800/50 p-2 rounded-lg">
                       <div className="text-xs text-slate-400">Condition</div>
                       <div className="font-bold text-red-400">{currentReport?.condition || "--"}</div>
                    </div>
                    <div className="bg-slate-800/50 p-2 rounded-lg">
                       <div className="text-xs text-slate-400">Actions</div>
                       <div className="font-bold text-white">{currentReport?.actionsTaken.length || 0}</div>
                    </div>
                    <div className="bg-slate-800/50 p-2 rounded-lg">
                       <div className="text-xs text-slate-400">Severity</div>
                       <div className="font-bold text-white">{currentReport?.severity || "LOW"}</div>
                    </div>
                  </div>
                </>
              )}
           </div>
        </div>

        {/* Cockpit Controls */}
        <div className="bg-slate-900 border-t border-slate-800 p-6 z-20">
          <div className="flex items-center justify-between space-x-4">
             <button 
               onClick={toggleAISpeak}
               className={`flex-1 py-4 rounded-xl font-bold flex flex-col items-center justify-center transition-all ${
                 isAISpeaking 
                   ? 'bg-amber-500 text-black animate-pulse' 
                   : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
               }`}
             >
               <Icons.Radio size={24} className="mb-1" />
               <span>{isAISpeaking ? 'AI SPEAKING...' : 'AI SPEAK FOR ME'}</span>
             </button>

             <button 
               onClick={handleEndCall}
               className="w-24 h-24 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center shadow-lg shadow-red-900/50 border-4 border-slate-900"
             >
               <Icons.PhoneCall size={32} className="text-white fill-current" />
             </button>

             <button className="flex-1 py-4 bg-slate-800 text-slate-300 rounded-xl font-bold flex flex-col items-center justify-center hover:bg-slate-700">
               <Icons.Share size={24} className="mb-1" />
               <span>SEND LOC</span>
             </button>
          </div>
        </div>
      </div>
    );
  }

  // --- PRE-CALL INTERFACE ---

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 animate-slide-up relative">
      
      {/* Top Bar */}
      <div className="px-6 pt-6 pb-2 flex justify-between items-start z-10">
        <button onClick={onBack} className="p-2 bg-slate-200 dark:bg-slate-800 rounded-full text-slate-600 dark:text-slate-300">
           <Icons.Close size={24} />
        </button>
        <div className="flex flex-col items-end">
           <div className="flex items-center space-x-1 text-red-600 dark:text-red-500 font-bold text-xs uppercase tracking-widest animate-pulse">
             <div className="w-2 h-2 rounded-full bg-red-500"></div>
             <span>Emergency Bridge Active</span>
           </div>
           <p className="text-xs text-slate-400 mt-1">Ready for Escalation</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-24">
         
         {/* Main Status */}
         <div className="mt-4 mb-8 text-center">
            <h1 className="text-3xl font-black text-slate-900 dark:text-white leading-tight">
              Instant Emergency Response
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2">
              System is ready to bridge AI triage to real-world responders.
            </p>
         </div>

         {/* Call Button */}
         <div className="relative group mb-8">
            <div className="absolute inset-0 bg-red-500 blur-xl opacity-20 group-hover:opacity-40 transition-opacity rounded-full"></div>
            <button 
               onClick={handleCall911}
               className="relative w-full py-6 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white rounded-2xl shadow-xl transform transition-all active:scale-[0.98] flex items-center justify-center space-x-4 border-t border-white/20"
            >
               <div className="bg-white/20 p-3 rounded-full">
                  <Icons.PhoneCall size={32} className="animate-pulse" />
               </div>
               <div className="text-left">
                  <span className="block text-sm font-medium text-red-100 uppercase tracking-wider">Slide or Tap</span>
                  <span className="block text-3xl font-black tracking-tight">CALL 911 NOW</span>
               </div>
            </button>
            <p className="text-center text-xs text-slate-400 mt-3">
              This will share your location and AI Triage report immediately.
            </p>
         </div>

         {/* Triage Preview */}
         <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm mb-6">
            <div className="flex items-center justify-between mb-4">
               <h3 className="font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                 <Icons.Report size={18} className="text-blue-500" />
                 <span>AI Handoff Report</span>
               </h3>
               {isGeneratingReport ? (
                 <div className="flex items-center space-x-2">
                   <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                   <span className="text-xs text-slate-400">Updating...</span>
                 </div>
               ) : (
                 <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded font-bold">
                   READY
                 </span>
               )}
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
               <p className="text-sm text-slate-600 dark:text-slate-300 font-mono leading-relaxed">
                  {currentReport?.summary || "Report pending. Start Interactive Mode to generate timeline data."}
               </p>
            </div>
         </div>

         {/* Contacts */}
         <div className="space-y-3">
            <h3 className="font-bold text-sm text-slate-500 dark:text-slate-400 uppercase tracking-wider">Trusted Contacts</h3>
            {contacts.map(contact => (
              <div key={contact.id} className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                 <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                       <Icons.Profile size={20} />
                    </div>
                    <div>
                       <div className="font-bold text-slate-900 dark:text-white">{contact.name}</div>
                       <div className="text-xs text-slate-500">{contact.relation} • {contact.phone}</div>
                    </div>
                 </div>
                 <div className={`text-xs font-bold px-2 py-1 rounded ${
                   contact.notified 
                     ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                     : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                 }`}>
                   {contact.notified ? 'NOTIFIED' : 'PENDING'}
                 </div>
              </div>
            ))}
         </div>

      </div>

      {/* Safety Auto-Call Bar (Visual Mock) */}
      <div className="absolute bottom-0 left-0 w-full bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4">
         <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Safety Monitor Active</span>
            <span>Microphone Hot</span>
         </div>
         <div className="h-1 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 w-[5%] animate-pulse"></div>
         </div>
      </div>

    </div>
  );
};