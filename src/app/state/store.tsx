import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import type { ActionSource } from "../../agent/types/actions";
import {
  EMPTY_PREDICATE,
  isEmptyPredicate,
  type QueryLiteral,
  type QueryPredicate,
} from "../../agent/types/query";
import { evaluatePredicate, type FieldAccessor } from "./evaluate";
import type {
  Account,
  AppState,
  AuditEntry,
  DirectoryUser,
  OrgUnit,
  Settings,
} from "./types";

/**
 * The application's own state: the single source of truth that both human
 * clicks and agent actions converge on. Nothing in here knows an agent exists.
 */

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY).toISOString();

export const UNITS: OrgUnit[] = [
  { id: "unit-north", name: "Northern region" },
  { id: "unit-south", name: "Southern region" },
];

/**
 * The directory an email address resolves against. Seeded so a lookup has
 * something real to find, miss, and — for one address — find twice.
 */
export const DIRECTORY: DirectoryUser[] = [
  { id: "usr_ellen", name: "Ellen Nakamura", email: "ellen@onecheck.example", unitId: "unit-north" },
  { id: "usr_priya", name: "Priya Raman", email: "priya@northwind.example", unitId: "unit-north" },
  { id: "usr_sam", name: "Sam Okafor", email: "sam@lumenlabs.example", unitId: "unit-south" },
  { id: "usr_ana", name: "Ana Duarte", email: "ana@cobaltfreight.example", unitId: "unit-north" },
  { id: "usr_tom", name: "Tom Beck", email: "tom@harbour.example", unitId: "unit-south" },
  { id: "usr_mira", name: "Mira Haddad", email: "mira@vela.example", unitId: "unit-north" },
  { id: "usr_dan", name: "Dan Whitfield", email: "dan@orchard.example", unitId: "unit-south" },
  { id: "usr_lena", name: "Lena Fischer", email: "lena@quarry.example", unitId: "unit-north" },
  { id: "usr_ivan", name: "Ivan Petrov", email: "ivan@pinewood.example", unitId: "unit-south" },
  { id: "usr_grace", name: "Grace Kim", email: "grace@sable.example", unitId: "unit-north" },
  { id: "usr_omar", name: "Omar Nasser", email: "omar@tidewater.example", unitId: "unit-south" },
  // Two people share a shared-mailbox address, so an ambiguous lookup is
  // reachable without contriving one.
  { id: "usr_ops_a", name: "Ops (Jo Field)", email: "ops@onecheck.example", unitId: "unit-north" },
  { id: "usr_ops_b", name: "Ops (Rae Lind)", email: "ops@onecheck.example", unitId: "unit-south" },
];

const ACCOUNTS: Account[] = [
  { id: "acc_1042", name: "Northwind Trading", owner: "Priya Raman", email: "priya@northwind.example", status: "active", plan: "enterprise", seats: 240, lastLoginAt: daysAgo(1), createdAt: "2025-02-14", ownerId: "usr_ellen", approverId: "usr_priya", unitId: "unit-north" },
  { id: "acc_1043", name: "Lumen Labs", owner: "Sam Okafor", email: "sam@lumenlabs.example", status: "active", plan: "team", seats: 32, lastLoginAt: daysAgo(3), createdAt: "2025-06-02", ownerId: "usr_sam", approverId: "usr_priya", unitId: "unit-south" },
  { id: "acc_1044", name: "Cobalt Freight", owner: "Ana Duarte", email: "ana@cobaltfreight.example", status: "active", plan: "team", seats: 18, lastLoginAt: daysAgo(46), createdAt: "2025-04-21", ownerId: "usr_ellen", approverId: "usr_priya", unitId: "unit-north" },
  { id: "acc_1045", name: "Harbour & Co", owner: "Tom Beck", email: "tom@harbour.example", status: "suspended", plan: "free", seats: 4, lastLoginAt: daysAgo(122), createdAt: "2024-11-08", ownerId: "usr_tom", approverId: null, unitId: "unit-south" },
  { id: "acc_1046", name: "Vela Research", owner: "Mira Haddad", email: "mira@vela.example", status: "active", plan: "enterprise", seats: 512, lastLoginAt: daysAgo(2), createdAt: "2025-09-20", ownerId: "usr_ellen", approverId: "usr_priya", unitId: "unit-north" },
  { id: "acc_1047", name: "Orchard Health", owner: "Dan Whitfield", email: "dan@orchard.example", status: "invited", plan: "team", seats: 0, lastLoginAt: null, createdAt: "2025-08-30", ownerId: "usr_dan", approverId: null, unitId: "unit-south" },
  { id: "acc_1048", name: "Quarry Systems", owner: "Lena Fischer", email: "lena@quarry.example", status: "active", plan: "team", seats: 26, lastLoginAt: daysAgo(64), createdAt: "2025-01-30", ownerId: "usr_ellen", approverId: "usr_priya", unitId: "unit-north" },
  { id: "acc_1049", name: "Pinewood Media", owner: "Ivan Petrov", email: "ivan@pinewood.example", status: "active", plan: "free", seats: 6, lastLoginAt: daysAgo(31), createdAt: "2025-07-11", ownerId: "usr_ellen", approverId: "usr_sam", unitId: "unit-north" },
  { id: "acc_1050", name: "Sable Logistics", owner: "Grace Kim", email: "grace@sable.example", status: "active", plan: "enterprise", seats: 310, lastLoginAt: daysAgo(5), createdAt: "2025-03-05", ownerId: "usr_grace", approverId: "usr_priya", unitId: "unit-north" },
  { id: "acc_1051", name: "Tidewater Group", owner: "Omar Nasser", email: "omar@tidewater.example", status: "active", plan: "team", seats: 44, lastLoginAt: daysAgo(89), createdAt: "2025-05-19", ownerId: "usr_ellen", approverId: "usr_priya", unitId: "unit-south" },
];

