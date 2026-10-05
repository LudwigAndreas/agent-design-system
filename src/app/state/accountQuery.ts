import type {
  AgentContextReference,
  AgentQueryLocale,
  QuerySchema,
} from "../../agent/types/query";
import type { ContextResolution, LookupResolution } from "../../agent/types/registry";
import type { AppState } from "./types";

/**
 * What can be queried on the accounts table, and what the application is
 * prepared to resolve inside such a query.
 *
 * This is the contract the agent fills in. Every field here is also in
 * `ACCOUNT_FIELDS`, and nothing the agent can name is absent from it.
 */

export const ACCOUNT_QUERY_SCHEMA: QuerySchema = {
  entity: "account",
  fields: [
    { id: "name", label: "Name", type: "string", description: "The account's name." },
    {
      id: "status",
      label: "Status",
      type: "enum",
      values: [
        { value: "active", label: "Active" },
        { value: "invited", label: "Invited" },
        { value: "suspended", label: "Suspended" },
      ],
    },
    {
      id: "plan",
      label: "Plan",
      type: "enum",
      values: [
        { value: "free", label: "Free" },
        { value: "team", label: "Team" },
        { value: "enterprise", label: "Enterprise" },
      ],
    },
    { id: "seats", label: "Seats", type: "number" },
    {
      id: "createdAt",
      label: "Created",
      type: "date",
      description: "The date the account record was created.",
    },
    {
      id: "lastLoginAt",
      label: "Last sign-in",
      type: "date",
      description:
        "When the account last signed in. Empty for accounts that never have, " +
        "which `isEmpty` matches.",
    },
    {
      id: "owner",
      label: "Owner",
      type: "reference",
      entity: "user",
      lookupBy: ["email"],
      description: "The user who owns the account.",
    },
    {
      id: "approver",
      label: "Approver",
      type: "reference",
      entity: "user",
      lookupBy: ["email"],
      description: "The user who approved the account. Empty if nobody has.",
    },
    {
      id: "unit",
      label: "Unit",
      type: "reference",
      entity: "unit",
      lookupBy: ["name"],
      description: "The organisational unit the account is assigned to.",
    },
  ],
};

/**
 * References the agent may use in place of a value. It names them; it never
 * learns what they resolve to.
 */
export const CONTEXT_REFERENCES: AgentContextReference[] = [
  {
    id: "current-user",
    description: "The signed-in user. Use for 'mine', 'me', 'my accounts'.",
    type: "reference",
    entity: "user",
  },
  {
    id: "current-user-unit",
    description: "The signed-in user's organisational unit. Use for 'my unit'.",
    type: "reference",
    entity: "unit",
  },
];

/** This application writes dates day-first. `11.09.2025` is 11 September. */
export const QUERY_LOCALE: AgentQueryLocale = { dateOrder: "DMY", locale: "en-GB" };

export function resolveAccountContext(state: AppState, id: string): ContextResolution {
  const { profile } = state.settings;

  switch (id) {
    case "current-user":
      return profile.userId
        ? { ok: true, value: profile.userId, display: profile.name }
        : { ok: false, reason: "no user is signed in" };

    case "current-user-unit": {
      if (!profile.unitId) {
        // A missing unit must fail rather than quietly match everything.
        return { ok: false, reason: "this user is not assigned to a unit" };
      }
      const unit = state.units.find((candidate) => candidate.id === profile.unitId);
      return { ok: true, value: profile.unitId, display: unit?.name ?? profile.unitId };
    }

    default:
      return { ok: false, reason: `"${id}" is not a reference this application knows` };
  }
}

export function lookupDirectory(
  state: AppState,
  entity: string,
  by: string,
  value: string,
): LookupResolution {
  const needle = value.trim().toLowerCase();

  if (entity === "unit") {
    if (by !== "name") return { ok: false, reason: "unsupported" };
    const units = state.units.filter((unit) => unit.name.toLowerCase() === needle);
    if (units.length === 0) return { ok: false, reason: "not-found" };
    if (units.length > 1) return { ok: false, reason: "ambiguous", matches: units.length };
    return { ok: true, value: units[0]!.id, display: units[0]!.name };
  }

  if (entity !== "user") return { ok: false, reason: "unsupported" };
  if (by !== "email") return { ok: false, reason: "unsupported" };

  const matches = state.directory.filter((user) => user.email.toLowerCase() === needle);

  if (matches.length === 0) return { ok: false, reason: "not-found" };
  if (matches.length > 1) return { ok: false, reason: "ambiguous", matches: matches.length };

  // Only the display name comes back. The id travels with the predicate and
  // is never handed to the agent.
  return { ok: true, value: matches[0]!.id, display: matches[0]!.name };
}

/**
 * The inverse of a lookup: an id back to the label a person reads.
 *
 * Without this a stored predicate would render as `Owner is usr_ellen` — the
 * id is what the application queries with, but never what it should show.
 */
export function describeAccountValue(
  state: AppState,
  entity: string,
  value: unknown,
): string | undefined {
  if (entity === "user") {
    return state.directory.find((user) => user.id === value)?.name;
  }
  if (entity === "unit") {
    return state.units.find((unit) => unit.id === value)?.name;
  }
  return undefined;
}
