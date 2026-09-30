import { useCallback, useEffect, useMemo, useRef, type RefObject } from "react";
import type { AgentElementMetadata, AgentOption } from "../types/metadata";
import type { AgentElementState } from "../types/state";
import type { AgentTargetHandlers, AgentTargetRegistration } from "../types/registry";
import { useOptionalAgent } from "./useAgent";
import { useAgentPageScope } from "./useAgentPageContext";

export interface UseAgentTargetConfig<V = unknown>
  extends Omit<AgentElementMetadata, "id"> {
  /** Omit to opt out entirely — the component then has no agent identity. */
  id?: string;
  handlers: AgentTargetHandlers<V>;
  options?: AgentOption[];
  visible?: boolean;
  enabled?: boolean;
  getState?: () => Partial<Omit<AgentElementState, "id" | "capabilities">>;
}

export interface UseAgentTargetResult<E extends HTMLElement = HTMLElement> {
  /** Attach to the element that should be scrolled to and focused. */
  ref: RefObject<E | null>;
  /** True while the agent is drawing attention to this target. */
  spotlighted: boolean;
  /** Spread onto the element: a debug hook, never a visible affordance. */
  targetProps: { "data-agent-id"?: string; "data-agent-spotlight"?: "true" };
  registered: boolean;
}

/**
 * Registers one piece of UI as an agent target.
 *
 * Handlers are read through a ref, so they always see current props even though
 * the registration itself is stable. The handlers must call the component's own
 * change callbacks — that is what keeps agent writes flowing through React
 * state and application business logic rather than around them.
 */
export function useAgentTarget<V = unknown, E extends HTMLElement = HTMLElement>(
  config: UseAgentTargetConfig<V>,
): UseAgentTargetResult<E> {
  const agent = useOptionalAgent();
  const scope = useAgentPageScope();
  const ref = useRef<E | null>(null);

  // Latest-value ref: updated during render so an action dispatched in the
  // same tick as a re-render still reads the new props.
  const configRef = useRef(config);
  configRef.current = config;

  const defaultReveal = useCallback(() => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const defaultFocus = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    // Prefer the real control when the ref points at a wrapper.
    const focusable =
      element.matches("input, select, textarea, button, [tabindex]")
        ? element
        : element.querySelector<HTMLElement>(
            "input, select, textarea, button, [tabindex]:not([tabindex='-1'])",
          );
    (focusable ?? element).focus?.();
  }, []);

  const { id } = config;

  // Re-register only when the *description* of the target changes, not when an
  // unrelated prop does.
  const metadataKey = JSON.stringify({
    id,
    label: config.label,
    description: config.description,
    role: config.role,
    capabilities: config.capabilities,
    readable: config.readable,
    writable: config.writable,
    sensitive: config.sensitive,
    requiresConfirmation: config.requiresConfirmation,
    page: scope.page,
    dialog: scope.dialog,
    handlers: Object.keys(config.handlers).sort(),
    data: config.data,
  });

  const registration = useMemo<AgentTargetRegistration<V> | null>(() => {
    if (!id) return null;
    const meta = configRef.current;
    const handlerKeys = Object.keys(meta.handlers) as (keyof AgentTargetHandlers<V>)[];
    const handlers: AgentTargetHandlers<V> = {};

    // Bind through the ref so the registration never captures stale props.
    for (const key of handlerKeys) {
      if (!meta.handlers[key]) continue;
      switch (key) {
        case "read":
          handlers.read = () => configRef.current.handlers.read!() as V;
          break;
        case "write":
          handlers.write = (value) => configRef.current.handlers.write!(value);
          break;
        case "validate":
          handlers.validate = (value) => configRef.current.handlers.validate!(value);
          break;
        case "submit":
          handlers.submit = () => configRef.current.handlers.submit!();
          break;
        case "invoke":
          handlers.invoke = (params) => configRef.current.handlers.invoke!(params);
          break;
        case "open":
          handlers.open = () => configRef.current.handlers.open!();
          break;
        case "close":
          handlers.close = () => configRef.current.handlers.close!();
          break;
        case "focus":
          handlers.focus = () => configRef.current.handlers.focus!();
          break;
        case "reveal":
          handlers.reveal = () => configRef.current.handlers.reveal!();
          break;
      }
    }

    // Every target can be brought to the user's attention, even when the
    // component did not implement it itself.
    handlers.reveal ??= defaultReveal;
    handlers.focus ??= defaultFocus;

    return {
      id,
      label: meta.label,
      description: meta.description,
      role: meta.role,
      capabilities: meta.capabilities,
      readable: meta.readable,
      writable: meta.writable,
      sensitive: meta.sensitive,
      requiresConfirmation: meta.requiresConfirmation,
      data: meta.data,
      page: scope.page,
      dialog: scope.dialog,
      handlers,
      options: meta.options,
      visible: meta.visible,
      enabled: meta.enabled,
      getState: () => {
        const current = configRef.current;
        return {
          ...current.getState?.(),
          options: current.options,
          visible: current.visible ?? true,
          enabled: current.enabled ?? true,
        };
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by metadataKey
  }, [metadataKey, defaultReveal, defaultFocus, scope.page, scope.dialog]);

  useEffect(() => {
    if (!agent || !registration) return;
    return agent.registry.register(registration);
  }, [agent, registration]);

  const spotlighted = Boolean(id) && agent?.spotlightTarget === id;

  return {
    ref,
    spotlighted,
    targetProps: {
      ...(id ? { "data-agent-id": id } : {}),
      ...(spotlighted ? { "data-agent-spotlight": "true" as const } : {}),
    },
    registered: Boolean(agent && registration),
  };
}
