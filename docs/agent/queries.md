# Queries

How a view declares what can be queried, how the agent fills that in, and how
an operation runs against the result without the agent doing the running.

The rule behind all of it: **the agent never writes a query language.** It fills
a schema the application published, and the application compiles the result.

## The shape of it

```
 agent                    runtime                        application
   │                         │                                │
   │  filter(target, pred)   │                                │
   ├────────────────────────►│                                │
   │                         │  1. validate against schema    │  no I/O
   │                         │     unknown field? → reject    │
   │                         │                                │
   │                         │  2. resolve values ────────────►  me → usr_…
   │                         │     any failure → reject all   │  email → user
   │                         │                                │  11.09 → 11 Sep
   │                         │  3. (confirm, if policy says)  │
   │                         │                                │
   │                         │  4. write ─────────────────────►  React state
   │                         │  5. verify ◄───────────────────┤
   │  result + matchCount    │                                │
   │◄────────────────────────┤                                │
```

Steps 1 and 2 both run *before* the user is asked anything. A bad query never
becomes a question, and a good one is shown with its values resolved.

## Declaring a schema

A target becomes queryable by publishing a schema. Without one, a `filter`
action is refused — there is no way to query a view that has not said what is
queryable.

```tsx
<DataTable
  agentId="accounts.table"
  querySchema={{
    entity: "account",
    fields: [
      { id: "name", label: "Name", type: "string" },
      { id: "seats", label: "Seats", type: "number" },
      { id: "createdAt", label: "Created", type: "date" },
      {
        id: "status",
        label: "Status",
        type: "enum",
        values: [{ value: "active", label: "Active" }, { value: "suspended" }],
      },
      {
        id: "approver",
        label: "Approver",
        type: "reference",
        entity: "user",
        lookupBy: ["email"],
      },
    ],
  }}
  query={query}
  onQueryChange={(next, meta) => setQuery(next, meta.source)}
/>
```

Or let it derive from the columns, which is usually enough:

```tsx
const columns = [
  { id: "name", header: "Name", query: true, cell: … },
  { id: "seats", header: "Seats", numeric: true, query: true, cell: … },
  { id: "status", header: "Status", query: { type: "enum", values: [...] }, cell: … },
];
```

A column with no `query` is not queryable. That is the safe default: a field the
schema does not mention cannot be reached.

### Operators

Each type has defaults, and a field may **narrow** them but never widen them:

| Type | Default operators |
| --- | --- |
| `string` | eq, ne, contains, startsWith, isEmpty, isNotEmpty |
| `number` | eq, ne, lt, lte, gt, gte |
| `boolean` | eq |
| `date` | eq, ne, lt, lte, gt, gte |
| `enum` | eq, ne, in |
| `reference` | eq, ne, in, isEmpty, isNotEmpty |

```ts
{ id: "plan", label: "Plan", type: "string", operators: ["eq"] }  // equality only
```

## Predicates

```ts
type QueryPredicate =
  | { kind: "compare"; field: string; op: QueryOperator; value?: QueryValue }
  | { kind: "and"; predicates: QueryPredicate[] }
  | { kind: "or";  predicates: QueryPredicate[] }
  | { kind: "not"; predicate: QueryPredicate };
```

The acceptance scenario, as the agent writes it:

```ts
{
  kind: "and",
  predicates: [
    { kind: "compare", field: "createdAt", op: "lt", value: "11.09.2025" },
    { kind: "compare", field: "owner", op: "eq", value: { $context: "current-user" } },
    { kind: "compare", field: "unit", op: "eq", value: { $context: "current-user-unit" } },
    {
      kind: "compare",
      field: "approver",
      op: "eq",
      value: { $lookup: { entity: "user", by: "email", value: "priya@northwind.example" } },
    },
  ],
}
```

Note what the agent did *not* do: it did not resolve "mine", it did not look up
the email, and it did not decide whether `11.09.2025` is September or November.

## Value resolution

Three kinds of value, only one of which is a literal.

**Context references** stand for something the application knows and the agent
does not. Declare what you will resolve:

```ts
const CONTEXT_REFERENCES = [
  { id: "current-user", description: "The signed-in user. Use for 'mine'.", type: "reference", entity: "user" },
  { id: "current-user-unit", description: "Their unit. Use for 'my unit'.", type: "reference", entity: "unit" },
];
```

```ts
resolveContext: (id) =>
  id === "current-user"
    ? { ok: true, value: profile.userId, display: profile.name }
    : { ok: false, reason: "this user is not assigned to a unit" };
```

