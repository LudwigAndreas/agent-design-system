# Worked examples

Each of these runs in the reference application (`npm run dev`). The
**Inspector** page shows the actions as they execute.

## 1 · "Take me to notification settings."

```
navigate("settings.notifications")   → succeeded
reveal("notifications.email")        → succeeded
getState()                           → reads values AFTER arriving
```

The agent then explains what is available, using the page's own `context` prose
and the live element values rather than guessing from markup.

## 2 · "Turn off email notifications."

```
getState()                                       → is the control on this screen?
navigate("settings.notifications")               → only if it is not
toggle("notifications.email", false)
  ├ validate      target exists, supports write, enabled
  ├ policy        not sensitive → no confirmation
  ├ execute       calls onCheckedChange(false, { source: "agent" })
  └ verify        re-reads until read() === false
→ "Done — Email notifications is now off."   [Undo]
```

If the switch is already off, the agent says so and changes nothing.

## 3 · "Change the notification frequency to weekly."

```
select-option("notifications.frequency", "weekly")   → succeeded
reveal("notifications.frequency")
```

The select publishes its options, so `"hourly"` fails with `invalid-value` and a
message naming the valid set. `"Weekly digest"` also works — options match on
label as well as value.

## 4 · "Show me accounts that haven't logged in for 30 days."

```
tool-started    account_search
navigate("accounts")
filter("accounts.table", { status: "all", inactiveDays: 30, search: "" })
tool-completed  "Found 4 matching accounts"
reveal("accounts.table")
```

The table's agent value *is* its filter, and its `data` publishes `rowCount`,
`rowIds` and `selectedIds` — so the agent reports the real result rather than
describing a filter it hopes was applied. `validateFilter` rejects unknown
fields and invalid statuses.

## 5 · "Delete these records."

```
getState()                               → reads selectedIds from the table
invoke("accounts.delete-selected")
  ├ policy        destructive → confirmation required
  ├ preview       "Agent wants to run a destructive action"
  ├ user confirms
  └ execute       runs the application's own delete function
→ "Deleted. The table now shows 6 accounts."
```

With nothing selected, the agent says so instead of guessing what to delete.
Cancelling yields `status: "cancelled"` and changes nothing.

## Failure paths worth trying

| Ask | What happens |
| --- | --- |
| "Turn on SMS notifications" | The app refuses the write. `state-not-confirmed`; the agent reports the failure and the switch stays off. The Inspector page can bring the provider back online. |
| "Turn on two-factor authentication" | `sensitive` → confirmation required even though no application rule mentions it. |
| Cancel any confirmation | `cancelled`, nothing changed, the transcript says so. |
| Change a switch by hand mid-turn | The agent's next `getState()` sees your value, not its own assumption. |

## Driving the layer without the chat

The **Inspector** page runs actions directly through the same runtime:

```ts
agent.executeAction({ type: "toggle", target: "notifications.email", value: false });
agent.navigate("settings.notifications");
agent.reveal("notifications.frequency");
agent.undo();
```

Including the deliberate failures: an unknown target, a rejected value, and a
write the application refuses.
