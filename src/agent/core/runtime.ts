import type {
  AgentAction,
  AgentActionRecord,
  AgentActionResult,
  ResolvedAgentAction,
} from "../types/actions";
import type { AgentEventBus } from "../types/events";
import type { AgentActionPolicy, AgentPolicyResolver } from "../types/policy";
import type { AgentReadableState } from "../types/state";
import type { AgentUIRegistry } from "../types/registry";
import { ACTION_CAPABILITY, supportsCapability } from "./capabilities";
import { composePolicy } from "./policy";
import { buildActionPreview } from "./preview";
import { resolveAction } from "./registry";

export interface AgentNavigation {
  navigate(target: string, params?: Record<string, string>): Promise<AgentActionResult>;
  focus(target: string): Promise<AgentActionResult>;
  reveal(target: string): Promise<AgentActionResult>;
}

export interface PendingConfirmation {
  action: ResolvedAgentAction;
  policy: AgentActionPolicy;
  resolve(confirmed: boolean): void;
}

export interface AgentRuntimeOptions {
  registry: AgentUIRegistry;
  events: AgentEventBus;
  policy?: AgentPolicyResolver;
  /** Spotlight hook; called for reveal/focus so the UI can highlight. */
  onSpotlight?: (target: string) => void;
  /** Cap on the retained audit log. */
  historyLimit?: number;
}

export interface AgentRuntime extends AgentNavigation {
  /**
   * The full lifecycle: requested → validated → awaiting-confirmation →
   * executing → succeeded | failed | cancelled. Never throws for a rejected
   * action; the result carries the failure.
   */
  execute(action: AgentAction): Promise<AgentActionResult>;
  confirm(actionId: string): void;
  cancelConfirmation(actionId: string): void;
  getPendingConfirmations(): PendingConfirmation[];
  getState(): AgentReadableState;
  getHistory(): AgentActionRecord[];
  /** Reverses the most recent undoable action. */
  undoLast(): Promise<AgentActionResult | undefined>;
  setTurnId(turnId: string): void;
  subscribe(listener: () => void): () => void;
}

