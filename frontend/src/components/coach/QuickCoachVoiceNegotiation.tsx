import React, { useState, useEffect, useRef } from "react";
import { api } from "../../lib/api";
import {
  Mic,
  MicOff,
  Send,
  Sparkles,
  Check,
  Loader2,
  Volume2,
  Target,
  RotateCcw,
} from "lucide-react";

interface ChatMessage {
  role: "user" | "model";
  content: string;
}

interface QuickCoachVoiceNegotiationProps {
  journalId: string;
  clusterId: string;
  isStoryFinished: boolean;
  initialGoal?: string;
  initialPrompt?: string;
  onGoalAgreed: (goal: string) => void;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: (event: { results: Array<Array<{ transcript: string }>> }) => void;
  onerror: (event: { error: string }) => void;
  onend: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export default function QuickCoachVoiceNegotiation({
  journalId,
  clusterId,
  isStoryFinished,
  initialGoal,
  initialPrompt,
  onGoalAgreed,
}: QuickCoachVoiceNegotiationProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDraftingGoal, setIsDraftingGoal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<string>(initialGoal || "");
  const [thinkingPhase, setThinkingPhase] = useState("Analyzing pattern...");
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(
    null,
  );
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const handleSendMessageRef = useRef<(text?: string) => Promise<void>>(
    async () => {},
  );

  // Progressive thinking status for high-reasoning models
  useEffect(() => {
    if (!isLoading) {
      setThinkingPhase("Analyzing pattern...");
      return;
    }

    const phases = [
      "Analyzing pattern...",
      "Investigating historical data...",
      "Synthesizing clinical coaching...",
    ];
    let idx = 0;
    setThinkingPhase(phases[0]);

    const timer = setInterval(() => {
      idx = (idx + 1) % phases.length;
      setThinkingPhase(phases[idx]);
    }, 2500);

    return () => clearInterval(timer);
  }, [isLoading]);

  // Initialize Speech Recognition if supported
  useEffect(() => {
    const SpeechRecognitionClass =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognitionClass) {
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event) => {
        let transcript = "";
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i]?.[0]?.transcript || "";
        }
        if (transcript.trim()) {
          setInputText(transcript.trim());
        }
      };

