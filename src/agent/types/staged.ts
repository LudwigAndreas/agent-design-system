import type { AgentTargetId } from "./metadata";
import type { ResolvedPredicate } from "./query";

/**
 * Staged operations.
 *
 * A third outcome alongside "execute" and "confirm then execute": the agent
 * prepares the work and hands the trigger to the user. Right for anything
 * expensive, slow, or that produces an artifact the user has to receive.
 *
 * A staged operation is an object, not a question. It persists, it can go
 * stale, and it can be discarded without ever running — which is what makes
 * it different from a confirmation.
 */

export type StagedStatus =
  | "staged"
  /** Its recorded inputs no longer match the application's current state. */
  | "stale"
  | "running"
  | "completed"
  | "failed"
  | "discarded";

/** What the user is shown before deciding whether to trigger. */
export interface StagedSummary {
  /** What the operation will do, in one line. */
  title: string;
  description?: string;
  /** The query it will run against, resolved and readable. */
  predicate?: ResolvedPredicate;
  /** How many records the query matched when the operation was prepared. */
  matchCount?: number;
  /** Any other input worth showing, as label/value pairs. */
  inputs?: { label: string; value: string }[];
}

export interface StagedOperation {
  id: string;
  /** The action that prepared it. */
  actionId: string;
  target: AgentTargetId;
  label: string;
  summary: StagedSummary;
  status: StagedStatus;
  /**
   * Fingerprint of the resolved inputs and the target's observed value at
   * preparation time. Recomputed on trigger to detect staleness.
   */
  fingerprint: string;
  stagedAt: number;
  /** What the operation produced, once it has run. */
  result?: StagedResult;
  /** Why it failed, when it did. */
  error?: string;
  /** What changed, when it went stale. */
  staleReason?: string;
}

export interface StagedResult {
  message: string;
  /** A produced file, offered to the user. */
  artifact?: StagedArtifact;
}

export interface StagedArtifact {
  filename: string;
  mediaType: string;
  /** Object URL the user can download from. */
  url: string;
  /** Size in bytes, when known. */
  size?: number;
}

/**
 * What an operation returns when it runs. The application does the work; the
 * agent layer only carries the outcome.
 */
export interface StagedRunOutcome {
  message: string;
  artifact?: StagedArtifact;
}
