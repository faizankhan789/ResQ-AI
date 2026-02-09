import React, { createContext, useContext, useState, useEffect } from 'react';

// Skill Categories
export type SkillCategory = 'CPR_ADULT' | 'CPR_CHILD' | 'CPR_INFANT' | 'CHOKING' |
  'BLEEDING' | 'BURNS' | 'FRACTURES' | 'STROKE' | 'HEART_ATTACK' | 'SHOCK' | 'UNCONSCIOUS';

export interface SkillScore {
  category: SkillCategory;
  accuracy: number; // 0-100
  speed: number; // 0-100
  lastPracticed: Date;
  practiceCount: number;
  mistakes: string[];
}

export interface LessonHistory {
  id: string;
  date: Date;
  category: SkillCategory;
  duration: number; // seconds
  score: number;
  completed: boolean;
}

export interface QuizResult {
  id: string;
  date: Date;
  category: SkillCategory;
  questionsAsked: number;
  correctAnswers: number;
  timeSpent: number;
}

export interface DrillResult {
  id: string;
  date: Date;
  scenario: string;
  category: SkillCategory;
  responseTime: number; // seconds
  correctActions: number;
  totalActions: number;
  criticalErrors: string[];
  score: number;
}

export interface UserProfile {
  userId: string;
  name: string;
  createdAt: Date;
  lastActive: Date;

  // Core Metrics
  readinessIndex: number; // 0-100
  streakDays: number;
  totalLessons: number;
  totalDrills: number;

  // Skill Tracking
  skillScores: SkillScore[];
  weakAreas: SkillCategory[];
  strongAreas: SkillCategory[];

  // History
  lessonHistory: LessonHistory[];
  quizHistory: QuizResult[];
  drillHistory: DrillResult[];

