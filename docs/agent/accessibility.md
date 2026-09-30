# Accessibility of agent-driven change

An agent that changes the UI without telling the user is worse than no agent.
Four rules, all enforced in code rather than convention.

## 1 · Announce sparingly

`AgentStatusRegion` is one polite live region, mounted once near the root. The
provider announces only:

- a completed action (`Agent Set Email notifications to off.`)
- a failed action, with the user-facing message
- a confirmation request
- a completed navigation

Not text deltas, not tool frames, not internal lifecycle transitions. Announcing
every event makes a live region worse than none.

## 2 · Move focus deliberately, or not at all

- `reveal` scrolls and spotlights. It never moves focus, because the user may be
  typing in the composer.
- `focus` moves focus, for when the next step is genuinely the user's input.

`Dialog` traps focus while open and restores it to wherever it was on close —
whether the human or the agent opened it.

## 3 · The user keeps control

Every agent-controllable component is a fully functioning control. The agent
changes values *through* it, so keyboard and pointer interaction are unaffected
while a turn is in flight, and a human change mid-turn simply wins — the agent
re-reads state rather than fighting it.

The agent panel is collapsible, and the resize handle is a `separator` with
arrow-key support, not a drag-only affordance.

## 4 · Perceivable status

- Agent-caused changes raise a toast with an Undo, so a change the user did not
  make is never silent.
- The audit trail labels each entry `Changed by agent` or `By user`.
- The agent hue is reserved for agent-caused change, and never carries meaning on
  its own — every use is paired with text.
- Streaming state is exposed as `aria-busy` on the transcript, which is a `log`.
- `prefers-reduced-motion` removes the spotlight animation, the caret blink and
  every transition.

## Checklist

- [ ] Is the change announced, once, in words a user understands?
- [ ] Did focus move only when the user needs to act?
- [ ] Is the control still operable by hand?
- [ ] Can the user reverse it, or at least see that it happened?
- [ ] Does colour alone carry any meaning? (It should not.)
