import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import type { ActionSource } from "../../agent/types/actions";
import type {
  Account,
  AccountFilter,
  AppState,
  AuditEntry,
  Settings,
} from "./types";

/**
 * The application's own state: the single source of truth that both human
 * clicks and agent actions converge on. Nothing in here knows an agent exists.
 */

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY).toISOString();

const ACCOUNTS: Account[] = [
  { id: "acc_1042", name: "Northwind Trading", owner: "Priya Raman", email: "priya@northwind.example", status: "active", plan: "enterprise", seats: 240, lastLoginAt: daysAgo(1) },
  { id: "acc_1043", name: "Lumen Labs", owner: "Sam Okafor", email: "sam@lumenlabs.example", status: "active", plan: "team", seats: 32, lastLoginAt: daysAgo(3) },
  { id: "acc_1044", name: "Cobalt Freight", owner: "Ana Duarte", email: "ana@cobaltfreight.example", status: "active", plan: "team", seats: 18, lastLoginAt: daysAgo(46) },
  { id: "acc_1045", name: "Harbour & Co", owner: "Tom Beck", email: "tom@harbour.example", status: "suspended", plan: "free", seats: 4, lastLoginAt: daysAgo(122) },
  { id: "acc_1046", name: "Vela Research", owner: "Mira Haddad", email: "mira@vela.example", status: "active", plan: "enterprise", seats: 512, lastLoginAt: daysAgo(2) },
  { id: "acc_1047", name: "Orchard Health", owner: "Dan Whitfield", email: "dan@orchard.example", status: "invited", plan: "team", seats: 0, lastLoginAt: null },
  { id: "acc_1048", name: "Quarry Systems", owner: "Lena Fischer", email: "lena@quarry.example", status: "active", plan: "team", seats: 26, lastLoginAt: daysAgo(64) },
  { id: "acc_1049", name: "Pinewood Media", owner: "Ivan Petrov", email: "ivan@pinewood.example", status: "active", plan: "free", seats: 6, lastLoginAt: daysAgo(31) },
  { id: "acc_1050", name: "Sable Logistics", owner: "Grace Kim", email: "grace@sable.example", status: "active", plan: "enterprise", seats: 310, lastLoginAt: daysAgo(5) },
  { id: "acc_1051", name: "Tidewater Group", owner: "Omar Nasser", email: "omar@tidewater.example", status: "active", plan: "team", seats: 44, lastLoginAt: daysAgo(89) },
];

export const initialAppState: AppState = {
  settings: {
    notifications: {
      email: true,
      push: true,
      sms: false,
      frequency: "daily",
      quietHours: true,
    },
    profile: {
      name: "Ellen Nakamura",
      email: "ellen@onecheck.example",
      language: "en-GB",
      timezone: "Europe/Berlin",
    },
    security: { twoFactor: true, sessionTimeout: "8h" },
    appearance: { theme: "system", density: "comfortable" },
  },
  accounts: ACCOUNTS,
  accountFilter: { status: "all", inactiveDays: 0, search: "" },
  selectedAccountIds: [],
  audit: [],
  smsServiceAvailable: false,
};

type Path = { section: keyof Settings; key: string };

export type AppAction =
  | { type: "set-setting"; path: Path; value: unknown; source: ActionSource }
  | { type: "set-account-filter"; filter: Partial<AccountFilter>; source: ActionSource }
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
        settings: {
          ...state.settings,
          [section]: { ...current, [key]: action.value },
        },
        audit: audited(
          state,
          `${section}.${key} → ${JSON.stringify(action.value)}`,
          action.source,
        ),
      };
    }

    case "set-account-filter":
      return {
        ...state,
        accountFilter: { ...state.accountFilter, ...action.filter },
        // A changed filter invalidates a selection made against the old one.
        selectedAccountIds: [],
        audit: audited(
          state,
          `Accounts filtered ${JSON.stringify({ ...state.accountFilter, ...action.filter })}`,
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

export interface AppStore {
  state: AppState;
  dispatch: (action: AppAction) => void;
  /** Rows after the current filter — what the user actually sees. */
  visibleAccounts: Account[];
}

const AppStoreContext = createContext<AppStore | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialAppState);

  const visibleAccounts = useMemo(
    () => filterAccounts(state.accounts, state.accountFilter),
    [state.accounts, state.accountFilter],
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

export function filterAccounts(accounts: Account[], filter: AccountFilter): Account[] {
  const cutoff = filter.inactiveDays > 0 ? Date.now() - filter.inactiveDays * DAY : null;
  const needle = filter.search.trim().toLowerCase();

  return accounts.filter((account) => {
    if (filter.status !== "all" && account.status !== filter.status) return false;

    if (cutoff !== null) {
      // Never signed in counts as inactive: it is the strongest case.
      const last = account.lastLoginAt ? Date.parse(account.lastLoginAt) : 0;
      if (last > cutoff) return false;
    }

    if (needle) {
      const haystack = `${account.name} ${account.owner} ${account.email} ${account.id}`;
      if (!haystack.toLowerCase().includes(needle)) return false;
    }

    return true;
  });
}

export function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - Date.parse(iso)) / DAY);
}
