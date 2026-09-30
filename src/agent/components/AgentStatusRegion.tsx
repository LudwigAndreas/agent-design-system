import { useAgent } from "../hooks/useAgent";

export interface AgentStatusRegionProps {
  /** `assertive` only for flows where the user must not miss the change. */
  politeness?: "polite" | "assertive";
}

/**
 * A single live region for agent status. Mount it once, near the root.
 *
 * The provider announces a deliberately small set of events — completed
 * actions, failures, confirmation requests, navigation — because announcing
 * every internal event makes a live region worse than none.
 */
export function AgentStatusRegion({ politeness = "polite" }: AgentStatusRegionProps) {
  const { announcement } = useAgent();

  return (
    <div className="visually-hidden" role="status" aria-live={politeness} aria-atomic="true">
      {announcement}
    </div>
  );
}
