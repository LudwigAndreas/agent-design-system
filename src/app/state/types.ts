import type { ActionSource } from "../../agent/types/actions";
import type { QueryPredicate } from "../../agent/types/query";

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
  /** The signed-in user's own id, so "mine" has something to resolve to. */
  userId: string;
  /** Their organisational unit, so "my unit" does too. */
  unitId: string;
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

export type AccountPlan = "free" | "team" | "enterprise";

export interface Account {
  id: string;
  name: string;
  owner: string;
  email: string;
  status: AccountStatus;
  plan: AccountPlan;
  seats: number;
  /** ISO date. `null` means the account has never signed in. */
  lastLoginAt: string | null;
  /** ISO date the account record was created. */
  createdAt: string;
  /** The user who owns this account, as a directory id. */
  ownerId: string;
  /** The user who approved it, if anyone has. */
  approverId: string | null;
  /** The organisational unit it is assigned to. */
  unitId: string;
}

/** A directory entry. The thing an email address resolves to. */
export interface DirectoryUser {
  id: string;
  name: string;
  email: string;
  unitId: string;
}

export interface OrgUnit {
  id: string;
  name: string;
}

/**
 * The toolbar's own controls. These compose into the same predicate the
 * agent writes — they are a shorthand over it, not a second filter model.
 */
export interface AccountToolbarFilter {
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
  directory: DirectoryUser[];
  units: OrgUnit[];
  /** The query in effect on the accounts table. One model, both actors. */
  accountQuery: QueryPredicate;
  selectedAccountIds: string[];
  audit: AuditEntry[];
  /** Simulated backend outage, so error paths are demonstrable. */
  smsServiceAvailable: boolean;
}
