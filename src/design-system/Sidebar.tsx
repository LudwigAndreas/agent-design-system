import { useState, type ReactNode } from "react";
import { IconChevronRight } from "./icons";
import { cx } from "./types";

/**
 * Workspace navigation.
 *
 * The sidebar's job is to recede: chrome-coloured so it sits behind the page,
 * compact rows, muted icons, and a selected state that is a neutral scrim
 * rather than a coloured block. Nothing in here should compete with content.
 */

export interface SidebarProps {
  children: ReactNode;
  /** Pinned above the scroll area — typically the workspace row. */
  header?: ReactNode;
  footer?: ReactNode;
  className?: string;
  label?: string;
}

export function Sidebar({ children, header, footer, className, label = "Workspace" }: SidebarProps) {
  return (
    <nav className={cx("ds-sidebar", className)} aria-label={label}>
      {header ? <div style={{ padding: "var(--space-8) var(--space-8) 0" }}>{header}</div> : null}
      <div className="ds-sidebar__scroll">{children}</div>
      {footer ? <div className="ds-sidebar__footer">{footer}</div> : null}
    </nav>
  );
}

function Section({
  label,
  action,
  children,
}: {
  label?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="ds-sidebar__section">
      {label ? (
        <div className="ds-sidebar__section-label">
          <span style={{ flex: 1 }}>{label}</span>
          {action}
        </div>
      ) : null}
      {children}
    </div>
  );
}

export interface SidebarItemProps {
  label: ReactNode;
  icon?: ReactNode;
  /** Renders `aria-current="page"` and the selected scrim. */
  current?: boolean;
  nested?: boolean;
  /** A count or hint on the right. Keep it short. */
  trailing?: ReactNode;
  onClick?: () => void;
  className?: string;
}

function Item({ label, icon, current, nested, trailing, onClick, className }: SidebarItemProps) {
  return (
    <button
      type="button"
      className={cx("ds-sidebar__item", nested && "ds-sidebar__item--nested", className)}
      aria-current={current ? "page" : undefined}
      onClick={onClick}
    >
      {icon ? <span className="ds-sidebar__item-icon">{icon}</span> : null}
      <span className="ds-sidebar__item-label">{label}</span>
      {trailing ? <span className="ds-sidebar__item-trailing">{trailing}</span> : null}
    </button>
  );
}

export interface SidebarGroupProps {
  label: ReactNode;
  icon?: ReactNode;
  current?: boolean;
  defaultOpen?: boolean;
  /** Clicking the row itself, as distinct from the disclosure triangle. */
  onClick?: () => void;
  children: ReactNode;
}

/**
 * A nested group. The disclosure triangle and the row are separate targets, so
 * expanding a section does not force navigation.
 */
function Group({
  label,
  icon,
  current,
  defaultOpen = false,
  onClick,
  children,
}: SidebarGroupProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <div
        className="ds-sidebar__item"
        aria-current={current ? "page" : undefined}
        style={{ paddingInlineStart: "var(--space-4)" }}
      >
        <span
          role="button"
          tabIndex={0}
          aria-expanded={open}
          aria-label={open ? "Collapse section" : "Expand section"}
          className="ds-sidebar__disclosure"
          onClick={(event) => {
            event.stopPropagation();
            setOpen((value) => !value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setOpen((value) => !value);
            }
          }}
        >
          <IconChevronRight size={12} />
        </span>
        {icon ? <span className="ds-sidebar__item-icon">{icon}</span> : null}
        <button
          type="button"
          className="ds-sidebar__item-label"
          style={{ background: "none", textAlign: "start", cursor: "pointer", font: "inherit", color: "inherit" }}
          onClick={() => {
            setOpen(true);
            onClick?.();
          }}
        >
          {label}
        </button>
      </div>
      {open ? children : null}
    </div>
  );
}

export interface WorkspaceProps {
  name: string;
  meta?: string;
  avatar?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
}

/** The identity row at the top of the sidebar. An identity, not a logo. */
function Workspace({ name, meta, avatar, trailing, onClick }: WorkspaceProps) {
  const content = (
    <>
      {avatar}
      <span className="ds-workspace__text">
        <span className="ds-workspace__name">{name}</span>
        {meta ? <span className="ds-workspace__meta">{meta}</span> : null}
      </span>
      {trailing}
    </>
  );

  return onClick ? (
    <button type="button" className="ds-workspace" onClick={onClick}>
      {content}
    </button>
  ) : (
    <div className="ds-workspace">{content}</div>
  );
}

Sidebar.Section = Section;
Sidebar.Item = Item;
Sidebar.Group = Group;
Sidebar.Workspace = Workspace;
