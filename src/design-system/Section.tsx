import type { ReactNode } from "react";
import { useAgentTarget } from "../agent/hooks/useAgentTarget";
import { cx, resolveAgentMeta, type AgentAwareProps } from "./types";

export interface SettingsSectionProps extends AgentAwareProps {
  /** Doubles as the agent target id when no explicit one is given. */
  id?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * A titled group of settings. Registered as a focus/reveal target so the agent
 * can take the user to a *section*, not just to a single control.
 */
export function SettingsSection({
  id,
  title,
  description,
  actions,
  children,
  className,
  agentId,
  agent,
}: SettingsSectionProps) {
  const meta = resolveAgentMeta(
    { agentId: agentId ?? id, agent },
    {
      label: typeof title === "string" ? title : undefined,
      description: typeof description === "string" ? description : undefined,
      role: "group",
    },
  );

  const { ref, targetProps } = useAgentTarget<void, HTMLElement>({
    ...meta,
    // Reveal-only: a section has no value to read or write.
    handlers: {},
  });

  return (
    <section
      {...targetProps}
      ref={ref}
      id={id}
      className={cx("ds-section", className)}
      aria-label={typeof title === "string" ? title : undefined}
    >
      <header className="ds-section__head">
        <div>
          <h2 className="ds-section__title">{title}</h2>
          {description ? <p className="ds-section__description">{description}</p> : null}
        </div>
        {actions}
      </header>
      <div className="ds-section__body">{children}</div>
    </section>
  );
}
