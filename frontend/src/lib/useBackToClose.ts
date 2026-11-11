import { useEffect, useRef } from "react";

/**
 * Android's back button (and the back swipe) closes an open sheet instead of leaving the screen.
 * Adds one history entry while the sheet is open and removes it again when the sheet closes.
 */
export function useBackToClose(onClose: () => void) {
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    let added = false;
    let closedByBack = false;
    const onPop = () => {
      closedByBack = true;
      close.current();
    };
    // Deferred so that React StrictMode's mount-unmount-mount in dev adds only one entry.
    const timer = window.setTimeout(() => {
      window.history.pushState({ ...window.history.state, sheet: true }, "");
      added = true;
      window.addEventListener("popstate", onPop);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("popstate", onPop);
      // Still on our entry (the sheet did not navigate away): step back off it.
      if (added && !closedByBack && window.history.state?.sheet) window.history.back();
    };
  }, []);
}
