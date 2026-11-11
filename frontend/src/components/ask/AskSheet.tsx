import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { ArrowUp, RotateCcw, Sparkles, X } from "lucide-react";
import { askAi, type ChatTurn } from "@/api/chat";
import { errorText } from "@/api/client";
import { Card } from "@/components/Card";
import { Chip } from "@/components/Chip";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";
import { useBackToClose } from "@/lib/useBackToClose";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/role";
import { motion as tokens } from "@/theme/tokens";

export type AskMessage =
  | { kind: "user"; text: string }
  | { kind: "answer"; text: string; sources: string[]; followups: string[]; reveal: boolean }
  | { kind: "error"; question: string; detail: string };

export interface AskSheetProps {
  onClose: () => void;
  /** The error on screen (Error detail): questions are about it. */
  code?: string | null;
  role: string | null;
  suggestions: string[];
  /** The conversation lives in the trigger, so closing and reopening keeps it. */
  messages: AskMessage[];
  setMessages: (update: (prev: AskMessage[]) => AskMessage[]) => void;
}

/** Conversation turns for the backend: questions and answers, without errors. */
function history(messages: AskMessage[]): ChatTurn[] {
  return messages.flatMap((m): ChatTurn[] =>
    m.kind === "user" ? [{ role: "user", text: m.text }] : m.kind === "answer" ? [{ role: "assistant", text: m.text }] : [],
  );
}

/** "Ask AI" bottom sheet: starter questions, the conversation, a text field. */
export function AskSheet({ onClose, code, role, suggestions, messages, setMessages }: AskSheetProps) {
  const t = useT();
  useBackToClose(onClose);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const scrollDown = useCallback(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(scrollDown, [messages, busy, scrollDown]);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    const earlier = history(messages);
    setDraft("");
    setBusy(true);
    setMessages((prev) => [...prev.filter((m) => m.kind !== "error"), { kind: "user", text: q }]);
    try {
      const reply = await askAi({ question: q, history: earlier, code, role });
      setMessages((prev) => [...prev, { kind: "answer", text: reply.answer, sources: reply.sources, followups: reply.followups, reveal: true }]);
    } catch (e) {
      setMessages((prev) => [...prev, { kind: "error", question: q, detail: errorText(e) }]);
    } finally {
      setBusy(false);
    }
  };

  const retry = (question: string) => {
    // Drop the failed question and its error, then ask again.
    setMessages((prev) => prev.slice(0, Math.max(0, prev.length - 2)));
    void ask(question);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void ask(draft);
  };

  const last = messages[messages.length - 1];

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <motion.div
        className="absolute inset-0 bg-bg-ink/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: tokens.enter }}
        onClick={onClose}
        aria-hidden
      />
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ask-ai-title"
        tabIndex={-1}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ duration: tokens.enter, ease: tokens.ease }}
        className="relative flex h-[85dvh] w-full max-w-md flex-col rounded-t-hero bg-bg-canvas shadow-card outline-none lg:max-w-lg"
      >
        <div className="px-gutter pt-3">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" aria-hidden />
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-full bg-bg-ink text-white">
              <Sparkles className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="ask-ai-title" className="text-title-l leading-tight">
                {t("ask.title")}
              </h2>
              <p className="truncate text-caption text-text-secondary">
                {code ? t("ask.about", { code }) : t("ask.aboutLine")} · {t("ask.dataOnly")}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label={t("common.close")}>
              <X className="h-5 w-5" aria-hidden />
            </Button>
          </div>
        </div>

        <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-gutter py-4" aria-live="polite">
          {messages.length === 0 && !busy ? (
            <Starters suggestions={suggestions} role={role} onPick={ask} />
          ) : (
            <div className="flex flex-col gap-3">
              {messages.map((m, i) => {
                const isLast = i === messages.length - 1;
                if (m.kind === "user") return <UserBubble key={i} text={m.text} />;
                if (m.kind === "error") return <ErrorCard key={i} onRetry={() => retry(m.question)} disabled={busy} />;
                return (
                  <AnswerCard
                    key={i}
                    message={m}
                    showFollowups={isLast && !busy}
                    onTick={scrollDown}
                    onRevealed={() => setMessages((prev) => prev.map((p) => (p === m ? { ...m, reveal: false } : p)))}
                    onPick={ask}
                  />
                );
              })}
              {busy && <Typing />}
            </div>
          )}
        </div>

        <form onSubmit={submit} className="flex gap-2 border-t bg-bg-card px-gutter pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
          <label htmlFor="ask-ai-input" className="sr-only">
            {t("ask.question")}
          </label>
          <input
            id="ask-ai-input"
            ref={input}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={500}
            autoComplete="off"
            enterKeyHint="send"
            placeholder={last?.kind === "answer" ? t("ask.followup") : code ? t("ask.placeholderCode", { code }) : t("ask.placeholder")}
            className="h-11 min-w-0 flex-1 rounded-button border bg-bg-card px-3 text-body placeholder:text-text-tertiary"
          />
          <Button type="submit" variant="primary" size="icon" disabled={!draft.trim() || busy} aria-label={t("ask.send")}>
            <ArrowUp className="h-5 w-5" aria-hidden />
          </Button>
        </form>
      </motion.div>
    </div>
  );
}

