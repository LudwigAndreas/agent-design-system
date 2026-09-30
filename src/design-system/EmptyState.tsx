import type { ReactNode } from "react";
import { cx } from "./types";

/**
 * Quiet by construction: a short title, one supporting line, at most one
 * action. There is no illustration slot and no large heading, because both
 * make an empty region louder than a full one.
 */
export interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  /** A single small icon. Optional, and easy to leave out. */
  icon?: ReactNode;
  action?: ReactNode;
  align?: "start" | "center";
  tone?: "neutral" | "danger";
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  align = "start",
  tone = "neutral",
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cx(
        "ds-empty",
        align === "center" && "ds-empty--center",
        tone === "danger" && "ds-empty--danger",
        className,
      )}
      role={tone === "danger" ? "alert" : undefined}
    >
      {icon ? <span className="ds-empty__icon">{icon}</span> : null}
      <p className="ds-empty__title">{title}</p>
      {description ? <p className="ds-empty__description">{description}</p> : null}
      {action ? <div className="ds-empty__actions">{action}</div> : null}
    </div>
  );
}
