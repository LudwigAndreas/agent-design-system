import {
  cloneElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { IconCheck } from "./icons";
import { cx } from "./types";

/**
 * A compact popover menu.
 *
 * Deliberately small: a hairline-free surface that earns its separation from
 * the page with elevation alone, tight rows, and a single highlight colour.
 * Keyboard handling is the point — arrow keys, Home/End, Escape, and a roving
 * highlight that does not depend on focus moving between items.
 */

export interface MenuItemSpec {
  id: string;
  label: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  shortcut?: string;
  selected?: boolean;
  disabled?: boolean;
  danger?: boolean;
  onSelect?: () => void;
}

export type MenuEntry = MenuItemSpec | { id: string; separator: true } | { id: string; label: string; heading: true };

const isItem = (entry: MenuEntry): entry is MenuItemSpec =>
  !("separator" in entry) && !("heading" in entry);

export interface MenuProps {
  /** The control that opens the menu. Receives ref, aria and onClick. */
  trigger: ReactElement<{
    ref?: RefObject<HTMLElement | null>;
    onClick?: () => void;
    "aria-haspopup"?: string;
    "aria-expanded"?: boolean;
  }>;
  items: MenuEntry[];
  /** Which edge of the trigger the menu aligns to. */
  align?: "start" | "end";
  label?: string;
  className?: string;
}

export function Menu({ trigger, items, align = "start", label, className }: MenuProps) {
  const triggerRef = useRef<HTMLElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [highlighted, setHighlighted] = useState(0);
  const menuId = useId();

  const selectable = items.filter(isItem).filter((item) => !item.disabled);

  const close = useCallback(() => {
    setOpen(false);
    setPosition(null);
    triggerRef.current?.focus();
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const anchor = triggerRef.current?.getBoundingClientRect();
    const menu = menuRef.current?.getBoundingClientRect();
    if (!anchor) return;

    const width = menu?.width ?? 200;
    const height = menu?.height ?? 200;
    const gap = 4;

    // Flip above / shift inwards rather than letting the menu leave the viewport.
    const top =
      anchor.bottom + gap + height > window.innerHeight && anchor.top - gap - height > 0
        ? anchor.top - gap - height
        : anchor.bottom + gap;
    const preferred = align === "end" ? anchor.right - width : anchor.left;
    const left = Math.min(Math.max(preferred, 8), Math.max(window.innerWidth - width - 8, 8));

    setPosition({ top, left });
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
      setPosition(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
      }
    };
    // Capture so a menu inside a dialog closes before the dialog does.
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("resize", close);
    };
  }, [open, close]);

  const choose = (item: MenuItemSpec) => {
    item.onSelect?.();
    close();
  };

  const triggerNode = cloneElement(trigger, {
    ref: triggerRef,
    "aria-haspopup": "menu",
    "aria-expanded": open,
    onClick: () => {
      setHighlighted(0);
      setOpen((current) => !current);
    },
  });

  return (
    <>
      {triggerNode}
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              aria-label={label}
              tabIndex={-1}
              className={cx("ds-menu", className)}
              style={{
                top: position?.top ?? -9999,
                left: position?.left ?? -9999,
                visibility: position ? "visible" : "hidden",
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setHighlighted((index) => (index + 1) % Math.max(selectable.length, 1));
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setHighlighted(
                    (index) =>
                      (index - 1 + selectable.length) % Math.max(selectable.length, 1),
                  );
                } else if (event.key === "Home") {
                  event.preventDefault();
                  setHighlighted(0);
                } else if (event.key === "End") {
                  event.preventDefault();
                  setHighlighted(Math.max(selectable.length - 1, 0));
                } else if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  const item = selectable[highlighted];
                  if (item) choose(item);
                }
              }}
              // Focus the menu itself, so the highlight can rove without
              // stealing focus from item to item.
              autoFocus
            >
              {items.map((entry) => {
                if ("separator" in entry) {
                  return <div key={entry.id} className="ds-menu__separator" role="separator" />;
                }
                if ("heading" in entry) {
                  return (
                    <div key={entry.id} className="ds-menu__label">
                      {entry.label}
                    </div>
                  );
                }
                const index = selectable.indexOf(entry);
                return (
                  <button
                    key={entry.id}
                    type="button"
                    role="menuitem"
                    disabled={entry.disabled}
                    aria-current={entry.selected || undefined}
                    data-highlighted={index === highlighted ? "true" : undefined}
                    className={cx("ds-menu__item", entry.danger && "ds-menu__item--danger")}
                    onPointerEnter={() => index >= 0 && setHighlighted(index)}
                    onClick={() => choose(entry)}
                  >
                    {entry.icon ? <span className="ds-menu__icon">{entry.icon}</span> : null}
                    <span className="ds-menu__text">
                      <span>{entry.label}</span>
                      {entry.description ? (
                        <span className="ds-menu__description">{entry.description}</span>
                      ) : null}
                    </span>
                    <span className="ds-menu__trailing">
                      {entry.shortcut ? <span className="ds-kbd">{entry.shortcut}</span> : null}
                      {entry.selected ? <IconCheck size="var(--icon-sm)" /> : null}
                    </span>
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