export const initialAppState: AppState = {
  settings: {
    notifications: { email: true, push: true, sms: false, frequency: "daily", quietHours: true },
    profile: {
      name: "Ellen Nakamura",
      email: "ellen@onecheck.example",
      language: "en-GB",
      timezone: "Europe/Berlin",
      userId: "usr_ellen",
      unitId: "unit-north",
    },
    security: { twoFactor: true, sessionTimeout: "8h" },
    appearance: { theme: "system", density: "comfortable" },
  },
  accounts: ACCOUNTS,
  directory: DIRECTORY,
  units: UNITS,
  accountQuery: EMPTY_PREDICATE,
  selectedAccountIds: [],
  audit: [],
  smsServiceAvailable: false,
};

type Path = { section: keyof Settings; key: string };

export type AppAction =
  | { type: "set-setting"; path: Path; value: unknown; source: ActionSource }
  | { type: "set-account-query"; query: QueryPredicate; source: ActionSource }
  | { type: "set-selection"; ids: string[]; source: ActionSource }
  | { type: "delete-accounts"; ids: string[]; source: ActionSource }
  | { type: "suspend-accounts"; ids: string[]; source: ActionSource }
  | { type: "reset-notifications"; source: ActionSource }
  | { type: "set-sms-service"; available: boolean };

let auditSeq = 0;

function audited(state: AppState, description: string, source: ActionSource): AuditEntry[] {
  const entry: AuditEntry = {
    id: `audit_${auditSeq++}`,
    at: Date.now(),
    description,
    source,
  };
  return [entry, ...state.audit].slice(0, 40);
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "set-setting": {
      const { section, key } = action.path;

      // A deliberate failure path: the SMS provider is down, so the write is
      // refused. The agent must report this, not claim success.
      if (section === "notifications" && key === "sms" && !state.smsServiceAvailable) {
        return {
          ...state,
          audit: audited(
            state,
            `Rejected SMS notification change — provider unavailable`,
            action.source,
          ),
        };
      }

      const current = state.settings[section] as unknown as Record<string, unknown>;
      if (current[key] === action.value) return state;

      return {
        ...state,
        settings: { ...state.settings, [section]: { ...current, [key]: action.value } },
        audit: audited(
          state,
          `${section}.${key} → ${JSON.stringify(action.value)}`,
          action.source,
        ),
      };
    }

    case "set-account-query":
      return {
        ...state,
        accountQuery: action.query,
        // A changed query invalidates a selection made against the old one.
        selectedAccountIds: [],
        audit: audited(
          state,
          isEmptyPredicate(action.query)
            ? "Account query cleared"
            : `Account query changed (${countConditions(action.query)} conditions)`,
          action.source,
        ),
      };

    case "set-selection":
      return { ...state, selectedAccountIds: action.ids };

    case "delete-accounts": {
      if (action.ids.length === 0) return state;
      return {
        ...state,
        accounts: state.accounts.filter((account) => !action.ids.includes(account.id)),
        selectedAccountIds: [],
        audit: audited(
          state,
          `Deleted ${action.ids.length} account${action.ids.length === 1 ? "" : "s"}`,
          action.source,
        ),
      };
    }

    case "suspend-accounts":
      return {
        ...state,
        accounts: state.accounts.map((account) =>
          action.ids.includes(account.id) ? { ...account, status: "suspended" } : account,
        ),
        audit: audited(state, `Suspended ${action.ids.length} account(s)`, action.source),
      };

    case "reset-notifications":
      return {
        ...state,
        settings: {
          ...state.settings,
          notifications: initialAppState.settings.notifications,
        },
        audit: audited(state, "Notification preferences reset", action.source),
      };

    case "set-sms-service":
      return { ...state, smsServiceAvailable: action.available };

    default:
      return state;
  }
}

