import { AgentContext } from "../../agent/components/AgentContext";
import { AgentSpotlight } from "../../agent/components/AgentSpotlight";
import { Button } from "../../design-system/Button";
import { EmptyState } from "../../design-system/EmptyState";
import { IconChevronRight } from "../../design-system/icons";
import { Page } from "../../design-system/Page";
import { Badge, KeyValue, Stack } from "../../design-system/primitives";
import { SettingsSection } from "../../design-system/Section";
import { daysSince, filterAccounts, useAppStore } from "../state/store";

export interface DashboardPageProps {
  onNavigate: (route: string) => void;
}

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const { state } = useAppStore();
  const { accounts, settings, audit } = state;

  const dormant = filterAccounts(accounts, { status: "all", inactiveDays: 30, search: "" });
  const suspended = accounts.filter((account) => account.status === "suspended");
  const seats = accounts.reduce((total, account) => total + account.seats, 0);
  const firstName = settings.profile.name.split(" ")[0];

  return (
    <AgentContext
      page="dashboard"
      title="Dashboard"
      description="Workspace overview"
      context={
        `Overview of ${accounts.length} accounts covering ${seats} seats. ` +
        `${dormant.length} accounts have not signed in for 30 days and ${suspended.length} ` +
        "are suspended. The activity list records who changed what — the user, the agent, " +
        "or the system."
      }
      actions={[
        {
          id: "dashboard.review-dormant",
          label: "Review dormant accounts",
          description:
            "Open the accounts table filtered to accounts with no sign-in for 30 days.",
          run: () => onNavigate("accounts"),
        },
      ]}
      suggestions={[
        "Show me accounts that haven't logged in for 30 days",
        "Take me to notification settings",
        "What can you do on this page?",
      ]}
    >
      <Page>
        <Page.Content width="wide">
          <Page.Header
            eyebrow="Overview"
            title={`Good afternoon, ${firstName}`}
            description="Everything here can be changed by you, or by the agent on request."
          />

          <div className="app-stats">
            <Stat label="Accounts" value={accounts.length} hint={`${seats} seats`} />
            <Stat label="Dormant 30 days" value={dormant.length} hint="no recent sign-in" />
            <Stat label="Suspended" value={suspended.length} hint="need review" />
            <Stat
              label="Digest"
              value={settings.notifications.frequency}
              hint={settings.notifications.email ? "email on" : "email off"}
            />
          </div>

          {/* Sections are spaced by the Stack: the `.ds-section + .ds-section`
              rule cannot see through the spotlight wrapper below. */}
          <Stack gap={40} style={{ marginBlockStart: "var(--space-40)" }}>
            <SettingsSection
              id="attention"
              title="Needs attention"
              description="Accounts with no sign-in in the last 30 days."
              actions={
                <Button
                  size="sm"
                  variant="tertiary"
                  onClick={() => onNavigate("accounts")}
                >
                  All accounts
                </Button>
              }
            >
              {dormant.length === 0 ? (
                <EmptyState
                  title="Nothing needs attention"
                  description="Every account has signed in within the last 30 days."
                />
              ) : (
                <div className="app-list">
                  {dormant.slice(0, 5).map((account) => (
                    <div className="app-list__row" key={account.id}>
                      <div className="app-list__text">
                        <div className="app-list__title">{account.name}</div>
                        <div className="app-list__meta">
                          {account.owner} ·{" "}
                          {daysSince(account.lastLoginAt) === null
                            ? "never signed in"
                            : `${daysSince(account.lastLoginAt)} days ago`}
                        </div>
                      </div>
                      <div className="app-list__trailing">
                        {account.status === "active" ? null : (
                          <Badge
                            dot
                            tone={account.status === "suspended" ? "danger" : "warning"}
                          >
                            {account.status}
                          </Badge>
                        )}
                        <IconChevronRight
                          size={14}
                          style={{ color: "var(--color-text-muted)" }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SettingsSection>

            {/*
              A spotlight wrapper: when the agent reveals
              `dashboard.notifications-summary` this block is scrolled to and
              outlined, so the user can see where it went.
            */}
            <AgentSpotlight target="dashboard.notifications-summary" tip="Agent">
              <SettingsSection
                id="notifications-summary"
                title="Your notifications"
                description="The settings the agent can change for you."
                actions={
                  <Button
                    size="sm"
                    variant="tertiary"
                    onClick={() => onNavigate("settings.notifications")}
                  >
                    Change
                  </Button>
                }
              >
                <KeyValue
                  items={[
                    { key: "Email", value: settings.notifications.email ? "On" : "Off" },
                    { key: "Push", value: settings.notifications.push ? "On" : "Off" },
                    {
                      key: "SMS",
                      value: settings.notifications.sms
                        ? "On"
                        : "Off — provider unavailable",
                    },
                    { key: "Frequency", value: settings.notifications.frequency },
                    {
                      key: "Quiet hours",
                      value: settings.notifications.quietHours ? "On" : "Off",
                    },
                  ]}
                />
              </SettingsSection>
            </AgentSpotlight>

            <SettingsSection
              id="activity"
              title="Recent activity"
              description="Who changed what, most recent first."
            >
              {audit.length === 0 ? (
                <EmptyState
                  title="Nothing has changed yet"
                  description="Changes you or the agent make will be listed here."
                />
              ) : (
                <Stack gap={0}>
                  {audit.slice(0, 8).map((entry) => (
                    <div className="app-list__row" key={entry.id}>
                      <div className="app-list__text">
                        <div className="app-list__title">{entry.description}</div>
                      </div>
                      <div className="app-list__trailing">
                        {entry.source === "agent" ? (
                          <Badge tone="agent">Agent</Badge>
                        ) : (
                          <span>{entry.source === "user" ? "You" : "System"}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </Stack>
              )}
            </SettingsSection>
          </Stack>
        </Page.Content>
      </Page>
    </AgentContext>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="app-stat">
      <span className="app-stat__label">{label}</span>
      <span className="app-stat__value">{value}</span>
      {hint ? <span className="app-stat__hint">{hint}</span> : null}
    </div>
  );
}
