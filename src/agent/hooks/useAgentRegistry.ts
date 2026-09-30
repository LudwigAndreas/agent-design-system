import { useMemo, useSyncExternalStore } from "react";
import type { AgentReadableState } from "../types/state";
import type { AgentUIRegistry } from "../types/registry";
import { useOptionalAgent } from "./useAgent";

/** Direct registry access, for tooling such as the demo panel. */
export function useAgentRegistry(): AgentUIRegistry | null {
  return useOptionalAgent()?.registry ?? null;
}

/**
 * The agent-readable snapshot, recomputed only when the registry version
 * changes. This is the same view the adapter receives.
 */
export function useAgentState(): AgentReadableState | null {
  const registry = useAgentRegistry();

  const version = useSyncExternalStore(
    useMemo(
      () => (listener: () => void) => registry?.subscribe(listener) ?? (() => {}),
      [registry],
    ),
    () => registry?.getVersion() ?? 0,
    () => 0,
  );

  return useMemo(
    () => (registry ? registry.getReadableState() : null),
    // A new version means some registered target changed.
    [registry, version],
  );
}
