import { useState } from "react";
import { AgentContext } from "../../agent/components/AgentContext";
import { AgentActionPreview } from "../../agent/components/AgentActionPreview";
import { AgentMessageView } from "../../agent/components/AgentMessages";
import { AgentSpotlight } from "../../agent/components/AgentSpotlight";
import { AgentSuggestions } from "../../agent/components/AgentSuggestions";
import { useAgent } from "../../agent/hooks/useAgent";
import type { AgentMessage } from "../../agent/types/messages";
import type { ResolvedAgentAction } from "../../agent/types/actions";
import { Button } from "../../design-system/Button";
import { Checkbox } from "../../design-system/Checkbox";
import { DataTable, Toolbar, ToolbarSpacer } from "../../design-system/DataTable";
import { Dialog } from "../../design-system/Dialog";
import { EmptyState } from "../../design-system/EmptyState";
import {
  IconAlert,
  IconBell,
  IconHome,
  IconSearch,
  IconSettings,
  IconTable,
  IconTrash,
} from "../../design-system/icons";
import { Input } from "../../design-system/Input";
import { Menu } from "../../design-system/Menu";
import { Page } from "../../design-system/Page";
import {
  Avatar,
  Badge,
  Card,
  Divider,
  Inline,
  Kbd,
  KeyValue,
  Skeleton,
  Spinner,
  Stack,
} from "../../design-system/primitives";
import { SettingRow } from "../../design-system/SettingRow";
import { SettingsSection } from "../../design-system/Section";
import { Select } from "../../design-system/Select";
import { Sidebar } from "../../design-system/Sidebar";
import { Switch } from "../../design-system/Switch";
import { Tabs } from "../../design-system/Tabs";
import { Tooltip } from "../../design-system/Tooltip";

/**
 * The visual reference surface.
 *
 * Every component rendered together, in one scroll, so a regression in the
 * token layer is visible immediately and so anyone — human or agent — building
 * a new screen can see what the system actually offers.
 */
export function DesignSystemPage() {
  return (
    <AgentContext
      page="design-system"
      title="Design system"
      description="Component reference"
      context="A gallery of every component in the design system. Nothing here affects application state."
      suggestions={["Switch to dark mode", "Take me to notification settings"]}
    >
      <Page>
        <Page.Content width="wide">
          <Page.Header
            eyebrow="Reference"
            title="Design system"
            description="Every component in one place. Hierarchy comes from type and space; colour and elevation are used sparingly and deliberately."
          />

          <Colours />
          <Typography />
          <Spacing />
          <ShapeAndElevation />
          <Buttons />
          <Inputs />
          <Toggles />
          <Metadata />
          <Overlays />
          <TabsAndTables />
          <Containers />
          <Navigation />
          <States />
          <AgentSurfaces />
        </Page.Content>
      </Page>
    </AgentContext>
  );
}

/* ------------------------------------------------------------------ colour */

const SWATCHES: { group: string; tokens: string[] }[] = [
  {
    group: "Surfaces",
    tokens: ["--color-page", "--color-chrome", "--color-surface", "--color-surface-sunken"],
  },
  {
    group: "States",
    tokens: ["--color-surface-hover", "--color-surface-active", "--color-overlay"],
  },
  {
    group: "Text",
    tokens: [
      "--color-text",
      "--color-text-secondary",
      "--color-text-tertiary",
      "--color-text-muted",
      "--color-text-disabled",
    ],
  },
  { group: "Borders", tokens: ["--color-border-subtle", "--color-border", "--color-border-strong"] },
  {
    group: "Accent",
    tokens: ["--color-accent", "--color-accent-hover", "--color-accent-soft"],
  },
  {
    group: "Semantic",
    tokens: [
      "--color-success",
      "--color-warning",
      "--color-danger",
      "--color-agent",
      "--color-success-soft",
      "--color-warning-soft",
      "--color-danger-soft",
      "--color-agent-soft",
    ],
  },
];

