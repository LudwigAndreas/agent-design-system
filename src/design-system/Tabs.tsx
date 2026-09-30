import { useId, type ReactNode } from "react";
import { useAgentTarget } from "../agent/hooks/useAgentTarget";
import {
  cx,
  resolveAgentMeta,
  USER_CHANGE,
  AGENT_CHANGE,
  type AgentAwareProps,
  type ChangeHandler,
} from "./types";

export interface TabDefinition {
  value: string;
  label: ReactNode;
  /** Prose for the agent, so it can choose the right tab from intent. */
  description?: string;
  disabled?: boolean;
}

export interface TabsProps extends AgentAwareProps {
  value: string;
  tabs: TabDefinition[];
  onValueChange?: ChangeHandler<string>;
  children?: ReactNode;
  className?: string;
  ariaLabel?: string;
}

/** Selecting a tab is low-risk, so the default policy never confirms it. */
export function Tabs({
  value,
  tabs,
  onValueChange,
  children,
  className,
  ariaLabel,
  agentId,
  agent,
}: TabsProps) {
  const baseId = useId();
  const meta = resolveAgentMeta({ agentId, agent }, { role: "tablist", label: ariaLabel });

  const { ref, targetProps } = useAgentTarget<string, HTMLDivElement>({
    ...meta,
    options: tabs.map((tab) => ({
      value: tab.value,
      label: typeof tab.label === "string" ? tab.label : tab.value,
      description: tab.description,
      disabled: tab.disabled,
    })),
    handlers: {
      read: () => value,
      write: (next) => onValueChange?.(next, AGENT_CHANGE),
    },
    getState: () => ({ state: value }),
  });

  const index = tabs.findIndex((tab) => tab.value === value);

  const move = (delta: number) => {
    const count = tabs.length;
    for (let step = 1; step <= count; step += 1) {
      const candidate = tabs[(index + delta * step + count * count) % count];
      if (candidate && !candidate.disabled) {
        onValueChange?.(candidate.value, USER_CHANGE);
        return;
      }
    }
  };

  return (
    <div className={cx("ds-tabs", className)}>
      <div
        {...targetProps}
        ref={ref}
        role="tablist"
        aria-label={ariaLabel}
        className="ds-tabs__list"
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") {
            event.preventDefault();
            move(1);
          } else if (event.key === "ArrowLeft") {
            event.preventDefault();
            move(-1);
          }
        }}
      >
        {tabs.map((tab) => {
          const selected = tab.value === value;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              id={`${baseId}-${tab.value}`}
              aria-selected={selected}
              aria-controls={`${baseId}-${tab.value}-panel`}
              tabIndex={selected ? 0 : -1}
              disabled={tab.disabled}
              className="ds-tabs__tab"
              onClick={() => onValueChange?.(tab.value, USER_CHANGE)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {children ? (
        <div
          role="tabpanel"
          id={`${baseId}-${value}-panel`}
          aria-labelledby={`${baseId}-${value}`}
          className="ds-tabs__panel"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
