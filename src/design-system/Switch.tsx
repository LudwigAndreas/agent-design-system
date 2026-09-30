import type { ReactNode } from "react";
import { useAgentTarget } from "../agent/hooks/useAgentTarget";
import {
  cx,
  resolveAgentMeta,
  USER_CHANGE,
  AGENT_CHANGE,
  type AgentAwareProps,
  type ChangeHandler,
} from "./types";

export interface SwitchProps extends AgentAwareProps {
  checked: boolean;
  onCheckedChange?: ChangeHandler<boolean>;
  label?: ReactNode;
  description?: ReactNode;
  /**
   * Accessible name when the visible label lives elsewhere — in a
   * `SettingRow`, say. Also becomes the agent's label for this target.
   */
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
  /** Requires the user to confirm before the agent may flip it. */
  requiresConfirmation?: boolean;
  sensitive?: boolean;
}

/**
 * Controlled in the ordinary React sense. An agent `toggle` lands in exactly
 * the same `onCheckedChange` a click would, so there is no second state path.
 */
export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  ariaLabel,
  disabled,
  className,
  agentId,
  agent,
  requiresConfirmation,
  sensitive,
}: SwitchProps) {
  const meta = resolveAgentMeta(
    { agentId, agent },
    {
      label: typeof label === "string" ? label : ariaLabel,
      description: typeof description === "string" ? description : undefined,
      role: "switch",
      requiresConfirmation,
      sensitive,
    },
  );

  const { ref, targetProps } = useAgentTarget<boolean, HTMLButtonElement>({
    ...meta,
    enabled: !disabled,
    handlers: {
      read: () => checked,
      write: (next) => onCheckedChange?.(next, AGENT_CHANGE),
    },
    getState: () => ({ state: checked ? "on" : "off" }),
  });

  const control = (
    <button
      {...targetProps}
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={typeof label === "string" ? undefined : (ariaLabel ?? meta.label)}
      className="ds-switch"
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked, USER_CHANGE)}
    >
      <span className="ds-switch__thumb" aria-hidden="true" />
    </button>
  );

  if (!label && !description) {
    return <span className={className}>{control}</span>;
  }

  return (
    <label className={cx("ds-choice", disabled && "ds-choice--disabled", className)}>
      {control}
      <span className="ds-choice__text">
        {label ? <span className="ds-choice__label">{label}</span> : null}
        {description ? <span className="ds-choice__description">{description}</span> : null}
      </span>
    </label>
  );
}
