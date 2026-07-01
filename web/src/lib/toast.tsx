/**
 * Minimal toast/snackbar. Write actions use this to CONFIRM success or SURFACE
 * failure, so a click never silently does nothing (the old `.catch(()=>{})`
 * writes looked "unresponsive" on any error).
 */
import { createContext, useCallback, useContext, useState } from "react";
import type { JSX, ReactNode } from "react";

type ToastKind = "success" | "error";
interface Toast { id: number; kind: ToastKind; msg: string }
interface ToastApi { notify: (msg: string, kind?: ToastKind) => void }

const ToastCtx = createContext<ToastApi>({ notify: () => {} });
export function useToast(): ToastApi { return useContext(ToastCtx); }

let seq = 0;
export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const notify = useCallback((msg: string, kind: ToastKind = "success") => {
    const id = ++seq;
    setToasts((list) => [...list, { id, kind, msg }]);
    window.setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), 3800);
  }, []);
  return (
    <ToastCtx.Provider value={{ notify }}>
      {children}
      <div className="toast-host" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>{t.msg}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
