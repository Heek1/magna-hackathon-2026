import { useEffect, useRef, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { CornerDownLeft } from "lucide-react";
import { useChat } from "@/api/hooks";
import { errorText } from "@/api/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion as tokens } from "@/theme/tokens";

interface Message {
  role: "user" | "assistant" | "error";
  text: string;
}

const SUGGESTIONS = [
  "Why is OEE below target today?",
  "Which stop costs us the most this month?",
  "What should we fix first and how?",
];

/** Ask the data a question (POST /api/chat). Render only when useChat().available is true. */
export function ChatPanel() {
  const { ask } = useChat();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => end.current?.scrollIntoView({ block: "end" }), [messages, busy]);

  const send = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setBusy(true);
    try {
      const answer = await ask(q);
      setMessages((m) => [...m, { role: "assistant", text: answer }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "error", text: errorText(e) }]);
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col gap-2">
            <span className="label">Ask about the line data</span>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void send(s)}
                className="rounded border px-3 py-2 text-left text-sm text-text/90 hover:border-border-strong hover:bg-surface-2"
              >
                {s}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: tokens.enter, ease: tokens.ease }}
                className={cn(
                  "whitespace-pre-wrap rounded border px-3 py-2 text-sm leading-relaxed",
                  m.role === "user" && "ml-8 border-border-strong bg-surface-2 text-text",
                  m.role === "assistant" && "mr-4 bg-bg text-text/90",
                  m.role === "error" && "mr-4 border-crit/50 text-crit",
                )}
              >
                {m.text}
              </motion.div>
            ))}
            {busy && <div className="label">Analysing…</div>}
          </div>
        )}
        <div ref={end} />
      </div>
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question…"
          aria-label="Question"
          className="h-9 min-w-0 flex-1 rounded border border-border-strong bg-bg px-3 text-sm text-text placeholder:text-dim"
        />
        <Button type="submit" size="icon" disabled={!input.trim() || busy} aria-label="Send">
          <CornerDownLeft className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
