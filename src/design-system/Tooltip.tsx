import {
  cloneElement,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

/**
 * A small delayed tooltip for icon-only controls.
 *
 * It never carries information that is not also available elsewhere — an icon
 * button always has an accessible name — so it is decoration for the pointer,
 * hidden from assistive technology via the trigger's own label.
 */
export interface TooltipProps {
  content: ReactNode;
  shortcut?: string;
  delayMs?: number;
  placement?: "top" | "bottom";
  children: ReactElement<{
    ref?: RefObject<HTMLElement | null>;
    onPointerEnter?: () => void;
    onPointerLeave?: () => void;
    onFocus?: () => void;
    onBlur?: () => void;
  }>;
}

export function Tooltip({
  content,
  shortcut,
  delayMs = 400,
  placement = "bottom",
  children,
}: TooltipProps) {
  const triggerRef = useRef<HTMLElement | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const id = useId();

  const show = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), delayMs);
  };
  const hide = () => {
    clearTimeout(timer.current);
    setOpen(false);
    setPosition(null);
  };

  useLayoutEffect(() => {
    if (!open) return;
    const anchor = triggerRef.current?.getBoundingClientRect();
    const bubble = bubbleRef.current?.getBoundingClientRect();
    if (!anchor) return;
    const width = bubble?.width ?? 120;
    const height = bubble?.height ?? 24;
    const gap = 6;
    setPosition({
      top: placement === "top" ? anchor.top - height - gap : anchor.bottom + gap,
      left: Math.min(
        Math.max(anchor.left + anchor.width / 2 - width / 2, 8),
        Math.max(window.innerWidth - width - 8, 8),
      ),
    });
  }, [open, placement]);

  const trigger = cloneElement(children, {
    ref: triggerRef,
    onPointerEnter: show,
    onPointerLeave: hide,
    onFocus: show,
    onBlur: hide,
  });

  return (
    <>
      {trigger}
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={bubbleRef}
              id={id}
              role="presentation"
              className="ds-tooltip"
              style={{
                top: position?.top ?? -9999,
                left: position?.left ?? -9999,
                visibility: position ? "visible" : "hidden",
              }}
            >
              {content}
              {shortcut ? <span className="ds-tooltip__kbd">{shortcut}</span> : null}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
