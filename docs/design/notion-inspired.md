# The visual rulebook

A workspace-application visual language: quiet, warm, editorial, information-first.
Typography and spacing do the work; colour and elevation are used sparingly and
deliberately.

The grammar, in priority order:

```
typography → spacing → layout → hairlines → minimal surfaces → small accents
```

Not:

```
cards → shadows → gradients → rounded corners → colour
```

The interface should be almost quiet until someone interacts with it.

Four questions to ask of any screen before it ships:

1. Remove the colour — does it still have hierarchy? *(It should.)*
2. Remove the shadows — does it still have structure? *(It should.)*
3. Remove the cards — does the page still read? *(It should.)*
4. Do type and space alone establish the hierarchy? *(They must.)*

---

## Colour

One warm near-black ink at varying alpha, one restrained accent, muted semantics.

| Token | Use |
| --- | --- |
| `--color-page` | The content area. The lightest surface on screen. |
| `--color-chrome` | Sidebar and agent panel. Slightly darker, so they recede. |
| `--color-surface` | Only things that float: menus, dialogs, toasts. |
| `--color-surface-sunken` | Code blocks and other inset content. |
| `--color-surface-hover` / `-active` | Interaction states. |

**Interaction states are translucent ink scrims, never solid colours.** That is
what lets one hover rule work identically over the page, the sidebar and a menu.
Never define a new hover colour per context.

Text has five levels — `--color-text`, `-secondary`, `-tertiary`, `-muted`,
`-disabled`. Use them instead of reaching for a lighter grey: a description is
`secondary`, table metadata is `tertiary`, a label is `muted`.

The accent (`--color-accent`) marks selection, focus and the single primary
action on a page. It is never page decoration, never a header background, and
never a brand flourish. Semantic colours (`success`, `warning`, `danger`) come as
a text colour, a `-soft` background and a `-border`, and stay muted enough to sit
inside a dense table without pulling the eye.

The agent hue (`--color-agent`) is reserved for marking what the agent touched:
a small glyph, a label, a brief outline. Never a fill, never a glow.

**Colour never carries meaning alone.** Every tone is paired with text.

## Typography

Ten sizes, three weights. 14px is the UI default; 15px is for reading; 30px is a
page title. Hierarchy comes from weight, size, colour and space — never from a
decorative container.

Forbidden, because they read as dashboard rather than document:

- uppercase + letter-spacing micro-labels
- more than one heading size per section
- font sizes not in the scale

Line height: `--leading-tight` for headings, `--leading-normal` for UI,
`--leading-relaxed` for prose and agent messages. Prose gets a measure —
`max-width: 60–72ch`.

## Spacing

Tokens are named for their pixel value: `--space-12` is 12px. The scale is
2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64. **Do not invent values.**

Rhythm that holds across every page:

```
page title
  8   lede
 32   first section
 12   heading → hairline
 16   hairline → content
 40   section → section
```

Inside controls, space is tight: 6–10px horizontal padding on a button, 8px on
an input. Density is a feature; do not make a component "comfortable" by padding
it.

## Surfaces

The default is **no container**. A heading, a hairline and content is the normal
way to structure a page.

Use `--color-surface` only for something genuinely floating: a menu, a dialog, a
toast. Use `--color-chrome` for the persistent frame. Everything else sits on the
page.

## Borders

Hairlines at ~6–11% ink. A border should be felt before it is seen.

Prefer a separator over a box:

```
Notifications
──────────────────────────
Email notifications  [ ]
Push notifications   [x]
```

not:

```
┌────────────────────────┐
│ Email notifications [ ]│
│ Push notifications  [x]│
└────────────────────────┘
```

`--color-border-subtle` separates rows and sections. `--color-border` outlines
inputs and cards. `--color-border-strong` is for a control that needs to be
grabbable — a checkbox, a switch track.

## Shadows

There is deliberately **no card shadow token**.

| Token | Use |
| --- | --- |
| *(none)* | Every page-level surface, including cards. |
| `--shadow-popover` | Menus, tooltips, toasts. |
| `--shadow-dialog` | Modal dialogs. |

If something has a shadow, it must genuinely be above the page and dismissible.

## Radius

2, 3, 4, 6, 8 — and `--radius-full` only for a switch track, an avatar dot or a
badge dot.

| Radius | Use |
| --- | --- |
| `--radius-sm` (3px) | Checkboxes, badges, inline code |
| `--radius-md` (4px) | Buttons, inputs, selects, rows |
| `--radius-lg` (6px) | Menus, cards, toasts |
| `--radius-xl` (8px) | Dialogs |

