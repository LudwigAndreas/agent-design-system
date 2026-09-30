import type { ReactNode } from "react";
import { cx } from "./types";

/**
 * Page layout primitives.
 *
 * The rhythm is fixed here so every screen inherits it: title, lede, then
 * sections separated by space and hairlines. Width is a deliberate choice per
 * page — prose wants a measure, tables want room.
 */
export type PageWidth = "narrow" | "medium" | "wide" | "full";

export interface PageProps {
  children: ReactNode;
  className?: string;
}

export function Page({ children, className }: PageProps) {
  return <div className={cx("ds-page", className)}>{children}</div>;
}

function Content({
  width = "medium",
  children,
  className,
}: {
  width?: PageWidth;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("ds-page__inner", `ds-page__inner--${width}`, className)}>{children}</div>
  );
}

function Header({
  title,
  description,
  eyebrow,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** A small line above the title: a breadcrumb, a context, a count. */
  eyebrow?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cx("ds-page__header", className)}>
      <div>
        {eyebrow ? <div className="ds-page__eyebrow">{eyebrow}</div> : null}
        <h1 className="ds-page__title">{title}</h1>
        {description ? <p className="ds-page__lede">{description}</p> : null}
      </div>
      {actions ? <div className="ds-page__header-actions">{actions}</div> : null}
    </header>
  );
}

Page.Content = Content;
Page.Header = Header;
