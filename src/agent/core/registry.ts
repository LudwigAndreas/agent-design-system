import type {
  AgentAction,
  AgentActionError,
  AgentActionErrorCode,
  AgentActionResult,
  ResolvedAgentAction,
} from "../types/actions";
import type { AgentDeclaredAction, AgentElementState, AgentReadableState } from "../types/state";
import type {
  AgentDialogRegistration,
  AgentPageRegistration,
  AgentRegistryEnvironment,
  AgentRouteRegistration,
  AgentTargetRegistration,
  AgentUIRegistry,
} from "../types/registry";
import { ACTION_CAPABILITY, resolveCapabilities, supportsCapability } from "./capabilities";

let actionSeq = 0;
const nextActionId = () => `act_${Date.now().toString(36)}_${(actionSeq++).toString(36)}`;

export function resolveAction(action: AgentAction): ResolvedAgentAction {
  return {
    ...action,
    id: action.id ?? nextActionId(),
    source: action.source ?? "agent",
  } as ResolvedAgentAction;
}

function fail(
  action: ResolvedAgentAction,
  code: AgentActionErrorCode,
  message: string,
  userMessage?: string,
): AgentActionResult {
  const error: AgentActionError = { code, message, userMessage: userMessage ?? message };
  return { success: false, action, status: "failed", error, message: error.userMessage };
}

/** How long to wait for React to commit an agent-initiated write. */
const VERIFY_TIMEOUT_MS = 1500;
const VERIFY_POLL_MS = 16;

const sameValue = (a: unknown, b: unknown) =>
  a === b || (a !== null && b !== null && typeof a === "object" && typeof b === "object"
    ? JSON.stringify(a) === JSON.stringify(b)
    : false);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Polls `condition` on a timer until it holds or the budget runs out. */
async function waitUntil(condition: () => boolean, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() >= deadline) return false;
    await sleep(VERIFY_POLL_MS);
  }
  return true;
}

/**
 * Waits until the application reports the value we asked for. This is what
 * makes "never claim success before state confirms it" true rather than a
 * comment: if the app rejects or overrides the write, we report failure.
 */
async function verifyValue(
  read: () => unknown,
  expected: unknown,
  timeoutMs = VERIFY_TIMEOUT_MS,
): Promise<{ confirmed: boolean; observed: unknown }> {
  const deadline = Date.now() + timeoutMs;
  let observed = read();
  while (!sameValue(observed, expected)) {
    if (Date.now() >= deadline) return { confirmed: false, observed };
    await sleep(VERIFY_POLL_MS);
    observed = read();
  }
  return { confirmed: true, observed };
}

export interface CreateRegistryOptions {
  /** Shortened in tests to keep them fast. */
  verifyTimeoutMs?: number;
}

