import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AgentAction, AgentActionRecord, AgentActionResult } from "../types/actions";
import type { AgentAdapter, AgentTurnContext } from "../types/adapter";
import type { AgentEvent, AgentEventBus } from "../types/events";
import type { AgentAttachment } from "../types/messages";
import type { AgentPolicyResolver } from "../types/policy";
import type { AgentReadableState } from "../types/state";
import type { StagedOperation } from "../types/staged";
import type { AgentRegistryEnvironment, AgentUIRegistry } from "../types/registry";
import { createAgentEventBus } from "../core/eventBus";
import { createAgentRegistry } from "../core/registry";
import { createAgentRuntime, type AgentRuntime } from "../core/runtime";
import {
  conversationReducer,
  initialConversationState,
  nextMessageId,
  type ConversationState,
} from "./conversation";

export interface AgentContextValue {
  adapter: AgentAdapter;
  registry: AgentUIRegistry;
  runtime: AgentRuntime;
  events: AgentEventBus;

  conversation: ConversationState;
  /** `true` while a turn is in flight. */
  busy: boolean;

  sendMessage(text: string, attachments?: AgentAttachment[]): Promise<void>;
  stop(): void;
  /** Re-runs the last user message after a failure. */
  retry(): Promise<void>;
  /** Drops the last assistant turn and asks again. */
  regenerate(): Promise<void>;
  clear(): void;

  executeAction(action: AgentAction): Promise<AgentActionResult>;
  confirm(actionId: string): void;
  cancel(actionId: string): void;
  undo(actionId?: string): Promise<AgentActionResult | undefined>;

  navigate(target: string, params?: Record<string, string>): Promise<AgentActionResult>;
  focus(target: string): Promise<AgentActionResult>;
  reveal(target: string): Promise<AgentActionResult>;

  getState(): AgentReadableState;
  history: AgentActionRecord[];

  /** Operations the agent prepared and the user has not yet run. */
  stagedOperations: StagedOperation[];
  /** Runs a staged operation. Only reachable from the UI, never the agent. */
  triggerStaged(id: string): Promise<AgentActionResult>;
  discardStaged(id: string): void;

  /** Target currently spotlighted by the agent, if any. */
  spotlightTarget?: string;
  spotlight(target: string, durationMs?: number): void;
  clearSpotlight(): void;

  /** Latest polite announcement for assistive technology. */
  announcement: string;
  announce(message: string): void;
}

export const AgentReactContext = createContext<AgentContextValue | null>(null);

export interface AgentProviderProps {
  adapter: AgentAdapter;
  /** Application rules for when the user must be asked first. */
  policy?: AgentPolicyResolver;
  /**
   * The application's router and ambient state. Closures are read through a
   * ref, so they may be recreated on every render.
   */
  environment?: AgentRegistryEnvironment;
  /** Shown by `AgentSuggestions` when no page provides its own. */
  defaultSuggestions?: string[];
  /** Overridable for tests. */
  verifyTimeoutMs?: number;
  spotlightDurationMs?: number;
  children: ReactNode;
}

/**
 * Events the runtime already publishes on the bus. If an adapter also yields
 * them we drop the duplicate: the bus is the single source of truth for what
 * actually happened to application state.
 */
const RUNTIME_OWNED: ReadonlySet<AgentEvent["type"]> = new Set([
  "action-requested",
  "action-started",
  "action-completed",
  "action-failed",
  "action-cancelled",
  "confirmation-required",
  "confirmation-resolved",
  "navigation-started",
  "navigation-completed",
  "state-changed",
]);

