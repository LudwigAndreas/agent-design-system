## Purpose

Lets a query carry references such as "the current user", "my unit" or an email address in place of literal values, so the application resolves them against its own identity and directory while the agent never handles the user's identity itself.

## ADDED Requirements

### Requirement: Applications declare the context references they resolve

An application SHALL publish the set of context references available for use in a predicate. Each reference MUST declare its identifier, a human description, and the type of value it resolves to, so the agent can tell which fields it may be compared against.

A context reference not declared is not usable, and submitting one MUST be rejected in the same way as an unknown field.

#### Scenario: Agent reads available context references

- **WHEN** the agent reads the agent-readable state
- **THEN** it receives the declared context references, each with a description and a resolved type
- **AND** it can determine which queryable fields each reference is type-compatible with

#### Scenario: Undeclared context reference

- **WHEN** the agent submits a predicate using a context reference the application did not declare
- **THEN** the query is rejected before execution
- **AND** the rejection names the reference and lists the ones that are available

### Requirement: Context references resolve inside the application

When a predicate contains a context reference, the application SHALL resolve it to a concrete value at execution time. The resolved value MUST NOT be returned to the agent, and the agent MUST NOT be required to know it in order to build a correct query.

#### Scenario: Querying for the user's own records

- **WHEN** the user asks for records that are theirs and the agent compares the owner field to the current-user reference
- **THEN** the application resolves the reference to the signed-in user and queries with it
- **AND** the agent-readable state does not expose the resolved identifier

#### Scenario: Querying by the user's organisational unit

- **WHEN** the agent compares a unit field to the current-user-unit reference
- **THEN** the application resolves it from the signed-in user's organisation
- **AND** a user with no unit produces a resolution failure rather than an empty or unfiltered result

### Requirement: Human identifiers resolve to typed references

A predicate MAY compare a reference field to a human-readable identifier such as an email address rather than to an internal identifier. The application SHALL resolve that identifier against the referenced entity before querying.

Resolution MUST distinguish between finding exactly one match, finding none, and finding several. Finding none or several MUST be reported as a typed failure that names the identifier and the entity searched; the query MUST NOT be applied.

#### Scenario: Email resolves to one person

- **WHEN** the agent compares an approver field to an email address matching exactly one directory entry
- **THEN** the application resolves it to that entry's reference and applies the query
- **AND** the reported outcome names the person resolved, so the user can see who was matched

#### Scenario: Email matches nobody

- **WHEN** the agent compares a reference field to an identifier matching no directory entry
- **THEN** the query is rejected before execution
- **AND** the failure states that the identifier was not found and in which entity it was searched
- **AND** the view's results are unchanged

#### Scenario: Identifier is ambiguous

- **WHEN** an identifier matches more than one directory entry
- **THEN** the query is rejected before execution
- **AND** the failure reports that the identifier was ambiguous and how many entries matched

### Requirement: Ambiguous literals surface their interpretation

Where a literal value can be read more than one way — most importantly a date written in a numeric format that differs between locales — the system SHALL resolve it to a single unambiguous value and MUST surface that interpretation to the user in the language of the value, not the format of the input.

The interpretation MUST be visible before any consequential action is taken on the query's results.

#### Scenario: Numeric date is interpreted and shown

- **WHEN** the agent submits a date written as a locale-ambiguous numeric string
- **THEN** the system resolves it using the application's declared date interpretation
- **AND** the resolved date is presented to the user in unambiguous form, naming the month

#### Scenario: Interpretation precedes a consequential action

- **WHEN** a query containing an interpreted date is used as the input to an operation requiring confirmation
- **THEN** the unambiguous interpretation appears in what the user is asked to confirm

### Requirement: Unresolvable references stop the query

If any reference in a predicate fails to resolve, the system SHALL reject the whole query before execution. A partially resolved predicate MUST NOT be applied.

#### Scenario: One of several references fails

- **WHEN** a predicate contains three conditions and one reference cannot be resolved
- **THEN** no part of the query is applied
- **AND** the failure identifies which reference failed and why
- **AND** the view's existing results and query remain as they were
