import { useMemo } from "react";
import type { AgentActionResult } from "../types/actions";
import { useAgent } from "./useAgent";
import { useAgentState } from "./useAgentRegistry";

export interface UseAgentNavigationResult {
  navigate(target: string, params?: Record<string, string>): Promise<AgentActionResult>;
  focus(target: string): Promise<AgentActionResult>;
  reveal(target: string): Promise<AgentActionResult>;
  route: string;
  routes: { id: string; title?: string; description?: string }[];
}

/** Semantic navigation, so the agent never has to know about URLs. */
export function useAgentNavigation(): UseAgentNavigationResult {
  const agent = useAgent();
  const state = useAgentState();

  return useMemo(
    () => ({
      navigate: agent.navigate,
      focus: agent.focus,
      reveal: agent.reveal,
      route: state?.route ?? "unknown",
      routes: state?.routes ?? [],
    }),
    [agent, state],
  );
}
