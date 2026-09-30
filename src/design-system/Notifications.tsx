import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ActionSource } from "../agent/types/actions";
import type { AgentNotificationState } from "../agent/types/state";
import { Button } from "./Button";
import { IconClose } from "./icons";
import { cx } from "./types";

export interface Notification {
  id: string;
  tone: "info" | "success" | "warning" | "danger";
  title: string;
  description?: string;
  /** Who caused the change this notification reports. */
  source?: ActionSource;
  /** A single affordance, typically Undo. */
  action?: { label: string; onClick: () => void | Promise<void> };
  durationMs?: number;
  createdAt: number;
}

export interface NotificationsApi {
  items: Notification[];
  notify(notification: Omit<Notification, "id" | "createdAt"> & { id?: string }): string;
  dismiss(id: string): void;
  /** Snapshot in the shape the agent's readable state expects. */
  toAgentState(): AgentNotificationState[];
}

const NotificationsContext = createContext<NotificationsApi | null>(null);

let notificationSeq = 0;

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Notification[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const notify = useCallback<NotificationsApi["notify"]>(
    (input) => {
      const id = input.id ?? `note_${notificationSeq++}`;
      const notification: Notification = { ...input, id, createdAt: Date.now() };
      setItems((current) => [...current.filter((item) => item.id !== id), notification]);

      // Anything with an action stays until the user deals with it: an Undo that
      // disappears on a timer is worse than no Undo.
      const duration = input.durationMs ?? (input.action ? 0 : 5200);
      if (duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration),
        );
      }
      return id;
    },
    [dismiss],
  );

  const api = useMemo<NotificationsApi>(
    () => ({
      items,
      notify,
      dismiss,
      toAgentState: () =>
        items.map((item) => ({
          id: item.id,
          tone: item.tone,
          title: item.title,
          description: item.description,
          source: item.source,
          createdAt: item.createdAt,
        })),
    }),
    [items, notify, dismiss],
  );

  return (
    <NotificationsContext.Provider value={api}>
      {children}
      <ToastViewport items={items} onDismiss={dismiss} />
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsApi {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error("useNotifications() must be used inside a <NotificationsProvider>.");
  }
  return context;
}

function ToastViewport({
  items,
  onDismiss,
}: {
  items: Notification[];
  onDismiss: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="ds-toasts" role="region" aria-label="Notifications">
      {items.map((item) => (
        <div
          key={item.id}
          className={cx(
            "ds-toast",
            `ds-toast--${item.tone}`,
            item.source === "agent" && "ds-toast--agent",
          )}
          role={item.tone === "danger" ? "alert" : "status"}
        >
          <span className="ds-toast__marker" aria-hidden="true" />
          <div className="ds-toast__body">
            <span className="ds-toast__title">{item.title}</span>
            {item.description ? (
              <span className="ds-toast__description">{item.description}</span>
            ) : null}
            {item.action ? (
              <div className="ds-toast__actions">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    void item.action?.onClick();
                    onDismiss(item.id);
                  }}
                >
                  {item.action.label}
                </Button>
              </div>
            ) : null}
          </div>
          <Button
            size="sm"
            variant="ghost"
            iconOnly
            aria-label="Dismiss notification"
            onClick={() => onDismiss(item.id)}
          >
            <IconClose size={13} />
          </Button>
        </div>
      ))}
    </div>
  );
}
