import React, { useState, useRef, useEffect } from 'react';
import { Icons } from '../Shared/Icons';
import { ChatMessage } from '../../types';
import { GoogleGenAI, Chat } from "@google/genai";
import { useMedicalReport } from '../Context/MedicalReportContext';
import { Upload, Camera, Video as VideoIcon, Image as ImageIcon, Film, Scan, StopCircle } from 'lucide-react';
import { MarkdownText } from '../Shared/MarkdownText';

interface InteractiveModeProps {
  onBack: () => void;
  isCritical: boolean;
  setCritical: (critical: boolean) => void;
  onEmergency: () => void;
}

// --- CONFIGURATION ---
// Toggle: true = Use Medical Book Cache, false = Use General LLM
const USE_MEDICAL_BOOK = false; // Disabled - cache expired

// Context Cache Name (created via create_cache.js) - Caches the 5MB file for 24hrs
const CACHE_NAME = "cachedContents/48038ptzqepvdmzc5oox73s04ptqbrayiebl7rsd"; 

// --- RAG KNOWLEDGE BASE (Local Keywords for UI Feedback only) ---
const MEDICAL_KNOWLEDGE_BASE = [
  { id: 'cpr', title: 'CPR Protocol', keywords: ['cpr', 'heart', 'cardiac', 'arrest', 'compressions'] },
  { id: 'bleeding', title: 'Hemorrhage Control', keywords: ['bleeding', 'blood', 'cut', 'wound', 'hemorrhage'] },
  { id: 'choking', title: 'Airway Obstruction', keywords: ['choking', 'choke', 'cough', 'breathe', 'heimlich'] },
  { id: 'burns', title: 'Burn Management', keywords: ['burn', 'fire', 'scald', 'skin'] }
];

// Helper for speech recognition type
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

