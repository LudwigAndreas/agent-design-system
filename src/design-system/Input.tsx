import type { InputHTMLAttributes, ReactNode } from "react";
import { useAgentTarget } from "../agent/hooks/useAgentTarget";
import { Field } from "./Field";
import {
  cx,
  resolveAgentMeta,
  USER_CHANGE,
  AGENT_CHANGE,
  type AgentAwareProps,
  type ChangeHandler,
} from "./types";

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "className">,
    AgentAwareProps {
  value: string;
  onValueChange?: ChangeHandler<string>;
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  /** Validates agent writes as well as user input. Return a message to reject. */
  validate?: (value: string) => string | void;
}

export function Input({
  value,
  onValueChange,
  label,
  hint,
  error,
  className,
  agentId,
  agent,
  validate,
  disabled,
  required,
  ...rest
}: InputProps) {
  const meta = resolveAgentMeta(
    { agentId, agent },
    {
      // Falls back to the accessible name when the visible label lives in a
      // setting row rather than on the control.
      label: typeof label === "string" ? label : rest["aria-label"],
      role: "textbox",
    },
  );

  const { ref, targetProps } = useAgentTarget<string, HTMLInputElement>({
    ...meta,
    enabled: !disabled,
    handlers: {
      read: () => value,
      // Same callback a keystroke takes, tagged as agent-sourced.
      write: (next) => onValueChange?.(next, AGENT_CHANGE),
      validate: (next) => validate?.(String(next)),
    },
    getState: () => ({ state: error ? "invalid" : undefined }),
  });

  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {({ id, describedBy, invalid }) => (
        <input
          {...rest}
          {...targetProps}
          ref={ref}
          id={id}
          className={cx("ds-input")}
          value={value}
          disabled={disabled}
          required={required}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          onChange={(event) => onValueChange?.(event.target.value, USER_CHANGE)}
        />
      )}
    </Field>
  );
}
