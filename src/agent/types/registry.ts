import type { AgentAction, AgentActionResult } from "./actions";
import type { AgentElementMetadata, AgentOption, AgentTargetId } from "./metadata";
import type {
  AgentContextReference,
  AgentQueryLocale,
  QueryLiteral,
  QueryProblem,
  QuerySchema,
  ResolvedPredicate,
} from "./query";
import type { StagedRunOutcome } from "./staged";
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
  /**
   * For page-declared named actions. A staging operation returns what it
   * produced, so the artifact can be offered to the user.
   */
  invoke?: (
    params?: Record<string, unknown>,
  ) => void | StagedRunOutcome | Promise<void | StagedRunOutcome>;
  /**
   * Optional value guard. Return a string to reject with `invalid-value`.
   * Business authorization belongs here too: reject what is not permitted.
   */
  validate?: (value: unknown) => string | void;
}

export interface AgentTargetRegistration<V = unknown> extends AgentElementMetadata {
  handlers: AgentTargetHandlers<V>;
  /**
   * Declares what can be queried against this target. Its presence is what
   * makes the target query-capable; without it a `filter` action is refused.
   */
  querySchema?: QuerySchema;
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
   * The last query applied to a target, with its references resolved and its
   * values rendered for display. Used by previews and staged summaries.
   */
  getResolvedQuery(id: AgentTargetId): ResolvedPredicate | undefined;

  /**
   * Validates and resolves a query without applying it.
   *
   * Separated from `execute` so the runtime can reject a bad query — and show
   * the user a resolved, readable one — *before* asking them to confirm
   * anything.
   */
  prepareQuery(
    target: AgentTargetId,
    predicate: unknown,
  ): Promise<QueryPreparation>;

  /**
   * Low-level execution: resolve target, check capability, run the handler,
   * verify the observed result. No policy, no confirmation, no events — the
   * runtime layers those on top.
   *
   * `prepared` passes through a query the runtime already validated and
   * resolved, so directory lookups are not repeated.
   */
  execute(
    action: AgentAction,
    options?: { prepared?: ResolvedPredicate },
  ): Promise<AgentActionResult>;

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

  /** Context references the application is prepared to resolve. */
  getContextReferences?: () => AgentContextReference[];
  /** How the application reads ambiguous literals such as numeric dates. */
  getQueryLocale?: () => AgentQueryLocale | undefined;
  /**
   * Resolves a declared context reference. The resolved value stays inside
   * the application; only `display` is shown to the user.
   */
  resolveContext?: (id: string) => Promise<ContextResolution> | ContextResolution;
  /** Resolves a human identifier against an entity, e.g. an email to a user. */
  lookupEntity?: (
    entity: string,
    by: string,
    value: string,
  ) => Promise<LookupResolution> | LookupResolution;
  /**
   * Renders a resolved reference back to a label — the inverse of a lookup.
   *
   * Needed because a stored predicate holds ids, not names: without this a
   * condition the user composed, or one re-read after the fact, would show
   * `usr_ellen` where it should show "Ellen Nakamura".
   */
  describeValue?: (entity: string, value: QueryLiteral) => string | undefined;
  /** Installed by the runtime so staged operations appear in readable state. */
  getStagedOperations?: () => { id: string; label: string; status: string }[];
}

export type QueryPreparation =
  | { ok: true; resolved: ResolvedPredicate }
  | { ok: false; code: "invalid-query" | "unresolved-reference" | "not-queryable"; problems: QueryProblem[] };

export type ContextResolution =
  | { ok: true; value: QueryLiteral; display: string }
  | { ok: false; reason: string };

export type LookupResolution =
  | { ok: true; value: QueryLiteral; display: string }
  | { ok: false; reason: "not-found" }
  | { ok: false; reason: "ambiguous"; matches: number }
  | { ok: false; reason: "unsupported" };
