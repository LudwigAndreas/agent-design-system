## 1. Protocol types

- [x] 1.1 Add query schema types in `src/agent/types/`: a queryable field (id, label, type, permitted operators, enum values, reference entity) and the schema that collects them
- [x] 1.2 Add the predicate types: a field comparison, the logical combinators (and/or/not), and the recursive predicate union
- [x] 1.3 Add value reference types: a context reference and an entity lookup, as the alternatives to a literal inside a comparison
- [x] 1.4 Change `FilterAction.filter` to carry a predicate instead of `Record<string, unknown>`, keeping the old shape temporarily accepted so the tree still compiles
- [x] 1.5 Extend `AgentElementState` to carry an optional query schema, and `AgentReadableState` to carry the declared context references
- [x] 1.6 Add `staged` to `AgentActionStatus` and add the staged outcome fields to `AgentActionResult`
- [x] 1.7 Add typed parameters to `AgentDeclaredAction` so a declared action can accept a predicate
- [x] 1.8 Verify `npm run typecheck` passes with both filter shapes present

## 2. Predicate validation

- [x] 2.1 Implement schema validation for a predicate: unknown field, operator not permitted for the field, value type mismatch, value outside an enumeration
- [x] 2.2 Make each rejection name what was invalid and list what would have been valid
- [x] 2.3 Reject any predicate submitted as a raw query string
- [x] 2.4 Wire validation into the registry's execute path so it runs before any write and leaves state unchanged on failure
- [x] 2.5 Unit-test validation against each rejection case from the `agent-query-schema` spec

## 3. Value resolution

- [x] 3.1 Add a resolver registration surface so the application declares context references (id, description, resolved type) and entity lookups (entity, lookup field)
- [x] 3.2 Publish the declared context references in the agent-readable state; reject undeclared references like unknown fields
- [x] 3.3 Implement the resolution pass: run after shape validation, before the write, asynchronously, over every reference in the predicate
- [x] 3.4 Return the resolved display label for a lookup while keeping the resolved identifier inside the application
- [x] 3.5 Distinguish not-found and ambiguous lookups as typed failures, reporting the identifier and entity searched, and the match count when ambiguous
- [x] 3.6 Abort the whole query when any reference fails to resolve, applying no part of it
- [x] 3.7 Add declared date interpretation and resolve locale-ambiguous numeric dates through it
- [x] 3.8 Unit-test resolution: successful context reference, successful lookup, not found, ambiguous, partial failure aborts, date interpretation

## 4. Staged action lifecycle

- [x] 4.1 Let an operation declare that it stages, and branch the runtime to return a staged result instead of invoking the handler
- [x] 4.2 Compose staging with confirmation so an operation can require confirmation to be *prepared* and still need a separate trigger to run
- [x] 4.3 Hold staged operations in the runtime with the inputs they were prepared against, and expose them for rendering
- [x] 4.4 Record a fingerprint of the resolved inputs and the target's observed value at staging time
- [x] 4.5 Recompute the fingerprint on trigger and mark the operation stale when it differs
- [x] 4.6 Run a stale operation against current state when the user proceeds, and report the inputs actually used
- [x] 4.7 Refuse any agent-initiated trigger of a staged operation, leaving it staged
- [x] 4.8 Implement discard: no work performed, state unchanged, outcome recorded as discarded
- [x] 4.9 Discard staged operations whose target unmounts
- [x] 4.10 Unit-test the staged lifecycle against each scenario in the `agent-staged-actions` spec

## 5. Preview and reporting

- [x] 5.1 Render a predicate as human-readable text, with resolved labels in place of references and named months for dates
- [x] 5.2 Include the readable predicate and the matching record count in confirmation previews for operations that take a query
- [x] 5.3 Report the effective predicate rather than the requested one when the application overrides or narrows it
- [x] 5.4 Report the observed matching count after a query is applied

## 6. Design system

- [x] 6.1 Derive a default query schema from `DataTable` column definitions (id, label, inferred type) with a local override for operators, enum values and reference targets
- [x] 6.2 Publish the schema through the table's agent target and keep the current predicate as the target's agent-readable value
- [x] 6.3 Build a condition-chip row that renders each condition of the active predicate, readable and individually removable
- [x] 6.4 Make a predicate built by the agent appear in the chip row identically to one the user composed, and make amendments re-query
- [x] 6.5 Build the staged-operation block: description, readable inputs, matching count, trigger, discard, and a stale indicator
- [x] 6.6 Remove `filter`/`validateFilter` from `DataTable` in favour of the schema
- [x] 6.7 Add the chip row and the staged block to the `/design-system` page

## 7. Reference application

- [x] 7.1 Give the accounts table a query schema covering status, plan, seats, owner and last sign-in, with operators and enum values
- [x] 7.2 Register `current-user` and `current-user-unit` context resolvers and a `user`-by-email lookup over seeded directory data
- [x] 7.3 Add an organisational unit to the account and user models so "my unit" has something to resolve against
- [x] 7.4 Add an approver field to accounts so the orders scenario's approver condition has a reference field
- [x] 7.5 Add an export declared as staging and artifact-producing, taking the predicate as a typed parameter
- [x] 7.6 Make the export button and the agent's staged export call the same application function
- [x] 7.7 Extend the local adapter to build predicates from the acceptance prompt — date, context reference, lookup, conjunction — and to stage the export
- [x] 7.8 Remove the last untyped `filter` call sites and delete the compatibility shape from the types

## 8. Acceptance and verification

- [x] 8.1 Write an integration test for the full acceptance scenario: query by date, owner, approver email and unit, then stage an export
- [x] 8.2 Test that a predicate referencing an unknown field is rejected and the table is unchanged
- [x] 8.3 Test that an unresolvable approver email aborts the whole query
- [x] 8.4 Test that the user amending a chip re-queries and the agent's next read sees the amended predicate
- [x] 8.5 Test that changing the query after staging marks the export stale
- [x] 8.6 Run `npm run typecheck`, `npm test` and `npm run build`
- [x] 8.7 Drive the acceptance scenario by hand in the browser and confirm the resolved date, the resolved approver name and the record count are all visible before the export is triggered

## 9. Documentation

- [x] 9.1 Update `docs/agent/actions.md` for the predicate shape, the new error codes and the staged outcome
- [x] 9.2 Update `docs/agent/state.md` for the query schema and declared context references
- [x] 9.3 Write `docs/agent/queries.md` covering schema authoring, predicates, value resolution and staging, with the acceptance scenario worked through
- [x] 9.4 Add the query schema and staging rules to `AGENTS.md`
