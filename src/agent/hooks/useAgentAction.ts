import { useCallback, useState } from "react";
import type { AgentAction, AgentActionResult, AgentActionStatus } from "../types/actions";
import { useAgent } from "./useAgent";

export interface UseAgentActionResult {
  run(action: AgentAction): Promise<AgentActionResult>;
  status: AgentActionStatus | "idle";
  result?: AgentActionResult;
  pending: boolean;
}

/**
 * Runs a single agent action with local lifecycle state — for UI that triggers
 * agent actions directly, such as the demo panel or a "do this for me" button.
 */
export function useAgentAction(): UseAgentActionResult {
  const agent = useAgent();
  const [status, setStatus] = useState<AgentActionStatus | "idle">("idle");
  const [result, setResult] = useState<AgentActionResult>();

  const run = useCallback(
    async (action: AgentAction) => {
      setStatus("requested");
      setResult(undefined);
      const next = await agent.executeAction(action);
      setStatus(next.status);
      setResult(next);
      return next;
    },
    [agent],
  );

  return {
    run,
    status,
    result,
    pending: status === "requested" || status === "executing" || status === "awaiting-confirmation",
  };
}
