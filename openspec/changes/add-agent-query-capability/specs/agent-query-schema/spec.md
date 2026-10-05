## Purpose

Lets a data view publish what can be queried against it, so an agent can build a valid, inspectable query by filling a declared schema rather than by writing a query language the application must then trust.

## ADDED Requirements

### Requirement: Query-capable targets declare a query schema

A target that accepts a query SHALL publish a query schema in the agent-readable state. The schema MUST describe every queryable field: its identifier, its human label, its type, the operators valid for it, its permitted values when the field is an enumeration, and the entity it refers to when the field is a reference.

A field absent from the schema is not queryable. The agent MUST NOT be able to discover queryable fields by any means other than the schema.

#### Scenario: Agent reads what is queryable

- **WHEN** the agent reads the state of a view whose table supports querying
- **THEN** that target's state includes a query schema listing each queryable field with its type and valid operators
- **AND** an enumerated field lists its permitted values
- **AND** a reference field names the entity it points at

#### Scenario: Non-queryable data has no schema

- **WHEN** the agent reads the state of a view that displays data but does not support querying
- **THEN** no query schema is present on that target
- **AND** the target does not advertise a query capability

### Requirement: The agent submits a structured predicate

The agent SHALL express a query as a structured predicate composed of field comparisons and logical combinators. The agent MUST NOT submit a query in any textual query language, and the system MUST NOT accept one.

A predicate MUST support comparing a field to a value using an operator the schema permits for that field, and MUST support combining predicates with conjunction, disjunction and negation.

#### Scenario: Multi-condition query

- **WHEN** the agent queries for records created before a date, owned by one party and approved by another
- **THEN** it submits a single predicate combining three field comparisons by conjunction
- **AND** the view applies it as one query

#### Scenario: Query language is refused

- **WHEN** the agent submits a query as a raw filter expression string rather than a predicate
- **THEN** the request is rejected before execution
- **AND** no query is applied to the view

### Requirement: Predicates are validated before execution

The system SHALL validate a predicate against the target's query schema before applying any part of it. Validation MUST reject an unknown field, an operator the schema does not permit for that field, a value whose type does not match the field, and a value outside an enumerated field's permitted set.

A rejected predicate MUST leave the view unchanged, and the rejection MUST name what was invalid and what would have been valid.

#### Scenario: Unknown field

- **WHEN** the agent submits a predicate referencing a field the schema does not declare
- **THEN** the query is rejected before execution
- **AND** the rejection names the unknown field and lists the fields that are queryable
- **AND** the view's current results and filter are unchanged

#### Scenario: Operator not permitted for the field

- **WHEN** the agent applies an ordering comparison to a field the schema declares as equality-only
- **THEN** the query is rejected before execution
- **AND** the rejection names the operators permitted for that field

#### Scenario: Value outside an enumeration

- **WHEN** the agent compares an enumerated field to a value outside its permitted set
- **THEN** the query is rejected before execution
- **AND** the rejection lists the permitted values

### Requirement: One predicate model serves the user and the agent

The predicate the agent submits and the query a human composes through the interface SHALL be the same model. A query built by the agent MUST be visible in the view's own query interface, and the user MUST be able to inspect, amend or clear it there using the ordinary controls.

The system MUST NOT maintain a separate agent-only query path.

#### Scenario: Agent's query is visible to the user

- **WHEN** the agent applies a predicate to a view
- **THEN** the view's query interface displays each condition of that predicate in the same form as a condition the user composed
- **AND** the user can remove or amend any individual condition

#### Scenario: User amends what the agent built

- **WHEN** the user removes one condition from a query the agent applied
- **THEN** the view re-queries with the remaining conditions
- **AND** a subsequent read of the agent-readable state reflects the amended predicate

### Requirement: Applied queries report their actual result

After applying a predicate the system SHALL report the result observed from the application, not the result requested. The reported outcome MUST include the number of matching records.

An application that refuses, alters or overrides the query MUST be reported as such, and the agent MUST NOT describe a query as applied when it was not.

#### Scenario: Query applied successfully

- **WHEN** a valid predicate is applied and the view re-queries
- **THEN** the result reports success and the number of records now matching
- **AND** the reported count equals the count the view displays

#### Scenario: Application overrides the query

- **WHEN** the application narrows or replaces the submitted predicate before querying
- **THEN** the reported result describes the predicate actually in effect
- **AND** the agent reports the effective query rather than the requested one
