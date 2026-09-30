import type { ActionSource } from "../../agent/types/actions";

export type NotificationFrequency = "realtime" | "daily" | "weekly" | "monthly";

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  sms: boolean;
  frequency: NotificationFrequency;
  quietHours: boolean;
}

export interface ProfileSettings {
  name: string;
  email: string;
  language: string;
  timezone: string;
}

export interface SecuritySettings {
  twoFactor: boolean;
  sessionTimeout: string;
}

export type ThemePreference = "system" | "light" | "dark";

export interface AppearanceSettings {
  theme: ThemePreference;
  density: "comfortable" | "compact";
}

export interface Settings {
  notifications: NotificationSettings;
  profile: ProfileSettings;
  security: SecuritySettings;
  appearance: AppearanceSettings;
}

export type AccountStatus = "active" | "invited" | "suspended";

export interface Account {
  id: string;
  name: string;
  owner: string;
  email: string;
  status: AccountStatus;
  plan: "free" | "team" | "enterprise";
  seats: number;
  /** ISO date. `null` means the account has never signed in. */
  lastLoginAt: string | null;
}

export interface AccountFilter {
  status: AccountStatus | "all";
  /** Only accounts with no sign-in in this many days. 0 disables the rule. */
  inactiveDays: number;
  search: string;
}

export interface AuditEntry {
  id: string;
  at: number;
  description: string;
  source: ActionSource;
}

export interface AppState {
  settings: Settings;
  accounts: Account[];
  accountFilter: AccountFilter;
  selectedAccountIds: string[];
  audit: AuditEntry[];
  /** Simulated backend outage, so error paths are demonstrable. */
  smsServiceAvailable: boolean;
}