function countConditions(predicate: QueryPredicate): number {
  switch (predicate.kind) {
    case "compare":
      return 1;
    case "not":
      return countConditions(predicate.predicate);
    default:
      return predicate.predicates.reduce((total, child) => total + countConditions(child), 0);
  }
}

/**
 * How each queryable field is read off an account. The schema the agent sees
 * and this map are two halves of one contract: a field in one and not the
 * other is a bug the query tests catch.
 */
export const ACCOUNT_FIELDS: Record<string, FieldAccessor<Account>> = {
  name: (account) => account.name,
  status: (account) => account.status,
  plan: (account) => account.plan,
  seats: (account) => account.seats,
  createdAt: (account) => account.createdAt,
  lastLoginAt: (account) => account.lastLoginAt,
  owner: (account) => account.ownerId,
  approver: (account) => account.approverId,
  unit: (account) => account.unitId,
};

export function queryAccounts(accounts: Account[], query: QueryPredicate | undefined): Account[] {
  return accounts.filter((account) => evaluatePredicate(account, query, ACCOUNT_FIELDS));
}

export interface AppStore {
  state: AppState;
  dispatch: (action: AppAction) => void;
  /** Rows after the current query — what the user actually sees. */
  visibleAccounts: Account[];
}

const AppStoreContext = createContext<AppStore | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialAppState);

  const visibleAccounts = useMemo(
    () => queryAccounts(state.accounts, state.accountQuery),
    [state.accounts, state.accountQuery],
  );

  const value = useMemo<AppStore>(
    () => ({ state, dispatch, visibleAccounts }),
    [state, visibleAccounts],
  );

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore(): AppStore {
  const store = useContext(AppStoreContext);
  if (!store) throw new Error("useAppStore() must be used inside an <AppStoreProvider>.");
  return store;
}

/** Narrow helper for settings, used by both UI and agent target handlers. */
export function useSetting<T>(section: keyof Settings, key: string) {
  const { state, dispatch } = useAppStore();
  const value = (state.settings[section] as unknown as Record<string, unknown>)[key] as T;
  const set = useCallback(
    (next: T, source: ActionSource) =>
      dispatch({ type: "set-setting", path: { section, key }, value: next, source }),
    [dispatch, section, key],
  );
  return [value, set] as const;
}

export function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - Date.parse(iso)) / DAY);
}

/** The ISO date N days ago, for building "no sign-in since" conditions. */
export function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * DAY).toISOString().slice(0, 10);
}

/**
 * "No sign-in for N days", as a predicate.
 *
 * An account that has never signed in has no `lastLoginAt` at all, and a
 * comparison against a missing value is false — so the disjunction with
 * `isEmpty` is load-bearing. Never having signed in is the strongest case of
 * dormant, not an exception to it.
 */
export function dormantPredicate(days: number): QueryPredicate {
  return {
    kind: "or",
    predicates: [
      { kind: "compare", field: "lastLoginAt", op: "lt", value: isoDaysAgo(days) },
      { kind: "compare", field: "lastLoginAt", op: "isEmpty" },
    ],
  };
}

export function unitName(units: OrgUnit[], id: QueryLiteral | null): string {
  return units.find((unit) => unit.id === id)?.name ?? String(id ?? "");
}
