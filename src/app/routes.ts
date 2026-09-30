import type { AgentRouteRegistration } from "../agent/types/registry";

/**
 * Semantic routes. The agent navigates by these ids and never sees a URL, so
 * the routing implementation can change without breaking agent behaviour.
 */
export const ROUTES = [
  {
    id: "dashboard",
    title: "Dashboard",
    description: "Account totals, activity and anything needing attention.",
  },
  {
    id: "accounts",
    title: "Accounts",
    description: "The account table, with status, plan, seats and last sign-in.",
  },
  {
    id: "settings.profile",
    title: "Profile settings",
    description: "Name, email address, language and timezone.",
  },
  {
    id: "settings.notifications",
    title: "Notification settings",
    description: "Email, push and SMS notifications, and how often they are sent.",
  },
  {
    id: "settings.security",
    title: "Security settings",
    description: "Two-factor authentication and session timeout.",
  },
  {
    id: "settings.appearance",
    title: "Appearance settings",
    description: "Theme and layout density.",
  },
  {
    id: "developer",
    title: "Agent inspector",
    description: "Developer view of executed agent actions and agent-readable state.",
  },
  {
    id: "design-system",
    title: "Design system",
    description: "Every component rendered together, as a visual reference surface.",
  },
] as const satisfies readonly AgentRouteRegistration[];

export type RouteId = (typeof ROUTES)[number]["id"];

export const DEFAULT_ROUTE: RouteId = "dashboard";

export const SETTINGS_TABS = [
  { value: "profile", label: "Profile" },
  { value: "notifications", label: "Notifications" },
  { value: "security", label: "Security" },
  { value: "appearance", label: "Appearance" },
] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number]["value"];

export function isRouteId(value: string): value is RouteId {
  return ROUTES.some((route) => route.id === value);
}

/** `settings.notifications` → `settings`. */
export function topLevel(route: string): string {
  return route.split(".")[0] ?? route;
}

/** `settings.notifications` → `notifications`, defaulting to the first tab. */
export function settingsTab(route: string): SettingsTab {
  const segment = route.split(".")[1];
  return (SETTINGS_TABS.find((tab) => tab.value === segment)?.value ??
    SETTINGS_TABS[0].value) as SettingsTab;
}
