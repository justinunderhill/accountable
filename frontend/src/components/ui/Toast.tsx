import * as RadixToast from "@radix-ui/react-toast";
import { X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type Tone = "success" | "error";
interface ToastItem {
  id: number;
  message: string;
  tone: Tone;
}
interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);
let nextId = 1;

/** Short messages at the bottom of the screen. Confirmations go after a few seconds; errors stay until dismissed. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((message: string, tone: Tone) => {
    setItems((current) => [...current.slice(-3), { id: nextId++, message, tone }]);
  }, []);
  const remove = (id: number) => setItems((current) => current.filter((t) => t.id !== id));
  const api = useMemo<ToastApi>(
    () => ({ success: (m) => push(m, "success"), error: (m) => push(m, "error") }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      <RadixToast.Provider swipeDirection="down" label="Notification">
        {children}
        {items.map((t) => (
          <RadixToast.Root
            key={t.id}
            className={`toast toast-${t.tone}`}
            duration={t.tone === "error" ? Infinity : 4000}
            type={t.tone === "error" ? "foreground" : "background"}
            onOpenChange={(open) => !open && remove(t.id)}
          >
            <RadixToast.Description className="toast-text">{t.message}</RadixToast.Description>
            {t.tone === "error" && (
              <RadixToast.Close className="toast-close" aria-label="Dismiss">
                <X size={16} aria-hidden="true" />
              </RadixToast.Close>
            )}
          </RadixToast.Root>
        ))}
        <RadixToast.Viewport className="toasts" />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast needs a ToastProvider");
  return api;
}
