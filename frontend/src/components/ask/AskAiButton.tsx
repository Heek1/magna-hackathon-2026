import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence } from "framer-motion";
import { useChatSuggestions } from "@/api/chat";
import { Button } from "@/components/ui/button";
import { useRole } from "@/lib/role";
import { cn } from "@/lib/utils";
import { AiIcon, AskSheet, type AskMessage } from "./AskSheet";

export interface AskAiButtonProps {
  /** The error on screen; on Error detail the button reads "Ask about {code}". */
  code?: string | null;
  /** icon — round button next to the settings button (Now); chip — pill under the solution card. */
  variant?: "icon" | "chip";
  className?: string;
}

/**
 * Entry to "Ask AI". Renders nothing until the backend confirms the AI is available, and nothing
 * at all when it is not (503: no LLM key).
 */
export function AskAiButton({ code = null, variant = "icon", className }: AskAiButtonProps) {
  const [role] = useRole();
  const { available, suggestions } = useChatSuggestions(code, role);
  const [open, setOpen] = useState(false);
  const [messages, setMessagesState] = useState<AskMessage[]>([]);
  const setMessages = useCallback((update: (prev: AskMessage[]) => AskMessage[]) => setMessagesState(update), []);
  const close = useCallback(() => setOpen(false), []);

  if (!available) return null;

  return (
    <>
      {variant === "icon" ? (
        <Button
          variant="surface"
          size="icon"
          className={className}
          onClick={() => setOpen(true)}
          aria-label="Ask AI"
          aria-haspopup="dialog"
        >
          <AiIcon />
        </Button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          className={cn(
            "inline-flex h-9 items-center gap-1.5 self-start rounded-chip bg-bg-ink pl-3 pr-3.5 text-caption font-medium text-white shadow-card transition active:scale-95",
            className,
          )}
        >
          <AiIcon className="h-4 w-4" />
          Ask about {code}
        </button>
      )}
      {/* On <body>: an animated (transformed) page would otherwise clip the fixed sheet. */}
      {createPortal(
        <AnimatePresence>
          {open && (
            <AskSheet
              onClose={close}
              code={code}
              role={role}
              suggestions={suggestions}
              messages={messages}
              setMessages={setMessages}
            />
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