No pill-shaped buttons. No `rounded-2xl` anything.

## Buttons

Compact: 28px (`sm`) or 32px (default), 10px horizontal padding, medium weight,
4px radius, no shadow.

| Variant | Use |
| --- | --- |
| `primary` | The one action a page is for. At most one per view. |
| `secondary` | The workhorse. Hairline outline, fill on hover. |
| `tertiary` | Text with a hover scrim. Dialog cancel, inline actions. |
| `ghost` | Icon buttons and toolbar controls. |
| `danger` | Destructive confirmation. |
| `agent` | Something the agent will do. Rare. |

Most interfaces should be mostly `secondary`, `tertiary` and `ghost`. If a screen
has three primary buttons, it has none.

Icon buttons are a compact square hit area with a hover scrim — never an icon
inside a filled circle — and always carry an accessible name, plus a `Tooltip`
when the icon is not self-evident.

## Cards

**When not to use a card:**

- to give a page structure — use a heading and a hairline
- for a settings group — use `SettingsSection` and `SettingRow`
- for a metric — use a figure and a label, not a tile
- for a list — use hairline-separated rows
- for a table — put the table on the page

**When to use one:** content that genuinely groups, sits beside sibling content,
and needs an edge to be legible. A card is a border and a radius. Never a shadow.

## Navigation

The sidebar is chrome-coloured so it recedes behind the content. Rows are 28px,
icons are 14px and muted, labels are 14px secondary. The selected state is a
neutral scrim plus medium weight — never a coloured block.

Structure: a workspace identity row, a primary section, then labelled sections
with nested groups. Section labels are 12px muted. Avoid separators between every
group; space is enough.

Nothing in the sidebar should compete with the page.

## Tables

Compact rows (36px), hairline dividers, muted 12px headers in normal weight,
tabular numerals for numeric columns, right-aligned figures. Selection checkboxes
stay hidden until a row is hovered or selected. A row hover is a scrim; a
selected row is `--color-accent-soft`.

No boxed table container, no coloured header band, no card-like rows.

## Badges

Metadata, not status lights. Sentence case, 12px, a muted `-soft` background, and
a dot when the tone alone carries the meaning. If every row has three badges,
delete two.

## Empty, loading and error states

Quiet. A short title, one supporting line, at most one action. No illustration,
no oversized heading, no full-width call to action.

```
No projects yet
Create your first project to get started.
[Create project]
```

Loading is a `Skeleton` in the shape of the content, or a small inline `Spinner`
with a label. Errors use `EmptyState` with `tone="danger"` and say what failed.

## Agent UI

The agent panel is a natural extension of the workspace, not a chat product
docked to the side. It sits on `--color-chrome`, mirroring the sidebar, and is
separated from the page by a single hairline.

**Turns are labelled, not bubbled.** A small "You" / "Agent" label and a block of
text. The user's turn gets a faint scrim; the agent's turn gets nothing at all.
No avatars, no alignment games, no gradients, no glow.

**Activity is a row, not a card.** A glyph, a sentence, and the semantic target
in mono underneath. Routine activity must read lighter than anything asking for a
decision. Trailing controls — Undo, Retry — appear on hover.

**A proposed change is the one container.** It gets a hairline, a subject, and a
before/after, because it is the one place the agent asks the user to decide:

```
✦ Agent wants to change
  You asked me to turn email notifications off.

  Email notifications
  Enabled → Disabled

                    Cancel   Confirm
```

The before value is read live from the application, so the user confirms against
what is actually true.

**Spotlight** is a hairline outline in the agent hue plus a faint tint, held
briefly. Scroll into view, mark, fade. No pulse, no halo, no movement. `reveal`
never takes keyboard focus; only `focus` does, and only when the user's input is
the next step.

**Suggestions** are quiet rows, not pills — things you could ask, not buttons
competing with the page.

## Motion

Short and mechanical: `--duration-instant` (80ms) for hover, `--duration-fast`
(120ms) for state changes, `--duration-base` (160ms) for things appearing.

Motion communicates opening, closing, selection, focus, navigation and state
change. It never decorates. `prefers-reduced-motion` disables all of it, and the
interface must remain fully legible without it.

## Focus

A 2px accent outline at 1px offset, or an accent border plus a 2.5px soft ring on
fields. Visible, but never heavier than the control it marks. Focus styles use
`:focus-visible`, so pointer interaction stays quiet.

## Density

`data-density="compact"` on the root tightens row height, control heights and the
page gutter through tokens alone. No component implements density itself.