export const InteractiveMode: React.FC<InteractiveModeProps> = ({ onBack, isCritical, setCritical, onEmergency }) => {
  const { logEvent } = useMedicalReport();
  
  const [inputValue, setInputValue] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false); // Default off
  const [isThinking, setIsThinking] = useState(false);
  
  // RAG UI State
  const [retrievingData, setRetrievingData] = useState(false);
  const [retrievedDoc, setRetrievedDoc] = useState<string | null>(null);
  
  // Menus
  const [activeMenu, setActiveMenu] = useState<'camera' | 'video' | null>(null);

  // RAG / Protocol State
  const [uploadedPdf, setUploadedPdf] = useState<{name: string, data: string} | null>(null);
  
  // Media State
  const [uploadedVideo, setUploadedVideo] = useState<{name: string, data: string, mimeType: string, url: string} | null>(null);
  const [uploadedImage, setUploadedImage] = useState<{name: string, data: string, mimeType: string, url: string} | null>(null);

  const pdfSentRef = useRef(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  
  // Media Input Refs
  const imageUploadRef = useRef<HTMLInputElement>(null); // For uploading image from gallery
  const videoUploadRef = useRef<HTMLInputElement>(null); // For uploading video from gallery
  const videoCaptureRef = useRef<HTMLInputElement>(null); // For recording video natively

  // Protocol States
  const [activeProtocol, setActiveProtocol] = useState<'CPR' | 'BLEEDING' | 'CHOKING' | 'UNCONSCIOUS' | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);
  
  const recognitionRef = useRef<any>(null);
  const chatSessionRef = useRef<Chat | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatInitializedRef = useRef(false);

  // Voice Interaction Refs
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptBuffer = useRef('');
  const isThinkingRef = useRef(false);

  // Live Analysis Mode States
  const [isLiveAnalysisActive, setIsLiveAnalysisActive] = useState(false);
  const [liveGuidance, setLiveGuidance] = useState<string | null>(null);
  const [isAnalysisPending, setIsAnalysisPending] = useState(false);
  const [analysisCount, setAnalysisCount] = useState(0);

  // Live Analysis Refs
  const liveAnalysisIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analysisQueueRef = useRef<boolean>(false); // Mutex to prevent overlapping API calls
  const liveAnalysisIntervalMs = useRef<number>(4000); // Default 4 seconds, short responses
  const liveAnalysisHistoryRef = useRef<Array<{role: string, parts: any[]}>>([]);  // Conversation history for continuity
  const pendingUserQuestionRef = useRef<string | null>(null);  // User question to include in next analysis
  const waitingForUserRef = useRef<boolean>(false);  // True = AI gave instruction, waiting for user response
  const lastAnalysisTimeRef = useRef<number>(0);  // Track when last analysis happened
  const isLiveAnalysisActiveRef = useRef<boolean>(false);  // Ref mirror for closure access

  // Video Recording States
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);

  // Video Playback Live Analysis States
  const [isVideoLiveAnalysisActive, setIsVideoLiveAnalysisActive] = useState(false);
  const [videoLiveGuidance, setVideoLiveGuidance] = useState<string | null>(null);
  const [isVideoAnalysisPending, setIsVideoAnalysisPending] = useState(false);
  const [videoAnalysisCount, setVideoAnalysisCount] = useState(0);
  const [videoPlaybackTime, setVideoPlaybackTime] = useState(0);
  const playbackVideoRef = useRef<HTMLVideoElement>(null);
  const videoLiveAnalysisIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoAnalysisQueueRef = useRef<boolean>(false);
  const videoLiveAnalysisHistoryRef = useRef<Array<{role: string, parts: any[]}>>([]);
  const isVideoLiveAnalysisActiveRef = useRef<boolean>(false);

  // Image Live Analysis States
  const [isImageLiveAnalysisActive, setIsImageLiveAnalysisActive] = useState(false);
  const [imageLiveGuidance, setImageLiveGuidance] = useState<string | null>(null);
  const [isImageAnalysisPending, setIsImageAnalysisPending] = useState(false);
  const [imageAnalysisCount, setImageAnalysisCount] = useState(0);
  const imageLiveAnalysisIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const imageAnalysisQueueRef = useRef<boolean>(false);
  const imageLiveAnalysisHistoryRef = useRef<Array<{role: string, parts: any[]}>>([]);
  const isImageLiveAnalysisActiveRef = useRef<boolean>(false);
  const pendingImageQuestionRef = useRef<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    { 
      id: '1', 
      role: 'assistant', 
      content: 'I am initializing the Emergency System...', 
      timestamp: new Date(),
      type: 'text'
    }
  ]);

  // Lifecycle Management (Mount/Unmount)
  useEffect(() => {
    isMountedRef.current = true;

    // Cancel any ongoing speech from previous session/reload
    window.speechSynthesis.cancel();

    // Handle page reload/close - cancel speech before unload
    const handleBeforeUnload = () => {
      window.speechSynthesis.cancel();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);

    logEvent('SYSTEM_ALERT', 'Interactive Mode Session Started');

    // Cleanup function: runs when component unmounts (closes)
    return () => {
      isMountedRef.current = false;
      window.speechSynthesis.cancel(); // Stop speaking immediately
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
      if (recognitionRef.current) {
         try { recognitionRef.current.stop(); } catch(e) {}
      }
      if (timerRef.current) clearTimeout(timerRef.current);
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      // Cleanup live analysis interval
      if (liveAnalysisIntervalRef.current) {
        clearInterval(liveAnalysisIntervalRef.current);
        liveAnalysisIntervalRef.current = null;
      }
      // Cleanup video live analysis interval
      if (videoLiveAnalysisIntervalRef.current) {
        clearInterval(videoLiveAnalysisIntervalRef.current);
        videoLiveAnalysisIntervalRef.current = null;
      }
      // Cleanup image live analysis interval
      if (imageLiveAnalysisIntervalRef.current) {
        clearInterval(imageLiveAnalysisIntervalRef.current);
        imageLiveAnalysisIntervalRef.current = null;
      }
      // Cleanup video recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (recordingStreamRef.current) {
        recordingStreamRef.current.getTracks().forEach(track => track.stop());
      }
      // Cleanup object URLs
      if (uploadedVideo?.url) URL.revokeObjectURL(uploadedVideo.url);
      if (uploadedImage?.url) URL.revokeObjectURL(uploadedImage.url);
    };
  }, []);

  // Close menus on click outside (simplified)
  useEffect(() => {
    const handleClick = () => setActiveMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  // Monitor Critical State
  useEffect(() => {
    if (isCritical) {
      logEvent('SYSTEM_ALERT', 'CRITICAL MODE ACTIVATED');
      if (!isMicActive) setIsMicActive(true); // Auto-enable mic in critical mode
    }
  }, [isCritical]);

  // --- AUTO-ANALYZE MEDIA EFFECT ---
  // Triggers sending message immediately when video or image is set
  useEffect(() => {
    if ((uploadedVideo || uploadedImage) && !isThinking && !isThinkingRef.current) {
        // Small delay to allow state to settle and UI to show preview momentarily
        const timer = setTimeout(() => {
            handleSendMessage(); 
        }, 500);
        return () => clearTimeout(timer);
    }
  }, [uploadedVideo, uploadedImage]);


  // --- TTS Helper ---
  const speak = (text: string) => {
    console.log("[DEBUG] Speak called with:", text.substring(0, 50) + "...");

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();

      // Chrome bug workaround: need to wait for voices to load
      const speakNow = () => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.1;
        utterance.pitch = 1.0;
        utterance.lang = 'en-US';

        // Try to get a voice (Chrome bug workaround)
        const voices = window.speechSynthesis.getVoices();
        console.log("[DEBUG] Available voices:", voices.length);
        if (voices.length > 0) {
          // Prefer English voice
          const englishVoice = voices.find(v => v.lang.startsWith('en')) || voices[0];
          utterance.voice = englishVoice;
          console.log("[DEBUG] Using voice:", englishVoice?.name);
        }

        window.speechSynthesis.speak(utterance);
        console.log("[DEBUG] Speech queued, pending:", window.speechSynthesis.pending, "speaking:", window.speechSynthesis.speaking);
      };

      // Wait for voices to load if not already
      if (window.speechSynthesis.getVoices().length === 0) {
        console.log("[DEBUG] Waiting for voices to load...");
        window.speechSynthesis.onvoiceschanged = () => {
          console.log("[DEBUG] Voices loaded");
          speakNow();
        };
        // Fallback timeout
        setTimeout(speakNow, 200);
      } else {
        setTimeout(speakNow, 100);
      }
    } else {
      console.log("[DEBUG] speechSynthesis not available");
    }
  };

  // --- Live Analysis Functions ---
  const performLiveAnalysis = async () => {
    // Check mutex to prevent overlapping API calls
    if (analysisQueueRef.current || !isMountedRef.current) {
      console.log("[DEBUG] Live Analysis skipped - mutex locked or not ready");
      return;
    }

    // Check if camera stream is still active
    if (!streamRef.current || !videoRef.current) {
      console.log("[DEBUG] Live Analysis: Camera stream not available");
      stopLiveAnalysis();
      speak("Camera disconnected. Live analysis stopped.");
      return;
    }

    try {
      analysisQueueRef.current = true;
      setIsAnalysisPending(true);

      // Capture frame via existing function
      const imageBase64 = captureImageFrame();
      if (!imageBase64) {
        console.log("[DEBUG] Live Analysis: Failed to capture frame");
        analysisQueueRef.current = false;
        setIsAnalysisPending(false);
        return;
      }

      console.log("[DEBUG] Live Analysis: Frame captured, sending to AI...");

      // Create a fresh API instance for live analysis (bypass cache issues)
      const apiKey = process.env.API_KEY;
      if (!apiKey) {
        throw new Error("API key not available");
      }

      const ai = new GoogleGenAI({ apiKey });

      // Build the current frame message
      const isFirstAnalysis = liveAnalysisHistoryRef.current.length === 0;
      const userQuestion = pendingUserQuestionRef.current;
      pendingUserQuestionRef.current = null; // Clear after using

      let currentPrompt: string;

      if (isFirstAnalysis) {
        currentPrompt = `You're a doctor on a live video call. Look and give ONE quick instruction.
${userQuestion ? `Patient asks: "${userQuestion}"` : ''}
MAXIMUM 12 WORDS. Be direct. Example: "I see a cut. Apply pressure now."
If critical (heavy bleeding, unconscious), start with ||CRITICAL_STATE||`;
      } else if (userQuestion) {
        currentPrompt = `Patient says: "${userQuestion}"
Respond briefly. Give next instruction. MAXIMUM 12 WORDS.`;
      } else {
        // Continuous monitoring - brief status updates
        currentPrompt = `CONTINUOUS MONITORING. Compare to last frame.
If SAME/NO CHANGE: Say "||STABLE||" only.
If PROGRESS/IMPROVEMENT: Brief positive note (8 words max). Example: "Good, keep going."
If NEW ISSUE or WORSENING: Alert + instruction (12 words max). Example: "More bleeding visible. Press harder."
If CRITICAL: Start with ||CRITICAL_STATE||`;
      }

      const currentParts = [
        { text: currentPrompt },
        { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }
      ];

      // Build contents array with history for context (keep last 4 exchanges max to avoid token limits)
      const historyToSend = liveAnalysisHistoryRef.current.slice(-8); // Last 4 exchanges (user+assistant pairs)
      const contents = [
        // System context - act like a real doctor, BRIEF responses
        {
          role: 'user',
          parts: [{ text: `You are Dr. ResQ doing a LIVE video call. CRITICAL RULES:
1. MAXIMUM 15 WORDS per response - this is spoken aloud
2. One instruction at a time - short and clear
3. Watch and correct if wrong
4. Quick encouragement when doing well
5. Remember what you said before
Example responses: "Good. Keep that pressure." / "Move it left a bit." / "Looking better, keep going."` }]
        },
        {
          role: 'model',
          parts: [{ text: "Got it. Short and clear. Let's help them." }]
        },
        ...historyToSend,
        { role: 'user', parts: currentParts }
      ];

      // Send with 15-second timeout using direct generateContent call
      const responsePromise = ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: contents
      });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Live analysis timeout")), 15000)
      );

      const response = await Promise.race([responsePromise, timeoutPromise]) as any;
      const responseText = response.text || "";

      console.log("[DEBUG] Live Analysis Response:", responseText);

      // Check if this was just a stable background check - don't speak
      if (responseText.includes("||STABLE||")) {
        console.log("[DEBUG] Background check: Stable - no speech needed");
        lastAnalysisTimeRef.current = Date.now();
        return; // Don't speak, don't update UI, just continue monitoring
      }

      // Add this exchange to history for continuity (only for real responses)
      liveAnalysisHistoryRef.current.push(
        { role: 'user', parts: currentParts },
        { role: 'model', parts: [{ text: responseText }] }
      );

      // Keep history manageable (max 10 exchanges = 20 messages)
      if (liveAnalysisHistoryRef.current.length > 20) {
        liveAnalysisHistoryRef.current = liveAnalysisHistoryRef.current.slice(-16);
      }

      if (isMountedRef.current) {
        // Check if stable (no change) - skip speaking
        const isStable = responseText.includes("||STABLE||");

        if (isStable) {
          // No change detected - just increment counter, don't speak
          setAnalysisCount(prev => prev + 1);
          lastAnalysisTimeRef.current = Date.now();
          return;
        }

        // Update guidance overlay
        const cleanText = responseText
          .replace("||CRITICAL_STATE||", "")
          .replace('CRITICAL_ALERT', '')
          .replace(/\|\|.*?\|\|/g, '')
          .trim();

        setLiveGuidance(cleanText);
        setAnalysisCount(prev => prev + 1);

        // Speak the guidance - cancel previous and speak new
        const speakText = cleanText.replace(/\*\*/g, '').replace(/\*/g, '');
        window.speechSynthesis.cancel();
        speak(speakText);

        // Check for critical response
        const isCriticalResponse = responseText.includes("||CRITICAL_STATE||") || responseText.includes("CRITICAL_ALERT");

        if (isCriticalResponse) {
          setCritical(true);
          if (!isMicActive) setIsMicActive(true);
        }

        lastAnalysisTimeRef.current = Date.now();
      }

    } catch (error: any) {
      console.error("[DEBUG] Live Analysis Error:", error);

      if (isMountedRef.current) {
        // Handle rate limiting - increase interval
        if (error.message?.includes("429")) {
          liveAnalysisIntervalMs.current = Math.min(liveAnalysisIntervalMs.current + 2000, 10000);
          setLiveGuidance("Rate limited. Slowing down analysis...");
          speak("Rate limited. Reducing analysis frequency.");

          // Restart interval with new timing
          if (liveAnalysisIntervalRef.current) {
            clearInterval(liveAnalysisIntervalRef.current);
            liveAnalysisIntervalRef.current = setInterval(performLiveAnalysis, liveAnalysisIntervalMs.current);
          }
        } else if (error.message === "Live analysis timeout") {
          // Skip this frame, continue to next
          console.log("[DEBUG] Live Analysis: Timeout - skipping frame");
        } else {
          setLiveGuidance("Analysis error. Will retry...");
        }
      }
    } finally {
      analysisQueueRef.current = false;
      if (isMountedRef.current) setIsAnalysisPending(false);
    }
  };

  const startLiveAnalysis = () => {
    if (isLiveAnalysisActive) return;

    console.log("[DEBUG] Starting Live Analysis Mode");
    setIsLiveAnalysisActive(true);
    isLiveAnalysisActiveRef.current = true;  // Update ref for closure access
    setLiveGuidance(null);
    setAnalysisCount(0);
    liveAnalysisIntervalMs.current = 4000;
    analysisQueueRef.current = false;
    liveAnalysisHistoryRef.current = []; // Reset conversation history for fresh session

    // Wait for camera stream to be ready before starting analysis
    const waitForCamera = () => {
      if (streamRef.current && videoRef.current) {
        console.log("[DEBUG] Camera ready, starting continuous analysis mode");

        // Enable microphone for two-way conversation
        if (!isMicActive) {
          setIsMicActive(true);
        }

        // Perform first analysis immediately
        waitingForUserRef.current = false;
        performLiveAnalysis();

        // Set up CONTINUOUS interval (3 seconds) - always analyzing
        liveAnalysisIntervalRef.current = setInterval(() => {
          performLiveAnalysis(); // Always full analysis
        }, 3000);

        logEvent('SYSTEM_ALERT', 'Live Analysis Mode Activated');
        speak("I'm here. Show me what's wrong.");
      } else {
        console.log("[DEBUG] Waiting for camera...");
        setTimeout(waitForCamera, 500);
      }
    };

    waitForCamera();
  };

  const stopLiveAnalysis = () => {
    console.log("[DEBUG] Stopping Live Analysis Mode");

    if (liveAnalysisIntervalRef.current) {
      clearInterval(liveAnalysisIntervalRef.current);
      liveAnalysisIntervalRef.current = null;
    }

    setIsLiveAnalysisActive(false);
    isLiveAnalysisActiveRef.current = false;  // Update ref for closure access
    setLiveGuidance(null);
    setIsAnalysisPending(false);
    analysisQueueRef.current = false;
    liveAnalysisIntervalMs.current = 4000;
    liveAnalysisHistoryRef.current = []; // Clear conversation history
    waitingForUserRef.current = false;
    pendingUserQuestionRef.current = null;

    logEvent('SYSTEM_ALERT', 'Live Analysis Mode Stopped');
  };

  // --- Video Playback Live Analysis Functions ---
  const captureVideoFrame = (): string | null => {
    if (playbackVideoRef.current) {
      const video = playbackVideoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0);
      return canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
    }
    return null;
  };

  const performVideoLiveAnalysis = async () => {
    if (videoAnalysisQueueRef.current || !isMountedRef.current) {
      console.log("[DEBUG] Video Live Analysis skipped - mutex locked");
      return;
    }

    if (!playbackVideoRef.current || playbackVideoRef.current.paused) {
      console.log("[DEBUG] Video Live Analysis: Video not playing");
      return;
    }

    try {
      videoAnalysisQueueRef.current = true;
      setIsVideoAnalysisPending(true);

      const imageBase64 = captureVideoFrame();
      if (!imageBase64) {
        console.log("[DEBUG] Video Live Analysis: Failed to capture frame");
        videoAnalysisQueueRef.current = false;
        setIsVideoAnalysisPending(false);
        return;
      }

      const currentTime = playbackVideoRef.current?.currentTime || 0;
      setVideoPlaybackTime(currentTime);

      console.log("[DEBUG] Video Live Analysis: Frame captured at", currentTime.toFixed(1), "s");

      const apiKey = process.env.API_KEY;
      if (!apiKey) throw new Error("API key not available");

      const ai = new GoogleGenAI({ apiKey });

      const isFirstAnalysis = videoLiveAnalysisHistoryRef.current.length === 0;
      let currentPrompt: string;

      if (isFirstAnalysis) {
        currentPrompt = `You're watching a medical emergency video. At ${currentTime.toFixed(1)}s - describe what you see and give ONE instruction.
MAXIMUM 15 WORDS. Be direct. Example: "I see CPR being performed. Compress faster, about 100 per minute."
If critical, start with ||CRITICAL_STATE||`;
      } else {
        currentPrompt = `Video at ${currentTime.toFixed(1)}s. Compare to before.
If SAME/NO CHANGE: Say "||STABLE||" only.
If PROGRESS: Brief positive note (8 words max).
If NEW ISSUE: Alert + instruction (15 words max).
If CRITICAL: Start with ||CRITICAL_STATE||`;
      }

      const currentParts = [
        { text: currentPrompt },
        { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }
      ];

      const historyToSend = videoLiveAnalysisHistoryRef.current.slice(-8);
      const contents = [
        {
          role: 'user',
          parts: [{ text: `You are Dr. ResQ analyzing a medical emergency video. CRITICAL RULES:
1. MAXIMUM 15 WORDS per response - this is spoken aloud
2. One observation/instruction at a time
3. Track progress across frames
4. Quick feedback when technique is good
5. Alert immediately if something looks wrong` }]
        },
        {
          role: 'model',
          parts: [{ text: "Got it. Watching the video. Short and clear feedback." }]
        },
        ...historyToSend,
        { role: 'user', parts: currentParts }
      ];

      const responsePromise = ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: contents
      });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Video analysis timeout")), 15000)
      );

      const response = await Promise.race([responsePromise, timeoutPromise]) as any;
      const responseText = response.text || "";

      console.log("[DEBUG] Video Live Analysis Response:", responseText);

      if (responseText.includes("||STABLE||")) {
        console.log("[DEBUG] Video analysis: Stable - no speech needed");
        return;
      }

      videoLiveAnalysisHistoryRef.current.push(
        { role: 'user', parts: currentParts },
        { role: 'model', parts: [{ text: responseText }] }
      );

      if (videoLiveAnalysisHistoryRef.current.length > 20) {
        videoLiveAnalysisHistoryRef.current = videoLiveAnalysisHistoryRef.current.slice(-16);
      }

      if (isMountedRef.current) {
        const cleanText = responseText
          .replace("||CRITICAL_STATE||", "")
          .replace('CRITICAL_ALERT', '')
          .replace(/\|\|.*?\|\|/g, '')
          .trim();

        setVideoLiveGuidance(cleanText);
        setVideoAnalysisCount(prev => prev + 1);

        const speakText = cleanText.replace(/\*\*/g, '').replace(/\*/g, '');
        window.speechSynthesis.cancel();
        speak(speakText);

        if (responseText.includes("||CRITICAL_STATE||") || responseText.includes("CRITICAL_ALERT")) {
          setCritical(true);
          if (!isMicActive) setIsMicActive(true);
        }
      }

    } catch (error: any) {
      console.error("[DEBUG] Video Live Analysis Error:", error);
      if (isMountedRef.current && error.message !== "Video analysis timeout") {
        setVideoLiveGuidance("Analysis error. Will retry...");
      }
    } finally {
      videoAnalysisQueueRef.current = false;
      if (isMountedRef.current) setIsVideoAnalysisPending(false);
    }
  };

  const startVideoLiveAnalysis = () => {
    if (isVideoLiveAnalysisActive || !uploadedVideo) return;

    console.log("[DEBUG] Starting Video Live Analysis Mode");
    setIsVideoLiveAnalysisActive(true);
    isVideoLiveAnalysisActiveRef.current = true;
    setVideoLiveGuidance(null);
    setVideoAnalysisCount(0);
    videoAnalysisQueueRef.current = false;
    videoLiveAnalysisHistoryRef.current = [];

    // Enable mic for voice interaction
    if (!isMicActive) setIsMicActive(true);

    // Wait for video to be ready
    const waitForVideo = () => {
      if (playbackVideoRef.current) {
        console.log("[DEBUG] Video ready, starting playback analysis");
        playbackVideoRef.current.play();

        // Perform first analysis after short delay
        setTimeout(() => performVideoLiveAnalysis(), 1000);

        // Set up interval for continuous analysis (every 3 seconds)
        videoLiveAnalysisIntervalRef.current = setInterval(() => {
          if (playbackVideoRef.current && !playbackVideoRef.current.paused) {
            performVideoLiveAnalysis();
          }
        }, 3000);

        logEvent('SYSTEM_ALERT', 'Video Live Analysis Mode Activated');
        speak("Analyzing the video. I'll guide you through what I see.");
      } else {
        setTimeout(waitForVideo, 500);
      }
    };

    waitForVideo();
  };

  const stopVideoLiveAnalysis = () => {
    console.log("[DEBUG] Stopping Video Live Analysis Mode");

    if (videoLiveAnalysisIntervalRef.current) {
      clearInterval(videoLiveAnalysisIntervalRef.current);
      videoLiveAnalysisIntervalRef.current = null;
    }

    if (playbackVideoRef.current) {
      playbackVideoRef.current.pause();
    }

    setIsVideoLiveAnalysisActive(false);
    isVideoLiveAnalysisActiveRef.current = false;
    setVideoLiveGuidance(null);
    setIsVideoAnalysisPending(false);
    videoAnalysisQueueRef.current = false;
    videoLiveAnalysisHistoryRef.current = [];

    logEvent('SYSTEM_ALERT', 'Video Live Analysis Mode Stopped');
  };

  // --- Image Live Analysis Functions ---
  const performImageLiveAnalysis = async (userQuestion?: string) => {
    if (imageAnalysisQueueRef.current || !isMountedRef.current || !uploadedImage) {
      console.log("[DEBUG] Image Live Analysis skipped");
      return;
    }

    try {
      imageAnalysisQueueRef.current = true;
      setIsImageAnalysisPending(true);

      console.log("[DEBUG] Image Live Analysis: Analyzing image");

      const apiKey = process.env.API_KEY;
      if (!apiKey) throw new Error("API key not available");

      const ai = new GoogleGenAI({ apiKey });

      const isFirstAnalysis = imageLiveAnalysisHistoryRef.current.length === 0;
      const question = userQuestion || pendingImageQuestionRef.current;
      pendingImageQuestionRef.current = null;

      let currentPrompt: string;

      if (isFirstAnalysis) {
        currentPrompt = `You're a doctor looking at a patient's photo. Describe what you see and give ONE immediate instruction.
${question ? `Patient asks: "${question}"` : ''}
MAXIMUM 20 WORDS. Be direct. Example: "I see a deep cut on your hand. Apply firm pressure with a clean cloth now."
If critical (heavy bleeding, severe burn), start with ||CRITICAL_STATE||`;
      } else if (question) {
        currentPrompt = `Patient asks: "${question}"
Look at the image again and respond. Give next instruction. MAXIMUM 20 WORDS.`;
      } else {
        // Follow-up check
        currentPrompt = `Check the image again. Ask about progress or give next step.
MAXIMUM 15 WORDS. Example: "Is the bleeding slowing? Keep that pressure firm."`;
      }

      const currentParts = [
        { text: currentPrompt },
        { inlineData: { mimeType: uploadedImage.mimeType, data: uploadedImage.data } }
      ];

      const historyToSend = imageLiveAnalysisHistoryRef.current.slice(-8);
      const contents = [
        {
          role: 'user',
          parts: [{ text: `You are Dr. ResQ on a video call helping someone with an injury. CRITICAL RULES:
1. MAXIMUM 20 WORDS per response - this is spoken aloud
2. One step at a time - don't overwhelm
3. Ask follow-up questions to check progress
4. Be reassuring but direct
5. Remember what you already told them` }]
        },
        {
          role: 'model',
          parts: [{ text: "I understand. Looking at the image. One step at a time." }]
        },
        ...historyToSend,
        { role: 'user', parts: currentParts }
      ];

      const responsePromise = ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: contents
      });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Image analysis timeout")), 15000)
      );

      const response = await Promise.race([responsePromise, timeoutPromise]) as any;
      const responseText = response.text || "";

      console.log("[DEBUG] Image Live Analysis Response:", responseText);

      imageLiveAnalysisHistoryRef.current.push(
        { role: 'user', parts: currentParts },
        { role: 'model', parts: [{ text: responseText }] }
      );

      if (imageLiveAnalysisHistoryRef.current.length > 20) {
        imageLiveAnalysisHistoryRef.current = imageLiveAnalysisHistoryRef.current.slice(-16);
      }

      if (isMountedRef.current) {
        const cleanText = responseText
          .replace("||CRITICAL_STATE||", "")
          .replace('CRITICAL_ALERT', '')
          .replace(/\|\|.*?\|\|/g, '')
          .trim();

        setImageLiveGuidance(cleanText);
        setImageAnalysisCount(prev => prev + 1);

        const speakText = cleanText.replace(/\*\*/g, '').replace(/\*/g, '');
        window.speechSynthesis.cancel();
        speak(speakText);

        if (responseText.includes("||CRITICAL_STATE||") || responseText.includes("CRITICAL_ALERT")) {
          setCritical(true);
          if (!isMicActive) setIsMicActive(true);
        }
      }

    } catch (error: any) {
      console.error("[DEBUG] Image Live Analysis Error:", error);
      if (isMountedRef.current && error.message !== "Image analysis timeout") {
        setImageLiveGuidance("Analysis error. Will retry...");
      }
    } finally {
      imageAnalysisQueueRef.current = false;
      if (isMountedRef.current) setIsImageAnalysisPending(false);
    }
  };

  const startImageLiveAnalysis = () => {
    if (isImageLiveAnalysisActive || !uploadedImage) return;

    console.log("[DEBUG] Starting Image Live Analysis Mode");
    setIsImageLiveAnalysisActive(true);
    isImageLiveAnalysisActiveRef.current = true;
    setImageLiveGuidance(null);
    setImageAnalysisCount(0);
    imageAnalysisQueueRef.current = false;
    imageLiveAnalysisHistoryRef.current = [];

    // Enable mic for voice interaction
    if (!isMicActive) setIsMicActive(true);

    // Perform first analysis immediately
    performImageLiveAnalysis();

    // Set up interval for periodic follow-up prompts (every 8 seconds if no user input)
    imageLiveAnalysisIntervalRef.current = setInterval(() => {
      if (!pendingImageQuestionRef.current && isMountedRef.current) {
        performImageLiveAnalysis();
      }
    }, 8000);

    logEvent('SYSTEM_ALERT', 'Image Live Analysis Mode Activated');
    speak("I'm analyzing the image. Speak to me if you have questions.");
  };

  const stopImageLiveAnalysis = () => {
    console.log("[DEBUG] Stopping Image Live Analysis Mode");

    if (imageLiveAnalysisIntervalRef.current) {
      clearInterval(imageLiveAnalysisIntervalRef.current);
      imageLiveAnalysisIntervalRef.current = null;
    }

    setIsImageLiveAnalysisActive(false);
    isImageLiveAnalysisActiveRef.current = false;
    setImageLiveGuidance(null);
    setIsImageAnalysisPending(false);
    imageAnalysisQueueRef.current = false;
    imageLiveAnalysisHistoryRef.current = [];
    pendingImageQuestionRef.current = null;

    logEvent('SYSTEM_ALERT', 'Image Live Analysis Mode Stopped');
  };

  // --- Video Recording Functions ---
  const startVideoRecording = async () => {
    try {
      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: true
      });

      recordingStreamRef.current = stream;
      recordedChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        // Create blob from recorded chunks
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);

        // Convert to base64 for API
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          setUploadedVideo({
            name: `recording_${Date.now()}.webm`,
            data: base64,
            mimeType: 'video/webm',
            url: url
          });

          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'system',
            content: `Video recorded (${recordingTime}s). Send a message to analyze it.`,
            timestamp: new Date(),
            type: 'text'
          }]);
        };
        reader.readAsDataURL(blob);

        // Cleanup
        if (recordingStreamRef.current) {
          recordingStreamRef.current.getTracks().forEach(track => track.stop());
          recordingStreamRef.current = null;
        }
      };

      mediaRecorder.start(1000); // Collect data every second
      setIsRecordingVideo(true);
      setRecordingTime(0);

      // Start timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      speak("Recording started. Press stop when done.");

    } catch (error) {
      console.error("Failed to start video recording:", error);
      speak("Could not access camera. Please check permissions.");
    }
  };

  const stopVideoRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    setIsRecordingVideo(false);
    speak("Recording stopped.");
  };

  // --- Countdown Logic ---
  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      timerRef.current = setTimeout(() => {
        if(isMountedRef.current) setCountdown(countdown - 1);
      }, 1000);
    } else if (countdown === 0) {
      setCountdown(null);
      speak("Time is up. What is the patient's status?");
      logEvent('SYSTEM_ALERT', 'Timer Expired');
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [countdown]);

  // --- Initialize Chat Session ---
  useEffect(() => {
    const initChat = async () => {
      // Prevent double initialization from React StrictMode
      if (chatInitializedRef.current) {
        console.log("[DEBUG] Chat already initialized, skipping...");
        return;
      }
      chatInitializedRef.current = true;

      try {
        console.log("[DEBUG] Starting Chat Initialization...");
        
        const apiKey = process.env.API_KEY;
        if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') {
          console.error("[DEBUG] API Key Missing");
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'system',
            content: 'SYSTEM ERROR: API Key missing.',
            timestamp: new Date(),
            type: 'text'
          }]);
          return;
        }

        const ai = new GoogleGenAI({ apiKey });

        // Create Chat Session - with or without Medical Book Cache based on config
        console.log(`[DEBUG] Creating Chat Session (USE_MEDICAL_BOOK: ${USE_MEDICAL_BOOK})...`);

        // System instruction - conversational, step-by-step, spoken aloud
        const GENERAL_SYSTEM_INSTRUCTION = `You are Dr. ResQ, an emergency medical assistant on a voice call.

CRITICAL RULES:
1. Give ONE step at a time - never dump all steps at once
2. Keep responses SHORT (max 2-3 sentences, under 40 words)
3. ALWAYS end with a question or "Tell me when done" - wait for their response
4. Remember what you already told them - don't repeat
5. Be warm and reassuring but direct

FLOW EXAMPLE:
User: "I burned my hand"
You: "I understand. First, let's cool that burn. Run cool water over it right now. Tell me when you're at the sink."
User: "Okay I'm there"
You: "Good. Keep the water running over it for 10 minutes. Don't use ice. How does it feel?"
User: "It stings"
You: "That's normal. Keep it under the water. Is the skin red or is there blistering?"

FOR IMAGES/VIDEOS:
- Describe briefly what you see
- Give ONE immediate action
- Ask a follow-up question

CRITICAL EMERGENCIES:
If life-threatening (heavy bleeding, not breathing, unconscious), start with ||CRITICAL_STATE|| and give urgent instruction immediately.

Remember: This is a conversation. One step, wait for response, then next step.`;

        try {
          chatSessionRef.current = ai.chats.create({
            model: 'gemini-2.0-flash',
            config: USE_MEDICAL_BOOK
              ? { cachedContent: CACHE_NAME }
              : { systemInstruction: GENERAL_SYSTEM_INSTRUCTION },
            history: []
          });

          console.log("[DEBUG] Chat Session Created.");

          if (isMountedRef.current) {
            // Auto-enable microphone for voice communication
            setIsMicActive(true);

            setMessages(prev => {
              if (prev.length <= 1) {
                return [{
                  id: '1',
                  role: 'assistant',
                  content: USE_MEDICAL_BOOK
                    ? 'Medical Library Loaded (Cached). I am ready to assist.'
                    : 'Ready. You can speak or type your emergency.',
                  timestamp: new Date(),
                  type: 'text'
                }];
              }
              return prev;
            });
          }
        } catch (cacheError: any) {
          console.error("[DEBUG] Cache error, falling back to regular chat:", cacheError.message);

          // Fallback: Create chat without cache if cache expired or invalid
          chatSessionRef.current = ai.chats.create({
            model: 'gemini-2.0-flash',
            config: {
              systemInstruction: `You are Dr. ResQ, an emergency medical assistant on a voice call.

CRITICAL RULES:
1. Give ONE step at a time - never dump all steps at once
2. Keep responses SHORT (max 2-3 sentences, under 40 words)
3. ALWAYS end with a question or "Tell me when done" - wait for their response
4. Be conversational like a real doctor on phone

FLOW:
- User describes problem → You assess severity briefly
- Give FIRST step only → Wait for "done" or "okay"
- Then give NEXT step → Wait again
- Continue until complete

CRITICAL TRIGGERS:
- If life-threatening: Start with "||CRITICAL_STATE||"
- For protocol UI: Include "||PROTOCOL: TYPE||"

Example response: "I see a burn on your hand. First, let's cool it - run cold water over it for at least 10 minutes. Tell me when you've started that."`
            },
            history: []
          });

          if (isMountedRef.current) {
            // Auto-enable microphone for voice communication
            setIsMicActive(true);

            setMessages(prev => {
              if (prev.length <= 1) {
                return [{
                  id: '1',
                  role: 'assistant',
                  content: 'Ready. You can speak or type your emergency.',
                  timestamp: new Date(),
                  type: 'text'
                }];
              }
              return prev;
            });
          }
        }

      } catch (error: any) {
        console.error("[DEBUG] General Init Error:", error);
        if(isMountedRef.current) {
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'assistant',
            content: `System Error: ${error.message}. Please restart.`,
            timestamp: new Date(),
            type: 'text'
          }]);
        }
      }
    };
    
    // Small delay to ensure render is complete before heavy API calls
    setTimeout(initChat, 100);

  }, []);

  // --- PDF Upload Handling ---
  const handlePdfUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        setUploadedPdf({
          name: file.name,
          data: base64String
        });
        pdfSentRef.current = false;
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'system',
          content: `Manual Protocol Attached: ${file.name}.`,
          timestamp: new Date(),
          type: 'text'
        }]);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearPdf = (e: React.MouseEvent) => {
    e.stopPropagation();
    setUploadedPdf(null);
    pdfSentRef.current = false;
  };

  // --- Media Upload Handling (Video/Image) ---
  
  const handleMediaUpload = (event: React.ChangeEvent<HTMLInputElement>, type: 'video' | 'image') => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileSizeMB = file.size / (1024 * 1024);

    // Hard limit check
    if (file.size > 25 * 1024 * 1024) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'system',
        content: 'File is too large. Please use a file under 25MB.',
        timestamp: new Date(),
        type: 'text'
      }]);
      speak("File is too large. Please use a smaller file.");
      return;
    }

    // Warning for large videos - suggest Live Video Analysis
    if (type === 'video' && fileSizeMB > 10) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'system',
        content: `Video is ${fileSizeMB.toFixed(1)}MB. For better results, use "Live Video Analysis" which processes frame-by-frame. Processing large videos directly may timeout.`,
        timestamp: new Date(),
        type: 'text'
      }]);
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      const url = URL.createObjectURL(file);

      if (type === 'video') {
          // Clear any image if a video is selected
          if (uploadedImage?.url) URL.revokeObjectURL(uploadedImage.url);
          setUploadedImage(null);

          setUploadedVideo({
            name: file.name,
            data: base64String,
            mimeType: file.type,
            url: url
          });
          logEvent('VISUAL_OBSERVATION', `Video staged: ${file.name} (${fileSizeMB.toFixed(1)}MB)`);
      } else {
          // Clear any video if an image is selected
          if (uploadedVideo?.url) URL.revokeObjectURL(uploadedVideo.url);
          setUploadedVideo(null);

          setUploadedImage({
             name: file.name,
             data: base64String,
             mimeType: file.type,
             url: url
          });
          logEvent('VISUAL_OBSERVATION', `Image staged: ${file.name}`);
      }
      setActiveMenu(null);
    };
    reader.readAsDataURL(file);
  };

  // Modified to optionally revoke URLs. 
  // If we are sending the message, we DON'T revoke, because we pass the URL to the chat history.
  // We let the component unmount cleanup handle the final revocation.
  const clearMedia = (shouldRevoke = true) => {
    if (shouldRevoke) {
        if (uploadedVideo?.url) URL.revokeObjectURL(uploadedVideo.url);
        if (uploadedImage?.url) URL.revokeObjectURL(uploadedImage.url);
    }
    setUploadedVideo(null);
    setUploadedImage(null);
    if(videoUploadRef.current) videoUploadRef.current.value = '';
    if(videoCaptureRef.current) videoCaptureRef.current.value = '';
    if(imageUploadRef.current) imageUploadRef.current.value = '';
  };

  // --- Speech Recognition Setup ---
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        // If AI is thinking (processing), ignore user speech
        if (isThinkingRef.current) {
          return;
        }

        let finalPart = '';
        let interimPart = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalPart += event.results[i][0].transcript;
          } else {
            interimPart += event.results[i][0].transcript;
          }
        }

        const textDetected = finalPart || interimPart;

        if (textDetected) {
           if (silenceTimer.current) clearTimeout(silenceTimer.current);

           if (finalPart) {
             transcriptBuffer.current += " " + finalPart;
             if(isMountedRef.current) {
               setInputValue(prev => (prev + " " + finalPart).trim());
             }
           }

           silenceTimer.current = setTimeout(() => {
              if (!isThinkingRef.current && isMountedRef.current) {
                const fullText = transcriptBuffer.current.trim();
                if (fullText) {
                   // If camera live analysis is active, user responded - trigger immediate analysis
                   if (isLiveAnalysisActiveRef.current) {
                     pendingUserQuestionRef.current = fullText;
                     waitingForUserRef.current = false;
                     transcriptBuffer.current = '';
                     setInputValue('');
                     performLiveAnalysis();
                   }
                   // If image live analysis is active, user responded - trigger immediate analysis
                   else if (isImageLiveAnalysisActiveRef.current) {
                     pendingImageQuestionRef.current = fullText;
                     transcriptBuffer.current = '';
                     setInputValue('');
                     performImageLiveAnalysis(fullText);
                   }
                   else {
                     handleSendMessage(fullText);
                     transcriptBuffer.current = '';
                     setInputValue('');
                   }
                }
              }
           }, 1500);
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'not-allowed' && isMountedRef.current) {
           setIsMicActive(false);
        }
      };

      recognition.onend = () => {
        // Restart recognition if mic is active
        if (isMicActive && !isThinkingRef.current && isMountedRef.current) {
          setTimeout(() => {
            try {
              if (isMicActive && !isThinkingRef.current && isMountedRef.current) {
                recognition.start();
              }
            } catch (e) {}
          }, 300);
        }
      };

      recognitionRef.current = recognition;
    } catch (error) {
      console.error('Failed to initialize speech recognition:', error);
    }
  }, [isMicActive]);

  // --- Mic State Management ---
  useEffect(() => {
    if (isMicActive) {
      try { recognitionRef.current?.start(); } catch(e) {}
    } else {
      try { recognitionRef.current?.stop(); } catch(e) {}
    }
  }, [isMicActive]);

  // Auto-scroll
  useEffect(() => {
    requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
    });
  }, [messages, isCritical, uploadedVideo, uploadedImage]);

  // Camera Management
  useEffect(() => {
    if (isCameraActive) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isCameraActive]);

  const startCamera = async () => {
    if (streamRef.current) return;
    setIsCameraLoading(true);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not supported');
      }

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      } catch (e) {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      if (isMountedRef.current) {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(err => console.warn(err));
        }
        setIsCameraLoading(false);
      } else {
        stream.getTracks().forEach(t => t.stop());
      }

    } catch (err: any) {
      if (isMountedRef.current) {
        setIsCameraActive(false);
        setIsCameraLoading(false);
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const captureImageFrame = (): string | null => {
    if (videoRef.current && streamRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(videoRef.current, 0, 0);
      return canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
    }
    return null;
  };

  // --- RAG SEARCH FUNCTION (Local Visual Only) ---
  const searchKnowledgeBase = (query: string) => {
    const q = query.toLowerCase();
    return MEDICAL_KNOWLEDGE_BASE.filter(doc => 
      doc.keywords.some(tag => q.includes(tag)) || doc.title.toLowerCase().includes(q)
    );
  };

  const handleSendMessage = async (overrideText?: string) => {
    // Determine the message text
    // If media is present, default to "Analyze this." if no text is provided
    const textToSend = overrideText || inputValue || ((uploadedVideo || uploadedImage) ? "Analyze this." : "");
    
    // If no text AND no media, don't send
    if (!textToSend.trim() && !uploadedVideo && !uploadedImage) return;

    if (isThinking || isThinkingRef.current) return;

    window.speechSynthesis.cancel();
    if (recognitionRef.current) try { recognitionRef.current.stop(); } catch(e) {}

    if (silenceTimer.current) clearTimeout(silenceTimer.current);
    transcriptBuffer.current = ''; 
    
    // Reset RAG UI
    setRetrievedDoc(null);
    setRetrievingData(false);

    // Manual keyword trigger
    const criticalKeywords = ["help", "emergency", "bleeding", "breath", "dying", "unconscious", "choking", "cpr"];
    if (criticalKeywords.some(kw => textToSend.toLowerCase().includes(kw))) {
      setCritical(true);
    }

    const userMsgId = Date.now().toString();

    // Prepare Attachment for History
    let attachment: ChatMessage['attachment'] = undefined;
    if (uploadedImage) {
        attachment = { 
            type: 'image', 
            // Construct a Data URI for persistence in chat history so we don't depend on unstable blob URLs
            url: `data:${uploadedImage.mimeType};base64,${uploadedImage.data}` 
        };
    } else if (uploadedVideo) {
        attachment = { type: 'video', url: uploadedVideo.url };
    }

    setMessages(prev => [...prev, {
      id: userMsgId,
      role: 'user',
      content: textToSend,
      timestamp: new Date(),
      type: 'text',
      attachment: attachment
    }]);
    
    setInputValue('');
    setIsThinking(true);
    isThinkingRef.current = true;

    try {
      if (!chatSessionRef.current) throw new Error("AI service not initialized (Chat Session Null).");

      console.log("[DEBUG] Sending Message:", textToSend);
      
      // --- VISUAL UI SEARCH (Local) ---
      // We still run this just to show the user "Searching..." feedback, 
      // but the actual context comes from the loaded PDF history.
      setRetrievingData(true);
      const relevantDocs = searchKnowledgeBase(textToSend);
      await new Promise(resolve => setTimeout(resolve, 600)); 
      
      if (relevantDocs.length > 0) {
        const topDoc = relevantDocs[0];
        setRetrievedDoc(topDoc.title);
      }
      setRetrievingData(false);

      let messagePayload: any = textToSend;
      let parts: any[] = [{ text: textToSend }];
      let isMultimodal = false;

      // 1. Uploaded Video (Highest Priority)
      if (uploadedVideo) {
         console.log("[DEBUG] Attaching Video");
         parts.push({ inlineData: { mimeType: uploadedVideo.mimeType, data: uploadedVideo.data } });
         parts.push({ text: "\n\nAnalyze this video. Provide: \n1. **Condition**\n2. **Immediate Treatment**\n3. **Precautions**\n4. **Step-by-Step Guide**" });
         isMultimodal = true;
      }
      // 2. Uploaded Image (Second Priority)
      else if (uploadedImage) {
         console.log("[DEBUG] Attaching Image");
         parts.push({ inlineData: { mimeType: uploadedImage.mimeType, data: uploadedImage.data } });
         parts.push({ text: "\n\nAnalyze this image. Provide: \n1. **Condition**\n2. **Immediate Treatment**\n3. **Precautions**" });
         isMultimodal = true;
      }
      // 3. Live Camera Frame (Third Priority)
      else if (isCameraActive) {
        const imageBase64 = captureImageFrame();
        if (imageBase64) {
          logEvent('VISUAL_OBSERVATION', 'Live Frame captured');
          parts.push({ inlineData: { mimeType: 'image/jpeg', data: imageBase64 } });
          isMultimodal = true;
        }
      }

      // 4. PDF Context (Manual single-file upload only)
      if (uploadedPdf && !pdfSentRef.current) {
         console.log("[DEBUG] Attaching Manual PDF");
         parts.push({ inlineData: { mimeType: 'application/pdf', data: uploadedPdf.data } });
         isMultimodal = true;
         pdfSentRef.current = true; 
      }

      // Format message as array of parts (matching PDF injection format)
      if (isMultimodal) messagePayload = parts;
      else messagePayload = [{ text: textToSend }];

      const aiMsgId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, {
        id: aiMsgId,
        role: 'assistant',
        content: uploadedVideo ? 'Analyzing video... This may take up to 2 minutes.' : (uploadedImage ? 'Analyzing image...' : '...'),
        timestamp: new Date(),
        type: 'text'
      }]);

      console.log("[DEBUG] Calling AI API...");
      const responsePromise = chatSessionRef.current.sendMessage({ message: messagePayload });
      // Longer timeout for video (180s = 3 min), standard for others (90s)
      const timeoutMs = uploadedVideo ? 180000 : 90000;
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Request timed out")), timeoutMs));
      const response = await Promise.race([responsePromise, timeoutPromise]) as any;
      console.log("[DEBUG] AI Response Received:", response.text);

      // Clear media from staging but DO NOT revoke object URLs because they are now used in chat history
      if (uploadedVideo || uploadedImage) clearMedia(false);

      const fullResponseText = response.text || "No response received.";

      // --- AUTO-CRITICAL TRIGGER CHECK ---
      // If AI detects critical state, enable critical mode AND microphone automatically
      if (fullResponseText.includes("||CRITICAL_STATE||") || fullResponseText.includes("CRITICAL_ALERT")) {
          setCritical(true);
          // Force enable mic for hands-free
          if (!isMicActive) setIsMicActive(true);
      }

      // TIMER FEATURE DISABLED
      // if (fullResponseText.includes("||TIMER:")) {
      //     const timerMatch = fullResponseText.match(/\|\|TIMER: (\d+)\|\|/);
      //     if (timerMatch && !countdown && isMountedRef.current) setCountdown(parseInt(timerMatch[1]));
      // }

      const finalDisplayText = fullResponseText
        .replace("||CRITICAL_STATE||", "")
        .replace('CRITICAL_ALERT', '')
        .replace(/\|\|PROTOCOL: .*?\|\|/g, '')
        .replace(/\|\|TIMER: .*?\|\|/g, '')
        .replace(/\|\|STEP: .*?\|\|/g, '')
        .trim();

      if (isMountedRef.current) {
        setMessages(prev => prev.map(msg => msg.id === aiMsgId ? { ...msg, content: finalDisplayText } : msg));
      }

      const finalCleanText = fullResponseText.replace(/\|\|.*?\|\|/g, '').replace('CRITICAL_ALERT', '').replace(/\*\*/g, '').replace(/\*/g, '');
      logEvent('AI_INSTRUCTION', finalCleanText);

      if (finalCleanText && isMountedRef.current) {
        setTimeout(() => { if (isMountedRef.current) speak(finalCleanText); }, 200);
      }

    } catch (error: any) {
      console.error("[DEBUG] Detailed AI Error:", error);

      if (uploadedPdf && pdfSentRef.current) pdfSentRef.current = false;

      // Track if we had media attached for better error messages
      const hadVideo = !!uploadedVideo;
      const hadImage = !!uploadedImage;

      let errorMsg = "Connection issue. Please try again.";
      let speakMsg = "I encountered a connection error. Please check your network.";

      if (error.message) {
          if (error.message.includes("API key")) {
            errorMsg = "Invalid API Key. Check console.";
          } else if (error.message.includes("timed out")) {
            if (hadVideo) {
              errorMsg = "Video processing timed out. Try a shorter video (under 30 seconds) or use Live Video Analysis mode for longer videos.";
              speakMsg = "Video processing timed out. Try a shorter video or use Live Video Analysis mode.";
            } else if (hadImage) {
              errorMsg = "Image processing timed out. Please try again.";
              speakMsg = "Image processing timed out. Please try again.";
            } else {
              errorMsg = "Request timed out. Please try again.";
            }
          } else if (error.message.includes("400")) {
            errorMsg = hadVideo ? "Video too large. Try a smaller file (under 20MB) or shorter duration." : "Request rejected (400). File too large?";
            speakMsg = hadVideo ? "Video too large. Try a smaller file." : "Request rejected. File may be too large.";
          } else if (error.message.includes("429")) {
            errorMsg = "Rate limited (429). Please wait a moment and try again.";
            speakMsg = "Rate limited. Please wait a moment.";
          } else if (error.message.includes("503")) {
            errorMsg = "Model overloaded (503). Try again in a few seconds.";
          } else if (error.message.includes("500")) {
            errorMsg = "Server error (500). Retrying connection...";
          } else {
            errorMsg = `Error: ${error.message}`;
          }
      }

      if (isMountedRef.current) {
        setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last.content === '...' || last.content.includes('Analyzing') || last.content === 'Connecting to Medical Library...' || last.content.includes("Library processing")) {
                return [...prev.slice(0, -1), {
                    id: Date.now().toString(),
                    role: 'assistant',
                    content: errorMsg,
                    timestamp: new Date(),
                    type: 'text'
                }];
            }
            return [...prev, { id: Date.now().toString(), role: 'assistant', content: errorMsg, timestamp: new Date(), type: 'text' }];
        });
        speak(speakMsg);
      }
    } finally {
      if (isMountedRef.current) setIsThinking(false);
      isThinkingRef.current = false;
      setRetrievingData(false);

      // Restart speech recognition after AI finishes responding
      if (isMicActive && recognitionRef.current && isMountedRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          // Already running or failed to start
        }
      }
    }
  };

  const markStepComplete = (msgId: string) => {
    const msg = messages.find(m => m.id === msgId);
    if (msg && msg.actionStep) logEvent('ACTION_LOG', `Step Completed: ${msg.actionStep.title}`);

    setMessages(prev => prev.map(msg => {
      if (msg.id === msgId && msg.actionStep) {
        return { ...msg, actionStep: { ...msg.actionStep, isCompleted: true } };
      }
      return msg;
    }));
    handleSendMessage("Step done. Next?");
  };

  const activeStep = [...messages].reverse().find(m => m.actionStep && !m.actionStep.isCompleted);

  const renderProtocolOverlay = () => {
    if (!activeProtocol) return null;
    const protocolConfig = {
      'CPR': { icon: Icons.CPR, color: 'text-red-500', label: 'CPR IN PROGRESS' },
      'BLEEDING': { icon: Icons.Bleeding, color: 'text-red-600', label: 'BLEEDING CONTROL' },
      'CHOKING': { icon: Icons.Unconscious, color: 'text-amber-500', label: 'CHOKING PROTOCOL' },
      'UNCONSCIOUS': { icon: Icons.Unconscious, color: 'text-purple-500', label: 'UNCONSCIOUS PATIENT' },
    }[activeProtocol];

    if (!protocolConfig) return null;
    const PIcon = protocolConfig.icon;

    return (
      <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-30 flex flex-col items-center animate-fade-in px-4">
        <div className={`flex items-center space-x-1.5 sm:space-x-2 bg-black/80 backdrop-blur px-3 py-1.5 sm:px-4 sm:py-2 rounded-full border border-white/20 shadow-xl`}>
          <PIcon className={`${protocolConfig.color} ${activeProtocol === 'CPR' ? 'animate-pulse' : ''}`} size={20} />
          <span className="text-white font-bold tracking-wider text-xs sm:text-sm whitespace-nowrap">{protocolConfig.label}</span>
        </div>
      </div>
    );
  };

  return (
    <div className={`flex flex-col h-screen relative overflow-hidden transition-all duration-500 ${
      isCritical ? 'bg-red-950 border-[6px] border-red-600' : 'bg-slate-50 dark:bg-slate-950 animate-slide-up'
    }`}>

      {/* Hidden Inputs */}
      <input type="file" accept="application/pdf" ref={pdfInputRef} onChange={handlePdfUpload} className="hidden" />
      <input type="file" accept="image/*" ref={imageUploadRef} onChange={(e) => handleMediaUpload(e, 'image')} className="hidden" />
      <input type="file" accept="video/*" ref={videoUploadRef} onChange={(e) => handleMediaUpload(e, 'video')} className="hidden" />
      <input type="file" accept="video/*" capture="environment" ref={videoCaptureRef} onChange={(e) => handleMediaUpload(e, 'video')} className="hidden" />

      {/* Header & Controls Overlay */}
      <div className="absolute top-0 left-0 right-0 z-50 p-4 flex justify-between items-start pointer-events-none">
          {/* Back Button - Always visible */}
          <div className="pointer-events-auto flex items-center gap-2">
            <button onClick={() => { setCritical(false); onBack(); }} className={`p-2.5 rounded-full backdrop-blur-md shadow-lg transition-all active:scale-95 border ${
              isCritical
                ? 'bg-black/50 text-white border-white/20 hover:bg-black/70'
                : 'bg-white/95 dark:bg-slate-800/95 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700'
            }`}>
                <Icons.Back size={22} />
            </button>
            {isCritical && (
               <div className="bg-red-600/90 backdrop-blur text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg border-2 border-red-400 shadow-xl animate-pulse flex items-center space-x-2">
                   <Icons.Warning size={20} className="animate-bounce" />
                   <span className="font-black tracking-wider text-xs sm:text-sm">CRITICAL MODE</span>
               </div>
            )}
          </div>

          {/* End Emergency Button */}
          <div className="pointer-events-auto">
             {isCritical && (
                 <button onClick={() => { 
                    setCritical(false); 
                    setActiveProtocol(null); 
                    setCountdown(null); 
                    window.speechSynthesis.cancel(); 
                    setIsMicActive(false); 
                    setIsCameraActive(false); 
                 }} className="bg-slate-900/80 text-white px-3 py-2 rounded-lg border border-slate-700 font-bold text-xs hover:bg-slate-800 shadow-lg flex items-center gap-2">
                    <Icons.Close size={16} /> EXIT EMERGENCY
                 </button>
             )}
          </div>
      </div>

      {/* Manual Critical Trigger (Only if not critical) */}
      {!isCritical && (
        <button onClick={() => setCritical(true)} className="absolute top-4 right-4 bg-red-600 hover:bg-red-700 transition-colors text-white px-4 py-1.5 text-xs font-bold tracking-widest text-center animate-pulse z-30 shadow-md rounded-lg">
          TAP FOR EMERGENCY
        </button>
      )}

      {/* Welcome Overlay */}
      {!isCritical && messages.length === 1 && !isCameraActive && (
        <div className="absolute inset-0 z-40 flex items-center justify-center p-8 pointer-events-none">
          <div className="bg-slate-800/90 dark:bg-slate-900/90 backdrop-blur-lg text-white rounded-3xl p-6 sm:p-8 shadow-2xl max-w-md text-center border border-slate-700/50 animate-fade-in">
            <div className="mb-4">
              <div className="inline-block p-4 bg-blue-500/20 rounded-full mb-3">
                <Icons.AI size={32} className="text-blue-400" />
              </div>
            </div>
            <p className="text-base sm:text-lg leading-relaxed font-medium">{messages[0]?.content}</p>
          </div>
        </div>
      )}

      {/* Subtle Heartbeat Vignette for Critical Mode */}
      {isCritical && <div className="absolute inset-0 z-50 pointer-events-none emergency-vignette opacity-20 animate-pulse"></div>}

      <div className="flex-1 min-h-0 relative flex flex-col pt-16">
        
        {/* Camera Layer */}
        {isCameraActive && (
          <div className={`transition-all duration-500 absolute inset-0 z-10 bg-black overflow-hidden`}>
            <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-contain transition-opacity duration-500`} />
            {isCameraLoading && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}

            {/* Live Analysis Overlay - Status Badge (top-left) */}
            {isLiveAnalysisActive && (
              <div className="absolute top-20 left-4 z-30 flex items-center gap-2">
                <div className="bg-emerald-600/90 backdrop-blur text-white px-3 py-1.5 rounded-lg border border-emerald-400 shadow-xl flex items-center space-x-2">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  <span className="font-bold tracking-wider text-xs">LIVE ANALYSIS ACTIVE</span>
                </div>
              </div>
            )}

            {/* Live Analysis Overlay - Counter (top-right, below close button) */}
            {isLiveAnalysisActive && (
              <div className="absolute top-32 right-4 z-30">
                <div className="bg-black/60 backdrop-blur text-white px-3 py-1 rounded-lg border border-white/20 text-xs font-mono">
                  Analysis #{analysisCount}
                </div>
              </div>
            )}

            {/* Live Analysis Overlay - Pending Indicator */}
            {isLiveAnalysisActive && isAnalysisPending && (
              <div className="absolute top-40 right-4 z-30">
                <div className="bg-blue-600/80 backdrop-blur text-white px-3 py-1.5 rounded-lg border border-blue-400 flex items-center space-x-2 text-xs">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Analyzing...</span>
                </div>
              </div>
            )}

            {/* Live Analysis Overlay - Guidance (bottom, above capture button) */}
            {isLiveAnalysisActive && liveGuidance && (
              <div className="absolute bottom-44 left-4 right-4 z-30">
                <div className="bg-black/80 backdrop-blur-md text-white px-4 py-3 rounded-xl border border-white/20 shadow-xl">
                  <div className="flex items-start gap-2">
                    <Scan size={18} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm leading-relaxed"><MarkdownText content={liveGuidance} /></p>
                      <p className="text-[10px] text-slate-400 mt-1">Last updated: {new Date().toLocaleTimeString()}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Camera Controls - Capture Button and Live Analysis Toggle */}
            {!isCameraLoading && (
              <div className="absolute bottom-24 left-0 right-0 flex justify-center gap-6 z-30">
                {/* Capture Button - Only visible when NOT in live analysis */}
                {!isLiveAnalysisActive && (
                  <button
                    onClick={() => {
                      const imageBase64 = captureImageFrame();
                      if (imageBase64) {
                        setUploadedImage({
                          name: 'camera-capture.jpg',
                          data: imageBase64,
                          mimeType: 'image/jpeg',
                          url: `data:image/jpeg;base64,${imageBase64}`
                        });
                        setIsCameraActive(false);
                      }
                    }}
                    className="w-20 h-20 rounded-full bg-white border-4 border-slate-300 shadow-2xl flex items-center justify-center active:scale-95 transition-transform"
                  >
                    <div className="w-16 h-16 rounded-full bg-white border-2 border-slate-400"></div>
                  </button>
                )}

                {/* Live Analysis Toggle Button */}
                <button
                  onClick={() => {
                    if (isLiveAnalysisActive) {
                      stopLiveAnalysis();
                    } else {
                      startLiveAnalysis();
                    }
                  }}
                  className={`w-20 h-20 rounded-full border-4 shadow-2xl flex flex-col items-center justify-center active:scale-95 transition-all ring-4 ${
                    isLiveAnalysisActive
                      ? 'bg-red-600 border-red-400 text-white ring-red-500/50'
                      : 'bg-emerald-500 border-white text-white ring-emerald-500/50 animate-pulse'
                  }`}
                >
                  {isLiveAnalysisActive ? (
                    <>
                      <StopCircle size={28} />
                      <span className="text-[10px] font-bold mt-0.5">STOP</span>
                    </>
                  ) : (
                    <>
                      <Scan size={28} />
                      <span className="text-[10px] font-bold mt-0.5">LIVE</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Close Camera Button - Updated to stop live analysis first */}
            <button
              onClick={() => {
                if (isLiveAnalysisActive) {
                  stopLiveAnalysis();
                }
                setIsCameraActive(false);
              }}
              className="absolute top-20 right-4 z-30 p-3 rounded-full bg-black/50 text-white backdrop-blur-sm border border-white/20"
            >
              <Icons.Close size={24} />
            </button>
          </div>
        )}

        {isCritical && renderProtocolOverlay()}

        {/* TIMER OVERLAY - DISABLED */}
        {/* {countdown !== null && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in pointer-events-none px-4">
            <div className="flex flex-col items-center">
              <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full border-6 sm:border-8 border-white flex items-center justify-center mb-3 sm:mb-4">
                <span className="text-5xl sm:text-6xl font-black text-white font-mono">{countdown}</span>
              </div>
              <span className="text-white text-base sm:text-xl font-bold animate-pulse text-center">PERFORMING ACTION...</span>
            </div>
          </div>
        )} */}

        {/* Unified Chat Interface (Used for both Normal and Critical) - Hidden when camera active */}
        <div className={`flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 z-20 transition-all duration-300 ${isCameraActive ? 'hidden' : ''}`}>
            {messages.filter((_, idx) => idx > 0 || messages.length > 1).map((msg) => (
              <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[90%] sm:max-w-[85%] rounded-2xl p-3 sm:p-4 shadow-sm mb-1.5 sm:mb-2 ${
                  msg.role === 'user'
                    ? (isCritical ? 'bg-red-600 text-white rounded-br-none' : 'bg-blue-600 text-white rounded-br-none')
                    : (isCritical
                        ? 'bg-red-900/80 text-white border border-red-500/30 rounded-bl-none'
                        : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-bl-none')
                }`}>
                  
                  {/* Render Attachments */}
                  {msg.attachment && (
                      <div className="mb-2 rounded-lg overflow-hidden border border-white/20">
                          {msg.attachment.type === 'image' ? (
                              <img src={msg.attachment.url} alt="Uploaded content" className="w-full max-h-60 object-cover" />
                          ) : (
                              <video src={msg.attachment.url} controls className="w-full max-h-60 object-cover" />
                          )}
                      </div>
                  )}

                  <p className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap"><MarkdownText content={msg.content} /></p>
                </div>
              </div>
            ))}
            
            {/* Media Preview Staging Area - Enhanced with Live Analysis */}
            {(uploadedVideo || uploadedImage) && !isVideoLiveAnalysisActive && !isImageLiveAnalysisActive && (
               <div className="flex justify-end mb-2">
                 <div className="relative bg-slate-900 rounded-xl overflow-hidden border-2 border-blue-500 shadow-lg max-w-[280px]">
                    {uploadedVideo ? (
                        <video src={uploadedVideo.url} className="w-full h-40 object-cover" muted loop playsInline />
                    ) : (
                        <img src={uploadedImage?.url} className="w-full h-40 object-cover" alt="Preview" />
                    )}
                    <button onClick={() => clearMedia(true)} className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1.5 shadow-md hover:bg-red-700 z-10">
                       <Icons.Close size={14} />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-black/40 p-2">
                       <p className="text-[10px] text-white/80 truncate mb-2">
                         {uploadedVideo ? uploadedVideo.name : uploadedImage?.name}
                       </p>
                       <button
                         onClick={() => {
                           if (uploadedVideo) {
                             startVideoLiveAnalysis();
                           } else if (uploadedImage) {
                             startImageLiveAnalysis();
                           }
                         }}
                         className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold py-2 rounded-lg transition-all shadow-lg animate-pulse"
                       >
                         <Scan size={16} />
                         {uploadedVideo ? 'Start Live Video Analysis' : 'Start Live Image Analysis'}
                       </button>
                    </div>
                 </div>
               </div>
            )}

            {/* Video Live Analysis Mode - Full Screen Overlay */}
            {isVideoLiveAnalysisActive && uploadedVideo && (
              <div className="fixed inset-0 z-50 bg-black flex flex-col">
                {/* Video Player */}
                <div className="flex-1 relative">
                  <video
                    ref={playbackVideoRef}
                    src={uploadedVideo.url}
                    className="w-full h-full object-contain"
                    playsInline
                    onEnded={() => {
                      // Loop video for continuous analysis
                      if (playbackVideoRef.current) {
                        playbackVideoRef.current.currentTime = 0;
                        playbackVideoRef.current.play();
                      }
                    }}
                    onTimeUpdate={(e) => setVideoPlaybackTime((e.target as HTMLVideoElement).currentTime)}
                  />

                  {/* Status Badge (top-left) */}
                  <div className="absolute top-4 left-4 z-30 flex items-center gap-2">
                    <div className="bg-emerald-600/90 backdrop-blur text-white px-3 py-1.5 rounded-lg border border-emerald-400 shadow-xl flex items-center space-x-2">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                      <span className="font-bold tracking-wider text-xs">VIDEO ANALYSIS ACTIVE</span>
                    </div>
                  </div>

                  {/* Progress Info (top-right) */}
                  <div className="absolute top-4 right-16 z-30 flex flex-col gap-2 items-end">
                    <div className="bg-black/60 backdrop-blur text-white px-3 py-1 rounded-lg border border-white/20 text-xs font-mono">
                      {videoPlaybackTime.toFixed(1)}s | Analysis #{videoAnalysisCount}
                    </div>
                    {isVideoAnalysisPending && (
                      <div className="bg-blue-600/80 backdrop-blur text-white px-3 py-1.5 rounded-lg border border-blue-400 flex items-center space-x-2 text-xs">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Analyzing...</span>
                      </div>
                    )}
                  </div>

                  {/* Close Button */}
                  <button
                    onClick={() => {
                      stopVideoLiveAnalysis();
                      clearMedia(true);
                    }}
                    className="absolute top-4 right-4 z-30 p-3 rounded-full bg-black/50 text-white backdrop-blur-sm border border-white/20"
                  >
                    <Icons.Close size={24} />
                  </button>

                  {/* Guidance Overlay (bottom) */}
                  {videoLiveGuidance && (
                    <div className="absolute bottom-24 left-4 right-4 z-30">
                      <div className="bg-black/80 backdrop-blur-md text-white px-4 py-3 rounded-xl border border-white/20 shadow-xl">
                        <div className="flex items-start gap-2">
                          <VideoIcon size={18} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm leading-relaxed"><MarkdownText content={videoLiveGuidance} /></p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Controls Bar */}
                <div className="shrink-0 p-4 bg-slate-900 border-t border-slate-700">
                  <div className="flex items-center justify-center gap-4">
                    {/* Play/Pause */}
                    <button
                      onClick={() => {
                        if (playbackVideoRef.current) {
                          if (playbackVideoRef.current.paused) {
                            playbackVideoRef.current.play();
                          } else {
                            playbackVideoRef.current.pause();
                          }
                        }
                      }}
                      className="p-4 rounded-full bg-white text-slate-900 hover:bg-slate-200 shadow-lg transition-all"
                    >
                      <Film size={24} />
                    </button>

                    {/* Stop Analysis */}
                    <button
                      onClick={() => {
                        stopVideoLiveAnalysis();
                        clearMedia(true);
                      }}
                      className="p-4 rounded-full bg-red-500 text-white hover:bg-red-600 shadow-lg transition-all ring-4 ring-red-500/30"
                    >
                      <StopCircle size={24} />
                    </button>
                  </div>
                  <p className="text-center text-xs text-slate-400 mt-2">
                    Speak to ask questions about the video
                  </p>
                </div>
              </div>
            )}

            {/* Image Live Analysis Mode - Full Screen Overlay */}
            {isImageLiveAnalysisActive && uploadedImage && (
              <div className="fixed inset-0 z-50 bg-black flex flex-col">
                {/* Image Display */}
                <div className="flex-1 relative overflow-hidden">
                  <img
                    src={uploadedImage.url}
                    className="w-full h-full object-contain"
                    alt="Analysis"
                  />

                  {/* Status Badge (top-left) */}
                  <div className="absolute top-4 left-4 z-30 flex items-center gap-2">
                    <div className="bg-purple-600/90 backdrop-blur text-white px-3 py-1.5 rounded-lg border border-purple-400 shadow-xl flex items-center space-x-2">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                      <span className="font-bold tracking-wider text-xs">IMAGE ANALYSIS ACTIVE</span>
                    </div>
                  </div>

                  {/* Counter (top-right) */}
                  <div className="absolute top-4 right-16 z-30 flex flex-col gap-2 items-end">
                    <div className="bg-black/60 backdrop-blur text-white px-3 py-1 rounded-lg border border-white/20 text-xs font-mono">
                      Exchange #{imageAnalysisCount}
                    </div>
                    {isImageAnalysisPending && (
                      <div className="bg-blue-600/80 backdrop-blur text-white px-3 py-1.5 rounded-lg border border-blue-400 flex items-center space-x-2 text-xs">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Analyzing...</span>
                      </div>
                    )}
                  </div>

                  {/* Close Button */}
                  <button
                    onClick={() => {
                      stopImageLiveAnalysis();
                      clearMedia(true);
                    }}
                    className="absolute top-4 right-4 z-30 p-3 rounded-full bg-black/50 text-white backdrop-blur-sm border border-white/20"
                  >
                    <Icons.Close size={24} />
                  </button>

                  {/* Guidance Overlay (bottom) */}
                  {imageLiveGuidance && (
                    <div className="absolute bottom-24 left-4 right-4 z-30">
                      <div className="bg-black/80 backdrop-blur-md text-white px-4 py-3 rounded-xl border border-white/20 shadow-xl">
                        <div className="flex items-start gap-2">
                          <ImageIcon size={18} className="text-purple-400 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm leading-relaxed"><MarkdownText content={imageLiveGuidance} /></p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Controls Bar */}
                <div className="shrink-0 p-4 bg-slate-900 border-t border-slate-700">
                  <div className="flex items-center justify-center gap-4">
                    {/* Ask Follow-up */}
                    <button
                      onClick={() => performImageLiveAnalysis()}
                      disabled={isImageAnalysisPending}
                      className="px-6 py-3 rounded-full bg-purple-500 text-white hover:bg-purple-600 shadow-lg transition-all font-medium flex items-center gap-2 disabled:opacity-50"
                    >
                      <Scan size={20} />
                      Ask for Next Step
                    </button>

                    {/* Stop Analysis */}
                    <button
                      onClick={() => {
                        stopImageLiveAnalysis();
                        clearMedia(true);
                      }}
                      className="p-4 rounded-full bg-red-500 text-white hover:bg-red-600 shadow-lg transition-all ring-4 ring-red-500/30"
                    >
                      <StopCircle size={24} />
                    </button>
                  </div>
                  <p className="text-center text-xs text-slate-400 mt-2">
                    Speak to ask questions or tap "Ask for Next Step"
                  </p>
                </div>
              </div>
            )}

            {/* RAG & Thinking Status */}
            {(isThinking || retrievingData) && (
              <div className="flex flex-col items-start gap-1">
                 {retrievingData && (
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider pl-2 flex items-center space-x-1 animate-pulse">
                        <Icons.Search size={10} />
                        <span>Searching Medical Knowledge Base...</span>
                    </div>
                 )}
                 {retrievedDoc && !retrievingData && (
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider pl-2 flex items-center space-x-1 mb-1">
                        <Icons.Check size={10} />
                        <span>RETRIEVED: {retrievedDoc}</span>
                    </div>
                 )}
                 {isThinking && (
                    <div className={`rounded-full px-4 py-2 text-xs font-medium flex items-center gap-2 ${isCritical ? 'bg-black/60 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>
                    <Icons.AI size={14} className="animate-spin" /> {uploadedVideo || uploadedImage ? "Analyzing media..." : "Thinking..."}
                    </div>
                 )}
              </div>
            )}
            <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Unified Input Bar - Hidden when camera active */}
      <div className={`shrink-0 p-3 sm:p-4 border-t z-30 transition-colors duration-300 safe-area-bottom ${
          isCameraActive ? 'hidden' : ''
        } ${
          isCritical
            ? 'bg-red-900/90 border-red-600'
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
        }`}>
          <div className="flex items-center gap-2 sm:gap-3 max-w-5xl mx-auto relative">
            
            {/* Camera Button with Menu */}
            <div className="relative">
                {activeMenu === 'camera' && (
                    <div onClick={(e) => e.stopPropagation()} className="absolute bottom-14 left-0 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-2 flex flex-col gap-2 w-40 z-50 animate-fade-in">
                        <button onClick={() => { setActiveMenu(null); setIsCameraActive(true); }} className="flex items-center gap-3 p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-200">
                            <Camera size={18} className="text-blue-500" /> Live Capture
                        </button>
                        <button onClick={() => { setActiveMenu(null); imageUploadRef.current?.click(); }} className="flex items-center gap-3 p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-200">
                            <ImageIcon size={18} className="text-purple-500" /> Upload Photo
                        </button>
                    </div>
                )}
                <button
                onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === 'camera' ? null : 'camera'); }}
                disabled={isThinking}
                className={`p-2.5 sm:p-3 rounded-full transition-all duration-300 flex-shrink-0 relative ${activeMenu === 'camera' || isCameraActive ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                >
                    {isCameraActive ? <Icons.CameraOff size={20} className="sm:w-6 sm:h-6" /> : <Icons.Camera size={20} className="sm:w-6 sm:h-6" />}
                </button>
            </div>

            {/* Video Button with Menu */}
            <div className="relative">
                {isRecordingVideo ? (
                    /* Recording Active - Show Stop Button */
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 bg-red-100 dark:bg-red-900/50 px-2 py-1 rounded-full">
                            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                            <span className="text-xs text-red-600 dark:text-red-400 font-medium">{recordingTime}s</span>
                        </div>
                        <button
                            onClick={stopVideoRecording}
                            className="p-2.5 sm:p-3 rounded-full bg-red-500 text-white hover:bg-red-600 transition-all"
                        >
                            <StopCircle size={20} className="sm:w-6 sm:h-6" />
                        </button>
                    </div>
                ) : (
                    /* Normal Menu */
                    <>
                        {activeMenu === 'video' && (
                            <div onClick={(e) => e.stopPropagation()} className="absolute bottom-14 left-0 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-2 flex flex-col gap-2 w-40 z-50 animate-fade-in">
                                <button onClick={() => { setActiveMenu(null); startVideoRecording(); }} className="flex items-center gap-3 p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-200">
                                    <VideoIcon size={18} className="text-red-500" /> Record Video
                                </button>
                                <button onClick={() => { setActiveMenu(null); videoUploadRef.current?.click(); }} className="flex items-center gap-3 p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-200">
                                    <Film size={18} className="text-orange-500" /> Upload Video
                                </button>
                            </div>
                        )}
                        <button
                            onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === 'video' ? null : 'video'); }}
                            disabled={isThinking}
                            className={`p-2.5 sm:p-3 rounded-full transition-all duration-300 flex-shrink-0 relative ${activeMenu === 'video' || uploadedVideo ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                        >
                            <VideoIcon size={20} className="sm:w-6 sm:h-6" />
                            {uploadedVideo && <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-white dark:border-slate-900"></div>}
                        </button>
                    </>
                )}
            </div>

            {/* Protocol PDF Button */}
            <button
              onClick={() => pdfInputRef.current?.click()}
              disabled={isThinking}
              className={`p-2.5 sm:p-3 rounded-full transition-all duration-300 flex-shrink-0 relative ${uploadedPdf ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
              title="Upload PDF Protocol"
            >
               <Icons.Report size={20} className="sm:w-6 sm:h-6" />
               {uploadedPdf && <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900"></div>}
            </button>

            {/* Live Analysis Button - Independent */}
            <button
              onClick={() => {
                if (isLiveAnalysisActive) {
                  stopLiveAnalysis();
                  setIsCameraActive(false);
                } else {
                  // Open camera and start live analysis
                  setIsCameraActive(true);
                  // Small delay to let camera initialize before starting analysis
                  setTimeout(() => {
                    startLiveAnalysis();
                  }, 1500);
                }
              }}
              disabled={isThinking}
              className={`p-2.5 sm:p-3 rounded-full transition-all duration-300 flex-shrink-0 relative ${
                isLiveAnalysisActive
                  ? 'bg-red-500 text-white animate-pulse ring-2 ring-red-500/50'
                  : 'bg-emerald-500 text-white hover:bg-emerald-600 ring-2 ring-emerald-500/30'
              }`}
              title={isLiveAnalysisActive ? "Stop Live Analysis" : "Start Live Analysis"}
            >
               {isLiveAnalysisActive ? <StopCircle size={20} className="sm:w-6 sm:h-6" /> : <Scan size={20} className="sm:w-6 sm:h-6" />}
            </button>

            <div className={`flex-1 rounded-xl sm:rounded-2xl flex items-center px-3 sm:px-4 py-1.5 sm:py-2 focus-within:ring-2 focus-within:ring-blue-500/50 transition-all ${isCritical ? 'bg-white/20 text-white placeholder-white/50' : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'}`}>
              <input type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()} placeholder={isMicActive ? "Listening..." : (isThinking ? "Thinking..." : (uploadedVideo || uploadedImage ? "Ask about media..." : "Type help..."))} disabled={isThinking} className={`w-full bg-transparent border-none focus:ring-0 text-sm sm:text-base py-1.5 sm:py-2 ${isCritical ? 'placeholder-slate-300' : 'placeholder-slate-400'}`} />
            </div>

            <button onClick={() => setIsMicActive(!isMicActive)} disabled={isThinking} className={`p-3 sm:p-4 rounded-full transition-all duration-300 transform active:scale-95 shadow-lg flex-shrink-0 ${isMicActive ? 'bg-red-500 text-white animate-pulse ring-4 ring-red-500/30' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
              {isMicActive ? <Icons.Mic size={22} className="sm:w-7 sm:h-7" /> : <Icons.MicOff size={22} className="sm:w-7 sm:h-7" />}
            </button>

            <button onClick={onEmergency} className="p-3 sm:p-4 rounded-full bg-red-600 text-white hover:bg-red-700 shadow-lg transition-all active:scale-95 ring-4 ring-red-600/20 flex-shrink-0">
              <Icons.Emergency size={22} className="sm:w-7 sm:h-7" />
            </button>

            {(inputValue.trim().length > 0 || uploadedVideo || uploadedImage) && !isThinking && (
               <button onClick={() => handleSendMessage()} className="p-2.5 sm:p-3 bg-slate-200 dark:bg-slate-700 rounded-full text-blue-600 dark:text-blue-400 flex-shrink-0">
                 <Icons.Send size={20} className="sm:w-6 sm:h-6" />
               </button>
            )}
          </div>
          <div className={`text-center mt-1.5 sm:mt-2 text-[11px] sm:text-xs flex items-center justify-center gap-2 ${isCritical ? 'text-slate-400' : 'text-slate-500'}`}>
             {isLiveAnalysisActive ? (
               <span className="flex items-center gap-1 text-emerald-500 font-bold animate-pulse">
                 <Scan size={12} /> LIVE ANALYSIS ACTIVE - Analysis #{analysisCount}
               </span>
             ) : isVideoLiveAnalysisActive ? (
               <span className="flex items-center gap-1 text-emerald-500 font-bold animate-pulse">
                 <VideoIcon size={12} /> VIDEO ANALYSIS ACTIVE - Analysis #{videoAnalysisCount}
               </span>
             ) : isImageLiveAnalysisActive ? (
               <span className="flex items-center gap-1 text-purple-500 font-bold animate-pulse">
                 <ImageIcon size={12} /> IMAGE ANALYSIS ACTIVE - Exchange #{imageAnalysisCount}
               </span>
             ) : uploadedPdf ? (
               <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">Protocol: {uploadedPdf.name} <button onClick={clearPdf} className="ml-1 hover:text-red-500"><Icons.Close size={12} /></button></span>
             ) : ( isMicActive ? "Hands-free voice mode active" : "Tap icons for options" )}
             <div className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-200 dark:border-blue-800/30 ml-2">
                <Icons.AI size={10} className="text-blue-500" /> <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400">Gemini 2.0 Flash (Cached)</span>
             </div>
          </div>
        </div>
    </div>
  );
};