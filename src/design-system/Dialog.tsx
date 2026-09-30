import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useOptionalAgent } from "../agent/hooks/useAgent";
import { AgentPageScopeContext, useAgentPageScope } from "../agent/hooks/useAgentPageContext";
import { useAgentTarget } from "../agent/hooks/useAgentTarget";
import { cx, resolveAgentMeta, type AgentAwareProps } from "./types";

export interface DialogProps extends AgentAwareProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  className?: string;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Registers itself both as an agent target (`open` / `close`) and as a dialog
 * in the readable state, so the agent can see that a modal is in the way.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  wide,
  className,
  agentId,
  agent,
}: DialogProps) {
  const agentApi = useOptionalAgent();
  const parentScope = useAgentPageScope();
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusTo = useRef<HTMLElement | null>(null);

  const meta = resolveAgentMeta(
    { agentId, agent },
    { label: typeof title === "string" ? title : undefined, role: "dialog" },
  );

  const { targetProps } = useAgentTarget<boolean, HTMLDivElement>({
    ...meta,
    handlers: {
      read: () => open,
      open: () => onOpenChange(true),
      close: () => onOpenChange(false),
    },
    getState: () => ({ state: open ? "open" : "closed", visible: open }),
  });

  // Publish dialog presence separately from element state: "is something modal
  // in front of the user" is a question the agent asks often.
  useEffect(() => {
    if (!agentApi || !meta.id) return;
    return agentApi.registry.registerDialog({
      id: meta.id,
      title: typeof title === "string" ? title : meta.label,
      description: typeof description === "string" ? description : meta.description,
      open,
    });
  }, [agentApi, meta.id, meta.label, meta.description, title, description, open]);

  useEffect(() => {
    if (!open) return;
    restoreFocusTo.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus() ?? panel?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onOpenChange(false);
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const focusable = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      // Return focus where the user left it, whether a human or the agent opened it.
      restoreFocusTo.current?.focus?.();
    };
  }, [open, onOpenChange]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="ds-dialog__backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false);
      }}
    >
      <div
        {...targetProps}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cx("ds-dialog", wide && "ds-dialog--wide", className)}
      >
        <AgentPageScopeContext.Provider
          value={{ page: parentScope.page, dialog: meta.id }}
        >
          <header className="ds-dialog__header">
            <h2 className="ds-dialog__title" id={titleId}>
              {title}
            </h2>
            {description ? (
              <p className="ds-dialog__description" id={descriptionId}>
                {description}
              </p>
            ) : null}
          </header>
          {children ? <div className="ds-dialog__body">{children}</div> : null}
          {footer ? <footer className="ds-dialog__footer">{footer}</footer> : null}
        </AgentPageScopeContext.Provider>
      </div>
    </div>,
    document.body,
  );
}
