/**
 * Semantic identity + capability description for a single agent-controllable
 * piece of UI. This is application infrastructure: it is never rendered.
 */

/** Things an agent may be permitted to do with a target. */
export type AgentCapability =
  | "read"
  | "write"
  | "focus"
  | "navigate"
  | "open"
  | "close"
  | "submit"
  | "invoke";

/**
 * A stable, structural identifier such as `notifications.email`.
 *
 * Dotted segments are a convention, not a requirement, but they let the agent
 * reason about grouping (`notifications.*`) without inspecting the DOM.
 */
export type AgentTargetId = string;

export interface AgentElementMetadata {
  id: AgentTargetId;
  /** Human-facing label. Usually mirrors the visible label. */
  label?: string;
  /** What this control means, in prose, for the model's benefit. */
  description?: string;
  /** Semantic kind: `switch`, `select`, `button`, `field`, `table`, `page`... */
  role?: string;
  capabilities?: AgentCapability[];
  /** Convenience shorthands; `capabilities` wins when both are present. */
  readable?: boolean;
  writable?: boolean;
  /** Carries personal or security-relevant data. */
  sensitive?: boolean;
  /** Writes must be confirmed by the user before executing. */
  requiresConfirmation?: boolean;
  /** Free-form, application-defined. Surfaced to the adapter untouched. */
  data?: Record<string, unknown>;
}

/** Enumerated choices, so the agent can pick a valid option rather than guess. */
export interface AgentOption {
  value: string;
  label?: string;
  description?: string;
  disabled?: boolean;
}
