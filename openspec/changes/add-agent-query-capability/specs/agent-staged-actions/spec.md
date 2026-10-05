## Purpose

Lets an agent prepare an operation and hand the trigger to the user instead of running it, which is the right behaviour for work that is expensive, slow, or produces an artifact the user must receive.

## ADDED Requirements

### Requirement: Operations declare that they stage

An operation SHALL be able to declare that it stages rather than executes. When the agent requests a staging operation, the system MUST prepare it and return a staged outcome instead of performing it.

Staging MUST be a distinct outcome from both immediate execution and confirm-then-execute: a confirmed action runs once the user approves it, whereas a staged action waits for the user to trigger it and may never run at all.

#### Scenario: Agent requests a staging operation

- **WHEN** the agent invokes an operation declared as staging
- **THEN** the operation is prepared but not performed
- **AND** the result reports a staged outcome rather than success or failure
- **AND** no artifact is produced and no irreversible work is done

#### Scenario: Staging is distinct from confirmation

- **WHEN** an operation is declared as staging and also requires confirmation
- **THEN** the user is asked to confirm, and on approval the operation is staged rather than performed
- **AND** performing it still requires a separate, explicit trigger

### Requirement: A staged operation shows what it will do

A staged operation SHALL be presented to the user with a description of the work, the inputs it will run against, and an explicit control to trigger it. Where the operation runs against a query, the presentation MUST include the query in human-readable form and the number of records it currently matches.

The presentation MUST make clear that nothing has happened yet.

#### Scenario: Export is staged against a query

- **WHEN** the agent stages an export of the records matching a query it has just applied
- **THEN** the user is shown what will be exported, the query in readable form, and the matching record count
- **AND** a single control is offered to perform the export
- **AND** no file has been produced

#### Scenario: Agent reports staging honestly

- **WHEN** an operation has been staged
- **THEN** the agent states that the operation is ready and awaiting the user
- **AND** the agent does not describe the operation as done

### Requirement: Only the user triggers a staged operation

A staged operation SHALL run only when the user triggers it. The agent MUST NOT be able to trigger a staged operation on the user's behalf, in the same turn or any later one.

Once triggered, the operation runs through the application's own path and its real outcome MUST be reported, including failure.

#### Scenario: User triggers the staged operation

- **WHEN** the user activates the control on a staged operation
- **THEN** the operation runs and its outcome is reported
- **AND** on success the resulting artifact is delivered to the user

#### Scenario: Agent cannot self-trigger

- **WHEN** the agent attempts to trigger an operation it has staged
- **THEN** the attempt is refused
- **AND** the operation remains staged and awaiting the user

#### Scenario: Triggered operation fails

- **WHEN** the user triggers a staged operation and the application reports an error
- **THEN** the failure is reported to the user with the application's reason
- **AND** the operation is not described as having succeeded

### Requirement: A staged operation goes stale when its inputs change

A staged operation SHALL record the state it was prepared against. If that state changes before the user triggers it — whether changed by the user, the agent or the system — the staged operation MUST be marked stale.

A stale operation MUST NOT run on its recorded inputs without the user being told what changed. The system MUST either refresh it against current state and show the difference, or require the user to re-confirm.

#### Scenario: Query changes after staging

- **WHEN** an export is staged against a query matching a given number of records, and the query is then changed
- **THEN** the staged export is marked stale
- **AND** the user is shown that the underlying query changed before they can trigger it

#### Scenario: Stale operation is refreshed

- **WHEN** the user chooses to proceed with a stale staged operation
- **THEN** it runs against current state, not the state recorded when it was staged
- **AND** the outcome reports the inputs actually used

### Requirement: Discarding a staged operation changes nothing

The user SHALL be able to discard a staged operation. Discarding MUST perform no part of the work and MUST leave application state exactly as it was.

#### Scenario: User discards

- **WHEN** the user discards a staged operation
- **THEN** no work is performed and no artifact is produced
- **AND** the record of the staged operation reports that it was discarded
- **AND** application state is unchanged
