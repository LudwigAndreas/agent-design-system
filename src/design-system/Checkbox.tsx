import type { ReactNode } from "react";
import { useAgentTarget } from "../agent/hooks/useAgentTarget";
import { IconCheck, IconMinus } from "./icons";
import {
  cx,
  resolveAgentMeta,
  USER_CHANGE,
  AGENT_CHANGE,
  type AgentAwareProps,
  type ChangeHandler,
} from "./types";

export interface CheckboxProps extends AgentAwareProps {
  checked: boolean;
  /** Renders the mixed state for partially-selected groups. */
  indeterminate?: boolean;
  onCheckedChange?: ChangeHandler<boolean>;
  label?: ReactNode;
  description?: ReactNode;
  /** Accessible name when the visible label lives elsewhere. */
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
}

export function Checkbox({
  checked,
  indeterminate,
  onCheckedChange,
  label,
  description,
  ariaLabel,
  disabled,
  className,
  agentId,
  agent,
}: CheckboxProps) {
  const meta = resolveAgentMeta(
    { agentId, agent },
    {
      label: typeof label === "string" ? label : ariaLabel,
      description: typeof description === "string" ? description : undefined,
      role: "checkbox",
    },
  );

  const { ref, targetProps } = useAgentTarget<boolean, HTMLButtonElement>({
    ...meta,
    enabled: !disabled,
    handlers: {
      read: () => checked,
      write: (next) => onCheckedChange?.(next, AGENT_CHANGE),
    },
    getState: () => ({ state: indeterminate ? "mixed" : checked ? "checked" : "unchecked" }),
  });

  const control = (
    <button
      {...targetProps}
      ref={ref}
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={typeof label === "string" ? undefined : (ariaLabel ?? meta.label)}
      className="ds-checkbox"
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked, USER_CHANGE)}
    >
      {indeterminate ? <IconMinus size={11} /> : checked ? <IconCheck size={11} /> : null}
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
