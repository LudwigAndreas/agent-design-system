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
import type { StagedOperation, StagedSummary } from "../types/staged";
import { ACTION_CAPABILITY, supportsCapability } from "./capabilities";
import { composePolicy } from "./policy";
import { buildActionPreview } from "./preview";
import { resolveAction } from "./registry";
import { createStagedStore, fingerprintInputs } from "./staged";
import type { ResolvedPredicate } from "../types/query";

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

  /** Operations prepared by the agent and waiting for the user. */
  getStagedOperations(): StagedOperation[];
  /**
   * Runs a staged operation. Only the user may do this: an agent-sourced
   * trigger is refused and the operation stays staged.
   */
  triggerStaged(id: string, source?: "user" | "agent" | "system"): Promise<AgentActionResult>;
  /** Abandons a staged operation without performing any part of it. */
  discardStaged(id: string): void;
  getState(): AgentReadableState;
  getHistory(): AgentActionRecord[];
  /** Reverses the most recent undoable action. */
  undoLast(): Promise<AgentActionResult | undefined>;
  setTurnId(turnId: string): void;
  subscribe(listener: () => void): () => void;
}

/** How long a target may be absent before its staged work is abandoned. */
const UNMOUNT_GRACE_MS = 150;

export function createAgentRuntime(options: AgentRuntimeOptions): AgentRuntime {
  const { registry, events, policy, onSpotlight } = options;
  const historyLimit = options.historyLimit ?? 100;

  const pending = new Map<string, PendingConfirmation>();
  const staged = createStagedStore({ onChange: () => notify() });
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

  // The registry owns the readable state, so it asks us what is staged.
  registry.setEnvironment({
    getStagedOperations: () =>
      staged
        .list()
        .filter((operation) => operation.status === "staged" || operation.status === "stale")
        .map((operation) => ({
          id: operation.id,
          label: operation.label,
          status: operation.status,
        })),
  });

  // A staged operation whose screen has gone is no longer meaningful.
  //
  // Checked after a grace period rather than on the notification itself:
  // React unregisters and re-registers a target whenever its description
  // changes, and treating that momentary gap as an unmount would discard
  // perfectly good work every time the page re-rendered.
  let pruneTimer: ReturnType<typeof setTimeout> | undefined;
  registry.subscribe(() => {
    clearTimeout(pruneTimer);
    pruneTimer = setTimeout(() => {
      staged.pruneUnmounted((target) => registry.get(target) !== undefined);
    }, UNMOUNT_GRACE_MS);
  });

  /** Builds the summary a staged operation is presented with. */
  function summarise(
    declared: { label: string; description?: string; queryTarget?: string },
  ): StagedSummary {
    const queryTarget = declared.queryTarget;
    const element = queryTarget ? registry.getElementState(queryTarget) : undefined;
    return {
      title: declared.label,
      description: declared.description,
      predicate: queryTarget ? registry.getResolvedQuery(queryTarget) : undefined,
      matchCount: element?.data?.rowCount as number | undefined,
    };
  }

  function fingerprintFor(declared: { queryTarget?: string }): string {
    const queryTarget = declared.queryTarget;
    const element = queryTarget ? registry.getElementState(queryTarget) : undefined;
    return fingerprintInputs({
      predicate: queryTarget ? registry.getResolvedQuery(queryTarget) : undefined,
      matchCount: element?.data?.rowCount as number | undefined,
      targetValue: element?.value,
    });
  }

  /** The query target of a declared action, when it names one. */
  function declaredQueryTarget(action: ResolvedAgentAction): string | undefined {
    if (action.type !== "invoke") return undefined;
    return registry
      .getDeclaredActions()
      .find((candidate) => candidate.id === action.target)?.queryTarget;
  }

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

      // A query is validated and resolved here, before policy and before the
      // user is asked anything. Two things follow: a bad query never becomes
      // a question, and a good one can be shown resolved — an interpreted
      // date reads as "11 September 2025" in the confirmation, not as the
      // numeric string the agent sent.
      let prepared: ResolvedPredicate | undefined;
      if (action.type === "filter") {
        const preparation = await registry.prepareQuery(action.target, action.filter);
        if (!preparation.ok) {
          const summary = preparation.problems.map((problem) => problem.message).join(" ");
          return finish({
            success: false,
            action,
            status: "failed",
            message: summary,
            error: {
              code:
                preparation.code === "unresolved-reference"
                  ? "unresolved-reference"
                  : "invalid-query",
              message: summary,
              userMessage: summary,
              problems: preparation.problems,
            },
          });
        }
        prepared = preparation.resolved;
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

        const preview = buildActionPreview(action, previewElement, actionPolicy, {
          predicate: prepared,
          // The query already in effect on the target this operation runs on.
          queryTarget: declaredQueryTarget(action),
          resolvedQuery: (target: string) => registry.getResolvedQuery(target),
          matchCount: (target: string) =>
            registry.getElementState(target)?.data?.rowCount as number | undefined,
        });
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

      // ---- stage ----------------------------------------------------------
      // After confirmation, before execution: a staging operation is prepared
      // and handed to the user. Confirmation gates the preparation; the user's
      // trigger gates the work.
      const declared =
        action.type === "invoke"
          ? registry.getDeclaredActions().find((candidate) => candidate.id === action.target)
          : undefined;

      if (declared?.stages && action.type === "invoke") {
        const invokeAction = action;
        const registration = registry.get(action.target);
        const invoke = registration?.handlers.invoke;
        if (!invoke) {
          return finish({
            success: false,
            action,
            status: "failed",
            message: `"${declared.label}" cannot be run.`,
            error: {
              code: "capability-unsupported",
              message: `Target "${action.target}" declares staging but has no handler.`,
              userMessage: `"${declared.label}" cannot be run.`,
            },
          });
        }

        const operation = staged.prepare({
          actionId: action.id,
          target: action.target,
          label: declared.label,
          summary: summarise(declared),
          fingerprint: fingerprintFor(declared),
          currentSummary: () => summarise(declared),
          currentFingerprint: () => fingerprintFor(declared),
          run: async (params) => {
            const outcome = await invoke(params ?? invokeAction.params);
            return outcome ?? undefined;
          },
        });

        entry.status = "staged";
        entry.endedAt = Date.now();
        notify();
        events.emit({ type: "action-staged", turnId, action, operation });

        const result: AgentActionResult = {
          // Not a success: nothing has been done, and it may never be.
          success: false,
          action,
          status: "staged",
          message: `${declared.label} is ready — trigger it when you want it to run.`,
          staged: operation,
          matchCount: operation.summary.matchCount,
        };
        entry.result = result;
        notify();
        return result;
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

      const result = await registry.execute(action, { prepared });

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

    getStagedOperations: () => staged.list(),

    async triggerStaged(id, source = "user") {
      const existing = staged.get(id);
      const base: ResolvedAgentAction = {
        type: "invoke",
        target: existing?.target ?? id,
        id: `trigger_${id}`,
        source: source,
      };

      if (!existing) {
        return {
          success: false,
          action: base,
          status: "failed",
          message: "That operation is no longer available.",
          error: {
            code: "unknown-target",
            message: `No staged operation with id "${id}".`,
            userMessage: "That operation is no longer available.",
          },
        };
      }

      // Only the user may trigger. The agent prepared it; it does not get to
      // decide that the work happens.
      if (source !== "user") {
        return {
          success: false,
          action: base,
          status: "staged",
          message: `"${existing.label}" is ready, but only you can run it.`,
          staged: existing,
          error: {
            code: "requires-user-trigger",
            message: `Staged operation "${id}" may only be triggered by the user.`,
            userMessage: `"${existing.label}" is ready, but only you can run it.`,
          },
        };
      }

      const outcome = await staged.trigger(id);
      if (!outcome) {
        return {
          success: false,
          action: base,
          status: "failed",
          message: "That operation is no longer available.",
          error: {
            code: "unknown-target",
            message: `Staged operation "${id}" could not be run.`,
          },
        };
      }

      events.emit({ type: "staged-updated", turnId, operation: outcome.operation });

      if (!outcome.ran) {
        // Stopped at the staleness check: the user is told, and nothing ran.
        return {
          success: false,
          action: base,
          status: "staged",
          message: outcome.operation.staleReason ?? "The inputs have changed.",
          staged: outcome.operation,
        };
      }

      const succeeded = outcome.operation.status === "completed";
      return {
        success: succeeded,
        action: base,
        status: succeeded ? "succeeded" : "failed",
        message:
          outcome.operation.result?.message ??
          outcome.operation.error ??
          `${outcome.operation.label} finished`,
        staged: outcome.operation,
        error: succeeded
          ? undefined
          : {
              code: "execution-failed",
              message: outcome.operation.error ?? "The operation failed.",
              userMessage: outcome.operation.error ?? "The operation failed.",
            },
      };
    },

    discardStaged(id) {
      const operation = staged.discard(id);
      if (operation) events.emit({ type: "staged-updated", turnId, operation });
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