Only `display` reaches the agent and the user. `value` goes into the query and
nowhere else.

**Lookups** turn a human identifier into a reference, and must distinguish three
outcomes:

```ts
lookupEntity: (entity, by, value) => {
  const matches = directory.filter((user) => user.email === value);
  if (matches.length === 0) return { ok: false, reason: "not-found" };
  if (matches.length > 1) return { ok: false, reason: "ambiguous", matches: matches.length };
  return { ok: true, value: matches[0].id, display: matches[0].name };
};
```

Finding nothing and finding several are both failures. Picking one would be a
guess the user cannot see.

**Reverse display** is the inverse, and it is what keeps a *stored* query
readable — a predicate holds ids, so without this a chip reads `Owner is
usr_ellen`:

```ts
describeValue: (entity, value) =>
  entity === "user" ? directory.find((u) => u.id === value)?.name : undefined;
```

### Ambiguous dates

`11.09.2025` is 11 September under `DMY` and 9 November under `MDY`. The
application decides:

```ts
getQueryLocale: () => ({ dateOrder: "DMY", locale: "en-GB" });
```

and the reading is **always** rendered with the month named — `11 September
2025` — wherever the query is shown. A numeric date never appears in a
confirmation or a staged summary, because a numeric date is exactly what the
user needs to be able to catch.

### Failure is total

If any reference in a predicate fails to resolve, the whole query is abandoned.
A partially resolved predicate is a different query from the one that was asked
for, and running it would silently answer a question nobody posed.

## One model, both actors

The predicate the agent writes and the one the user composes are the same object.
`QueryChips` renders it, and removing a chip re-queries:

```tsx
<QueryChips
  query={query}
  target="accounts.table"
  schema={ACCOUNT_QUERY_SCHEMA}
  onQueryChange={(next, meta) => setQuery(next, meta.source)}
/>
```

Toolbar controls are a shorthand over the same tree, not a second filter model —
a status dropdown edits the predicate the chips show.

This is why the user can correct the agent: if it read the date the wrong way,
the chip says so and one click removes it.

## Staged operations

An operation that is expensive, slow, or produces a file should be **prepared**
by the agent and **run** by the user:

```tsx
<AgentContext
  actions={[
    {
      id: "accounts.export",
      label: "Export matching accounts",
      description: "Prepare a spreadsheet of the accounts matching the current query.",
      stages: true,
      queryTarget: "accounts.table",
      run: () => exportAccounts(visibleAccounts, context),
    },
  ]}
>
```

`stages: true` makes `invoke` return a staged outcome instead of running.
`queryTarget` names the view whose query it runs against, which is what makes the
summary showable and staleness well-defined.

```
┌──────────────────────────────────────────────────┐
│ ✦ Ready to run — nothing has happened yet        │
│ Export matching accounts                         │
│                                                  │
│ Matching  Created is before 11 September 2025    │
│           and Owner is Ellen Nakamura and …      │
│ Scope     3 records match                        │
│                                                  │
│                      Discard   ↑ Export …        │
└──────────────────────────────────────────────────┘
```

**Only the user triggers it.** `triggerStaged` refuses an agent-sourced call and
leaves the operation staged. There is no action type that runs one.

**Staleness.** The operation records a fingerprint of its resolved inputs. If the
query changes, the first trigger stops, marks it stale, shows what it would run
against now, and runs nothing. A second trigger proceeds against *current* state.

**Discard** performs no part of the work.

Staging and confirmation compose: an operation may require confirmation to be
prepared and still need a trigger to run. Usually you want one or the other —
the reference application turns confirmation off for the export, because the
staged block is already the decision point.

## Error codes

| Code | Meaning |
| --- | --- |
| `invalid-query` | Failed schema validation. `error.problems` names each one. |
| `unresolved-reference` | A context reference or lookup did not resolve. |
| `requires-user-trigger` | The agent tried to run a staged operation. |

Every problem carries a message naming what was wrong **and what would have been
valid** — the field list, the permitted operators, the allowed enum values —
because the agent's next attempt depends on being told.

## Checklist for a new queryable view

- [ ] Does every schema field have a matching accessor in the evaluator?
- [ ] Are enum values declared, so a wrong one is rejected with the valid set?
- [ ] Do reference fields declare `entity` and `lookupBy`?
- [ ] Does `describeValue` cover every entity a reference field points at?
- [ ] Is the query rendered as chips the user can remove?
- [ ] Does an expensive operation stage rather than execute?
- [ ] Does a missing value mean what you think? (`lt` is false for null —
      "dormant" needs `or isEmpty`.)
