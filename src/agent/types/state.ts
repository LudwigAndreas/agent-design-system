import type { AgentCapability, AgentOption, AgentTargetId } from "./metadata";
import type { AgentContextReference, AgentQueryLocale, QuerySchema } from "./query";

/**
 * The agent's view of the UI. Deliberately semantic: no DOM nodes, no class
 * names, no element ids. Everything here is something the application chose
 * to publish.
 */

export interface AgentElementState {
  id: AgentTargetId;
  label?: string;
  description?: string;
  role?: string;
  value?: unknown;
  /** Coarse status word, e.g. `enabled`, `invalid`, `loading`. */
  state?: string;
  options?: AgentOption[];
  visible: boolean;
  enabled: boolean;
  capabilities: AgentCapability[];
  sensitive?: boolean;
  requiresConfirmation?: boolean;
  /**
   * What can be queried against this target. Present only on targets that
   * accept a query; a field absent from the schema is not queryable, and
   * there is no other way to discover one.
   */
  querySchema?: QuerySchema;
  /** The page context this element is nested in, when any. */
  page?: string;
  data?: Record<string, unknown>;
}

export interface AgentDialogState {
  id: AgentTargetId;
  title?: string;
  description?: string;
  open: boolean;
  /** Elements that live inside the dialog. */
  elements?: AgentTargetId[];
}

export interface AgentNotificationState {
  id: string;
  tone: "info" | "success" | "warning" | "danger";
  title: string;
  description?: string;
  source?: "user" | "agent" | "system";
  createdAt: number;
}

/** A named action a page advertises, beyond raw element manipulation. */
export interface AgentDeclaredAction {
  id: AgentTargetId;
  label: string;
  description?: string;
  destructive?: boolean;
  requiresConfirmation?: boolean;
  /**
   * The operation is prepared rather than performed, and the user triggers
   * it. Use for work that is expensive, slow, or produces an artifact.
   */
  stages?: boolean;
  /**
   * The target whose current query this operation runs against. Makes the
   * staged summary showable and gives staleness a precise definition.
   */
  queryTarget?: AgentTargetId;
  params?: Record<string, AgentActionParam>;
}

export interface AgentActionParam {
  /** `predicate` means the parameter takes a query against the page's data. */
  type: "string" | "number" | "boolean" | "predicate";
  description?: string;
  required?: boolean;
}

export interface AgentPageState {
  id: string;
  title?: string;
  description?: string;
  /** Prose the page wants the agent to know: constraints, caveats, meaning. */
  context?: string;
  actions?: AgentDeclaredAction[];
  suggestions?: string[];
}

export interface AgentReadableState {
  /** Semantic route id, e.g. `settings.notifications`. Never a URL path. */
  route: string;
  routeParams?: Record<string, string>;
  page?: AgentPageState;
  /** Every page context currently mounted, innermost last. */
  pages: AgentPageState[];
  elements: AgentElementState[];
  dialogs: AgentDialogState[];
  notifications: AgentNotificationState[];
  /** Routes the agent is allowed to navigate to. */
  routes: { id: string; title?: string; description?: string }[];
  /**
   * References the application will resolve inside a predicate — the current
   * user, their unit. The agent names them; it never learns their values.
   */
  contextReferences: AgentContextReference[];
  /** How the application reads ambiguous literals, notably numeric dates. */
  queryLocale?: AgentQueryLocale;
  /** Operations prepared by the agent and awaiting the user. */
  stagedOperations: { id: string; label: string; status: string }[];
  capturedAt: number;
}
