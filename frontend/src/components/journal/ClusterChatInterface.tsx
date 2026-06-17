import React, { useState, useRef, useEffect } from "react";
import { api } from "../../lib/api";
import { Loader2, Send, X, AlertCircle } from "lucide-react";

interface ChatMessage {
  role: "user" | "model";
  content: string;
}

interface ClusterChatInterfaceProps {
  journalId: string;
  clusterId: string;
  initialPrompt: string;
  onSaveInsight: (synthesizedText: string) => void;
  onClose: () => void;
}

const ClusterChatInterface: React.FC<ClusterChatInterfaceProps> = ({
  journalId,
  clusterId,
  initialPrompt,
  onSaveInsight,
  onClose,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "model", content: initialPrompt },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom when messages update
  const scrollToBottom = () => {
    if (typeof chatEndRef.current?.scrollIntoView === "function") {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const messageToSend = inputMessage.trim();
    if (!messageToSend || isSending || isSynthesizing) return;

    setInputMessage("");
    setError(null);

    // Append user message immediately
    const updatedMessages = [
      ...messages,
      { role: "user" as const, content: messageToSend },
    ];
    setMessages(updatedMessages);
    setIsSending(true);

    try {
      // Send message to the backend API route
      const response = await api.post<{ reply: string }>(
        `/journals/${journalId}/clusters/${clusterId}/chat`,
        {
          message: messageToSend,
          chatHistory: messages, // Send history before this message was appended
        },
      );

      // Append AI coach response
      setMessages((prev) => [
        ...prev,
        { role: "model" as const, content: response.data.reply },
      ]);
    } catch {
      setError(
        "Unable to reach the AI coach. Please check your connection and try again.",
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveInsight = async () => {
    if (isSending || isSynthesizing) return;

    setIsSynthesizing(true);
    setError(null);

    try {
      // Request final POV summary and resolutions from backend
      const response = await api.post<{ synthesizedInsight: string }>(
        `/journals/${journalId}/clusters/${clusterId}/save-insight`,
        { chatHistory: messages },
      );

      // Trigger success callback to parent card
      onSaveInsight(response.data.synthesizedInsight);
    } catch {
      setError(
        "Failed to compile and synthesize this reflection. Please try again.",
      );
      setIsSynthesizing(false);
    }
  };

  return (
    <div className="fixed right-0 top-0 h-screen w-[380px] sm:w-[420px] bg-white border-l border-gray-200 shadow-2xl z-50 flex flex-col transition-all duration-300">
      {/* Chat Header */}
      <div className="bg-gray-50 border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-sm">✨</span>
          <span className="text-xs font-bold text-blue-900 uppercase tracking-wider">
            AI Reflection Coach
          </span>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
        </div>
        <button
          onClick={onClose}
          type="button"
          className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
          title="Close chat drawer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Message Feed Container */}
      <div className="flex-grow overflow-y-auto bg-gray-50/30 flex flex-col">
        {/* Synthesis Overlay Loading Screen */}
        {isSynthesizing && (
          <div className="absolute inset-0 bg-white/95 z-10 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200">
            <Loader2 className="w-8 h-8 text-mesa-primary animate-spin mb-4" />
            <h4 className="text-sm font-bold text-gray-900 mb-1">
              Synthesizing Reflection
            </h4>
            <p className="text-xs text-gray-500 max-w-[280px]">
              Compiling conversation logs into your personal summary and action
              items...
            </p>
          </div>
        )}

        {/* Messages Feed */}
        <div className="flex-grow flex flex-col space-y-3 p-4">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex flex-col p-3 rounded-xl max-w-[85%] text-sm shadow-sm transition-all duration-150 animate-in fade-in duration-200 ${
                m.role === "model"
                  ? "bg-blue-50/70 text-gray-800 border border-blue-100 self-start"
                  : "bg-mesa-primary text-white self-end"
              }`}
            >
              <p className="leading-relaxed whitespace-pre-wrap">{m.content}</p>
            </div>
          ))}

          {isSending && (
            <div className="bg-white border border-gray-150 p-3 rounded-xl max-w-[85%] self-start flex items-center space-x-2 text-sm text-gray-500 shadow-sm animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-mesa-secondary" />
              <span>AI Coach is thinking...</span>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Error Message Box */}
      {error && (
        <div className="bg-red-50 border-t border-b border-red-100 px-4 py-2 flex items-center text-xs text-red-600 space-x-2 animate-in slide-in-from-top-1 duration-200">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Input Action Bar */}
      <form
        onSubmit={(e) => {
          void handleSendMessage(e);
        }}
        className="border-t border-gray-150 px-3 py-2 bg-white flex items-center space-x-2"
      >
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="Ask a question or explain what happened..."
          disabled={isSending || isSynthesizing}
          className="flex-grow bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-mesa-primary focus:border-mesa-primary disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!inputMessage.trim() || isSending || isSynthesizing}
          className="p-2 bg-mesa-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-30 disabled:hover:bg-mesa-primary flex-shrink-0 cursor-pointer"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      {/* Synthesize/Save Dock */}
      <div className="bg-gray-50 border-t border-gray-100 px-4 py-3 flex justify-center">
        <button
          onClick={() => {
            void handleSaveInsight();
          }}
          type="button"
          disabled={isSending || isSynthesizing}
          className="w-full mx-2 py-2 bg-mesa-primary hover:bg-primary-hover text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
        >
          Summarize my notes
        </button>
      </div>
    </div>
  );
};

export default ClusterChatInterface;
