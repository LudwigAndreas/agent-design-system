import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { cx } from "../../design-system/types";

/** Supported main/agent splits, expressed the way designers talk about them. */
export type AgentPanelSplit = "50/50" | "60/40" | "70/30" | "75/25" | "80/20";

const SPLIT_TO_PERCENT: Record<AgentPanelSplit, number> = {
  "50/50": 50,
  "60/40": 40,
  "70/30": 30,
  "75/25": 25,
  "80/20": 20,
};

const MOBILE_BREAKPOINT = 900;

export interface AgentShellState {
  open: boolean;
  fullscreen: boolean;
  /** Agent panel width as a percentage of the shell. */
  widthPercent: number;
  resizing: boolean;
  /** Below the breakpoint the panel is a drawer, not a column. */
  compact: boolean;
  setOpen(open: boolean): void;
  toggle(): void;
  setFullscreen(fullscreen: boolean): void;
  toggleFullscreen(): void;
  setWidthPercent(percent: number): void;
  setSplit(split: AgentPanelSplit): void;
  beginResize(event: ReactPointerEvent<HTMLElement>): void;
}

const AgentShellContext = createContext<AgentShellState | null>(null);

/** Returns null outside a shell, for components that work in either place. */
export function useOptionalAgentShell(): AgentShellState | null {
  return useContext(AgentShellContext);
}

export function useAgentShell(): AgentShellState {
  const context = useContext(AgentShellContext);
  if (!context) {
    throw new Error("useAgentShell() must be used inside an <AgentAppShell>.");
  }
  return context;
}

interface PersistedShellState {
  open: boolean;
  fullscreen: boolean;
  widthPercent: number;
}

function readPersisted(key: string): Partial<PersistedShellState> | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Partial<PersistedShellState>) : null;
  } catch {
    // Private windows and blocked site data both throw; a forgotten panel
    // position is not worth failing a render over.
    return null;
  }
}

const clampPercent = (percent: number) => Math.min(Math.max(percent, 12), 85);

export interface AgentAppShellProps {
  children: ReactNode;
  split?: AgentPanelSplit;
  defaultOpen?: boolean;
  /** Pass null to disable persistence. */
  storageKey?: string | null;
  minPanelWidth?: number;
  maxPanelWidth?: number;
  resizable?: boolean;
  className?: string;
}

/**
 * The canonical two-pane application layout: main UI beside a persistent agent
 * panel — collapsible, resizable, fullscreen-able, and a drawer on small
 * screens. Panel state persists so the agent stays where the user put it.
 */
export function AgentAppShell({
  children,
  split = "75/25",
  defaultOpen = true,
  storageKey = "agent-shell",
  minPanelWidth = 300,
  maxPanelWidth = 640,
  resizable = true,
  className,
}: AgentAppShellProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<PersistedShellState>(() => ({
    open: defaultOpen,
    fullscreen: false,
    widthPercent: SPLIT_TO_PERCENT[split],
  }));
  const [resizing, setResizing] = useState(false);
  const [compact, setCompact] = useState(false);
  const [hydrated, setHydrated] = useState(storageKey === null);

  // Read persisted state after mount so first render stays deterministic.
  useLayoutEffect(() => {
    if (!storageKey) return;
    const persisted = readPersisted(storageKey);
    if (persisted) setState((current) => ({ ...current, ...persisted }));
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || !hydrated) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // Non-fatal: the layout simply will not be remembered.
    }
  }, [storageKey, hydrated, state]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const sync = () => setCompact(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const setWidthPercent = useCallback((percent: number) => {
    setState((current) => ({ ...current, widthPercent: clampPercent(percent) }));
  }, []);

  const beginResize = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const container = containerRef.current;
      if (!resizable || !container) return;
      event.preventDefault();
      const bounds = container.getBoundingClientRect();
      setResizing(true);

      const move = (pointer: PointerEvent) => {
        const raw = Math.min(
          Math.max(bounds.right - pointer.clientX, minPanelWidth),
          maxPanelWidth,
        );
        setWidthPercent((raw / bounds.width) * 100);
      };
      const stop = () => {
        setResizing(false);
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", stop);
      };

      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", stop);
    },
    [resizable, minPanelWidth, maxPanelWidth, setWidthPercent],
  );

  const value = useMemo<AgentShellState>(
    () => ({
      open: state.open,
      fullscreen: state.fullscreen,
      widthPercent: state.widthPercent,
      resizing,
      compact,
      setOpen: (open) => setState((current) => ({ ...current, open })),
      toggle: () => setState((current) => ({ ...current, open: !current.open })),
      setFullscreen: (fullscreen) =>
        setState((current) => ({ ...current, fullscreen, open: fullscreen || current.open })),
      toggleFullscreen: () =>
        setState((current) => ({
          ...current,
          fullscreen: !current.fullscreen,
          open: current.fullscreen ? current.open : true,
        })),
      setWidthPercent,
      setSplit: (nextSplit) => setWidthPercent(SPLIT_TO_PERCENT[nextSplit]),
      beginResize: resizable ? beginResize : () => {},
    }),
    [state, resizing, compact, setWidthPercent, beginResize, resizable],
  );

  return (
    <AgentShellContext.Provider value={value}>
      <div
        ref={containerRef}
        className={cx(
          "agent-shell",
          !state.open && "agent-shell--collapsed",
          state.fullscreen && state.open && "agent-shell--fullscreen",
          resizing && "agent-shell--resizing",
          className,
        )}
        style={{ ["--agent-panel-width" as string]: `${state.widthPercent}%` }}
        data-agent-panel-open={state.open}
      >
        {children}
      </div>
    </AgentShellContext.Provider>
  );
}

function Main({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("agent-shell__main", className)}>
      <div className="agent-shell__main-scroll">{children}</div>
    </div>
  );
}

function AgentPanel({
  children,
  className,
  label = "Agent",
}: {
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  const shell = useAgentShell();
  const showHandle = shell.open && !shell.fullscreen && !shell.compact;

  return (
    <aside
      className={cx("agent-shell__panel", className)}
      aria-label={label}
      // On small screens the panel covers the app, so it is announced as a dialog.
      {...(shell.compact ? { role: "dialog", "aria-modal": false } : {})}
    >
      {showHandle ? (
        <button
          type="button"
          className="agent-shell__handle"
          aria-label="Resize agent panel"
          role="separator"
          aria-orientation="vertical"
          aria-valuenow={Math.round(shell.widthPercent)}
          onPointerDown={shell.beginResize}
          // Keyboard users resize in steps rather than dragging.
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") shell.setWidthPercent(shell.widthPercent + 3);
            if (event.key === "ArrowRight") shell.setWidthPercent(shell.widthPercent - 3);
          }}
        />
      ) : null}
      {children}
    </aside>
  );
}

function Footer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("agent-shell__footer", className)}>{children}</div>;
}

AgentAppShell.Main = Main;
AgentAppShell.AgentPanel = AgentPanel;
AgentAppShell.Footer = Footer;