  // Learning Preferences
  voiceEnabled: boolean;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

interface LearningProfileContextType {
  profile: UserProfile;
  updateProfile: (updates: Partial<UserProfile>) => void;
  addLessonHistory: (lesson: LessonHistory) => void;
  addQuizResult: (quiz: QuizResult) => void;
  addDrillResult: (drill: DrillResult) => void;
  updateSkillScore: (category: SkillCategory, updates: Partial<SkillScore>) => void;
  calculateReadinessIndex: () => number;
  getNextLesson: () => SkillCategory;
  resetProfile: () => void;
}

const LearningProfileContext = createContext<LearningProfileContextType | undefined>(undefined);

const STORAGE_KEY = 'resq_learning_profile';

const DEFAULT_PROFILE: UserProfile = {
  userId: 'user_' + Date.now(),
  name: 'Emergency Responder',
  createdAt: new Date(),
  lastActive: new Date(),
  readinessIndex: 0,
  streakDays: 0,
  totalLessons: 0,
  totalDrills: 0,
  skillScores: [
    { category: 'CPR_ADULT', accuracy: 0, speed: 0, lastPracticed: new Date(), practiceCount: 0, mistakes: [] },
    { category: 'CPR_CHILD', accuracy: 0, speed: 0, lastPracticed: new Date(), practiceCount: 0, mistakes: [] },
    { category: 'CHOKING', accuracy: 0, speed: 0, lastPracticed: new Date(), practiceCount: 0, mistakes: [] },
    { category: 'BLEEDING', accuracy: 0, speed: 0, lastPracticed: new Date(), practiceCount: 0, mistakes: [] },
    { category: 'BURNS', accuracy: 0, speed: 0, lastPracticed: new Date(), practiceCount: 0, mistakes: [] },
    { category: 'HEART_ATTACK', accuracy: 0, speed: 0, lastPracticed: new Date(), practiceCount: 0, mistakes: [] },
  ],
  weakAreas: ['CPR_ADULT', 'CHOKING', 'BLEEDING'],
  strongAreas: [],
  lessonHistory: [],
  quizHistory: [],
  drillHistory: [],
  voiceEnabled: true,
  difficulty: 'beginner'
};

export const LearningProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<UserProfile>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert date strings back to Date objects
        parsed.createdAt = new Date(parsed.createdAt);
        parsed.lastActive = new Date(parsed.lastActive);
        parsed.lessonHistory = parsed.lessonHistory.map((l: any) => ({...l, date: new Date(l.date)}));
        parsed.quizHistory = parsed.quizHistory.map((q: any) => ({...q, date: new Date(q.date)}));
        parsed.drillHistory = parsed.drillHistory.map((d: any) => ({...d, date: new Date(d.date)}));
        parsed.skillScores = parsed.skillScores.map((s: any) => ({...s, lastPracticed: new Date(s.lastPracticed)}));
        return parsed;
      }
    } catch (e) {
      console.error('Failed to load profile:', e);
    }
    return DEFAULT_PROFILE;
  });

  // Save to localStorage whenever profile changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch (e) {
      console.error('Failed to save profile:', e);
    }
  }, [profile]);

  const updateProfile = (updates: Partial<UserProfile>) => {
    setProfile(prev => ({ ...prev, ...updates, lastActive: new Date() }));
  };

  const addLessonHistory = (lesson: LessonHistory) => {
    setProfile(prev => ({
      ...prev,
      lessonHistory: [...prev.lessonHistory, lesson],
      totalLessons: prev.totalLessons + 1,
      lastActive: new Date()
    }));
  };

  const addQuizResult = (quiz: QuizResult) => {
    setProfile(prev => ({
      ...prev,
      quizHistory: [...prev.quizHistory, quiz],
      lastActive: new Date()
    }));
  };

  const addDrillResult = (drill: DrillResult) => {
    setProfile(prev => ({
      ...prev,
      drillHistory: [...prev.drillHistory, drill],
      totalDrills: prev.totalDrills + 1,
      lastActive: new Date()
    }));
  };

  const updateSkillScore = (category: SkillCategory, updates: Partial<SkillScore>) => {
    setProfile(prev => {
      const existingIndex = prev.skillScores.findIndex(s => s.category === category);
      let newSkillScores = [...prev.skillScores];

      if (existingIndex >= 0) {
        newSkillScores[existingIndex] = { ...newSkillScores[existingIndex], ...updates };
      } else {
        newSkillScores.push({
          category,
          accuracy: 0,
          speed: 0,
          lastPracticed: new Date(),
          practiceCount: 0,
          mistakes: [],
          ...updates
        });
      }

      return { ...prev, skillScores: newSkillScores };
    });
  };

  const calculateReadinessIndex = (): number => {
    const { skillScores, totalLessons, totalDrills, streakDays } = profile;

    if (skillScores.length === 0) return 0;

    // Only count skills that have actually been practiced
    const practicedSkills = skillScores.filter(s => s.practiceCount > 0);

    // If no skills practiced yet, return 0
    if (practicedSkills.length === 0) return 0;

    // Average skill accuracy (only for practiced skills)
    const avgAccuracy = practicedSkills.reduce((sum, s) => sum + s.accuracy, 0) / practicedSkills.length;

    // Recency bonus (practiced in last 7 days) - only count actually practiced skills
    const recentPractice = practicedSkills.filter(s => {
      const daysSince = (Date.now() - s.lastPracticed.getTime()) / (1000 * 60 * 60 * 24);
      return daysSince <= 7;
    }).length;
    const recencyBonus = practicedSkills.length > 0 ? (recentPractice / practicedSkills.length) * 10 : 0;

    // Volume bonus
    const volumeBonus = Math.min(totalLessons * 0.5 + totalDrills * 1, 20);

    // Streak bonus
    const streakBonus = Math.min(streakDays * 2, 15);

    const index = Math.min(100, Math.round(avgAccuracy * 0.6 + recencyBonus + volumeBonus + streakBonus));

    return index;
  };

  const getNextLesson = (): SkillCategory => {
    // Prioritize weak areas
    if (profile.weakAreas.length > 0) {
      return profile.weakAreas[0];
    }

    // Find least practiced skill
    const allSkills: SkillCategory[] = ['CPR_ADULT', 'CPR_CHILD', 'CPR_INFANT', 'CHOKING',
      'BLEEDING', 'BURNS', 'FRACTURES', 'STROKE', 'HEART_ATTACK', 'SHOCK', 'UNCONSCIOUS'];

    let leastPracticed = allSkills[0];
    let minCount = Infinity;

    for (const skill of allSkills) {
      const score = profile.skillScores.find(s => s.category === skill);
      const count = score?.practiceCount || 0;
      if (count < minCount) {
        minCount = count;
        leastPracticed = skill;
      }
    }

    return leastPracticed;
  };

  const resetProfile = () => {
    setProfile(DEFAULT_PROFILE);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <LearningProfileContext.Provider value={{
      profile,
      updateProfile,
      addLessonHistory,
      addQuizResult,
      addDrillResult,
      updateSkillScore,
      calculateReadinessIndex,
      getNextLesson,
      resetProfile
    }}>
      {children}
    </LearningProfileContext.Provider>
  );
};

export const useLearningProfile = () => {
  const context = useContext(LearningProfileContext);
  if (!context) {
    throw new Error('useLearningProfile must be used within LearningProfileProvider');
  }
  return context;
};
