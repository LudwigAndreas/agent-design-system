import type { ResolvedPredicate } from "../types/query";
import { resolvedComparisons } from "../types/query";
import type {
  StagedOperation,
  StagedRunOutcome,
  StagedStatus,
  StagedSummary,
} from "../types/staged";

/**
 * The store of operations the agent has prepared and the user has not yet
 * triggered.
 *
 * A staged operation is an object rather than a question: it persists, it can
 * go stale, and it can be discarded without ever running. That is what makes
 * it different from a confirmation, which is answered once and then gone.
 */

let sequence = 0;
const nextId = () => `stg_${Date.now().toString(36)}_${(sequence++).toString(36)}`;

/**
 * A stable digest of what the operation was prepared against.
 *
 * Deliberately narrow: the resolved predicate, the match count and the
 * target's observed value, and nothing else. Fingerprinting unrelated
 * application state would mark exports stale for changes that cannot affect
 * them, and a staleness warning nobody believes is worse than none.
 */
export function fingerprintInputs(input: {
  predicate?: ResolvedPredicate;
  matchCount?: number;
  targetValue?: unknown;
}): string {
  const conditions = resolvedComparisons(input.predicate).map(
    (leaf) => `${leaf.field}|${leaf.op}|${JSON.stringify(leaf.value ?? null)}`,
  );
  return JSON.stringify({
    conditions,
    matchCount: input.matchCount ?? null,
    value: input.targetValue ?? null,
  });
}

export interface StagedStoreOptions {
  /** Notified whenever any staged operation changes. */
  onChange: () => void;
}

export interface PrepareInput {
  actionId: string;
  target: string;
  label: string;
  summary: StagedSummary;
  fingerprint: string;
  /** The application function this operation runs. */
  run: (params?: Record<string, unknown>) => Promise<StagedRunOutcome | void>;
  /** Recomputed at trigger time to detect staleness. */
  currentFingerprint: () => string;
  /** Rebuilds the summary from current state when the operation is refreshed. */
  currentSummary: () => StagedSummary;
}

export interface TriggerOutcome {
  operation: StagedOperation;
  /** False when the trigger stopped at a staleness check instead of running. */
  ran: boolean;
}

export interface StagedStore {
  prepare(input: PrepareInput): StagedOperation;
  get(id: string): StagedOperation | undefined;
  list(): StagedOperation[];
  /** Runs it. Stops short and reports staleness if the inputs have moved. */
  trigger(id: string): Promise<TriggerOutcome | undefined>;
  discard(id: string): StagedOperation | undefined;
  /** Drops operations whose target is no longer registered. */
  pruneUnmounted(isRegistered: (target: string) => boolean): void;
}

export function createStagedStore(options: StagedStoreOptions): StagedStore {
  const operations = new Map<string, StagedOperation>();
  const internals = new Map<string, PrepareInput>();

  const update = (id: string, patch: Partial<StagedOperation>) => {
    const current = operations.get(id);
    if (!current) return undefined;
    const next = { ...current, ...patch };
    operations.set(id, next);
    options.onChange();
    return next;
  };

  const settle = (id: string, status: StagedStatus) => {
    internals.delete(id);
    return update(id, { status });
  };

  return {
    prepare(input) {
      const operation: StagedOperation = {
        id: nextId(),
        actionId: input.actionId,
        target: input.target,
        label: input.label,
        summary: input.summary,
        status: "staged",
        fingerprint: input.fingerprint,
        stagedAt: Date.now(),
      };
      operations.set(operation.id, operation);
      internals.set(operation.id, input);
      options.onChange();
      return operation;
    },

    get: (id) => operations.get(id),
    list: () => [...operations.values()],

    async trigger(id) {
      const operation = operations.get(id);
      const internal = internals.get(id);
      if (!operation || !internal) return undefined;
      if (operation.status === "running") return { operation, ran: false };

      // First trigger on a staged operation checks whether its inputs still
      // hold. If they have moved, the user is told and nothing runs; a second
      // trigger then proceeds against current state.
      if (operation.status === "staged") {
        const current = internal.currentFingerprint();
        if (current !== operation.fingerprint) {
          const stale = update(id, {
            status: "stale",
            summary: internal.currentSummary(),
            fingerprint: current,
            staleReason:
              "The query this was prepared against has changed. " +
              "Running it now will use the current one.",
          });
          return stale ? { operation: stale, ran: false } : undefined;
        }
      }

      // A stale operation the user chose to proceed with runs against current
      // state, never against what was recorded when it was prepared.
      const summary = internal.currentSummary();
      update(id, { status: "running", summary, fingerprint: internal.currentFingerprint() });

      try {
        const outcome = await internal.run();
        internals.delete(id);
        const completed = update(id, {
          status: "completed",
          result: outcome
            ? { message: outcome.message, artifact: outcome.artifact }
            : { message: `${operation.label} completed` },
          staleReason: undefined,
        });
        return completed ? { operation: completed, ran: true } : undefined;
      } catch (error) {
        internals.delete(id);
        const failed = update(id, {
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
          staleReason: undefined,
        });
        return failed ? { operation: failed, ran: true } : undefined;
      }
    },

    discard(id) {
      const operation = operations.get(id);
      if (!operation) return undefined;
      // Discarding performs no part of the work and touches no state.
      return settle(id, "discarded");
    },

    pruneUnmounted(isRegistered) {
      for (const operation of operations.values()) {
        const live = operation.status === "staged" || operation.status === "stale";
        if (live && !isRegistered(operation.target)) {
          settle(operation.id, "discarded");
        }
      }
    },
  };
}
