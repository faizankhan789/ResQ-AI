import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { TimelineEvent, TriageReport, EventType } from '../../types';
import { GoogleGenAI } from "@google/genai";

interface MedicalReportContextType {
  timeline: TimelineEvent[];
  currentReport: TriageReport | null;
  isGeneratingReport: boolean;
  logEvent: (type: EventType, description: string, metadata?: any) => void;
  generateLiveReport: () => Promise<void>;
  clearReport: () => void;
}

const MedicalReportContext = createContext<MedicalReportContextType | undefined>(undefined);

export const MedicalReportProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [currentReport, setCurrentReport] = useState<TriageReport | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // Auto-generate report disabled to reduce API rate limiting
  // Can be manually triggered via generateLiveReport() if needed
  // useEffect(() => {
  //   if (timeline.length > 0 && timeline.length % 5 === 0) {
  //     generateLiveReport();
  //   }
  // }, [timeline.length]);

  const logEvent = useCallback((type: EventType, description: string, metadata?: any) => {
    const newEvent: TimelineEvent = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      type,
      description,
      metadata
    };
    setTimeline(prev => [...prev, newEvent]);
  }, []);

  const clearReport = useCallback(() => {
    setTimeline([]);
    setCurrentReport(null);
  }, []);

  const generateLiveReport = async () => {
    setIsGeneratingReport(true);

    try {
      const apiKey = process.env.API_KEY;
      if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') {
        console.warn("Medical Report: API Key missing.");
        setIsGeneratingReport(false);
        return;
      }

      // Handle empty timeline case
      const timelineStr = timeline.length > 0 
        ? timeline.map(e => `[${e.timestamp.toLocaleTimeString()}] ${e.type}: ${e.description}`).join('\n')
        : "[System] Session started. No medical events recorded yet.";

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: `You are an automated medical scribe. Review this incident timeline and generate a Paramedic Handoff Report.
        
        TIMELINE:
        ${timelineStr}
        
        OUTPUT FORMAT (JSON):
        {
          "condition": "Suspected primary medical condition (or 'Assessment Pending')",
          "severity": "LOW/MEDIUM/HIGH/CRITICAL",
          "actionsTaken": ["List of interventions performed"],
          "vitalsEstimate": {
            "breathing": "Observation based on logs",
            "consciousness": "Observation based on logs",
            "bleeding": "Observation based on logs"
          },
          "summary": "30-word EMS handoff summary. Chronological and professional.",
          "suggestedNextSteps": ["Step 1", "Step 2"],
          "medications": ["Mention only if relevant first aid meds (aspirin, epi-pen) were discussed"]
        }`,
        config: { responseMimeType: "application/json" }
      });

      const text = response.text;
      if (text) {
        const data = JSON.parse(text);
        setCurrentReport({
          ...data,
          timestamp: new Date().toLocaleTimeString()
        });
      }
    } catch (e) {
      console.error("Report Generation Failed", e);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  return (
    <MedicalReportContext.Provider value={{ 
      timeline, 
      currentReport, 
      isGeneratingReport, 
      logEvent, 
      generateLiveReport,
      clearReport
    }}>
      {children}
    </MedicalReportContext.Provider>
  );
};

export const useMedicalReport = () => {
  const context = useContext(MedicalReportContext);
  if (!context) {
    throw new Error('useMedicalReport must be used within a MedicalReportProvider');
  }
  return context;
};