/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Volume2, Square, Info, History, Trash2, Cpu, User, X, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";

// Initialize Gemini Client
const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || "" 
});

// --- Types ---
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface UserProfile {
  name: string;
  preferences: string;
}

// Check for STT support
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export default function App() {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isHindi, setIsHindi] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('nova_user_profile');
    return saved ? JSON.parse(saved) : { name: '', preferences: '' };
  });

  const [tempProfile, setTempProfile] = useState<UserProfile>(userProfile);

  // --- Persistence ---
  useEffect(() => {
    localStorage.setItem('nova_user_profile', JSON.stringify(userProfile));
  }, [userProfile]);

  const recognitionRef = useRef<any>(null);
  const synthesisRef = useRef<SpeechSynthesisUtterance | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- Speech Synthesis Helper ---
  const speak = useCallback((text: string) => {
    // Cancel ongoing speech
    window.speechSynthesis.cancel();

    // Basic cleanup for voice: remove markdown bold/italic markers
    const cleanText = text.replace(/[*#_~`]/g, '');

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.volume = 1;
    utterance.rate = 1.1;
    utterance.pitch = 1;
    
    // Select a pleasant voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.name.includes('Google') || v.name.includes('Female')) || voices[0];
    if (preferredVoice) utterance.voice = preferredVoice;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    synthesisRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, []);

  // --- First Load Welcome ---
  useEffect(() => {
    const hasWelcomed = sessionStorage.getItem('nova_welcomed');
    if (!hasWelcomed) {
      const welcomeText = isHindi 
        ? "नमस्ते, मैं अमोद एमजे एआई हूँ, आपका व्यक्तिगत सहायक, जिसे अमोद राजपुत द्वारा बनाया गया है। मैं आज आपकी कैसे मदद कर सकता हूँ?"
        : "Hello, I am Amod MJ AI, your personal assistant, created by Amod Rajpoot. How can I help you today?";
      
      // Delay slightly to ensure voices are loaded
      setTimeout(() => {
        speak(welcomeText);
        setMessages([{
          id: 'welcome',
          role: 'assistant',
          content: welcomeText,
          timestamp: new Date()
        }]);
      }, 1000);
      
      sessionStorage.setItem('nova_welcomed', 'true');
    }
  }, [speak, isHindi]);

  // --- Scroll to Bottom ---
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // --- Speech Recognition Logic ---
  const handleResult = useCallback(async (event: any) => {
    const current = event.resultIndex;
    const resultTranscript = event.results[current][0].transcript;
    setTranscript(resultTranscript);

    if (event.results[current].isFinal) {
      setIsListening(false);
      setIsProcessing(true);
      
      const userMessage: Message = {
        id: Math.random().toString(36).substring(7),
        role: 'user',
        content: resultTranscript,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, userMessage]);

      const lowerText = resultTranscript.toLowerCase();

      // --- Local Command Handling ---
      if (lowerText.includes('time')) {
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const namePart = userProfile.name ? `${userProfile.name}, ` : '';
        const response = isHindi 
          ? `ज़रूर, ${namePart}अभी समय ${timeStr} है।` 
          : `Of course, ${namePart}it's currently ${timeStr}.`;
        
        const assistantMessage: Message = {
          id: Math.random().toString(36).substring(7),
          role: 'assistant',
          content: response,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, assistantMessage]);
        speak(response);
        setIsProcessing(false);
        return;
      }

      if (lowerText.includes('open youtube')) {
        const namePart = userProfile.name ? `${userProfile.name}, ` : '';
        const response = isHindi 
          ? `निश्चित रूप से, ${namePart}मैं आपके लिए यूट्यूब खोल रहा हूँ।` 
          : `Sure thing, ${namePart}I'm opening YouTube for you right now.`;
        window.open('https://www.youtube.com', '_blank');
        
        const assistantMessage: Message = {
          id: Math.random().toString(36).substring(7),
          role: 'assistant',
          content: response,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, assistantMessage]);
        speak(response);
        setIsProcessing(false);
        return;
      }

      if (lowerText.includes('call ')) {
        const contactName = resultTranscript.toLowerCase().split('call ')[1];
        const namePart = userProfile.name ? `${userProfile.name}, ` : '';
        const response = isHindi 
          ? `ठीक है, ${namePart}${contactName || 'कॉन्टैक्ट'} को कॉल लगा रहा हूँ।` 
          : `Got it, ${namePart}I'm starting a call to ${contactName || 'the contact'} for you.`;
        
        const assistantMessage: Message = {
          id: Math.random().toString(36).substring(7),
          role: 'assistant',
          content: response,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, assistantMessage]);
        speak(response);
        setIsProcessing(false);
        return;
      }

      try {
        let systemPrompt = `You are Amod MJ AI, a helpful and friendly voice assistant created by Amod Rajpoot. 
        Tone: Conversational, warm, and brief.
        Formatting Rules for Voice:
        1. Use short, simple sentences.
        2. Use plain, everyday vocabulary.
        3. Convert symbols to words (e.g., use "dollars" instead of "$").
        4. Avoid bullet points, lists, or complex markdown.
        5. Use conversational fillers like "Sure," "Got it," or "Okay" to feel more natural.
        6. Always introduce yourself as Amod MJ AI, created by Amod Rajpoot, when asked who you are.
        7. If responding in Hindi, maintain a polite and natural flow.`;
        
        if (userProfile?.name) {
          systemPrompt += ` The user's name is ${userProfile.name}. Address them personally when it feels natural, but don't overdo it.`;
        }
        if (userProfile?.preferences) {
          systemPrompt += ` User preferences: ${userProfile.preferences}. Respect these in your tone and content.`;
        }

        const result = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: resultTranscript,
          config: {
            systemInstruction: systemPrompt
          }
        });
        
        const aiResponse = result.text || "I'm sorry, I couldn't process that.";
        
        const assistantMessage: Message = {
          id: Math.random().toString(36).substring(7),
          role: 'assistant',
          content: aiResponse,
          timestamp: new Date(),
        };
        
        setMessages(prev => [...prev, assistantMessage]);
        speak(aiResponse);
      } catch (err) {
        setError('Connection to Nova lost. Please try again.');
        console.error(err);
      } finally {
        setIsProcessing(false);
      }
    }
  }, [speak]);

  useEffect(() => {
    if (!SpeechRecognition) {
      setError('Speech Recognition is not supported in this browser.');
      return;
    }

    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = isHindi ? 'hi-IN' : 'en-US';

    recognitionRef.current.onresult = handleResult;
    recognitionRef.current.onerror = (event: any) => {
      console.error('Recognition error:', event.error);
      setIsListening(false);
      if (event.error === 'not-allowed') {
        setError('Microphone access denied. Please check permissions.');
      }
    };
    recognitionRef.current.onend = () => {
      setIsListening(false);
    };
  }, [handleResult]);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setError(null);
      setTranscript('');
      // Stop any speech before listening
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const saveProfile = () => {
    setUserProfile(tempProfile);
    setShowProfile(false);
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const clearHistory = () => {
    setMessages([]);
  };

  return (
    <div className="min-h-screen bg-[#030712] text-white font-sans overflow-hidden flex items-center justify-center relative selection:bg-indigo-500/30">
      {/* Abstract Mesh Background */}
      <div className="absolute top-[-15%] left-[-10%] w-[500px] h-[500px] rounded-full bg-blue-600/10 blur-[100px] animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[600px] h-[600px] rounded-full bg-indigo-700/10 blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
      <div className="absolute top-[20%] right-[15%] w-[300px] h-[300px] rounded-full bg-purple-600/5 blur-[80px] animate-pulse" style={{ animationDelay: '1s' }} />

      {/* Main Assistant Interface */}
      <main className="glass-panel w-full max-w-[860px] h-[620px] rounded-[48px] p-8 md:p-12 flex flex-col relative z-10 m-4">
        {/* Top HUD */}
        <div className="flex justify-between items-start mb-8 md:mb-16">
          <div className="space-y-1">
            <h1 className="text-[11px] font-bold tracking-[0.4em] uppercase text-indigo-400">Amod MJ Interface v1.0</h1>
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${isProcessing ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
              <span className="text-[10px] text-white/40 uppercase tracking-widest font-mono">
                {isProcessing ? 'AI Processing' : 'Voice Uplink Active'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex bg-white/5 rounded-full p-1 border border-white/10">
              <button 
                onClick={() => setIsHindi(false)}
                className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all ${!isHindi ? 'bg-indigo-500 text-white' : 'text-white/30'}`}
              >
                EN
              </button>
              <button 
                onClick={() => setIsHindi(true)}
                className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all ${isHindi ? 'bg-indigo-500 text-white' : 'text-white/30'}`}
              >
                HI
              </button>
            </div>
            
            <button 
              onClick={() => {
                setTempProfile(userProfile);
                setShowProfile(true);
              }}
              className="p-2 hover:bg-white/5 rounded-full transition-colors text-white/30 hover:text-white"
              title="Profile Settings"
            >
              <User className="w-5 h-5" />
            </button>

            <button 
              onClick={() => setShowHistory(!showHistory)}
              className="p-2 hover:bg-white/5 rounded-full transition-colors text-white/30 hover:text-white"
            >
              <History className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Transcription Visualization */}
        <div className="flex-1 flex flex-col justify-center gap-8 px-4 overflow-hidden">
          <div className="space-y-4 fade-in-up">
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded bg-white/5 border border-white/10 text-[9px] uppercase tracking-wider text-white/50">User</span>
              {userProfile.name && <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">{userProfile.name}</span>}
            </div>
            <h2 className="text-2xl md:text-4xl font-extralight text-white/90 leading-tight">
              {transcript || (isListening ? '"I\'m listening..."' : '"Click the orb to command"')}
            </h2>

            {/* Typing Indicator */}
            {isProcessing && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/5 border border-white/10 w-fit"
              >
                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
              </motion.div>
            )}
          </div>

          <AnimatePresence>
            {messages.length > 0 && messages[messages.length - 1].role === 'assistant' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4 self-end text-right"
              >
                <span className="px-2 py-1 rounded bg-indigo-500/10 border border-indigo-500/20 text-[9px] uppercase tracking-wider text-indigo-400">Amod MJ AI</span>
                <h2 className="text-2xl md:text-4xl font-extralight text-indigo-100 italic leading-tight">
                  "{messages[messages.length - 1].content}"
                </h2>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Controller & Audio Feed */}
        <div className="mt-8 md:mt-12 flex flex-col items-center gap-8">
          {/* Waveform Visualization */}
          <div className="flex items-end justify-center gap-1.5 h-12">
            {[...Array(14)].map((_, i) => (
              <motion.div
                key={i}
                className="waveform-bar"
                animate={{
                  height: isSpeaking || isListening || isProcessing ? [12, Math.random() * 40 + 12, 12] : 4
                }}
                transition={{
                  repeat: Infinity,
                  duration: 0.5 + Math.random() * 0.5,
                  ease: "easeInOut"
                }}
              />
            ))}
          </div>

          {/* Interaction Trigger */}
          <div className="relative flex items-center justify-center">
            <AnimatePresence>
              {(isListening || isSpeaking || isProcessing) && (
                <>
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1.4, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    className="absolute w-28 h-28 rounded-full border border-indigo-500/20"
                    transition={{ repeat: Infinity, duration: 2, repeatType: 'reverse' }}
                  />
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1.8, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="absolute w-36 h-36 rounded-full border border-indigo-500/10"
                    transition={{ repeat: Infinity, duration: 3, repeatType: 'reverse', delay: 0.5 }}
                  />
                </>
              )}
            </AnimatePresence>
            
            <button
              onClick={toggleListening}
              disabled={isProcessing}
              className={`voice-orb w-20 h-20 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 z-20 
                ${isProcessing ? 'cursor-wait opacity-80' : 'cursor-pointer'}
              `}
            >
              {isListening ? (
                <Square className="w-8 h-8 text-white fill-white" />
              ) : isSpeaking ? (
                <MicOff className="w-8 h-8 text-white" />
              ) : (
                <Mic className="w-8 h-8 text-white" />
              )}
            </button>
          </div>
        </div>
      </main>

      {/* Message History Drawer */}
      <AnimatePresence>
        {showHistory && (
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full sm:w-96 glass-panel z-50 flex flex-col shadow-2xl"
          >
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">Memory Buffer</h2>
              <div className="flex items-center gap-2">
                <button onClick={clearHistory} className="p-2 hover:bg-white/5 rounded-full text-white/30 hover:text-red-400 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
                <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-white/5 rounded-full text-white/30 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-10 gap-4">
                  <History className="w-12 h-12 text-white" />
                  <p className="text-[10px] uppercase tracking-widest">No Buffer Entries</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`px-4 py-3 rounded-2xl max-w-[85%] text-xs leading-relaxed ${
                      msg.role === 'user' 
                        ? 'bg-white/5 text-white/70 border border-white/10' 
                        : 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-100'
                    }`}>
                      {msg.content}
                    </div>
                    <span className="text-[8px] font-mono mt-2 text-white/20 uppercase tracking-tighter">
                      {msg.role === 'user' ? 'Input' : 'Response'} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Profile Settings Modal */}
      <AnimatePresence>
        {showProfile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-panel w-full max-w-md rounded-[32px] overflow-hidden"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-indigo-400">Profile Identity</h2>
                <button onClick={() => setShowProfile(false)} className="p-2 hover:bg-white/5 rounded-full text-white/30 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[9px] uppercase tracking-widest text-white/30 font-mono">User Designation</label>
                  <input 
                    type="text" 
                    value={tempProfile.name}
                    onChange={(e) => setTempProfile(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter your name..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-[9px] uppercase tracking-widest text-white/30 font-mono">Behavioral Preferences</label>
                  <textarea 
                    value={tempProfile.preferences}
                    onChange={(e) => setTempProfile(prev => ({ ...prev, preferences: e.target.value }))}
                    placeholder="e.g. Keep answers technical, like science fiction, talk about space..."
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50 transition-colors resize-none text-xs leading-relaxed"
                  />
                </div>

                <div className="pt-4">
                  <button 
                    onClick={saveProfile}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 group"
                  >
                    <Save className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    <span className="text-xs uppercase tracking-widest">Update Identity</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Status Bar Footer */}
      <div className="absolute bottom-8 left-12 right-12 hidden md:flex justify-between items-center text-white/20 pointer-events-none">
        <div className="flex items-center gap-4">
          <span className="text-[9px] uppercase tracking-[0.3em] font-mono">Status: Stable</span>
          <div className="w-1 h-1 rounded-full bg-white/20"></div>
          <span className="text-[9px] uppercase tracking-[0.3em] font-mono">Uptime: 99.9%</span>
        </div>
        {error && <span className="text-[9px] uppercase tracking-wider text-red-500/50 bg-red-500/5 px-3 py-1 rounded-full border border-red-500/10 pointer-events-auto">{error}</span>}
        <div className="text-[9px] text-white/10 tracking-[0.5em] uppercase font-mono">Amod MJ Neural Link v1.0</div>
      </div>
    </div>
  );
}
