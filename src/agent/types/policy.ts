import type { AgentAction } from "./actions";
import type { AgentElementState, AgentReadableState } from "./state";

/**
 * Policy decides *whether the user is asked*, not whether the operation is
 * allowed. Authorization is the application's job and happens inside the
 * target's own handler, where the business rules already live.
 */

export interface AgentActionPolicy {
  requiresConfirmation: boolean;
  reason?: string;
  destructive?: boolean;
  sensitive?: boolean;
  /** Override the preview's confirm button copy. */
  confirmLabel?: string;
}

export interface AgentPolicyContext {
  action: AgentAction;
  /** The resolved target's published state, when the target exists. */
  element?: AgentElementState;
  state: AgentReadableState;
}

/**
 * Returning a partial policy merges over the default. Returning nothing falls
 * through to the default policy.
 */
export type AgentPolicyResolver = (
  context: AgentPolicyContext,
) => Partial<AgentActionPolicy> | void;
