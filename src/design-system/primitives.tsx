import type { CSSProperties, ReactNode } from "react";
import { cx } from "./types";

/** Every spacing value in the system. Nothing off-scale. */
export type Space = 0 | 2 | 4 | 6 | 8 | 12 | 16 | 20 | 24 | 32 | 40 | 48 | 64;

const space = (value: Space) => (value === 0 ? "0" : `var(--space-${value})`);

export interface StackProps {
  gap?: Space;
  align?: CSSProperties["alignItems"];
  className?: string;
  children: ReactNode;
  as?: "div" | "section" | "ul" | "form" | "li";
  style?: CSSProperties;
}

export function Stack({ gap = 16, align, className, children, as = "div", style }: StackProps) {
  const Component = as;
  return (
    <Component
      className={cx("ds-stack", className)}
      style={{ gap: space(gap), alignItems: align, ...style }}
    >
      {children}
    </Component>
  );
}

export interface InlineProps extends Omit<StackProps, "as"> {
  justify?: CSSProperties["justifyContent"];
  wrap?: boolean;
}

export function Inline({
  gap = 8,
  align = "center",
  justify,
  wrap = true,
  className,
  children,
  style,
}: InlineProps) {
  return (
    <div
      className={cx("ds-inline", className)}
      style={{
        gap: space(gap),
        alignItems: align,
        justifyContent: justify,
        flexWrap: wrap ? "wrap" : "nowrap",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cx("ds-divider", className)} />;
}

export function Spinner({ label }: { label?: string }) {
  return (
    <>
      <span className="ds-spinner" aria-hidden="true" />
      {label ? <span className="visually-hidden">{label}</span> : null}
    </>
  );
}

/** Placeholder geometry for content that is still loading. */
export function Skeleton({
  width = "100%",
  height = 12,
  radius,
  className,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  className?: string;
}) {
  return (
    <span
      className={cx("ds-skeleton", className)}
      aria-hidden="true"
      style={{ display: "block", width, height, borderRadius: radius }}
    />
  );
}

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "agent";

export interface BadgeProps {
  tone?: BadgeTone;
  /** Adds a small dot. Use for statuses, not for counts or labels. */
  dot?: boolean;
  children: ReactNode;
  className?: string;
}

export function Badge({ tone = "neutral", dot, children, className }: BadgeProps) {
  return (
    <span className={cx("ds-badge", tone !== "neutral" && `ds-badge--${tone}`, className)}>
      {dot ? <span className="ds-badge__dot" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="ds-kbd">{children}</kbd>;
}

export interface AvatarProps {
  /** Initials are derived from this when `initials` is not given. */
  name: string;
  initials?: string;
  size?: "sm" | "md" | "lg";
  tone?: "neutral" | "accent";
  className?: string;
}

export function Avatar({ name, initials, size = "sm", tone = "neutral", className }: AvatarProps) {
  const text =
    initials ??
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0] ?? "")
      .join("");

  return (
    <span
      className={cx("ds-avatar", size !== "sm" && `ds-avatar--${size}`, tone === "accent" && "ds-avatar--accent", className)}
      aria-hidden="true"
      title={name}
    >
      {text}
    </span>
  );
}

export interface CardProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  flush?: boolean;
  /**
   * Drops the border and radius. Useful when a Card is only being used for its
   * header/body structure inside a region that already has a boundary.
   */
  plain?: boolean;
  className?: string;
}

/**
 * Use a card only when content genuinely groups and benefits from a boundary.
 * Most page structure should come from a section heading and a hairline.
 */
export function Card({
  title,
  description,
  actions,
  children,
  flush,
  plain,
  className,
}: CardProps) {
  return (
    <div className={cx("ds-card", plain && "ds-card--plain", className)}>
      {title || actions ? (
        <div className="ds-card__header">
          <div>
            {title ? <h3 className="ds-card__title">{title}</h3> : null}
            {description ? <p className="ds-card__description">{description}</p> : null}
          </div>
          {actions ? <Inline gap={4}>{actions}</Inline> : null}
        </div>
      ) : null}
      {children ? (
        <div className={cx("ds-card__body", flush && "ds-card__body--flush")}>{children}</div>
      ) : null}
    </div>
  );
}

export function KeyValue({ items }: { items: { key: ReactNode; value: ReactNode }[] }) {
  return (
    <dl className="ds-kv">
      {items.map((item, index) => (
        <div key={index} style={{ display: "contents" }}>
          <dt className="ds-kv__key">{item.key}</dt>
          <dd className="ds-kv__value">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
