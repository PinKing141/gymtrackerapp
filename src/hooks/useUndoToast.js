import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_DURATION_MS = 6000;

// Snapshot-restore undo: the caller captures whatever slice of state it's
// about to delete from, performs the delete immediately, and passes a
// restore callback. If the user taps Undo before the toast expires, the
// restore callback runs (typically just re-setting the captured snapshot).
// This is "last write wins" undo, not full history — enough for a single
// accidental delete, which is what it's for.
export function useUndoToast(duration = DEFAULT_DURATION_MS) {
  const [toast, setToast] = useState(null);
  const timeoutRef = useRef(null);

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  const showUndo = useCallback((message, onUndo) => {
    clearTimeout(timeoutRef.current);
    setToast({ message, onUndo });
    timeoutRef.current = setTimeout(() => setToast(null), duration);
  }, [duration]);

  const dismiss = useCallback(() => {
    clearTimeout(timeoutRef.current);
    setToast(null);
  }, []);

  const undo = useCallback(() => {
    setToast((current) => {
      current?.onUndo?.();
      return null;
    });
    clearTimeout(timeoutRef.current);
  }, []);

  return { toast, showUndo, dismiss, undo };
}
