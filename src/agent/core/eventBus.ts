import type { AgentEvent, AgentEventBus } from "../types/events";

/**
 * Cross-cutting agent events only. Component-local state stays in React;
 * routing this bus through ordinary UI state would be a mistake.
 */
export function createAgentEventBus(): AgentEventBus {
  const handlers = new Set<(event: AgentEvent) => void>();

  return {
    emit(event) {
      const stamped = event.at ? event : { ...event, at: Date.now() };
      // Copy first: a handler may unsubscribe while we iterate.
      for (const handler of [...handlers]) {
        try {
          handler(stamped);
        } catch (error) {
          // One bad subscriber must not break the turn.
          console.error("[agent] event handler threw", error);
        }
      }
    },
    subscribe(handler) {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    },
  };
}
