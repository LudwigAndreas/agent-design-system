# Security boundary

**Treat every agent action as an untrusted request.** A model asking for
something is not authorization to do it.

```
Agent request
     ↓
Action validation          registry: does this target exist and support this?
     ↓
Authorization / rules      application: is this permitted, for this user, now?
     ↓
Confirmation if required   runtime + user
     ↓
Application action         the same code path a click takes
```

## Where each check lives

| Check | Location | Why there |
| --- | --- | --- |
| Target exists | `registry.execute` | Structural; cheap; prevents pointless questions. |
| Capability supported | `resolveCapabilities` | Derived from implemented handlers, not from claims. |
| Enabled | element state | A disabled control is disabled for everyone. |
| Value validity | the target's `validate` | Next to the rules it enforces. |
| **Authorization** | the target's `validate`, or the declared action's `run` | Where the application already knows the user, the tenant and the roles. |
| Confirmation | runtime + policy | A UI concern, so the UI layer owns it. |
| Server-side enforcement | your API | The only check an attacker cannot reach. |

The design system deliberately has no opinion on roles or permissions. It never
concludes that a request is allowed because an agent made it.

## Prompt injection

Model output is untrusted input. Anything a model can influence — a page, a
document, a support ticket — can try to instruct the agent.

Mitigations built in here:

- **The registry is the whole attack surface.** An agent can only reach
  registered targets with implemented capabilities. There is no `querySelector`
  and no synthetic clicking, so "click the hidden button" is not expressible.
- **Routes are allow-listed.** Navigation outside `registerRoute` fails.
- **Consequential actions need a human.** `destructive` and `sensitive` targets
  require a confirmation the model cannot self-approve; `confirm()` is only
  reachable from the UI.
- **Sensitive values are withheld** from the readable state, so injected text
  cannot exfiltrate them through the snapshot.
- **Assistant markdown is never HTML.** `Markdown` builds React elements and
  never touches `innerHTML`; only `http(s)` and `mailto` links survive.

What this does not solve: an agent with legitimate write access that is talked
into a legitimate-looking change. Keep confirmation for anything you would not
want done silently, and enforce authorization on the server.

## Auditability

Every action is recorded with its `ActionSource`, its status and its result.
`ActionSource` flows into design-system change callbacks (`ChangeMeta`), so the
application can record who caused a change in its own audit trail — and say
"Changed by agent" instead of pretending the user did it.

## Checklist for a new agent-controllable surface

- [ ] Are ids stable and semantic?
- [ ] Is authorization enforced in the handler, not assumed?
- [ ] Is the server authoritative for the same rule?
- [ ] Is anything destructive or sensitive marked as such?
- [ ] Do sensitive values stay out of the snapshot?
- [ ] Does the failure path report honestly?
