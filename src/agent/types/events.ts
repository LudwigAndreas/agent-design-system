import type {
  AgentAction,
  AgentActionError,
  AgentActionResult,
  ResolvedAgentAction,
} from "./actions";
import type { AgentReadableState } from "./state";

/**
 * Provider-neutral event stream. An adapter yields these; the UI renders them.
 * No adapter is allowed to leak a vendor's wire format past this boundary.
 */

export interface AgentEventBase {
  /** Ties the event to a conversation turn. */
  turnId: string;
  at?: number;
}

export interface AgentTurnStarted extends AgentEventBase {
  type: "turn-started";
}

export interface AgentTextDelta extends AgentEventBase {
  type: "text-delta";
  /** Appended to the current assistant message. */
  delta: string;
  /** Distinguishes parallel assistant blocks within one turn. */
  blockId?: string;
}

export interface AgentThinkingDelta extends AgentEventBase {
  type: "thinking-delta";
  delta: string;
}

export interface AgentToolStarted extends AgentEventBase {
  type: "tool-started";
  toolCallId: string;
  name: string;
  /** Present-tense label, e.g. "Searching your account". */
  label?: string;
  input?: unknown;
}

export interface AgentToolCompleted extends AgentEventBase {
  type: "tool-completed";
  toolCallId: string;
  summary?: string;
  output?: unknown;
}

export interface AgentToolFailed extends AgentEventBase {
  type: "tool-failed";
  toolCallId: string;
  error: string;
}

export interface AgentActionRequested extends AgentEventBase {
  type: "action-requested";
  action: ResolvedAgentAction;
}

export interface AgentActionStarted extends AgentEventBase {
  type: "action-started";
  action: ResolvedAgentAction;
}

export interface AgentActionCompleted extends AgentEventBase {
  type: "action-completed";
  action: ResolvedAgentAction;
  result: AgentActionResult;
}

export interface AgentActionFailed extends AgentEventBase {
  type: "action-failed";
  action: ResolvedAgentAction;
  error: AgentActionError;
}

export interface AgentActionCancelled extends AgentEventBase {
  type: "action-cancelled";
  action: ResolvedAgentAction;
}

export interface AgentConfirmationRequired extends AgentEventBase {
  type: "confirmation-required";
  action: ResolvedAgentAction;
  /** Rendered by `AgentActionPreview`. */
  preview: AgentActionPreviewModel;
}

export interface AgentConfirmationResolved extends AgentEventBase {
  type: "confirmation-resolved";
  action: ResolvedAgentAction;
  confirmed: boolean;
}

export interface AgentNavigationStarted extends AgentEventBase {
  type: "navigation-started";
  target: string;
  params?: Record<string, string>;
}

export interface AgentNavigationCompleted extends AgentEventBase {
  type: "navigation-completed";
  route: string;
}

export interface AgentStateChanged extends AgentEventBase {
  type: "state-changed";
  state: AgentReadableState;
  /** `user` when a human changed something mid-turn — the sync case. */
  cause: "user" | "agent" | "system";
}

export interface AgentError extends AgentEventBase {
  type: "error";
  message: string;
  /** Lets the composer offer a retry affordance. */
  retryable?: boolean;
  cause?: unknown;
}

export interface AgentSuggestionsUpdated extends AgentEventBase {
  type: "suggestions-updated";
  suggestions: string[];
}

export interface AgentTurnCompleted extends AgentEventBase {
  type: "turn-completed";
  /** `stopped` when the user pressed stop. */
  outcome: "completed" | "stopped" | "failed";
}

export interface AgentEventMap {
  "turn-started": AgentTurnStarted;
  "text-delta": AgentTextDelta;
  "thinking-delta": AgentThinkingDelta;
  "tool-started": AgentToolStarted;
  "tool-completed": AgentToolCompleted;
  "tool-failed": AgentToolFailed;
  "action-requested": AgentActionRequested;
  "action-started": AgentActionStarted;
  "action-completed": AgentActionCompleted;
  "action-failed": AgentActionFailed;
  "action-cancelled": AgentActionCancelled;
  "confirmation-required": AgentConfirmationRequired;
  "confirmation-resolved": AgentConfirmationResolved;
  "navigation-started": AgentNavigationStarted;
  "navigation-completed": AgentNavigationCompleted;
  "state-changed": AgentStateChanged;
  "suggestions-updated": AgentSuggestionsUpdated;
  error: AgentError;
  "turn-completed": AgentTurnCompleted;
}

export type AgentEvent = AgentEventMap[keyof AgentEventMap];
export type AgentEventType = AgentEvent["type"];

/** Structured diff shown to the user before a confirmed action runs. */
export interface AgentActionPreviewModel {
  title: string;
  /** e.g. "Email notifications" */
  subject?: string;
  changes: AgentPreviewChange[];
  description?: string;
  destructive?: boolean;
  sensitive?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  action: AgentAction;
}

export interface AgentPreviewChange {
  label: string;
  from?: string;
  to?: string;
  /** For changes with no before/after, e.g. "3 records". */
  detail?: string;
}

export interface AgentEventBus {
  emit(event: AgentEvent): void;
  subscribe(handler: (event: AgentEvent) => void): () => void;
}