export function AgentProvider({
  adapter,
  policy,
  environment,
  defaultSuggestions,
  verifyTimeoutMs,
  spotlightDurationMs = 2600,
  children,
}: AgentProviderProps) {
  const [conversation, dispatch] = useReducer(conversationReducer, {
    ...initialConversationState,
    suggestions: defaultSuggestions ?? [],
  });
  const [announcement, setAnnouncement] = useState("");
  const [spotlightTarget, setSpotlightTarget] = useState<string | undefined>();
  const [history, setHistory] = useState<AgentActionRecord[]>([]);
  const [stagedOperations, setStagedOperations] = useState<StagedOperation[]>([]);

  const spotlightTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const abortRef = useRef<AbortController>(undefined);
  const conversationRef = useRef(conversation);
  conversationRef.current = conversation;

  // Policy and environment are read late, so callers may pass fresh closures.
  const policyRef = useRef(policy);
  policyRef.current = policy;
  const environmentRef = useRef(environment);
  environmentRef.current = environment;

  const events = useMemo(() => createAgentEventBus(), []);
  const registry = useMemo(
    () => createAgentRegistry({ verifyTimeoutMs }),
    [verifyTimeoutMs],
  );

  const clearSpotlight = useCallback(() => {
    clearTimeout(spotlightTimer.current);
    setSpotlightTarget(undefined);
  }, []);

  const spotlight = useCallback(
    (target: string, durationMs = spotlightDurationMs) => {
      clearTimeout(spotlightTimer.current);
      setSpotlightTarget(target);
      spotlightTimer.current = setTimeout(() => setSpotlightTarget(undefined), durationMs);
    },
    [spotlightDurationMs],
  );

  const runtime = useMemo(
    () =>
      createAgentRuntime({
        registry,
        events,
        policy: (context) => policyRef.current?.(context),
        onSpotlight: (target) => spotlight(target),
      }),
    [registry, events, spotlight],
  );

  // Bridge the application's router/state into registry snapshots.
  useEffect(() => {
    // Every hook is forwarded through the ref, so the application may hand
    // over fresh closures on each render without re-registering anything.
    registry.setEnvironment({
      getRoute: () => environmentRef.current?.getRoute?.() ?? { route: "unknown" },
      getNotifications: () => environmentRef.current?.getNotifications?.() ?? [],
      navigate: (target, params) => environmentRef.current?.navigate?.(target, params),
      getContextReferences: () => environmentRef.current?.getContextReferences?.() ?? [],
      getQueryLocale: () => environmentRef.current?.getQueryLocale?.(),
      resolveContext: (id) =>
        environmentRef.current?.resolveContext?.(id) ?? {
          ok: false,
          reason: "this application resolves no context references",
        },
      describeValue: (entity, value) => environmentRef.current?.describeValue?.(entity, value),
      lookupEntity: (entity, by, value) =>
        environmentRef.current?.lookupEntity?.(entity, by, value) ?? {
          ok: false,
          reason: "unsupported",
        },
    });
  }, [registry]);

  useEffect(
    () =>
      runtime.subscribe(() => {
        setHistory(runtime.getHistory());
        setStagedOperations(runtime.getStagedOperations());
      }),
    [runtime],
  );

  // The bus drives the transcript for everything state-related.
  useEffect(
    () =>
      events.subscribe((event) => {
        dispatch({ kind: "event", event });

        // Deliberately sparse: announcing every internal event would make the
        // live region unusable.
        if (event.type === "action-completed" && event.result.success) {
          setAnnouncement(`Agent ${event.result.message ?? "completed an action"}.`);
        } else if (event.type === "action-failed") {
          setAnnouncement(
            `Agent action failed. ${event.error.userMessage ?? event.error.message}`,
          );
        } else if (event.type === "confirmation-required") {
          setAnnouncement(`Agent is asking you to confirm: ${event.preview.title}.`);
        } else if (event.type === "navigation-completed") {
          setAnnouncement(`Agent navigated to ${event.route}.`);
        } else if (event.type === "action-staged") {
          setAnnouncement(
            `Agent prepared ${event.operation.label}. It is waiting for you to run it.`,
          );
        } else if (event.type === "staged-updated" && event.operation.status === "completed") {
          setAnnouncement(event.operation.result?.message ?? `${event.operation.label} finished.`);
        }
      }),
    [events],
  );

  useEffect(() => () => clearTimeout(spotlightTimer.current), []);

  const runTurn = useCallback(
    async (text: string, attachments?: AgentAttachment[]) => {
      if (!text.trim() && !attachments?.length) return;

      const turnId = nextMessageId("turn");
      runtime.setTurnId(turnId);
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      dispatch({ kind: "user-message", text, attachments, turnId });
      dispatch({ kind: "turn-start", turnId });

      const context: AgentTurnContext = {
        input: { text, attachments },
        history: conversationRef.current.messages,
        state: registry.getReadableState(),
        getState: () => registry.getReadableState(),
        execute: (action) => runtime.execute(action),
        signal: controller.signal,
        turnId,
      };

      try {
        for await (const event of adapter.sendMessage(context)) {
          if (controller.signal.aborted) break;
          if (RUNTIME_OWNED.has(event.type)) continue;
          dispatch({ kind: "event", event });
        }
        dispatch({
          kind: "turn-end",
          turnId,
          outcome: controller.signal.aborted ? "stopped" : "completed",
        });
      } catch (error) {
        if (controller.signal.aborted) {
          dispatch({ kind: "turn-end", turnId, outcome: "stopped" });
          return;
        }
        const message = error instanceof Error ? error.message : String(error);
        dispatch({ kind: "turn-end", turnId, outcome: "failed", error: message });
      } finally {
        if (abortRef.current === controller) abortRef.current = undefined;
      }
    },
    [adapter, registry, runtime],
  );

  const value = useMemo<AgentContextValue>(
    () => ({
      adapter,
      registry,
      runtime,
      events,
      conversation,
      busy: conversation.status === "streaming",
      sendMessage: runTurn,
      stop: () => {
        abortRef.current?.abort();
        // A stop mid-confirmation would otherwise leave the promise hanging.
        for (const pending of runtime.getPendingConfirmations()) {
          runtime.cancelConfirmation(pending.action.id);
        }
      },
      retry: async () => {
        const last = conversationRef.current.lastInput;
        if (last) await runTurn(last.text, last.attachments);
      },
      regenerate: async () => {
        const { messages, lastInput } = conversationRef.current;
        if (!lastInput) return;
        for (let i = messages.length - 1; i >= 0; i -= 1) {
          if (messages[i]?.role === "user") {
            dispatch({ kind: "drop-from", messageId: messages[i]!.id });
            break;
          }
        }
        await runTurn(lastInput.text, lastInput.attachments);
      },
      clear: () => dispatch({ kind: "clear" }),
      executeAction: (action) => runtime.execute(action),
      confirm: (actionId) => runtime.confirm(actionId),
      cancel: (actionId) => runtime.cancelConfirmation(actionId),
      undo: async (actionId) => {
        const entry = actionId
          ? runtime.getHistory().find((h) => h.action.id === actionId)
          : undefined;
        const result = entry?.result?.undo ? await entry.result.undo() : await runtime.undoLast();
        if (result?.success) {
          dispatch({ kind: "mark-undone", actionId: actionId ?? result.action.id });
          setAnnouncement("Agent change undone.");
        }
        return result;
      },
      navigate: runtime.navigate,
      focus: runtime.focus,
      reveal: runtime.reveal,
      getState: () => registry.getReadableState(),
      history,
      stagedOperations,
      triggerStaged: (id) => runtime.triggerStaged(id, "user"),
      discardStaged: (id) => runtime.discardStaged(id),
      spotlightTarget,
      spotlight,
      clearSpotlight,
      announcement,
      announce: setAnnouncement,
    }),
    [
      adapter,
      registry,
      runtime,
      events,
      conversation,
      runTurn,
      history,
      stagedOperations,
      spotlightTarget,
      spotlight,
      clearSpotlight,
      announcement,
    ],
  );

  return <AgentReactContext.Provider value={value}>{children}</AgentReactContext.Provider>;
}
