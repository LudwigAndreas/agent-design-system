import type { AgentAction, AgentActionResult } from "./actions";
import type { AgentElementMetadata, AgentOption, AgentTargetId } from "./metadata";
import type {
  AgentDeclaredAction,
  AgentDialogState,
  AgentElementState,
  AgentPageState,
  AgentReadableState,
} from "./state";

/**
 * Handlers are the *only* way an action reaches the UI. Each one is the same
 * callback a human interaction would invoke, so agent writes land in React
 * state and flow through application business logic unchanged.
 */
export interface AgentTargetHandlers<V = unknown> {
  /** Current value, read from React state at call time. */
  read?: () => V;
  /** Must call the component's own change callback — never mutate the DOM. */
  write?: (value: V) => void | Promise<void>;
  focus?: () => void;
  /** Scroll into view and spotlight, without moving keyboard focus. */
  reveal?: () => void;
  open?: () => void;
  close?: () => void;
  submit?: () => void | Promise<void>;
  /** For page-declared named actions. */
  invoke?: (params?: Record<string, unknown>) => void | Promise<void>;
  /**
   * Optional value guard. Return a string to reject with `invalid-value`.
   * Business authorization belongs here too: reject what is not permitted.
   */
  validate?: (value: unknown) => string | void;
}

export interface AgentTargetRegistration<V = unknown> extends AgentElementMetadata {
  handlers: AgentTargetHandlers<V>;
  /** Live, so state reads never go stale. */
  getState?: () => Partial<Omit<AgentElementState, "id" | "capabilities">>;
  options?: AgentOption[];
  visible?: boolean;
  enabled?: boolean;
  /** Owning page context id, injected by `AgentContext`. */
  page?: string;
  /** Owning dialog id, when nested inside one. */
  dialog?: string;
}

export interface AgentRouteRegistration {
  id: string;
  title?: string;
  description?: string;
}

export interface AgentPageRegistration extends AgentPageState {
  /** Declared actions get an `invoke` handler each. */
  handlers?: Record<string, (params?: Record<string, unknown>) => void | Promise<void>>;
}

export interface AgentDialogRegistration extends AgentDialogState {
  handlers?: Pick<AgentTargetHandlers, "open" | "close">;
}

/**
 * The bridge between React UI and the agent interaction layer. Implemented as
 * a plain store with `useSyncExternalStore` subscriptions, so it cooperates
 * with React instead of fighting it.
 */
export interface AgentUIRegistry {
  register(registration: AgentTargetRegistration<any>): () => void;
  unregister(id: AgentTargetId): void;
  get(id: AgentTargetId): AgentTargetRegistration<any> | undefined;
  getAll(): AgentTargetRegistration<any>[];

  registerPage(page: AgentPageRegistration): () => void;
  registerDialog(dialog: AgentDialogRegistration): () => void;
  registerRoute(route: AgentRouteRegistration): () => void;
  getDeclaredActions(): AgentDeclaredAction[];
  getDialogs(): AgentDialogState[];

  /** Semantic snapshot. Cheap enough to call after every action. */
  getReadableState(): AgentReadableState;
  /** Resolved, live state for one target. */
  getElementState(id: AgentTargetId): AgentElementState | undefined;

  /**
   * Low-level execution: resolve target, check capability, run the handler,
   * verify the observed result. No policy, no confirmation, no events — the
   * runtime layers those on top.
   */
  execute(action: AgentAction): Promise<AgentActionResult>;

  subscribe(listener: () => void): () => void;
  /** Bumped on every registration or notified state change. */
  getVersion(): number;
  /** Called by the host to publish route + notifications into the snapshot. */
  setEnvironment(env: AgentRegistryEnvironment): void;
}

export interface AgentRegistryEnvironment {
  getRoute?: () => { route: string; params?: Record<string, string> };
  getNotifications?: () => AgentReadableState["notifications"];
  /** Invoked for `navigate`. Provided by the application's router. */
  navigate?: (target: string, params?: Record<string, string>) => void | Promise<void>;
}
