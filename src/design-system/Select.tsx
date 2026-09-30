import type { ReactNode, SelectHTMLAttributes } from "react";
import type { AgentOption } from "../agent/types/metadata";
import { useAgentTarget } from "../agent/hooks/useAgentTarget";
import { Field } from "./Field";
import { IconChevronUpDown } from "./icons";
import {
  cx,
  resolveAgentMeta,
  USER_CHANGE,
  AGENT_CHANGE,
  type AgentAwareProps,
  type ChangeHandler,
} from "./types";

export interface SelectOption extends AgentOption {}

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "value" | "onChange" | "className">,
    AgentAwareProps {
  value: string;
  options: SelectOption[];
  onValueChange?: ChangeHandler<string>;
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  placeholder?: string;
  className?: string;
}

/**
 * Publishes its options to the registry, which is what lets the agent pick a
 * valid value (and be told the valid set when it guesses wrong) instead of
 * writing an arbitrary string.
 */
export function Select({
  value,
  options,
  onValueChange,
  label,
  hint,
  error,
  placeholder,
  className,
  agentId,
  agent,
  disabled,
  required,
  ...rest
}: SelectProps) {
  const meta = resolveAgentMeta(
    { agentId, agent },
    { label: typeof label === "string" ? label : rest["aria-label"], role: "select" },
  );

  const { ref, targetProps } = useAgentTarget<string, HTMLSelectElement>({
    ...meta,
    options,
    enabled: !disabled,
    handlers: {
      read: () => value,
      write: (next) => onValueChange?.(next, AGENT_CHANGE),
    },
    getState: () => ({ state: error ? "invalid" : undefined }),
  });

  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {({ id, describedBy, invalid }) => (
        <span className="ds-select-wrap">
          <select
            {...rest}
            {...targetProps}
            ref={ref}
            id={id}
            className={cx("ds-select")}
            value={value}
            disabled={disabled}
            required={required}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            onChange={(event) => onValueChange?.(event.target.value, USER_CHANGE)}
          >
            {placeholder ? (
              <option value="" disabled>
                {placeholder}
              </option>
            ) : null}
            {options.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label ?? option.value}
              </option>
            ))}
          </select>
          <IconChevronUpDown size={12} className="ds-select-wrap__caret" />
        </span>
      )}
    </Field>
  );
}
