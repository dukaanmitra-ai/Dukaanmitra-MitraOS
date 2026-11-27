import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { MessageSquare, X, Send, Loader2, ExternalLink, RefreshCw } from "lucide-react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  isError?: boolean;
}

const QUICK_PROMPTS = [
  "WhatsApp se billing kaise hoti hai?",
  "Pricing aur free plan kya hai?",
  "Free CSV templates aur brochure kahan milenge?",
  "DukaanMitra ke founder kaun hain?",
];

export const MunimChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Namaste! Main Munim AI hoon. Aap DukaanMitra ke WhatsApp billing, udhaar khata, pricing, ya downloadable templates ke baare mein seedha sawal pooch sakte hain.",
    },
  ]);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen, sending]);

  const sendMessage = async (rawText: string) => {
    const trimmed = rawText.trim();
    if (!trimmed || sending) return;

    setInput("");
    setLastFailedPrompt(null);

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      text: trimmed,
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setSending(true);

    try {
      const response = await fetch("/api/munim-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history: nextHistory
            .filter((m) => !m.isError)
            .slice(-6)
            .map((m) => ({ role: m.role, text: m.text })),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.reply) {
        const errorText =
          typeof data.error === "string"
            ? data.error
            : "Munim AI server se jawaab nahi mil saka. Kripya dobara try karein ya WhatsApp par sampark karein.";
        setLastFailedPrompt(trimmed);
        setMessages((prev) => [
          ...prev,
          {
            id: `e-${Date.now()}`,
            role: "assistant",
            text: errorText,
            isError: true,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            text: data.reply,
          },
        ]);
      }
    } catch {
      setLastFailedPrompt(trimmed);
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: "assistant",
          text: "Network error ke karan Munim AI se connect nahi ho paya. Kripya retry karein ya WhatsApp par baat karein.",
          isError: true,
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div className="fixed bottom-5 right-5 z-[180] flex flex-col items-end">
      {isOpen && (
        <section
          aria-label="Munim AI Chat Assistant"
          className="mb-3 w-[360px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[75vh] bg-white rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="px-4 py-3.5 bg-slate-900 text-white flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight truncate">Munim AI</p>
              <p className="text-xs text-slate-300 truncate">
                DukaanMitra Website Assistant · Hindi / English
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close chat widget"
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50/70"
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] px-3.5 py-2.5 rounded-xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-slate-900 text-white"
                      : msg.isError
                      ? "bg-rose-50 text-rose-900 border border-rose-200"
                      : "bg-white text-slate-800 border border-slate-200"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex justify-start">
                <div className="px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-500 inline-flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  Munim AI likh raha hai...
                </div>
              </div>
            )}

            {lastFailedPrompt && !sending && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => sendMessage(lastFailedPrompt)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <RefreshCw size={12} /> Retry
                </button>
                <a
                  href="https://wa.me/919876543210?text=Hi%20DukaanMitra%2C%20I%20want%20to%20know%20more%20about%20WhatsApp%20billing%20and%20udhaar%20khata."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                >
                  WhatsApp Chat <ExternalLink size={12} />
                </a>
              </div>
            )}

            {/* Starter quick questions */}
            {messages.length <= 2 && !sending && (
              <div className="pt-2 space-y-1.5">
                <p className="text-[11px] font-medium text-slate-500">Quick questions</p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_PROMPTS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => sendMessage(q)}
                      className="text-left px-3 py-1.5 text-xs text-slate-700 bg-white border border-slate-200 rounded-lg hover:border-indigo-400 hover:text-indigo-700 transition-colors cursor-pointer"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Quick internal links strip */}
          <div className="px-4 py-2 bg-white border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <div className="flex items-center gap-3">
              <Link
                to="/downloads"
                onClick={() => setIsOpen(false)}
                className="hover:text-indigo-700 font-medium"
              >
                Downloads
              </Link>
              <span aria-hidden="true">·</span>
              <Link
                to="/sitemap"
                onClick={() => setIsOpen(false)}
                className="hover:text-indigo-700 font-medium"
              >
                Sitemap
              </Link>
              <span aria-hidden="true">·</span>
              <Link
                to="/demo"
                onClick={() => setIsOpen(false)}
                className="hover:text-indigo-700 font-medium"
              >
                Live Demo
              </Link>
            </div>
            <a
              href="/llms.txt"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-indigo-700 font-mono"
            >
              llms.txt
            </a>
          </div>

          {/* Input Form */}
          <form
            onSubmit={handleSubmit}
            className="p-3 bg-white border-t border-slate-200 flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Apna sawal poochein..."
              aria-label="Ask Munim AI a question"
              disabled={sending}
              className="flex-1 px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              aria-label="Send message"
              className="p-2.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer shrink-0"
            >
              <Send size={16} />
            </button>
          </form>
        </section>
      )}

      {/* Compact Launcher Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close Munim AI chat" : "Open Munim AI chat"}
        className="inline-flex items-center gap-2.5 px-4 py-3 rounded-full bg-slate-900 text-white text-sm font-semibold shadow-lg hover:bg-indigo-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
      >
        {isOpen ? <X size={18} /> : <MessageSquare size={18} />}
        <span>{isOpen ? "Close Chat" : "Ask Munim AI"}</span>
      </button>
    </div>
  );
};

export default MunimChatWidget;
