import type { AgentTargetId } from "./metadata";
import type { QueryPredicate, QueryProblem } from "./query";
import type { StagedOperation } from "./staged";

/**
 * Who asked for a state change. Preserved end-to-end so the UI can say
 * "changed by agent" instead of pretending the user did it.
 */
export type ActionSource = "user" | "agent" | "system";

export interface AgentActionBase {
  /** Assigned by the runtime when absent. Correlates events and lifecycle. */
  id?: string;
  /** Why the agent wants this. Shown verbatim in confirmation previews. */
  reason?: string;
  source?: ActionSource;
}

export interface NavigateAction extends AgentActionBase {
  type: "navigate";
  target: AgentTargetId;
  params?: Record<string, string>;
}

export interface OpenDialogAction extends AgentActionBase {
  type: "open-dialog";
  target: AgentTargetId;
}

export interface CloseDialogAction extends AgentActionBase {
  type: "close-dialog";
  target: AgentTargetId;
}

export interface SetValueAction extends AgentActionBase {
  type: "set-value";
  target: AgentTargetId;
  value: unknown;
}

export interface ToggleAction extends AgentActionBase {
  type: "toggle";
  target: AgentTargetId;
  /** Absolute desired state. Omit to flip whatever the current value is. */
  value?: boolean;
}

export interface SelectOptionAction extends AgentActionBase {
  type: "select-option";
  target: AgentTargetId;
  value: string;
}

export interface CheckAction extends AgentActionBase {
  type: "check";
  target: AgentTargetId;
}

export interface UncheckAction extends AgentActionBase {
  type: "uncheck";
  target: AgentTargetId;
}

export interface SubmitAction extends AgentActionBase {
  type: "submit";
  target: AgentTargetId;
}

export interface FocusAction extends AgentActionBase {
  type: "focus";
  target: AgentTargetId;
}

/** Scroll into view + spotlight, without stealing keyboard focus. */
export interface RevealAction extends AgentActionBase {
  type: "reveal";
  target: AgentTargetId;
}

export interface ScrollToAction extends AgentActionBase {
  type: "scroll-to";
  target: AgentTargetId;
}

export interface SearchAction extends AgentActionBase {
  type: "search";
  target: AgentTargetId;
  query: string;
}

export interface FilterAction extends AgentActionBase {
  type: "filter";
  target: AgentTargetId;
  /**
   * A structured predicate, validated against the target's query schema
   * before anything is applied. There is no untyped form: a query the schema
   * cannot describe is a query the application will not run.
   */
  filter: QueryPredicate;
}

/** A named, page-declared action from `AgentContext`'s `actions` list. */
export interface InvokeAction extends AgentActionBase {
  type: "invoke";
  target: AgentTargetId;
  params?: Record<string, unknown>;
}

/**
 * Registry of action types, keyed by discriminant.
 *
 * Extend it from application code by interface merging, which keeps
 * `AgentAction` a correctly discriminated union:
 *
 * ```ts
 * declare module "@agent/types/actions" {
 *   interface AgentActionMap {
 *     "export-csv": { type: "export-csv"; target: string } & AgentActionBase;
 *   }
 * }
 * ```
 */
export interface AgentActionMap {
  navigate: NavigateAction;
  "open-dialog": OpenDialogAction;
  "close-dialog": CloseDialogAction;
  "set-value": SetValueAction;
  toggle: ToggleAction;
  "select-option": SelectOptionAction;
  check: CheckAction;
  uncheck: UncheckAction;
  submit: SubmitAction;
  focus: FocusAction;
  reveal: RevealAction;
  "scroll-to": ScrollToAction;
  search: SearchAction;
  filter: FilterAction;
  invoke: InvokeAction;
}

export type AgentAction = AgentActionMap[keyof AgentActionMap];
export type AgentActionType = AgentAction["type"];

/** An action with its runtime-assigned identity resolved. */
export type ResolvedAgentAction = AgentAction & { id: string; source: ActionSource };

export type AgentActionStatus =
  | "requested"
  | "validated"
  | "awaiting-confirmation"
  | "executing"
  /**
   * Prepared, and waiting for the user to trigger it. Terminal for the
   * agent's turn: the work has not been done and may never be.
   */
  | "staged"
  | "succeeded"
  | "failed"
  | "cancelled";

export type AgentActionErrorCode =
  | "unknown-target"
  | "capability-unsupported"
  | "target-disabled"
  | "target-hidden"
  | "invalid-value"
  | "not-authorized"
  | "cancelled"
  | "state-not-confirmed"
  | "execution-failed"
  | "unsupported-action"
  /** The predicate did not match the target's query schema. */
  | "invalid-query"
  /** A context reference or directory lookup in the predicate did not resolve. */
  | "unresolved-reference"
  /** The agent tried to trigger an operation only the user may trigger. */
  | "requires-user-trigger";

export interface AgentActionError {
  code: AgentActionErrorCode;
  message: string;
  /** Safe to show the user as-is. */
  userMessage?: string;
  cause?: unknown;
  /**
   * Per-problem detail for a rejected query, so the agent can correct the
   * specific field rather than guess at the whole predicate.
   */
  problems?: QueryProblem[];
}

export interface AgentActionResult {
  success: boolean;
  action: ResolvedAgentAction;
  status: AgentActionStatus;
  /** Short natural-language summary, suitable for the chat transcript. */
  message?: string;
  /** Observed state after the action, re-read from the application. */
  value?: unknown;
  previousValue?: unknown;
  error?: AgentActionError;
  /** Present only when the action is genuinely reversible. */
  undo?: () => Promise<AgentActionResult>;
  /**
   * Present when `status` is `staged`: the prepared operation, awaiting a
   * trigger from the user.
   */
  staged?: StagedOperation;
  /** Number of records matching, after a query was applied. */
  matchCount?: number;
}

/** An entry in the audit log the demo panel and undo affordances read from. */
export interface AgentActionRecord {
  action: ResolvedAgentAction;
  status: AgentActionStatus;
  startedAt: number;
  endedAt?: number;
  result?: AgentActionResult;
}
