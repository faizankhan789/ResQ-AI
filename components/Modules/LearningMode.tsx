import React, { useState, useRef, useEffect } from 'react';
import { Icons } from '../Shared/Icons';
import { GoogleGenAI, Chat } from "@google/genai";
import { useLearningProfile, SkillCategory } from '../Context/LearningProfileContext';
import { MarkdownText } from '../Shared/MarkdownText';

interface LearningModeProps {
  onBack: () => void;
}

type Mode = 'DASHBOARD' | 'LESSON' | 'QUIZ' | 'DRILL' | 'ANALYTICS';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

const SKILL_LABELS: Record<SkillCategory, string> = {
  CPR_ADULT: 'Adult CPR',
  CPR_CHILD: 'Child CPR',
  CPR_INFANT: 'Infant CPR',
  CHOKING: 'Choking Response',
  BLEEDING: 'Bleeding Control & Tourniquets',
  BURNS: 'Burn Treatment',
  FRACTURES: 'Fracture Management',
  STROKE: 'Stroke Recognition',
  HEART_ATTACK: 'Heart Attack Response',
  SHOCK: 'Shock Treatment',
  UNCONSCIOUS: 'Unconscious Patient Care'
};

export const LearningMode: React.FC<LearningModeProps> = ({ onBack }) => {
  const {
    profile,
    addLessonHistory,
    addQuizResult,
    addDrillResult,
    updateSkillScore,
    calculateReadinessIndex,
    getNextLesson,
    updateProfile,
    resetProfile
  } = useLearningProfile();

  const [currentMode, setCurrentMode] = useState<Mode>('DASHBOARD');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const [currentCategory, setCurrentCategory] = useState<SkillCategory | null>(null);

  // Voice state
  const [isVoiceActive, setIsVoiceActive] = useState(profile.voiceEnabled);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Lesson state
  const [lessonStartTime, setLessonStartTime] = useState<number>(0);

  // Quiz state
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [quizScore, setQuizScore] = useState(0);

  // Drill state
  const [drillScenario, setDrillScenario] = useState('');
  const [drillActions, setDrillActions] = useState<string[]>([]);
  const [drillErrors, setDrillErrors] = useState<string[]>([]);
  const [drillStartTime, setDrillStartTime] = useState(0);

  const chatSessionRef = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Lifecycle Cleanup for Voice & Mode Switching
  useEffect(() => {
    // Cleanup function that runs on mode change AND unmount
    return () => {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e) {}
      }
    };
  }, [currentMode]); 

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Text-to-Speech
  const speak = (text: string) => {
    if (!isVoiceActive || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    setIsSpeaking(true);

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.onend = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  // Speech Recognition Setup
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition && isVoiceActive) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setUserInput(transcript);
        if (currentMode === 'DRILL') {
          handleDrillResponse(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          console.warn('Speech recognition error:', event.error);
        }
      };

      recognitionRef.current = recognition;
    }
  }, [isVoiceActive]);

  // Start voice listening
  const startListening = () => {
    if (recognitionRef.current && isVoiceActive) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.log('Recognition already started');
      }
    }
  };

  // ==============================================
  // LESSON MODE
  // ==============================================

  const startLesson = async (category?: SkillCategory) => {
    const skillCategory = category || getNextLesson();
    setCurrentCategory(skillCategory);
    setCurrentMode('LESSON');
    setIsLoading(true);
    setLessonStartTime(Date.now());
    setMessages([]);

    try {
      const apiKey = process.env.API_KEY;
      if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') {
        throw new Error('API key not configured');
      }

      const ai = new GoogleGenAI({ apiKey });
      chatSessionRef.current = ai.chats.create({
        model: 'gemini-2.0-flash',
        config: {
          systemInstruction: `You are an Emergency Medical Training Instructor.

USER LEVEL: ${profile.difficulty}
SKILL: ${SKILL_LABELS[skillCategory]}

Your job is to teach this emergency skill in a clear, step-by-step manner.

INSTRUCTIONS:
- Start with WHY this skill is life-saving
- Break down into 5-7 simple steps
- Use simple language for beginners, medical terminology for advanced
- After each step, ask "Do you understand? Say yes to continue."
- At the end, quiz the user with 3 critical questions
- Use encouraging tone
- Focus on muscle memory and pattern recognition

RESPONSE FORMAT:
- Keep responses short (2-3 sentences per step)
- Number your steps clearly
- Wait for user confirmation before continuing
- If user seems confused, explain again differently`
        }
      });

      const response = await chatSessionRef.current.sendMessage({
        message: `Teach me ${SKILL_LABELS[skillCategory]}. I am a ${profile.difficulty} learner. Start the lesson now.`
      } as any);

      const content = response.text || 'Starting lesson...';

      setMessages([{
        id: '1',
        role: 'assistant',
        content,
        timestamp: new Date()
      }]);

      speak(content);

    } catch (error) {
      console.error('Lesson init error:', error);
      setMessages([{
        id: 'error',
        role: 'system',
        content: 'Failed to start lesson. Please check your API key configuration.',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const sendLessonMessage = async () => {
    if (!userInput.trim() || !chatSessionRef.current) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userInput,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setUserInput('');
    setIsLoading(true);

    try {
      const response = await chatSessionRef.current.sendMessage({
        message: userInput
      } as any);

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.text || 'Continue...',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMsg]);
      speak(assistantMsg.content);

      // Check if lesson is complete
      if (response.text?.toLowerCase().includes('quiz') ||
          response.text?.toLowerCase().includes('test your knowledge')) {
        setTimeout(() => completeLesson(), 2000);
      }

    } catch (error) {
      console.error('Lesson error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const completeLesson = () => {
    const duration = Math.floor((Date.now() - lessonStartTime) / 1000);

    if (currentCategory) {
      addLessonHistory({
        id: Date.now().toString(),
        date: new Date(),
        category: currentCategory,
        duration,
        score: 80, // Base score
        completed: true
      });

      updateSkillScore(currentCategory, {
        lastPracticed: new Date(),
        practiceCount: (profile.skillScores.find(s => s.category === currentCategory)?.practiceCount || 0) + 1
      });
    }

    // Move to quiz
    startQuiz(currentCategory!);
  };

  // ==============================================
  // QUIZ MODE (Knowledge Reinforcement)
  // ==============================================

  const startQuiz = async (category: SkillCategory) => {
    setCurrentMode('QUIZ');
    setIsLoading(true);
    setQuizScore(0);
    setCurrentQuestion(0);

    try {
      const apiKey = process.env.API_KEY;
      if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') {
        throw new Error('API key not configured');
      }

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: `Generate 5 critical multiple-choice questions about ${SKILL_LABELS[category]}.

Focus on:
- Life-saving decision points
- Common mistakes
- Critical timing
- Recognition of danger signs

FORMAT (JSON):
{
  "questions": [
    {
      "question": "What is the first step when you find an unconscious adult?",
      "options": ["Check breathing", "Call 911", "Start CPR", "Check pulse"],
      "correctIndex": 1,
      "explanation": "Always call 911 first to get professional help on the way"
    }
  ]
}`,
        config: { responseMimeType: "application/json" }
      });

      const data = JSON.parse(response.text);
      setQuizQuestions(data.questions || []);

      if (data.questions && data.questions.length > 0) {
        speak(data.questions[0].question);
      }

    } catch (error) {
      console.error('Quiz generation error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const answerQuiz = (selectedIndex: number) => {
    if (!quizQuestions[currentQuestion]) return;

    const question = quizQuestions[currentQuestion];
    const isCorrect = selectedIndex === question.correctIndex;
    const nextQuestionIndex = currentQuestion + 1;

    if (isCorrect) {
      setQuizScore(prev => prev + 1);
      speak('Correct! ' + question.explanation);
    } else {
      speak('Incorrect. The correct answer is: ' + question.options[question.correctIndex] + '. ' + question.explanation);
    }

    setTimeout(() => {
      if (nextQuestionIndex < quizQuestions.length) {
        setCurrentQuestion(nextQuestionIndex);
        if (quizQuestions[nextQuestionIndex]) {
          speak(quizQuestions[nextQuestionIndex].question);
        }
      } else {
        completeQuiz();
      }
    }, 3000);
  };

  const completeQuiz = () => {
    if (currentCategory) {
      const accuracy = (quizScore / quizQuestions.length) * 100;

      addQuizResult({
        id: Date.now().toString(),
        date: new Date(),
        category: currentCategory,
        questionsAsked: quizQuestions.length,
        correctAnswers: quizScore,
        timeSpent: 0
      });

      updateSkillScore(currentCategory, {
        accuracy: Math.round(accuracy)
      });

      // Update readiness index
      const newIndex = calculateReadinessIndex();
      updateProfile({ readinessIndex: newIndex });
    }

    speak(`Quiz complete! You scored ${quizScore} out of ${quizQuestions.length}.`);

    setTimeout(() => {
      setCurrentMode('DASHBOARD');
    }, 3000);
  };

  // ==============================================
  // DRILL MODE (Emergency Simulation)
  // ==============================================

  const startDrill = async () => {
    const category = getNextLesson();
    setCurrentCategory(category);
    setCurrentMode('DRILL');
    setIsLoading(true);
    setDrillActions([]);
    setDrillErrors([]);
    setDrillStartTime(Date.now());
    setMessages([]);

    try {
      const apiKey = process.env.API_KEY;
      if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') {
        throw new Error('API key not configured');
      }

      const ai = new GoogleGenAI({ apiKey });
      chatSessionRef.current = ai.chats.create({
        model: 'gemini-2.0-flash',
        config: {
          systemInstruction: `You are acting as an EMERGENCY VICTIM in a medical simulation.

SCENARIO TYPE: ${SKILL_LABELS[category]}

RULES:
- Act as a real patient in distress
- Respond to the user's questions and actions
- Use *actions* for physical descriptions (e.g., *coughing*, *gasping*)
- If user makes a CRITICAL ERROR, immediately interrupt with "CRITICAL ERROR: [explanation]"
- If user is correct, describe how the patient improves
- Track user's performance internally
- When scenario is complete, say "SCENARIO COMPLETE" and give score

BEHAVIOR:
- Start by describing visible symptoms
- React realistically to user's actions
- Get worse if user delays or makes mistakes
- Improve if user does correct actions
- Keep responses SHORT (1-2 sentences)
- Use emotional language to create urgency`
        }
      });

      const response = await chatSessionRef.current.sendMessage({
        message: 'START_SIMULATION'
      } as any);

      const content = response.text || 'Simulation starting...';
      const scenario = content;

      setDrillScenario(scenario);
      setMessages([{
        id: '1',
        role: 'assistant',
        content,
        timestamp: new Date()
      }]);

      speak(content);

    } catch (error) {
      console.error('Drill init error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrillResponse = async (response: string) => {
    if (!chatSessionRef.current || !response.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: response,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setDrillActions(prev => [...prev, response]);
    setUserInput(''); // Clear input after sending

    try {
      const aiResponse = await chatSessionRef.current.sendMessage({
        message: response
      } as any);

      const content = aiResponse.text || '';

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMsg]);
      speak(content);

      // Check for critical error
      if (content.includes('CRITICAL ERROR')) {
        setDrillErrors(prev => [...prev, content]);
      }

      // Check if scenario complete
      if (content.includes('SCENARIO COMPLETE')) {
        completeDrill();
      }

    } catch (error) {
      console.error('Drill error:', error);
    }
  };

  const completeDrill = () => {
    const responseTime = Math.floor((Date.now() - drillStartTime) / 1000);
    const totalActions = drillActions.length;
    const criticalErrors = drillErrors.length;
    const correctActions = totalActions - criticalErrors;
    const score = Math.max(0, Math.round((correctActions / totalActions) * 100));

    if (currentCategory) {
      addDrillResult({
        id: Date.now().toString(),
        date: new Date(),
        scenario: drillScenario,
        category: currentCategory,
        responseTime,
        correctActions,
        totalActions,
        criticalErrors: drillErrors,
        score
      });

      updateSkillScore(currentCategory, {
        speed: Math.max(0, 100 - responseTime),
        accuracy: score
      });

      // Update readiness index
      const newIndex = calculateReadinessIndex();
      updateProfile({ readinessIndex: newIndex });
    }

    setTimeout(() => {
      setCurrentMode('DASHBOARD');
    }, 3000);
  };

  // ==============================================
  // RENDER METHODS
  // ==============================================

  const renderDashboard = () => {
    const readinessIndex = calculateReadinessIndex();

    return (
      <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-4 space-y-6 animate-fade-in pb-32">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Training Center</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Build life-saving skills daily</p>
          </div>
          <button
            onClick={() => setIsVoiceActive(!isVoiceActive)}
            className={`p-2 rounded-full ${isVoiceActive ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-slate-100 dark:bg-slate-800'}`}
          >
            {isVoiceActive ? <Icons.Volume size={20} className="text-blue-600 dark:text-blue-400" /> : <Icons.MicOff size={20} className="text-slate-500" />}
          </button>
        </div>

        {/* Readiness Index Card */}
        <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Icons.Trophy size={120} />
          </div>
          {/* Reset Button - Top Right */}
          <button
            onClick={() => {
              if (window.confirm('Reset all learning progress? This cannot be undone.')) {
                resetProfile();
              }
            }}
            className="absolute top-3 right-3 z-20 p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white/80 hover:text-white transition-all text-xs font-medium"
            title="Reset Progress"
          >
            <Icons.Close size={16} />
          </button>
          <div className="relative z-10">
            <h2 className="text-white/80 text-xs font-bold uppercase tracking-widest mb-1">Emergency Readiness Index</h2>
            <div className="flex items-baseline space-x-2 mb-4">
              <span className="text-5xl font-black">{readinessIndex}</span>
              <span className="text-xl text-white/80">/100</span>
            </div>
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center space-x-1">
                <Icons.Education size={16} />
                <span>{profile.totalLessons} lessons</span>
              </div>
              <div className="flex items-center space-x-1">
                <Icons.Trophy size={16} />
                <span>{profile.totalDrills} drills</span>
              </div>
              <div className="flex items-center space-x-1">
                <Icons.Target size={16} />
                <span>{profile.streakDays} day streak</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => startLesson()}
            disabled={isLoading}
            className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-6 rounded-2xl flex flex-col items-start hover:shadow-lg transition-all text-left"
          >
            <div className="bg-emerald-100 dark:bg-emerald-800 p-3 rounded-xl mb-4 text-emerald-600 dark:text-emerald-300">
              <Icons.Education size={24} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Daily Lesson</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-3">
              Next: {SKILL_LABELS[getNextLesson()]}
            </p>
            <span className="text-xs font-bold bg-white dark:bg-slate-900 px-2 py-1 rounded text-emerald-600 border border-emerald-200">
              5-10 MIN
            </span>
          </button>

          <button
            onClick={startDrill}
            disabled={isLoading}
            className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 p-6 rounded-2xl flex flex-col items-start hover:shadow-lg transition-all text-left"
          >
            <div className="bg-purple-100 dark:bg-purple-800 p-3 rounded-xl mb-4 text-purple-600 dark:text-purple-300">
              <Icons.Play size={24} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Emergency Drill</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-3">
              Realistic simulation
            </p>
            <span className="text-xs font-bold bg-white dark:bg-slate-900 px-2 py-1 rounded text-purple-600 border border-purple-200">
              AI ROLEPLAY
            </span>
          </button>

          <button
            onClick={() => setCurrentMode('ANALYTICS')}
            className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-6 rounded-2xl flex flex-col items-start hover:shadow-lg transition-all text-left"
          >
            <div className="bg-blue-100 dark:bg-blue-800 p-3 rounded-xl mb-4 text-blue-600 dark:text-blue-300">
              <Icons.Chart size={24} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Analytics</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-3">
              View progress
            </p>
            <span className="text-xs font-bold bg-white dark:bg-slate-900 px-2 py-1 rounded text-blue-600 border border-blue-200">
              INSIGHTS
            </span>
          </button>
        </div>

        {/* Weak Areas */}
        {profile.weakAreas.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center space-x-2 mb-4">
              <Icons.Target className="text-red-500" size={20} />
              <h3 className="font-bold text-slate-900 dark:text-white">Priority Focus Areas</h3>
            </div>
            <div className="space-y-3">
              {profile.weakAreas.slice(0, 3).map((area, idx) => (
                <button
                  key={idx}
                  onClick={() => startLesson(area)}
                  className="w-full flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
                >
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {SKILL_LABELS[area]}
                  </span>
                  <Icons.Play size={16} className="text-red-500" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderLesson = () => (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 p-4 bg-emerald-600 text-white shadow-lg z-10 flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2 text-emerald-100 text-xs font-bold uppercase tracking-wider mb-1">
            <Icons.Education size={14} />
            <span>AI Instructor • {profile.difficulty}</span>
          </div>
          <h1 className="text-xl font-black leading-tight">
            {currentCategory && SKILL_LABELS[currentCategory]}
          </h1>
        </div>
        <button
          onClick={() => setCurrentMode('DASHBOARD')}
          className="p-2 bg-emerald-700 rounded-full hover:bg-emerald-800 transition-colors"
        >
          <Icons.Back size={20} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-950">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] p-4 rounded-2xl ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-none shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-bl-none shadow-sm'
              }`}
            >
              <p className="text-sm leading-relaxed whitespace-pre-wrap"><MarkdownText content={msg.content} /></p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-200 dark:bg-slate-800 px-4 py-2 rounded-full text-xs flex items-center gap-2 animate-pulse">
              <Icons.AI size={14} className="animate-spin" />
              <span>Instructor thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input - Gemini Style */}
      <div className="shrink-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 pb-6">
        <div className="max-w-3xl mx-auto relative">
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-full px-2 py-2 border border-transparent focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 transition-all">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendLessonMessage()}
              placeholder="Type your response..."
              className="flex-1 bg-transparent border-none focus:ring-0 text-sm px-4 py-2 text-slate-900 dark:text-white placeholder-slate-500"
            />
            
            {isVoiceActive && (
               <button
                 onClick={startListening}
                 className="p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 rounded-full transition-colors"
               >
                 <Icons.Mic size={20} />
               </button>
            )}

            <button
              onClick={sendLessonMessage}
              disabled={!userInput.trim()}
              className={`p-2 rounded-full transition-all ${
                 userInput.trim() 
                   ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md transform active:scale-95' 
                   : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Icons.Send size={18} />
            </button>
          </div>
          <div className="text-center mt-2">
            <p className="text-[10px] text-slate-400 dark:text-slate-500">
               AI can make mistakes. Verify critical medical info.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderQuiz = () => {
    if (!quizQuestions[currentQuestion]) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-500">Generating questions...</p>
          </div>
        </div>
      );
    }

    const question = quizQuestions[currentQuestion];

    return (
      <div className="flex-1 overflow-y-auto bg-gradient-to-br from-blue-50 to-purple-50 dark:from-slate-900 dark:to-slate-800 p-6 flex flex-col justify-center">
        <div className="max-w-2xl mx-auto w-full">
          <div className="mb-8 text-center">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Question {currentQuestion + 1} of {quizQuestions.length}
            </span>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-2 leading-snug">
              {question.question}
            </h2>
          </div>

          <div className="space-y-3">
            {question.options.map((option: string, idx: number) => (
              <button
                key={idx}
                onClick={() => answerQuiz(idx)}
                className="w-full p-4 rounded-xl text-left font-medium transition-all border-2 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
              >
                {option}
              </button>
            ))}
          </div>

          <div className="mt-8 text-center text-sm text-slate-500">
            Score: {quizScore} / {currentQuestion}
          </div>
        </div>
      </div>
    );
  };

  const renderDrill = () => (
    <div className="flex flex-col h-full bg-red-950 overflow-hidden">
      {/* Emergency Header */}
      <div className="shrink-0 p-4 bg-red-900 text-white shadow-lg z-10 flex items-center justify-between border-b-4 border-red-600">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-red-400 rounded-full animate-pulse"></div>
          <span className="font-bold text-sm tracking-wider">LIVE SIMULATION</span>
        </div>
        <button
          onClick={() => setCurrentMode('DASHBOARD')}
          className="p-2 bg-red-800 rounded-full hover:bg-red-700 transition-colors"
        >
          <Icons.Back size={20} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] p-4 rounded-2xl ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-none shadow-md'
                  : 'bg-white/90 text-slate-800 rounded-bl-none backdrop-blur shadow-md'
              }`}
            >
              {msg.role === 'assistant' && (
                <span className="block text-xs font-bold text-red-600 mb-1 uppercase tracking-wider">
                  Patient
                </span>
              )}
              <p className="text-sm leading-relaxed"><MarkdownText content={msg.content} /></p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input - Gemini Style Dark Mode */}
      <div className="shrink-0 bg-slate-900 border-t border-red-800 p-4 pb-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2 bg-slate-800 rounded-full px-2 py-2 border border-red-900/50 focus-within:border-red-500 focus-within:ring-1 focus-within:ring-red-500 transition-all">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleDrillResponse(userInput)}
              placeholder="What do you do? Speak or type..."
              className="flex-1 bg-transparent border-none focus:ring-0 text-sm px-4 py-2 text-white placeholder-slate-400"
            />
            {isVoiceActive && (
               <button
                 onClick={startListening}
                 className="p-2 text-red-500 hover:bg-red-900/30 rounded-full transition-colors"
               >
                 <Icons.Mic size={20} />
               </button>
            )}
            <button
              onClick={() => handleDrillResponse(userInput)}
              disabled={!userInput.trim()}
              className={`p-2 rounded-full transition-all ${
                 userInput.trim()
                   ? 'bg-red-600 text-white hover:bg-red-700 shadow-md transform active:scale-95'
                   : 'bg-slate-700 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Icons.Send size={18} />
            </button>
          </div>
          <div className="text-center mt-2">
            <p className="text-[10px] text-slate-500">
               Simulation Mode. Responses may vary.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAnalytics = () => (
    <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-900 pb-20">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 z-10">
        <button
          onClick={() => setCurrentMode('DASHBOARD')}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
        >
          <Icons.Back size={20} />
        </button>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Performance Analytics</h1>
        <div className="w-10"></div>
      </div>

      <div className="p-4 space-y-6">
        {/* Overall Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
            <div className="text-3xl font-black text-blue-600 dark:text-blue-400">
              {calculateReadinessIndex()}
            </div>
            <div className="text-xs font-bold text-slate-600 dark:text-slate-400 mt-1">
              Readiness Index
            </div>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800">
            <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
              {profile.totalLessons}
            </div>
            <div className="text-xs font-bold text-slate-600 dark:text-slate-400 mt-1">
              Lessons
            </div>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-xl border border-purple-200 dark:border-purple-800">
            <div className="text-3xl font-black text-purple-600 dark:text-purple-400">
              {profile.totalDrills}
            </div>
            <div className="text-xs font-bold text-slate-600 dark:text-slate-400 mt-1">
              Drills
            </div>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-200 dark:border-amber-800">
            <div className="text-3xl font-black text-amber-600 dark:text-amber-400">
              {profile.streakDays}
            </div>
            <div className="text-xs font-bold text-slate-600 dark:text-slate-400 mt-1">
              Day Streak
            </div>
          </div>
        </div>

        {/* Skill Breakdown */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
          <h3 className="font-bold text-slate-900 dark:text-white mb-4">Skill Proficiency</h3>
          <div className="space-y-3">
            {profile.skillScores.length === 0 ? (
              <p className="text-slate-500 dark:text-slate-400 text-sm text-center py-4">
                Complete lessons to track your skills
              </p>
            ) : (
              profile.skillScores.map((skill, idx) => (
                <div key={idx}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {SKILL_LABELS[skill.category]}
                    </span>
                    <span className={`font-medium ${skill.accuracy >= 70 ? 'text-emerald-600' : skill.accuracy > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                      {skill.accuracy > 0 ? `${skill.accuracy}%` : 'Not started'}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        skill.accuracy >= 70 ? 'bg-gradient-to-r from-emerald-500 to-green-500' :
                        skill.accuracy > 0 ? 'bg-gradient-to-r from-amber-500 to-orange-500' :
                        'bg-slate-300 dark:bg-slate-600'
                      }`}
                      style={{ width: `${Math.max(skill.accuracy, 5)}%` }}
                    ></div>
                  </div>
                  {skill.practiceCount > 0 && (
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Practiced {skill.practiceCount} time{skill.practiceCount > 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
          <h3 className="font-bold text-slate-900 dark:text-white mb-4">Recent Activity</h3>
          {profile.lessonHistory.length === 0 ? (
            <div className="text-center py-8">
              <Icons.Education size={48} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400 text-sm">No lessons completed yet</p>
              <button
                onClick={() => { setCurrentMode('DASHBOARD'); setTimeout(() => startLesson(), 100); }}
                className="mt-4 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
              >
                Start Your First Lesson
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {profile.lessonHistory.slice(-5).reverse().map((lesson, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                      <Icons.Education size={16} className="text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-900 dark:text-white">
                        {SKILL_LABELS[lesson.category]}
                      </div>
                      <div className="text-xs text-slate-500">
                        {new Date(lesson.date).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    {lesson.score}%
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Drill History */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
          <h3 className="font-bold text-slate-900 dark:text-white mb-4">Drill Performance</h3>
          {profile.drillHistory.length === 0 ? (
            <div className="text-center py-8">
              <Icons.Play size={48} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400 text-sm">No drills completed yet</p>
              <button
                onClick={() => { setCurrentMode('DASHBOARD'); setTimeout(() => startDrill(), 100); }}
                className="mt-4 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
              >
                Start Your First Drill
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {profile.drillHistory.slice(-5).reverse().map((drill, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                      <Icons.Play size={16} className="text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-900 dark:text-white">
                        {SKILL_LABELS[drill.category]}
                      </div>
                      <div className="text-xs text-slate-500">
                        {new Date(drill.date).toLocaleDateString()} • {drill.responseTime}s response
                      </div>
                    </div>
                  </div>
                  <div className={`text-xs font-bold ${drill.score >= 70 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {drill.score}%
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reset Progress */}
        <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-2xl border border-red-200 dark:border-red-800">
          <h3 className="font-bold text-red-700 dark:text-red-400 mb-2">Reset Progress</h3>
          <p className="text-sm text-red-600 dark:text-red-300 mb-4">
            This will reset your readiness index, lesson history, quiz results, and drill performance. This action cannot be undone.
          </p>
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to reset all your learning progress? This cannot be undone.')) {
                resetProfile();
                setCurrentMode('DASHBOARD');
              }
            }}
            className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
          >
            Reset All Progress
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full h-full bg-slate-50 dark:bg-slate-950 flex flex-col animate-fade-in relative z-20 overflow-hidden">
      {/* Main Header (Only on Dashboard) */}
      {currentMode === 'DASHBOARD' && (
        <div className="shrink-0 p-2 z-30 bg-slate-50 dark:bg-slate-950">
          <button
            onClick={onBack}
            className="flex items-center space-x-2 text-slate-600 dark:text-slate-400 px-2 py-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800"
          >
            <Icons.Back size={20} />
            <span className="font-medium text-sm">Back to Home</span>
          </button>
        </div>
      )}

      {/* Content View Switcher - Uses Flex-1 to fill remaining space */}
      <div className="flex-1 w-full flex flex-col min-h-0">
        {currentMode === 'DASHBOARD' && renderDashboard()}
        {currentMode === 'LESSON' && renderLesson()}
        {currentMode === 'QUIZ' && renderQuiz()}
        {currentMode === 'DRILL' && renderDrill()}
        {currentMode === 'ANALYTICS' && renderAnalytics()}
      </div>
    </div>
  );
};