export function createAgentRuntime(options: AgentRuntimeOptions): AgentRuntime {
  const { registry, events, policy, onSpotlight } = options;
  const historyLimit = options.historyLimit ?? 100;

  const pending = new Map<string, PendingConfirmation>();
  const history: AgentActionRecord[] = [];
  const listeners = new Set<() => void>();
  let turnId = "turn_0";

  const notify = () => {
    for (const listener of [...listeners]) listener();
  };

  const record = (entry: AgentActionRecord) => {
    history.push(entry);
    if (history.length > historyLimit) history.shift();
    notify();
  };

  const runtime: AgentRuntime = {
    setTurnId(next) {
      turnId = next;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    getState: () => registry.getReadableState(),
    getHistory: () => [...history],
    getPendingConfirmations: () => [...pending.values()],

    async execute(rawAction) {
      const action = resolveAction(rawAction);
      const entry: AgentActionRecord = {
        action,
        status: "requested",
        startedAt: Date.now(),
      };
      record(entry);
      events.emit({ type: "action-requested", turnId, action });

      const finish = (result: AgentActionResult): AgentActionResult => {
        entry.status = result.status;
        entry.endedAt = Date.now();
        entry.result = result;
        notify();
        if (result.success) {
          events.emit({ type: "action-completed", turnId, action, result });
        } else if (result.status === "cancelled") {
          events.emit({ type: "action-cancelled", turnId, action });
        } else {
          events.emit({
            type: "action-failed",
            turnId,
            action,
            error: result.error ?? { code: "execution-failed", message: "Unknown failure" },
          });
        }
        return result;
      };

      // ---- validate -------------------------------------------------------
      // Cheap structural checks first, so we never ask the user to confirm an
      // action that could not have run anyway.
      const state = registry.getReadableState();
      const element =
        action.type === "navigate" ? undefined : registry.getElementState(action.target);

      if (action.type !== "navigate") {
        const registration = registry.get(action.target);
        if (!registration) {
          return finish({
            success: false,
            action,
            status: "failed",
            message: `I couldn't find "${action.target}" in the current interface.`,
            error: {
              code: "unknown-target",
              message: `No agent target registered with id "${action.target}".`,
              userMessage: `I couldn't find "${action.target}" in the current interface.`,
            },
          });
        }
        const capability = ACTION_CAPABILITY[action.type];
        if (!supportsCapability(registration, capability)) {
          return finish({
            success: false,
            action,
            status: "failed",
            message: `"${element?.label ?? action.target}" can't be changed that way.`,
            error: {
              code: "capability-unsupported",
              message: `Target "${action.target}" does not support "${capability}".`,
              userMessage: `"${element?.label ?? action.target}" can't be changed that way.`,
            },
          });
        }
      }

      entry.status = "validated";
      notify();

      // ---- policy & confirmation -----------------------------------------
      const actionPolicy = composePolicy(policy, { action, element, state });

      if (actionPolicy.requiresConfirmation && action.source !== "user") {
        entry.status = "awaiting-confirmation";
        notify();

        // Read the live value rather than the published one. A sensitive
        // target withholds its value from the agent, but the person being
        // asked to approve the change is entitled to see what it is now.
        const previewElement =
          element && "target" in action
            ? { ...element, value: registry.get(action.target)?.handlers.read?.() ?? element.value }
            : element;

        const preview = buildActionPreview(action, previewElement, actionPolicy);
        events.emit({ type: "confirmation-required", turnId, action, preview });

        const confirmed = await new Promise<boolean>((resolve) => {
          pending.set(action.id, { action, policy: actionPolicy, resolve });
          notify();
        });
        pending.delete(action.id);
        events.emit({ type: "confirmation-resolved", turnId, action, confirmed });

        if (!confirmed) {
          return finish({
            success: false,
            action,
            status: "cancelled",
            message: "Cancelled — nothing was changed.",
            error: {
              code: "cancelled",
              message: "The user declined the action.",
              userMessage: "Cancelled — nothing was changed.",
            },
          });
        }
      }

      // ---- execute --------------------------------------------------------
      entry.status = "executing";
      notify();
      events.emit({ type: "action-started", turnId, action });

      if (action.type === "navigate") {
        events.emit({
          type: "navigation-started",
          turnId,
          target: action.target,
          params: action.params,
        });
      }
      if (action.type === "reveal" || action.type === "focus" || action.type === "scroll-to") {
        onSpotlight?.(action.target);
      }

      const result = await registry.execute(action);

      if (action.type === "navigate" && result.success) {
        events.emit({
          type: "navigation-completed",
          turnId,
          route: registry.getReadableState().route,
        });
      }

      // Publish the post-action truth so the adapter reads reality, not hope.
      events.emit({
        type: "state-changed",
        turnId,
        state: registry.getReadableState(),
        cause: action.source ?? "agent",
      });

      return finish(result);
    },

    confirm(actionId) {
      pending.get(actionId)?.resolve(true);
    },

    cancelConfirmation(actionId) {
      pending.get(actionId)?.resolve(false);
    },

    async undoLast() {
      for (let i = history.length - 1; i >= 0; i -= 1) {
        const entry = history[i];
        if (entry?.result?.success && entry.result.undo) {
          const undo = entry.result.undo;
          // Retire the affordance first: undo is offered once.
          entry.result = { ...entry.result, undo: undefined };
          notify();
          return undo();
        }
      }
      return undefined;
    },

    navigate: (target, params) => runtime.execute({ type: "navigate", target, params }),
    focus: (target) => runtime.execute({ type: "focus", target }),
    reveal: (target) => runtime.execute({ type: "reveal", target }),
  };

  return runtime;
}
