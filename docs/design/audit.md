# Visual audit — before the Notion-inspired redesign

A record of what the first implementation looked like, why it did not read as
Notion-inspired, and what changed. Kept so the reasoning behind the token system
survives the commit that introduced it.

## Current visual language (before)

- **Palette** — warm-ish ink neutrals on a `#f6f6f4` canvas, white card surfaces,
  a saturated teal brand accent (`#2c7a70`) and a second saturated violet "agent"
  hue (`#584ca8`).
- **Surfaces** — every region is a bordered card: `border + radius 12px +
  shadow-sm`. Dashboard metrics, settings groups, account table, agent action
  rows, previews and toasts are all boxes.
- **Radii** — 3 / 5 / 8 / 12 / 16 / pill. Buttons 8px, cards 12px, dialogs 16px.
- **Shadows** — `--shadow-sm` applied to static surfaces; `md` on toasts; `lg` on
  dialogs. Elevation is decoration rather than signal.
- **Typography** — 15px base with a 9-step scale up to 36px. Heavy use of
  uppercase, letter-spaced 11px micro-labels for badges, table headers, metric
  captions and section labels.
- **Density** — 36px controls, 16px button padding, 20px card padding, 12px table
  cell padding. Comfortable everywhere, compact nowhere.
- **Navigation** — a horizontal top bar with pill-backed active states and a
  teal brand mark in a rounded square. No sidebar.
- **Layout** — a single `max-width: 62rem` page, content stacked as cards.
  No readable-width variants, no document rhythm.
- **Agent** — chat bubbles with an accent-tinted background and asymmetric
  radius; action rows as violet-tinted bordered boxes; a 3px violet halo with a
  pulse animation for the spotlight.
- **Missing** — no menus or popovers, no tooltip, no empty/loading/error state
  components, no page primitives, no icon set.

## Problems

Twenty differences, ordered by how much each one costs:

1. **Card-first grammar.** Structure comes from bordered, rounded, shadowed
   containers instead of from typography and spacing. This alone reads as
   "SaaS dashboard".
2. **No sidebar.** A top nav bar frames the app as an admin panel rather than a
   workspace. There is nowhere for hierarchy, sections or nesting to live.
3. **Radii too large.** 12–16px on every container makes the page a collection of
   floating tiles.
4. **Shadows on static surfaces.** Elevation stops meaning "this floats above".
5. **Two saturated hues.** A teal brand plus a violet agent colour compete, and
   the brand mark puts saturated colour in the permanent chrome.
6. **Uppercase micro-labels everywhere.** Letter-spaced caps on badges, table
   headers and metric captions are dashboard grammar, not document grammar.
7. **Metric tiles.** Four bordered boxes with 28px numerals — the canonical
   generic-dashboard component.
8. **Controls are too large.** 36px buttons and inputs with 16px padding; nothing
   feels compact or tactile.
9. **Hover states change hue** (`--color-surface-hover` is a distinct solid
   colour) rather than laying a neutral scrim over whatever is underneath.
10. **Badges for everything.** Every account status is a pill; the eye is pulled
    to metadata rather than to names.
11. **No text-width discipline.** Prose and tables share one 62rem column.
12. **Page headers are undifferentiated.** A title and lede floating above cards,
    with no hairline or rhythm to separate page from content.
13. **Settings are boxed.** Each group is a card, so settings read as a control
    panel instead of a structured document.
14. **Table chrome is heavy.** Sunken uppercase sticky headers and 12px cells
    make a data table look like a report.
15. **Chat bubbles.** Accent-filled user bubbles read as a chat product bolted on
    to the side of the app.
16. **Agent action rows are boxes** in a second accent colour, so routine
    activity is as loud as a confirmation request.
17. **Theatrical spotlight.** A pulsing violet halo announces itself rather than
    quietly showing where the agent went.
18. **Focus rings are 3px halos**, visually heavier than the controls they mark.
19. **Spacing scale is rem-based and abstract** (`--space-4` = 16px), so values
    get picked by feel; card padding dominates the rhythm.
20. **No popover layer at all** — no menus, no tooltips — so there is nowhere for
    the compact, tightly-spaced interactions that define the target feel.

## Notion-inspired target

The visual grammar inverts:

```
typography → spacing → layout → hairlines → minimal surfaces → small accents
```

- A warm off-white page, a slightly darker warm chrome for the sidebar, and pure
  white reserved for things that genuinely float.
- Hierarchy from weight, size, colour and space. Containers only when content
  genuinely groups.
- Hairline borders at ~8% ink; separators instead of boxes.
- Radii 2–8px. Elevation only for popovers, menus and dialogs.
- Compact controls: 24 / 28 / 32px heights, 6–10px horizontal padding.
- Translucent neutral scrims for hover and selection, so states compose over any
  background.
- One restrained accent, used for selection, focus and primary actions — never as
  page decoration.
- The agent panel as a quiet extension of the workspace: labelled turns, no
  bubbles, changes rendered as lightweight blocks.

## Changes required

- Rewrite the token layer: colour, type, space (px-named), radius, shadow,
  control heights, icon sizes, motion.
- Rewrite both stylesheets around the new grammar.
- Add the missing primitives: page layout, sidebar, menu, tooltip, empty state,
  skeleton, setting row, avatar, kbd, icon set.
- Restyle every existing component and remove card usage that is not earning it.
- Restructure the reference application around a sidebar workspace.
- Rebuild the agent panel's visual presentation without touching its
  architecture.
- Add a design-system page as a visual regression surface.

## Components affected

Tokens, base styles, and: Button, Input, Select, Checkbox, Switch, Field,
Dialog, Tabs, DataTable, Badge, Card, SettingsSection, Notifications/Toast,
primitives (Stack/Inline/Divider/Spinner/KeyValue), AgentAppShell, AgentChat,
AgentMessages, AgentActionPreview, AgentSuggestions, AgentSpotlight,
AgentDemoPanel, and every page in the reference application.