function Starters({ suggestions, role, onPick }: { suggestions: string[]; role: string | null; onPick: (q: string) => void }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-3">
      <p className="text-body text-text-secondary">
        {t("ask.intro")}
        {role ? ` ${t("ask.introRole", { role: t(`role.${role as Role}`) })}` : ""}
      </p>
      {suggestions.length > 0 && (
        <>
          <span className="overline-label mt-1">{t("ask.try")}</span>
          <div className="flex flex-col items-start gap-2">
            {suggestions.map((q) => (
              <QuestionChip key={q} text={q} onClick={() => onPick(q)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** A tappable question: starter or follow-up. */
function QuestionChip({ text, onClick, disabled }: { text: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="min-h-9 max-w-full rounded-chip bg-bg-card px-3.5 py-2 text-left text-caption font-medium text-text-primary shadow-card transition active:scale-[0.98] disabled:opacity-40"
    >
      {text}
    </button>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <motion.p
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: tokens.enter }}
      className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-card rounded-br-badge-sm bg-bg-ink px-3.5 py-2.5 text-body text-white"
    >
      {text}
    </motion.p>
  );
}

const WORD_MS = 28;

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function AnswerCard({
  message,
  showFollowups,
  onTick,
  onRevealed,
  onPick,
}: {
  message: Extract<AskMessage, { kind: "answer" }>;
  showFollowups: boolean;
  onTick: () => void;
  onRevealed: () => void;
  onPick: (q: string) => void;
}) {
  const t = useT();
  const words = message.text.split(/(\s+)/);
  const [shown, setShown] = useState(() => (message.reveal && !prefersReducedMotion() ? 0 : words.length));
  const done = shown >= words.length;

  // Word by word: the answer arrives whole, then appears like typing.
  useEffect(() => {
    if (done) return;
    const t = setTimeout(() => setShown((n) => n + 2), WORD_MS);
    return () => clearTimeout(t);
  }, [shown, done]);
  useEffect(() => {
    onTick();
    if (done && message.reveal) onRevealed();
  }, [shown, done, message.reveal, onTick, onRevealed]);

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: tokens.enter }}>
      <Card className="flex flex-col gap-3 rounded-bl-badge-sm">
        <span className="flex items-center gap-1.5 text-caption font-medium text-status-speed">
          <Sparkles className="h-4 w-4" aria-hidden />
          OEE Engine
        </span>
        <p className="whitespace-pre-wrap text-body text-text-primary">{words.slice(0, shown).join("")}</p>
        {done && message.sources.length > 0 && (
          <div className="flex flex-wrap gap-1.5" aria-label={t("ask.sources")}>
            {message.sources.map((s) => (
              <Chip key={s} dot={false} className="h-6 px-2 text-[12px] text-text-secondary">
                {s}
              </Chip>
            ))}
          </div>
        )}
      </Card>
      {done && showFollowups && message.followups.length > 0 && (
        <div className="mt-3 flex flex-col items-start gap-2">
          {message.followups.map((q) => (
            <QuestionChip key={q} text={q} onClick={() => onPick(q)} />
          ))}
        </div>
      )}
    </motion.div>
  );
}

function Typing() {
  const t = useT();
  return (
    <Card className="flex w-fit items-center gap-1.5 rounded-bl-badge-sm px-4 py-3.5" aria-label={t("ask.typing")}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-2 rounded-full bg-text-tertiary"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
        />
      ))}
    </Card>
  );
}

function ErrorCard({ onRetry, disabled }: { onRetry: () => void; disabled: boolean }) {
  const t = useT();
  return (
    <Card tone="stop" className="flex items-center gap-3">
      <p className="flex-1 text-body text-text-primary">{t("ask.unavailable")}</p>
      <Button variant="default" size="sm" onClick={onRetry} disabled={disabled}>
        <RotateCcw className="h-4 w-4" aria-hidden />
        {t("ask.retry")}
      </Button>
    </Card>
  );
}

/** Small "AI" mark used by the triggers. */
export function AiIcon({ className }: { className?: string }) {
  return <Sparkles className={cn("h-5 w-5", className)} aria-hidden />;
}
