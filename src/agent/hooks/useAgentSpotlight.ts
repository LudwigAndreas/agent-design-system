import { useEffect, useRef } from "react";
import { useOptionalAgent } from "./useAgent";

export interface UseAgentSpotlightResult<E extends HTMLElement = HTMLElement> {
  ref: React.RefObject<E | null>;
  active: boolean;
}

/**
 * Subscribes an arbitrary element to the agent's current spotlight target.
 * Scrolls into view once when it becomes active; never steals focus, because
 * the user may be typing somewhere else.
 */
export function useAgentSpotlight<E extends HTMLElement = HTMLElement>(
  target: string | undefined,
): UseAgentSpotlightResult<E> {
  const agent = useOptionalAgent();
  const ref = useRef<E | null>(null);
  const active = Boolean(target) && agent?.spotlightTarget === target;

  useEffect(() => {
    if (!active) return;
    ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [active]);

  return { ref, active };
}