export function createAgentRegistry(options: CreateRegistryOptions = {}): AgentUIRegistry {
  const verifyTimeoutMs = options.verifyTimeoutMs ?? VERIFY_TIMEOUT_MS;

  const targets = new Map<string, AgentTargetRegistration<any>>();
  const pages = new Map<string, AgentPageRegistration>();
  const dialogs = new Map<string, AgentDialogRegistration>();
  const routes = new Map<string, AgentRouteRegistration>();
  const listeners = new Set<() => void>();
  let environment: AgentRegistryEnvironment = {};
  let version = 0;

  const notify = () => {
    version += 1;
    for (const listener of [...listeners]) listener();
  };

  const elementState = (
    registration: AgentTargetRegistration<any>,
  ): AgentElementState => {
    const live = registration.getState?.() ?? {};
    const capabilities = resolveCapabilities(registration);
    const value = capabilities.includes("read")
      ? registration.handlers.read?.()
      : undefined;

    return {
      id: registration.id,
      label: registration.label,
      description: registration.description,
      role: registration.role,
      // A sensitive target publishes that it exists, never its contents.
      value: registration.sensitive ? undefined : (live.value ?? value),
      state: live.state,
      options: live.options ?? registration.options,
      visible: live.visible ?? registration.visible ?? true,
      enabled: live.enabled ?? registration.enabled ?? true,
      capabilities,
      sensitive: registration.sensitive,
      requiresConfirmation: registration.requiresConfirmation,
      page: registration.page,
      data: live.data ?? registration.data,
    };
  };

  const registry: AgentUIRegistry = {
    register(registration) {
      if (targets.has(registration.id) && import.meta.env?.DEV) {
        console.warn(
          `[agent] duplicate agentId "${registration.id}". Semantic ids must be unique; ` +
            `the later registration wins and the earlier target becomes unreachable.`,
        );
      }
      targets.set(registration.id, registration);
      notify();
      return () => {
        // Guard against a re-register having already replaced us.
        if (targets.get(registration.id) === registration) {
          targets.delete(registration.id);
          notify();
        }
      };
    },

    unregister(id) {
      if (targets.delete(id)) notify();
    },

    get: (id) => targets.get(id),
    getAll: () => [...targets.values()],

    registerPage(page) {
      pages.set(page.id, page);
      notify();
      return () => {
        if (pages.get(page.id) === page) {
          pages.delete(page.id);
          notify();
        }
      };
    },

    registerDialog(dialog) {
      dialogs.set(dialog.id, dialog);
      notify();
      return () => {
        if (dialogs.get(dialog.id) === dialog) {
          dialogs.delete(dialog.id);
          notify();
        }
      };
    },

    registerRoute(route) {
      routes.set(route.id, route);
      notify();
      return () => {
        if (routes.get(route.id) === route) {
          routes.delete(route.id);
          notify();
        }
      };
    },

    getDeclaredActions() {
      const declared: AgentDeclaredAction[] = [];
      for (const page of pages.values()) declared.push(...(page.actions ?? []));
      return declared;
    },

    getDialogs: () => [...dialogs.values()].map(({ handlers: _handlers, ...rest }) => rest),

    getElementState(id) {
      const registration = targets.get(id);
      return registration ? elementState(registration) : undefined;
    },

    getReadableState(): AgentReadableState {
      const location = environment.getRoute?.() ?? { route: "unknown" };
      const pageList = [...pages.values()].map(({ handlers: _h, ...rest }) => rest);
      return {
        route: location.route,
        routeParams: location.params,
        page: pageList.at(-1),
        pages: pageList,
        elements: [...targets.values()].map(elementState),
        dialogs: registry.getDialogs(),
        notifications: environment.getNotifications?.() ?? [],
        routes: [...routes.values()],
        capturedAt: Date.now(),
      };
    },

    async execute(rawAction): Promise<AgentActionResult> {
      const action = resolveAction(rawAction);

      // `navigate` is the one action routed to the host router rather than to a
      // registered element, because a route is not a piece of UI.
      if (action.type === "navigate") {
        if (!environment.navigate) {
          return fail(
            action,
            "unsupported-action",
            "No navigation delegate was provided to AgentProvider.",
            "I can't navigate in this application.",
          );
        }
        if (routes.size > 0 && !routes.has(action.target)) {
          return fail(
            action,
            "unknown-target",
            `Unknown route "${action.target}". Known routes: ${[...routes.keys()].join(", ")}.`,
            `I couldn't find a "${action.target}" screen.`,
          );
        }
        try {
          await environment.navigate(action.target, action.params);
        } catch (error) {
          return { ...fail(action, "execution-failed", String(error)), error: {
            code: "execution-failed",
            message: String(error),
            userMessage: "Navigation failed.",
            cause: error,
          } };
        }

        // Navigation is not done when the router's state changes — it is done
        // when the new screen has mounted and registered its targets. Without
        // this wait, an agent that navigates and immediately reads state finds
        // the *old* page and concludes the control does not exist.
        if (environment.getRoute) {
          const arrived = await waitUntil(
            () => environment.getRoute!().route === action.target,
            verifyTimeoutMs,
          );
          if (!arrived) {
            return {
              ...fail(
                action,
                "state-not-confirmed",
                `Asked to navigate to "${action.target}" but the application still reports ` +
                  `"${environment.getRoute().route}".`,
                `I couldn't get to ${action.target}.`,
              ),
              value: environment.getRoute().route,
            };
          }
        }

        // Then wait for the arriving page to publish itself, when it uses the
        // page-id-equals-route-id convention. Pages that do not are given one
        // tick for their effects to run and are not held up further.
        const pageArrived = await waitUntil(
          () => pages.has(action.target),
          Math.min(verifyTimeoutMs, 250),
        );
        if (!pageArrived) await sleep(VERIFY_POLL_MS);

        return {
          success: true,
          action,
          status: "succeeded",
          message: `Navigated to ${action.target}`,
          value: action.target,
        };
      }

      const registration = targets.get(action.target);
      if (!registration) {
        return fail(
          action,
          "unknown-target",
          `No agent target registered with id "${action.target}".`,
          `I couldn't find "${action.target}" in the current interface.`,
        );
      }

      const state = elementState(registration);
      const capability = ACTION_CAPABILITY[action.type];

      if (!supportsCapability(registration, capability)) {
        return fail(
          action,
          "capability-unsupported",
          `Target "${action.target}" does not support "${capability}".`,
          `"${state.label ?? action.target}" can't be changed that way.`,
        );
      }

      const mutates = capability === "write" || capability === "submit" || capability === "invoke";
      if (mutates && !state.enabled) {
        return fail(
          action,
          "target-disabled",
          `Target "${action.target}" is disabled.`,
          `"${state.label ?? action.target}" is currently disabled.`,
        );
      }

      const { handlers } = registration;
      const previousValue = handlers.read?.();

      try {
        switch (action.type) {
          case "focus":
          case "scroll-to":
            handlers.reveal?.();
            handlers.focus?.();
            return {
              success: true,
              action,
              status: "succeeded",
              message: `Focused ${state.label ?? action.target}`,
            };

          case "reveal":
            (handlers.reveal ?? handlers.focus)?.();
            return {
              success: true,
              action,
              status: "succeeded",
              message: `Revealed ${state.label ?? action.target}`,
            };

          case "open-dialog": {
            handlers.open?.();
            return {
              success: true,
              action,
              status: "succeeded",
              message: `Opened ${state.label ?? action.target}`,
            };
          }

          case "close-dialog": {
            handlers.close?.();
            return {
              success: true,
              action,
              status: "succeeded",
              message: `Closed ${state.label ?? action.target}`,
            };
          }

          case "submit": {
            await handlers.submit?.();
            return {
              success: true,
              action,
              status: "succeeded",
              message: `Submitted ${state.label ?? action.target}`,
            };
          }

          case "invoke": {
            await handlers.invoke?.(action.params);
            return {
              success: true,
              action,
              status: "succeeded",
              message: `Ran ${state.label ?? action.target}`,
              previousValue,
            };
          }

          default: {
            // Everything else is a value write, normalised to a target value.
            const desired = desiredValue(action, previousValue, state);
            if ("error" in desired) {
              return fail(action, "invalid-value", desired.error, desired.error);
            }

            const rejection = handlers.validate?.(desired.value);
            if (rejection) {
              return fail(action, "invalid-value", rejection, rejection);
            }

            await handlers.write?.(desired.value);

            if (!handlers.read) {
              // Nothing to verify against; report the write, not the value.
              return {
                success: true,
                action,
                status: "succeeded",
                message: `Updated ${state.label ?? action.target}`,
                previousValue,
              };
            }

            const { confirmed, observed } = await verifyValue(
              handlers.read,
              desired.value,
              verifyTimeoutMs,
            );

            if (!confirmed) {
              return {
                ...fail(
                  action,
                  "state-not-confirmed",
                  `Wrote ${JSON.stringify(desired.value)} to "${action.target}" but the ` +
                    `application still reports ${JSON.stringify(observed)}.`,
                  `I tried to change "${state.label ?? action.target}", but the application ` +
                    `didn't accept the change.`,
                ),
                value: observed,
                previousValue,
              };
            }

            return {
              success: true,
              action,
              status: "succeeded",
              message: `Set ${state.label ?? action.target} to ${format(observed)}`,
              value: observed,
              previousValue,
              undo:
                sameValue(previousValue, observed) || previousValue === undefined
                  ? undefined
                  : () =>
                      registry.execute({
                        type: "set-value",
                        target: action.target,
                        value: previousValue,
                        source: "system",
                        reason: `Undo of ${action.id}`,
                      }),
            };
          }
        }
      } catch (error) {
        return {
          success: false,
          action,
          status: "failed",
          previousValue,
          message: "The application reported an error.",
          error: {
            code: "execution-failed",
            message: error instanceof Error ? error.message : String(error),
            userMessage: "The application reported an error.",
            cause: error,
          },
        };
      }
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    getVersion: () => version,

    setEnvironment(env) {
      environment = { ...environment, ...env };
    },
  };

  return registry;
}

function format(value: unknown): string {
  if (typeof value === "boolean") return value ? "on" : "off";
  if (value === null || value === undefined) return "empty";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Normalises every write-shaped action into a single target value. */
function desiredValue(
  action: AgentAction,
  previousValue: unknown,
  state: AgentElementState,
): { value: unknown } | { error: string } {
  switch (action.type) {
    case "set-value":
      return { value: action.value };
    case "toggle":
      return { value: action.value ?? !previousValue };
    case "check":
      return { value: true };
    case "uncheck":
      return { value: false };
    case "search":
      return { value: action.query };
    case "filter":
      return { value: action.filter };
    case "select-option": {
      const options = state.options;
      if (options && options.length > 0) {
        const match =
          options.find((o) => o.value === action.value) ??
          options.find(
            (o) => (o.label ?? "").toLowerCase() === action.value.toLowerCase(),
          );
        if (!match) {
          return {
            error:
              `"${action.value}" is not an available option for ` +
              `"${state.label ?? state.id}". Options: ${options.map((o) => o.value).join(", ")}.`,
          };
        }
        if (match.disabled) {
          return { error: `The option "${match.label ?? match.value}" is disabled.` };
        }
        return { value: match.value };
      }
      return { value: action.value };
    }
    default:
      return { error: `Unsupported action type "${(action as AgentAction).type}".` };
  }
}
