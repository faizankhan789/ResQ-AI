// Fix: Import React to resolve namespace error for React.ElementType
import React from 'react';

export type View = 'HOME' | 'INTERACTIVE' | 'LEARNING' | 'ANALYSIS' | 'BRIDGE' | 'REPORT';

export interface ModuleCardProps {
  id: View;
  label: string;
  subtitle: string;
  icon: React.ElementType;
  colorClass: string;
  onClick: (view: View) => void;
}

export interface AppState {
  currentView: View;
  isEmergencyActive: boolean;
  isCriticalMode: boolean; // New visual state
  aiStatus: 'ready' | 'thinking' | 'offline';
  connectivity: 'online' | 'offline';
  location: string | null;
}

export interface ChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: Date;
  type?: 'text' | 'audio' | 'action';
  attachment?: {
    type: 'image' | 'video';
    url: string;
  };
  actionStep?: {
    title: string;
    isCompleted: boolean;
  };
}

// Learning Mode Types
export interface UserProfile {
  name: string;
  readinessIndex: number; // 0-100
  streakDays: number;
  completedLessons: number;
  weakAreas: string[];
  history: {
    date: string;
    activity: string;
    score: number;
  }[];
}

export interface Lesson {
  id: string;
  topic: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  content: {
    title: string;
    steps: string[];
    visualCue: string;
    practicalTip: string;
  };
}

// Emergency Bridge Types
export interface EmergencyContact {
  id: string;
  name: string;
  relation: string;
  phone: string;
  notified: boolean;
}

// Medical Documentation System Types
export type EventType = 'USER_AUDIO' | 'AI_INSTRUCTION' | 'ACTION_LOG' | 'VITALS_LOG' | 'SYSTEM_ALERT' | 'VISUAL_OBSERVATION';

export interface TimelineEvent {
  id: string;
  timestamp: Date;
  type: EventType;
  description: string;
  metadata?: any;
}

export interface TriageReport {
  timestamp: string;
  condition: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  actionsTaken: string[];
  vitalsEstimate: {
    breathing: string;
    consciousness: string;
    bleeding: string;
  };
  summary: string;
  suggestedNextSteps?: string[];
  medications?: string[];
}