import { forwardRef, type ButtonHTMLAttributes, type MouseEvent, type ReactNode } from "react";
import { useAgentTarget } from "../agent/hooks/useAgentTarget";
import { cx, resolveAgentMeta, type AgentAwareProps } from "./types";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "tertiary"
  | "ghost"
  | "danger"
  | "agent";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "onClick">,
    AgentAwareProps {
  /**
   * The event is optional: the agent invokes this same handler with no event,
   * so a handler that reads `event` must guard for it.
   */
  onClick?: (event?: MouseEvent<HTMLButtonElement>) => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  iconOnly?: boolean;
  startIcon?: ReactNode;
  className?: string;
  /**
   * Marks the button as consequential. The agent sees this in state and the
   * default policy asks the user before invoking it.
   */
  destructive?: boolean;
}

/**
 * A button is an `invoke` target for the agent: it exposes the same onClick the
 * user triggers, never a synthetic DOM click.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "secondary",
    size = "md",
    fullWidth,
    loading,
    iconOnly,
    startIcon,
    className,
    destructive,
    children,
    agentId,
    agent,
    disabled,
    onClick,
    ...rest
  },
  forwardedRef,
) {
  const label = agent?.label ?? (typeof children === "string" ? children : undefined);
  const meta = resolveAgentMeta(
    { agentId, agent },
    { label, role: "button", requiresConfirmation: destructive || undefined },
  );

  // Read at call time via the hook's own latest-props ref.
  const configuredOnClick = () => onClick?.();

  const { ref, targetProps } = useAgentTarget<void, HTMLButtonElement>({
    ...meta,
    enabled: !disabled && !loading,
    handlers: {
      // The agent's only route into this button is the component's own handler.
      invoke: () => configuredOnClick(),
      submit: rest.type === "submit" ? () => configuredOnClick() : undefined,
    },
    getState: () => ({ state: loading ? "loading" : disabled ? "disabled" : "ready" }),
  });

  return (
    <button
      {...rest}
      {...targetProps}
      ref={(node) => {
        ref.current = node;
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      }}
      className={cx(
        "ds-button",
        `ds-button--${destructive && variant === "secondary" ? "danger" : variant}`,
        size !== "md" && `ds-button--${size}`,
        fullWidth && "ds-button--full",
        iconOnly && "ds-button--icon",
        className,
      )}
      disabled={disabled || loading}
      onClick={onClick}
      aria-busy={loading || undefined}
    >
      {loading ? <span className="ds-spinner" aria-hidden="true" /> : startIcon}
      {children}
    </button>
  );
});
