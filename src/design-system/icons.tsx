import type { SVGProps } from "react";

/**
 * A small, original stroke-icon set.
 *
 * Deliberately plain geometry on a 16px grid with a 1.5px stroke: icons here
 * are labels, not illustration. They inherit `currentColor` and size from the
 * `size` prop so they sit inside compact controls without special-casing.
 */
export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  size?: number | string;
}

function Icon({ size = "var(--icon-md)", ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ flex: "none", display: "block" }}
      {...props}
    />
  );
}

export const IconHome = (props: IconProps) => (
  <Icon {...props}>
    <path d="M2.5 6.6 8 2.5l5.5 4.1V13a.5.5 0 0 1-.5.5H3a.5.5 0 0 1-.5-.5z" />
    <path d="M6.25 13.5v-4h3.5v4" />
  </Icon>
);

export const IconTable = (props: IconProps) => (
  <Icon {...props}>
    <rect x="2.25" y="2.75" width="11.5" height="10.5" rx="1.25" />
    <path d="M2.25 6.25h11.5M6.5 6.25v7" />
  </Icon>
);

export const IconSettings = (props: IconProps) => (
  <Icon {...props}>
    <path d="M2.5 4.5h11M2.5 11.5h11" />
    <circle cx="6" cy="4.5" r="1.75" />
    <circle cx="10.5" cy="11.5" r="1.75" />
  </Icon>
);

export const IconUser = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="8" cy="5.5" r="2.5" />
    <path d="M3 13.5c.6-2.4 2.5-3.6 5-3.6s4.4 1.2 5 3.6" />
  </Icon>
);

export const IconBell = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 7a4 4 0 1 1 8 0c0 2.2.5 3.3 1.1 4H2.9C3.5 10.3 4 9.2 4 7Z" />
    <path d="M6.5 13a1.6 1.6 0 0 0 3 0" />
  </Icon>
);

export const IconLock = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3.25" y="7" width="9.5" height="6.5" rx="1.25" />
    <path d="M5.75 7V5.25a2.25 2.25 0 0 1 4.5 0V7" />
  </Icon>
);

export const IconPalette = (props: IconProps) => (
  <Icon {...props}>
    <path d="M8 2.5a5.5 5.5 0 0 0 0 11c.9 0 1.4-.6 1.4-1.3 0-.8-.7-1.1-.7-1.9 0-.6.5-1.1 1.2-1.1h1.2a2.4 2.4 0 0 0 2.4-2.5C13.5 4.6 11.1 2.5 8 2.5Z" />
    <circle cx="5.6" cy="7" r=".9" fill="currentColor" stroke="none" />
    <circle cx="8.4" cy="5.3" r=".9" fill="currentColor" stroke="none" />
  </Icon>
);

export const IconTerminal = (props: IconProps) => (
  <Icon {...props}>
    <rect x="2.25" y="2.75" width="11.5" height="10.5" rx="1.25" />
    <path d="m5.5 6.5 1.75 1.5L5.5 9.5M8.75 10h2" />
  </Icon>
);

export const IconSearch = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="7.25" cy="7.25" r="4" />
    <path d="m10.25 10.25 3 3" />
  </Icon>
);

export const IconChevronRight = (props: IconProps) => (
  <Icon {...props}>
    <path d="m6.25 3.75 4.5 4.25-4.5 4.25" />
  </Icon>
);

export const IconChevronDown = (props: IconProps) => (
  <Icon {...props}>
    <path d="m3.75 6.25 4.25 4 4.25-4" />
  </Icon>
);

export const IconChevronUpDown = (props: IconProps) => (
  <Icon {...props}>
    <path d="m5 6.5 3-2.5 3 2.5M5 9.5l3 2.5 3-2.5" />
  </Icon>
);

export const IconCheck = (props: IconProps) => (
  <Icon {...props}>
    <path d="m3.25 8.5 3 3 6.5-7" />
  </Icon>
);

export const IconMinus = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 8h8" />
  </Icon>
);

export const IconClose = (props: IconProps) => (
  <Icon {...props}>
    <path d="m4 4 8 8M12 4l-8 8" />
  </Icon>
);

export const IconPlus = (props: IconProps) => (
  <Icon {...props}>
    <path d="M8 3.5v9M3.5 8h9" />
  </Icon>
);

export const IconMore = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="3.5" cy="8" r=".95" fill="currentColor" stroke="none" />
    <circle cx="8" cy="8" r=".95" fill="currentColor" stroke="none" />
    <circle cx="12.5" cy="8" r=".95" fill="currentColor" stroke="none" />
  </Icon>
);

/** The agent's mark: a small four-point star, used sparingly. */
export const IconSparkle = (props: IconProps) => (
  <Icon {...props}>
    <path d="M8 2.25c.35 2.6 1.15 3.4 3.75 3.75-2.6.35-3.4 1.15-3.75 3.75-.35-2.6-1.15-3.4-3.75-3.75C6.85 5.65 7.65 4.85 8 2.25Z" />
    <path d="M11.9 10.4c.17 1.15.55 1.53 1.7 1.7-1.15.17-1.53.55-1.7 1.7-.17-1.15-.55-1.53-1.7-1.7 1.15-.17 1.53-.55 1.7-1.7Z" />
  </Icon>
);

export const IconArrowUp = (props: IconProps) => (
  <Icon {...props}>
    <path d="M8 12.75v-9.5M4.25 7 8 3.25 11.75 7" />
  </Icon>
);

export const IconUndo = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3.25 7.25h6.5a3 3 0 0 1 0 6H7" />
    <path d="M5.75 4.75 3.25 7.25l2.5 2.5" />
  </Icon>
);

export const IconTrash = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3 4.5h10M6.25 4.5V3.25h3.5V4.5M4.5 4.5l.5 8.25a.75.75 0 0 0 .75.75h4.5a.75.75 0 0 0 .75-.75l.5-8.25" />
  </Icon>
);

export const IconFilter = (props: IconProps) => (
  <Icon {...props}>
    <path d="M2.75 4h10.5L9.25 8.5v4L6.75 11V8.5z" />
  </Icon>
);

export const IconPanel = (props: IconProps) => (
  <Icon {...props}>
    <rect x="2.25" y="3" width="11.5" height="10" rx="1.25" />
    <path d="M9.75 3v10" />
  </Icon>
);

export const IconExpand = (props: IconProps) => (
  <Icon {...props}>
    <path d="M9.5 2.75h3.75V6.5M6.5 13.25H2.75V9.5" />
    <path d="m13.25 2.75-4.5 4.5M2.75 13.25l4.5-4.5" />
  </Icon>
);

export const IconCollapse = (props: IconProps) => (
  <Icon {...props}>
    <path d="M13 6.5H9.25V2.75M3 9.5h3.75v3.75" />
    <path d="m9.25 6.75 4-4M6.75 9.25l-4 4" />
  </Icon>
);

export const IconAlert = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="8" cy="8" r="5.75" />
    <path d="M8 5v3.5" />
    <circle cx="8" cy="10.75" r=".8" fill="currentColor" stroke="none" />
  </Icon>
);

export const IconInfo = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="8" cy="8" r="5.75" />
    <path d="M8 7.5V11" />
    <circle cx="8" cy="5.25" r=".8" fill="currentColor" stroke="none" />
  </Icon>
);

export const IconDoc = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 2.75h4.5L12 6.25v7a.75.75 0 0 1-.75.75h-7.5a.75.75 0 0 1-.75-.75V3.5a.75.75 0 0 1 .75-.75Z" />
    <path d="M8.25 2.9v3.35H11.8" />
  </Icon>
);