function Colours() {
  return (
    <SettingsSection
      id="colour"
      title="Colour"
      description="A warm neutral ink at varying alpha, one restrained accent, and muted semantics. Interaction states are translucent scrims so they compose over any surface."
    >
      <Stack gap={24}>
        {SWATCHES.map((row) => (
          <div key={row.group}>
            <p className="specimen__label" style={{ marginBlockEnd: "var(--space-8)" }}>
              {row.group}
            </p>
            <div className="specimen__grid">
              {row.tokens.map((token) => (
                <div className="swatch" key={token}>
                  <div className="swatch__chip" style={{ background: `var(${token})` }} />
                  <span className="swatch__token">{token}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </Stack>
    </SettingsSection>
  );
}

/* -------------------------------------------------------------- typography */

const TYPE_SCALE = [
  { token: "--text-30", label: "Page title", weight: 600 },
  { token: "--text-24", label: "Figure", weight: 600 },
  { token: "--text-20", label: "Heading", weight: 600 },
  { token: "--text-18", label: "Subheading", weight: 600 },
  { token: "--text-16", label: "Dialog title", weight: 600 },
  { token: "--text-15", label: "Reading text", weight: 400 },
  { token: "--text-14", label: "UI default", weight: 400 },
  { token: "--text-13", label: "Secondary", weight: 400 },
  { token: "--text-12", label: "Meta", weight: 400 },
  { token: "--text-11", label: "Micro", weight: 400 },
];

function Typography() {
  return (
    <SettingsSection
      id="typography"
      title="Typography"
      description="Ten sizes, three weights, and four text colours. Hierarchy comes from these rather than from containers — no uppercase tracking, no decorative headings."
    >
      <div>
        {TYPE_SCALE.map((item) => (
          <div className="type-specimen" key={item.token}>
            <span className="type-specimen__meta">{item.token}</span>
            <span style={{ fontSize: `var(${item.token})`, fontWeight: item.weight }}>
              {item.label}
            </span>
          </div>
        ))}
      </div>

      <Stack gap={8} style={{ marginBlockStart: "var(--space-24)" }}>
        <p className="specimen__label">Text colours</p>
        <p style={{ fontSize: "var(--text-14)" }}>Primary — the thing you are reading</p>
        <p style={{ fontSize: "var(--text-14)", color: "var(--color-text-secondary)" }}>
          Secondary — supporting description
        </p>
        <p style={{ fontSize: "var(--text-14)", color: "var(--color-text-tertiary)" }}>
          Tertiary — metadata and table values
        </p>
        <p style={{ fontSize: "var(--text-14)", color: "var(--color-text-muted)" }}>
          Muted — labels and placeholders
        </p>
        <p style={{ fontSize: "var(--text-14)", color: "var(--color-text-disabled)" }}>
          Disabled — unavailable controls
        </p>
      </Stack>
    </SettingsSection>
  );
}

/* ----------------------------------------------------------------- spacing */

const SPACE_SCALE = [2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64];

function Spacing() {
  return (
    <SettingsSection
      id="spacing"
      title="Spacing"
      description="Tokens are named for their pixel value. Every gap, pad and margin in the system comes from this scale."
    >
      <div>
        {SPACE_SCALE.map((value) => (
          <div className="space-specimen" key={value}>
            <span className="space-specimen__meta">--space-{value}</span>
            <span className="space-specimen__bar" style={{ width: value }} />
          </div>
        ))}
      </div>
    </SettingsSection>
  );
}

/* ------------------------------------------------------ shape & elevation */

function ShapeAndElevation() {
  return (
    <SettingsSection
      id="shape"
      title="Shape and elevation"
      description="Small radii, and shadows only for surfaces that genuinely float. There is no card shadow token."
    >
      <Inline gap={16} align="flex-end">
        {["--radius-xs", "--radius-sm", "--radius-md", "--radius-lg", "--radius-xl"].map(
          (token) => (
            <Stack gap={6} key={token} align="center">
              <div
                style={{
                  width: 56,
                  height: 40,
                  background: "var(--color-surface-hover)",
                  borderRadius: `var(${token})`,
                }}
              />
              <span className="swatch__token">{token}</span>
            </Stack>
          ),
        )}
      </Inline>

      <Inline gap={16} align="flex-end" style={{ marginBlockStart: "var(--space-24)" }}>
        {[
          { token: "none", shadow: "none", label: "Page content" },
          { token: "--shadow-popover", shadow: "var(--shadow-popover)", label: "Menus, toasts" },
          { token: "--shadow-dialog", shadow: "var(--shadow-dialog)", label: "Dialogs" },
        ].map((item) => (
          <Stack gap={6} key={item.token} align="center">
            <div
              style={{
                width: 120,
                height: 56,
                background: "var(--color-surface)",
                borderRadius: "var(--radius-lg)",
                boxShadow: item.shadow,
                border: item.shadow === "none" ? "1px solid var(--color-border)" : undefined,
              }}
            />
            <span className="swatch__token">{item.token}</span>
            <span className="specimen__label">{item.label}</span>
          </Stack>
        ))}
      </Inline>
    </SettingsSection>
  );
}

/* ----------------------------------------------------------------- buttons */

function Buttons() {
  return (
    <SettingsSection
      id="buttons"
      title="Buttons"
      description="Compact, restrained, and mostly secondary or tertiary. One primary per view at most."
    >
      <Stack gap={16}>
        <div className="specimen__row">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="tertiary">Tertiary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="agent">Agent</Button>
        </div>

        <div className="specimen__row">
          <Button size="sm" variant="secondary">
            Small
          </Button>
          <Button size="md" variant="secondary">
            Medium
          </Button>
          <Button size="lg" variant="secondary">
            Large
          </Button>
          <Button variant="secondary" startIcon={<IconSearch size={14} />}>
            With icon
          </Button>
          <Button variant="secondary" loading>
            Loading
          </Button>
          <Button variant="secondary" disabled>
            Disabled
          </Button>
        </div>

        <div className="specimen__row">
          <Tooltip content="Settings" shortcut="⌘,">
            <Button variant="ghost" iconOnly aria-label="Settings">
              <IconSettings size={15} />
            </Button>
          </Tooltip>
          <Tooltip content="Notifications">
            <Button variant="ghost" iconOnly aria-label="Notifications">
              <IconBell size={15} />
            </Button>
          </Tooltip>
          <Tooltip content="Delete">
            <Button variant="ghost" iconOnly aria-label="Delete">
              <IconTrash size={15} />
            </Button>
          </Tooltip>
          <span className="specimen__label">
            Icon buttons — compact hit area, hover scrim, tooltip on delay
          </span>
        </div>
      </Stack>
    </SettingsSection>
  );
}

/* ------------------------------------------------------------------ inputs */

function Inputs() {
  const [text, setText] = useState("Ellen Nakamura");
  const [invalid, setInvalid] = useState("not-an-email");
  const [choice, setChoice] = useState("weekly");

  return (
    <SettingsSection
      id="inputs"
      title="Inputs"
      description="Part of the document rather than heavy form widgets: a hairline border, a quiet fill, and an elegant focus state."
    >
      <div className="specimen__grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <Input label="Default" value={text} onValueChange={(next) => setText(next)} />
        <Input label="With hint" value="" hint="We never share this." onValueChange={() => {}} />
        <Input
          label="Invalid"
          value={invalid}
          error="Enter a valid email address."
          onValueChange={(next) => setInvalid(next)}
        />
        <Input label="Disabled" value="Read only" disabled onValueChange={() => {}} />
        <Select
          label="Select"
          value={choice}
          options={[
            { value: "realtime", label: "As it happens" },
            { value: "daily", label: "Daily digest" },
            { value: "weekly", label: "Weekly digest" },
          ]}
          onValueChange={(next) => setChoice(next)}
        />
        <Select
          label="Disabled select"
          value="weekly"
          disabled
          options={[{ value: "weekly", label: "Weekly digest" }]}
          onValueChange={() => {}}
        />
      </div>
    </SettingsSection>
  );
}

/* ----------------------------------------------------------------- toggles */

function Toggles() {
  const [checks, setChecks] = useState({ a: true, b: false });
  const [switches, setSwitches] = useState({ a: true, b: false });

  return (
    <SettingsSection
      id="toggles"
      title="Checkboxes and switches"
      description="Understated and precise. A switch is for a setting that applies immediately; a checkbox is for selection."
    >
      <div className="specimen__grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        <Stack gap={12}>
          <Checkbox
            checked={checks.a}
            label="Checked"
            onCheckedChange={(next) => setChecks((c) => ({ ...c, a: next }))}
          />
          <Checkbox
            checked={checks.b}
            label="Unchecked"
            description="With a supporting description"
            onCheckedChange={(next) => setChecks((c) => ({ ...c, b: next }))}
          />
          <Checkbox checked={false} indeterminate label="Indeterminate" onCheckedChange={() => {}} />
          <Checkbox checked disabled label="Disabled" onCheckedChange={() => {}} />
        </Stack>

        <Stack gap={12}>
          <Switch
            checked={switches.a}
            label="On"
            onCheckedChange={(next) => setSwitches((s) => ({ ...s, a: next }))}
          />
          <Switch
            checked={switches.b}
            label="Off"
            description="With a supporting description"
            onCheckedChange={(next) => setSwitches((s) => ({ ...s, b: next }))}
          />
          <Switch checked disabled label="Disabled" onCheckedChange={() => {}} />
        </Stack>
      </div>

      <div style={{ marginBlockStart: "var(--space-24)" }}>
        <p className="specimen__label" style={{ marginBlockEnd: "var(--space-8)" }}>
          Setting rows — the settings grammar
        </p>
        <SettingRow label="Email notifications" description="Sent to your profile email address.">
          <Switch checked ariaLabel="Email notifications" onCheckedChange={() => {}} />
        </SettingRow>
        <SettingRow label="Frequency" description="How often digests are sent." controlWidth="wide">
          <Select
            value="weekly"
            options={[{ value: "weekly", label: "Weekly digest" }]}
            onValueChange={() => {}}
          />
        </SettingRow>
      </div>
    </SettingsSection>
  );
}

/* ---------------------------------------------------------------- metadata */

function Metadata() {
  return (
    <SettingsSection
      id="metadata"
      title="Badges and metadata"
      description="Muted metadata, not status lights. Use a dot when the tone alone carries meaning."
    >
      <Stack gap={16}>
        <div className="specimen__row">
          <Badge>Neutral</Badge>
          <Badge tone="success" dot>
            active
          </Badge>
          <Badge tone="warning" dot>
            invited
          </Badge>
          <Badge tone="danger" dot>
            suspended
          </Badge>
          <Badge tone="info">info</Badge>
          <Badge tone="agent">Agent</Badge>
        </div>

        <div className="specimen__row">
          <Avatar name="Ellen Nakamura" />
          <Avatar name="Ellen Nakamura" size="md" />
          <Avatar name="OneCheck" initials="1" size="lg" tone="accent" />
          <Kbd>⌘K</Kbd>
          <Kbd>Esc</Kbd>
          <span className="specimen__label">Avatars and keyboard hints</span>
        </div>

        <KeyValue
          items={[
            { key: "Plan", value: "Enterprise" },
            { key: "Seats", value: "240" },
            { key: "Last sign-in", value: "1 day ago" },
          ]}
        />
      </Stack>
    </SettingsSection>
  );
}

/* ---------------------------------------------------------------- overlays */

function Overlays() {
  const [open, setOpen] = useState(false);

  return (
    <SettingsSection
      id="overlays"
      title="Menus and dialogs"
      description="The floating layer: tight rows, small radii, and the only place elevation is used."
    >
      <div className="specimen__row">
        <Menu
          label="Example menu"
          trigger={<Button variant="secondary">Open menu</Button>}
          items={[
            { id: "h", label: "Actions", heading: true },
            {
              id: "rename",
              label: "Rename",
              icon: <IconSettings size={14} />,
              shortcut: "⌘R",
              onSelect: () => {},
            },
            {
              id: "duplicate",
              label: "Duplicate",
              description: "Copy this item and its settings",
              onSelect: () => {},
            },
            { id: "selected", label: "Show metadata", selected: true, onSelect: () => {} },
            { id: "disabled", label: "Move", disabled: true },
            { id: "sep", separator: true },
            {
              id: "delete",
              label: "Delete",
              icon: <IconTrash size={14} />,
              danger: true,
              onSelect: () => {},
            },
          ]}
        />

        <Button variant="secondary" onClick={() => setOpen(true)}>
          Open dialog
        </Button>

        <Tooltip content="A tooltip, after a short delay">
          <Button variant="tertiary">Hover me</Button>
        </Tooltip>
      </div>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Delete this view?"
        description="The view and its filters are removed for everyone in the workspace."
        footer={
          <>
            <Button variant="tertiary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => setOpen(false)}>
              Delete view
            </Button>
          </>
        }
      >
        <p style={{ color: "var(--color-text-secondary)" }}>
          Dialogs are the one surface that uses a strong shadow, because they genuinely sit
          above the page.
        </p>
      </Dialog>
    </SettingsSection>
  );
}

/* ---------------------------------------------------------- tabs and tables */

interface DemoRow {
  id: string;
  name: string;
  owner: string;
  status: "active" | "invited" | "suspended";
  seats: number;
}

const DEMO_ROWS: DemoRow[] = [
  { id: "r1", name: "Northwind Trading", owner: "Priya Raman", status: "active", seats: 240 },
  { id: "r2", name: "Lumen Labs", owner: "Sam Okafor", status: "active", seats: 32 },
  { id: "r3", name: "Harbour & Co", owner: "Tom Beck", status: "suspended", seats: 4 },
  { id: "r4", name: "Orchard Health", owner: "Dan Whitfield", status: "invited", seats: 0 },
];

function TabsAndTables() {
  const [tab, setTab] = useState("all");
  const [selected, setSelected] = useState<string[]>(["r2"]);

  const rows = tab === "all" ? DEMO_ROWS : DEMO_ROWS.filter((row) => row.status === tab);

  return (
    <SettingsSection
      id="tables"
      title="Tabs and tables"
      description="Dense but readable: hairline dividers, muted headers, and a selection column that stays out of the way until you need it."
    >
      <Tabs
        value={tab}
        onValueChange={setTab}
        ariaLabel="Example filter"
        tabs={[
          { value: "all", label: "All" },
          { value: "active", label: "Active" },
          { value: "suspended", label: "Suspended" },
          { value: "archived", label: "Archived", disabled: true },
        ]}
      >
        <DataTable
          rows={rows}
          rowKey={(row) => row.id}
          selectedIds={selected}
          onSelectionChange={(ids) => setSelected(ids)}
          caption="Example accounts"
          emptyMessage={
            <EmptyState align="center" title="Nothing here" description="Try another tab." />
          }
          toolbar={
            <Toolbar>
              <div style={{ width: 200 }}>
                <Input value="" placeholder="Search" aria-label="Search" onValueChange={() => {}} />
              </div>
              <ToolbarSpacer />
              <span style={{ fontSize: "var(--text-13)", color: "var(--color-text-tertiary)" }}>
                {rows.length} rows
              </span>
            </Toolbar>
          }
          columns={[
            {
              id: "name",
              header: "Account",
              cell: (row) => (
                <>
                  <div className="ds-table__primary">{row.name}</div>
                  <div className="ds-table__secondary" style={{ fontSize: "var(--text-12)" }}>
                    {row.owner}
                  </div>
                </>
              ),
            },
            {
              id: "status",
              header: "Status",
              cell: (row) => (
                <Badge
                  dot
                  tone={
                    row.status === "active"
                      ? "success"
                      : row.status === "invited"
                        ? "warning"
                        : "danger"
                  }
                >
                  {row.status}
                </Badge>
              ),
            },
            { id: "seats", header: "Seats", numeric: true, cell: (row) => row.seats },
          ]}
        />
      </Tabs>
    </SettingsSection>
  );
}

/* -------------------------------------------------------------- containers */

function Containers() {
  return (
    <SettingsSection
      id="containers"
      title="Containers"
      description="Most structure is a heading and a hairline. A card is for content that genuinely groups and needs a boundary — which is rarer than it looks."
    >
      <div className="specimen__grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        <Card
          title="A card with a boundary"
          description="Use when content groups and needs an edge."
          actions={
            <Button size="sm" variant="ghost">
              Open
            </Button>
          }
        >
          <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-13)" }}>
            Border and radius only. No shadow — a card is not floating.
          </p>
        </Card>

        <Stack gap={8}>
          <h3 style={{ fontSize: "var(--text-15)" }}>The usual alternative</h3>
          <Divider />
          <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-13)" }}>
            A heading, a hairline and content. This is what most sections should be, and it is
            what keeps a page from reading as a grid of tiles.
          </p>
        </Stack>
      </div>
    </SettingsSection>
  );
}

/* -------------------------------------------------------------- navigation */

function Navigation() {
  const [current, setCurrent] = useState("dashboard");

  return (
    <SettingsSection
      id="navigation"
      title="Navigation"
      description="The sidebar recedes: chrome-coloured, compact rows, muted icons, and a selected state that is a neutral scrim rather than a coloured block."
    >
      <div
        style={{
          display: "flex",
          height: 260,
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
        }}
      >
        <Sidebar
          label="Example workspace"
          header={
            <div className="ds-workspace">
              <Avatar name="OneCheck" initials="1" size="lg" />
              <span className="ds-workspace__text">
                <span className="ds-workspace__name">OneCheck</span>
                <span className="ds-workspace__meta">Ellen Nakamura</span>
              </span>
            </div>
          }
        >
          <Sidebar.Section>
            <Sidebar.Item
              label="Dashboard"
              icon={<IconHome size={14} />}
              current={current === "dashboard"}
              onClick={() => setCurrent("dashboard")}
            />
            <Sidebar.Item
              label="Accounts"
              icon={<IconTable size={14} />}
              trailing={10}
              current={current === "accounts"}
              onClick={() => setCurrent("accounts")}
            />
          </Sidebar.Section>
          <Sidebar.Section label="Workspace">
            <Sidebar.Group
              label="Settings"
              icon={<IconSettings size={14} />}
              defaultOpen
              current={current.startsWith("settings")}
            >
              <Sidebar.Item
                nested
                label="Profile"
                current={current === "settings.profile"}
                onClick={() => setCurrent("settings.profile")}
              />
              <Sidebar.Item
                nested
                label="Notifications"
                current={current === "settings.notifications"}
                onClick={() => setCurrent("settings.notifications")}
              />
            </Sidebar.Group>
          </Sidebar.Section>
        </Sidebar>

        <div style={{ flex: 1, padding: "var(--space-16)", background: "var(--color-page)" }}>
          <p className="specimen__label">Content area</p>
        </div>
      </div>
    </SettingsSection>
  );
}

/* ------------------------------------------------------------------ states */

function States() {
  return (
    <SettingsSection
      id="states"
      title="Empty, loading and error states"
      description="Quiet by construction: a short title, one supporting line, at most one action."
    >
      <div className="specimen__grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        <div className="specimen__frame">
          <EmptyState
            title="No projects yet"
            description="Create your first project to get started."
            action={
              <Button size="sm" variant="secondary">
                Create project
              </Button>
            }
          />
        </div>

        <div className="specimen__frame">
          <Stack gap={12}>
            <p className="specimen__label">Loading</p>
            <Skeleton width="55%" height={14} />
            <Skeleton width="85%" />
            <Skeleton width="70%" />
            <Inline gap={6}>
              <Spinner label="Loading" />
              <span style={{ fontSize: "var(--text-13)", color: "var(--color-text-tertiary)" }}>
                Loading accounts…
              </span>
            </Inline>
          </Stack>
        </div>

        <div className="specimen__frame">
          <EmptyState
            tone="danger"
            icon={<IconAlert size={18} />}
            title="Couldn't load accounts"
            description="The account service returned an error."
            action={
              <Button size="sm" variant="secondary">
                Try again
              </Button>
            }
          />
        </div>
      </div>
    </SettingsSection>
  );
}

/* ------------------------------------------------------------ agent surfaces */

const DEMO_ACTION: ResolvedAgentAction = {
  id: "demo_action",
  type: "toggle",
  target: "notifications.email",
  value: false,
  source: "agent",
  reason: "You asked me to turn email notifications off.",
};

const DEMO_MESSAGES: AgentMessage[] = [
  {
    id: "m1",
    role: "user",
    text: "Turn off email notifications",
    createdAt: 0,
  },
  {
    id: "m2",
    role: "assistant",
    text: "Opening notification settings, then turning email off.",
    createdAt: 0,
  },
  {
    id: "m3",
    role: "action",
    action: { ...DEMO_ACTION, id: "demo_nav", type: "navigate", target: "settings.notifications" },
    status: "succeeded",
    label: "Navigated to settings.notifications",
    createdAt: 0,
  },
  {
    id: "m4",
    role: "tool",
    toolCallId: "t1",
    name: "account_search",
    label: "Searching your accounts",
    status: "succeeded",
    summary: "Found 4 matching accounts",
    createdAt: 0,
  },
  {
    id: "m5",
    role: "action",
    action: DEMO_ACTION,
    status: "succeeded",
    label: "Set Email notifications to off",
    createdAt: 0,
  },
  {
    id: "m6",
    role: "action",
    action: { ...DEMO_ACTION, id: "demo_fail", target: "notifications.sms" },
    status: "failed",
    label: "The application didn't accept the change",
    createdAt: 0,
  },
  {
    id: "m7",
    role: "assistant",
    text: "Done — email notifications are now **off**.",
    createdAt: 0,
  },
];

function AgentSurfaces() {
  const agent = useAgent();

  return (
    <SettingsSection
      id="agent"
      title="Agent surfaces"
      description="The agent panel is workspace furniture, not a separate product. Turns are labelled rather than bubbled, activity is reported as quiet rows, and only a request for a decision gets a container."
    >
      <div className="specimen__grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
        <Stack gap={12}>
          <p className="specimen__label">Transcript</p>
          <div
            className="specimen__frame"
            style={{ background: "var(--color-chrome)", padding: "var(--space-12)" }}
          >
            <Stack gap={16}>
              {DEMO_MESSAGES.map((message) => (
                <AgentMessageView key={message.id} message={message} isLast={false} />
              ))}
            </Stack>
          </div>
        </Stack>

        <Stack gap={12}>
          <p className="specimen__label">Proposed change</p>
          <AgentActionPreview
            action={{
              title: "Agent wants to change",
              subject: "Email notifications",
              description: "You asked me to turn email notifications off.",
              changes: [{ label: "Email notifications", from: "Enabled", to: "Disabled" }],
              confirmLabel: "Confirm",
              action: DEMO_ACTION,
            }}
            onConfirm={() => {}}
            onCancel={() => {}}
          />

          <p className="specimen__label" style={{ marginBlockStart: "var(--space-12)" }}>
            Destructive change
          </p>
          <AgentActionPreview
            action={{
              title: "Agent wants to run a destructive action",
              description: "The user asked to delete 2 selected accounts.",
              destructive: true,
              confirmLabel: "Delete permanently",
              changes: [
                {
                  label: "Delete selected accounts",
                  detail: "Permanently delete every currently selected account.",
                },
              ],
              action: DEMO_ACTION,
            }}
            onConfirm={() => {}}
            onCancel={() => {}}
          />

          <p className="specimen__label" style={{ marginBlockStart: "var(--space-12)" }}>
            Suggestions
          </p>
          <div
            className="specimen__frame"
            style={{ background: "var(--color-chrome)", padding: "var(--space-8)" }}
          >
            <AgentSuggestions
              label="Try asking"
              suggestions={[
                "Turn off email notifications",
                "Show me dormant accounts",
                "Explain these settings",
              ]}
            />
          </div>
        </Stack>
      </div>

      <div style={{ marginBlockStart: "var(--space-24)" }}>
        {/* Extra room: the spotlight tag is positioned above the block. */}
        <p className="specimen__label" style={{ marginBlockEnd: "var(--space-24)" }}>
          Spotlight — how the agent shows you where it went
        </p>
        <Inline gap={16} align="flex-start">
          <AgentSpotlight target="design-system.spotlight" tip="Agent">
            <div className="specimen__frame" style={{ width: 240 }}>
              <SettingRow label="Email notifications">
                <Switch checked ariaLabel="Email notifications" onCheckedChange={() => {}} />
              </SettingRow>
            </div>
          </AgentSpotlight>
          <Button
            variant="secondary"
            // Held longer than the 2.6s default: this is a reference surface,
            // so the cue needs to stay up long enough to look at.
            onClick={() => agent.spotlight("design-system.spotlight", 6000)}
          >
            Reveal this
          </Button>
        </Inline>
      </div>
    </SettingsSection>
  );
}