      recognition.onerror = (event) => {
        console.warn("Speech recognition error:", event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert(
        "Speech recognition is not supported in this browser. You can type below!",
      );
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setIsListening(true);
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.warn("Failed to start speech recognition:", e);
      }
    }
  };

  const speakReply = (text: string) => {
    if (
      typeof window !== "undefined" &&
      "speechSynthesis" in window &&
      typeof window.SpeechSynthesisUtterance !== "undefined"
    ) {
      window.speechSynthesis.cancel();
      const cleanText = text
        .replace(/[*#_]/g, "")
        .replace(/(\d+(?:\.\d+)?)\s*(?:mmol\/L|mg\/dL)/gi, "$1");
      const utterance = new window.SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1.05;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const messageContent = (textToSend || inputText).trim();
    if (!messageContent || isLoading) return;

    const userMessage: ChatMessage = { role: "user", content: messageContent };
    const updatedHistory = [...messages, userMessage];
    setMessages(updatedHistory);
    setInputText("");
    setIsLoading(true);
    setLastFailedMessage(null);

    try {
      const res = await api.post<{ reply: string }>(
        `/journals/${journalId}/clusters/${clusterId}/chat`,
        {
          message: messageContent,
          chatHistory: updatedHistory.slice(-6),
        },
      );

      const aiReply = res.data.reply;
      setMessages([...updatedHistory, { role: "model", content: aiReply }]);
      speakReply(aiReply);
    } catch (err: unknown) {
      console.error("Chat error:", err);
      setLastFailedMessage(messageContent);
      const fallbackReply =
        "Let's focus on taking a short 10-15 minute walk or adjusting meal bolus timing next week.";
      setMessages([
        ...updatedHistory,
        { role: "model", content: fallbackReply },
      ]);
    } finally {
      setIsLoading(false);
    }
  };
  handleSendMessageRef.current = handleSendMessage;

  const handleDraftGoal = async () => {
    if (messages.length === 0 || isDraftingGoal) return;
    try {
      setIsDraftingGoal(true);
      const res = await api.post<{
        synthesizedInsight?: string;
        reply?: string;
      }>(`/journals/${journalId}/clusters/${clusterId}/save-insight`, {
        chatHistory: messages,
      });
      const rawDraft =
        res.data.synthesizedInsight ||
        res.data.reply ||
        "Take a 10-15 minute walk after meals.";
      const cleanDraft = rawDraft
        .replace(/^[\s>*-]+/, "")
        .replace(/^"(.*)"$/, "$1")
        .trim();
      setSelectedGoal(cleanDraft);
    } catch (err: unknown) {
      console.error("Failed to draft micro-goal:", err);
      setSelectedGoal("Focus on post-meal walking and bolus timing next week.");
    } finally {
      setIsDraftingGoal(false);
    }
  };

  const handleSelectGoal = (goalText: string) => {
    setSelectedGoal(goalText);
    onGoalAgreed(goalText);
  };

  return (
    <div
      data-testid="quick-coach-voice-negotiation"
      className="bg-white rounded-2xl p-4 border border-[#E8E1D9] shadow-sm space-y-4"
    >
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[#2C4C5B]">
          <Sparkles className="w-4 h-4 text-[#D9775B]" />
          <span>Voice Habit Negotiation</span>
        </div>
        <span className="text-[11px] font-semibold text-[#D9775B] bg-[#D9775B]/10 px-2.5 py-0.5 rounded-full">
          AI Coach Active
        </span>
      </div>

      {/* Starting Coach Prompt */}
      <div className="bg-[#FBF9F5] p-3 rounded-xl border border-[#E8E1D9]/70 text-xs text-gray-700 leading-relaxed">
        <p className="font-semibold text-gray-900 mb-1">Coach Reflection:</p>
        {initialPrompt
          ? initialPrompt
          : isStoryFinished
            ? "Now that you've watched the data story, what is one small, realistic micro-habit you'd like to test next week? Speak or type your thought."
            : "What is one small, realistic micro-habit you'd like to test for this pattern next week? Speak or type your thought."}
      </div>

      {/* Message Feed */}
      {messages.length > 0 && (
        <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
            >
              <div
                className={`text-xs px-3.5 py-2 rounded-2xl max-w-[85%] leading-relaxed ${
                  m.role === "user"
                    ? "bg-[#D9775B] text-white rounded-br-none"
                    : "bg-[#F3EFEA] text-gray-800 border border-[#E8E1D9]/80 rounded-bl-none"
                }`}
              >
                {m.content}
              </div>
              {m.role === "model" && (
                <button
                  onClick={() => speakReply(m.content)}
                  className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-gray-400 hover:text-gray-600"
                >
                  <Volume2 className="w-3 h-3" /> Replay Voice
                </button>
              )}
            </div>
          ))}
          {isLoading && (
            <div
              data-testid="thinking-status"
              className="flex items-center gap-1.5 text-xs text-gray-500 pl-2 py-1 animate-pulse"
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D9775B]" />
              <span>{thinkingPhase}</span>
            </div>
          )}
          {lastFailedMessage && !isLoading && (
            <div className="flex items-center justify-between bg-amber-50 border border-amber-200/80 rounded-xl px-3 py-2 text-xs text-amber-900 mt-1">
              <span className="text-[11px]">
                Coaching connection interrupted.
              </span>
              <button
                type="button"
                onClick={() => void handleSendMessage(lastFailedMessage)}
                className="inline-flex items-center gap-1 font-bold text-xs text-[#D9775B] hover:text-[#b85b42] cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" /> Retry
              </button>
            </div>
          )}
        </div>
      )}

      {/* Action Button to Draft Goal from Conversation */}
      {messages.length > 0 && (
        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={() => void handleDraftGoal()}
            disabled={isDraftingGoal || isLoading}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#D9775B] bg-[#D9775B]/10 hover:bg-[#D9775B]/20 border border-[#D9775B]/30 px-3.5 py-2 rounded-xl transition-all shadow-sm disabled:opacity-50"
          >
            {isDraftingGoal ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D9775B]" />
                <span>Drafting Micro-Goal...</span>
              </>
            ) : (
              <>
                <Target className="w-3.5 h-3.5 text-[#D9775B]" />
                <span>Draft Micro-Goal from Conversation</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Proposed Goal Card if Goal is Drafted */}
      {selectedGoal && (
        <div className="bg-[#54A67A]/10 border border-[#54A67A]/30 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#2C4C5B] uppercase tracking-wider">
              Drafted Weekly Micro-Habit
            </span>
            <Check className="w-3.5 h-3.5 text-[#54A67A]" />
          </div>
          <p className="text-xs font-semibold text-gray-800">
            "{selectedGoal}"
          </p>
          <button
            onClick={() => handleSelectGoal(selectedGoal)}
            className="w-full py-2 px-3 rounded-lg bg-[#54A67A] text-white font-bold text-xs hover:bg-[#469066] active:scale-95 transition-all shadow-sm"
          >
            Set as Weekly Micro-Habit
          </button>
        </div>
      )}

      {/* Input Controls */}
      <div className="flex items-center gap-2 pt-1">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleSendMessage();
          }}
          placeholder="e.g. 10 minute walk after lunch"
          disabled={isLoading}
          className="flex-1 text-xs px-3.5 py-2.5 rounded-xl border border-[#E8E1D9] focus:outline-none focus:border-[#D9775B] bg-[#FBF9F5]"
        />

        <button
          onClick={() => void handleSendMessage()}
          disabled={!inputText.trim() || isLoading}
          aria-label="Send Message"
          className="p-2.5 rounded-xl bg-[#D9775B] text-white hover:bg-[#c2654a] active:scale-95 disabled:opacity-40 transition-all shadow-sm"
        >
          <Send className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={toggleListening}
          aria-label="Push to Talk"
          className={`p-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center ${
            isListening
              ? "bg-red-500 text-white animate-pulse"
              : "bg-[#2C4C5B] text-white hover:bg-[#233c48]"
          }`}
        >
          {isListening ? (
            <MicOff className="w-4 h-4" />
          ) : (
            <Mic className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}
