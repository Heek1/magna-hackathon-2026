import { useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Moon, Pause, Play, Presentation, SlidersHorizontal, Sun, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { SPEEDS, useSimClock, useSimControl, useSimState } from "@/api/hooks";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/SegmentedControl";
import { dayLabel, hhmmss, toLocalInput } from "@/lib/format";
import { LANGS, useLang, useT, type Lang } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { useBackToClose } from "@/lib/useBackToClose";
import { cn } from "@/lib/utils";
import { motion as tokens, type ThemeName } from "@/theme/tokens";

/**
 * Settings in a bottom sheet, off the main screen: language, light or dark theme, and the simulator
 * (pause, speed, jump to date and time). Renders its own trigger button.
 */
export function SimSettings({ className, withLabel }: { className?: string; withLabel?: boolean }) {
  const [open, setOpen] = useState(false);
  const t = useT();
  return (
    <>
      <Button
        variant={withLabel ? "ghost" : "surface"}
        size={withLabel ? "md" : "icon"}
        className={cn(withLabel && "justify-start px-3", className)}
        onClick={() => setOpen(true)}
        aria-label={t("settings.title")}
        aria-haspopup="dialog"
      >
        <SlidersHorizontal className="h-5 w-5" aria-hidden />
        {withLabel && t("settings.title")}
      </Button>
      <AnimatePresence>{open && <Sheet onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
  );
}

function Sheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [lang, setLang] = useLang();
  const [theme, setTheme] = useTheme();
  useBackToClose(onClose);
  const { now, speed, paused } = useSimClock();
  const { data } = useSimState();
  const { setPaused, setSpeed, jumpTo, startDemo, error } = useSimControl();
  const navigate = useNavigate();
  const [target, setTarget] = useState(() => toLocalInput(now));
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const jump = (e: FormEvent) => {
    e.preventDefault();
    const d = new Date(target);
    if (!Number.isNaN(d.getTime())) jumpTo(d);
  };

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
        aria-labelledby="sim-settings-title"
        tabIndex={-1}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ duration: tokens.enter, ease: tokens.ease }}
        className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-hero bg-bg-card px-gutter pb-[max(20px,env(safe-area-inset-bottom))] pt-3 shadow-card outline-none"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" aria-hidden />
        <div className="flex items-center justify-between">
          <h2 id="sim-settings-title" className="text-title-l">
            {t("settings.title")}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label={t("common.close")}>
            <X className="h-5 w-5" aria-hidden />
          </Button>
        </div>

        <div className="mt-2">
          <span className="overline-label">{t("settings.language")}</span>
          <SegmentedControl<Lang>
            className="mt-2"
            label={t("settings.language")}
            value={lang}
            onChange={setLang}
            options={LANGS.map((l) => ({ value: l.lang, label: l.label }))}
          />
        </div>

        <div className="mt-4">
          <span className="overline-label">{t("settings.theme")}</span>
          <SegmentedControl<ThemeName>
            className="mt-2"
            label={t("settings.theme")}
            value={theme}
            onChange={setTheme}
            options={[
              { value: "light", label: t("theme.light"), icon: Sun },
              { value: "dark", label: t("theme.dark"), icon: Moon },
            ]}
          />
        </div>

        <h3 className="mt-6 border-t pt-4 text-title-m text-text-primary">{t("sim.title")}</h3>
        <p className="text-caption text-text-secondary">{t("sim.intro")}</p>

        <button
          type="button"
          onClick={() => {
            startDemo();
            navigate("/");
            onClose();
          }}
          className="mt-4 flex w-full items-center gap-3 rounded-card bg-bg-ink p-card-pad text-left text-white transition active:scale-[0.99]"
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-badge bg-white/10">
            <Presentation className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-body font-semibold">{t("sim.demo")}</span>
            <span className="block text-caption text-white/60">{t("sim.demoHint")}</span>
          </span>
          <Play className="h-5 w-5 shrink-0" aria-hidden />
        </button>

        <div className="mt-4 flex items-center justify-between rounded-card bg-bg-subtle p-card-pad">
          <div>
            <span className="overline-label">{t("sim.time")}</span>
            <p className="num text-num-l text-text-primary">{data ? hhmmss(now) : "--:--:--"}</p>
            <p className="text-caption text-text-secondary">{data ? dayLabel(now) : t("sim.waiting")}</p>
          </div>
          <Button variant="primary" size="icon" onClick={() => setPaused(!paused)} aria-label={t(paused ? "sim.resume" : "sim.pause")}>
            {paused ? <Play className="h-5 w-5" aria-hidden /> : <Pause className="h-5 w-5" aria-hidden />}
          </Button>
        </div>

        <div className="mt-4">
          <span className="overline-label">{t("sim.speed")}</span>
          <SegmentedControl
            className="mt-2"
            label={t("sim.speedLabel")}
            value={String(speed)}
            onChange={(v) => setSpeed(Number(v))}
            options={SPEEDS.map((s) => ({ value: String(s), label: `${s}×` }))}
          />
        </div>

        <form onSubmit={jump} className="mt-4">
          <label htmlFor="sim-jump" className="overline-label">
            {t("sim.jumpTo")}
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="sim-jump"
              type="datetime-local"
              value={target}
              min="2026-11-02T06:00"
              max="2026-11-30T14:00"
              onChange={(e) => setTarget(e.target.value)}
              className="num h-11 min-w-0 flex-1 rounded-button border bg-bg-card px-3 text-body"
            />
            <Button type="submit" variant="primary" disabled={!target}>
              {t("sim.jump")}
            </Button>
          </div>
        </form>

        {error && <p className="mt-3 text-caption text-status-stop">{error}</p>}
      </motion.div>
    </div>
  );
}
