import type { ReactNode } from "react";
import { IconSparkle } from "../../design-system/icons";
import { cx } from "../../design-system/types";
import { useAgentSpotlight } from "../hooks/useAgentSpotlight";

export interface AgentSpotlightProps {
  /** Semantic target id this wrapper highlights. */
  target: string;
  children: ReactNode;
  /** Short caption shown above the highlight while active. */
  tip?: string;
  className?: string;
}

/**
 * Marks where the agent just took the user.
 *
 * A hairline outline in the agent hue and a faint tint, held briefly. No glow,
 * no pulse, no movement: the cue answers "where did it go?" and then gets out
 * of the way.
 */
export function AgentSpotlight({ target, children, tip, className }: AgentSpotlightProps) {
  const { ref, active } = useAgentSpotlight<HTMLDivElement>(target);

  return (
    <div
      ref={ref}
      className={cx("agent-spotlight", active && "agent-spotlight--active", className)}
    >
      {active && tip ? (
        <span className="agent-spotlight__tip" aria-hidden="true">
          <IconSparkle size={11} />
          {tip}
        </span>
      ) : null}
      {children}
    </div>
  );
}
