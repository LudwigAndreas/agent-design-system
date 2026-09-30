import { useEffect } from "react";
import { AgentContext } from "../../agent/components/AgentContext";
import { Button } from "../../design-system/Button";
import { Input } from "../../design-system/Input";
import { Page } from "../../design-system/Page";
import { SettingRow } from "../../design-system/SettingRow";
import { SettingsSection } from "../../design-system/Section";
import { Select } from "../../design-system/Select";
import { Switch } from "../../design-system/Switch";
import { useNotifications } from "../../design-system/Notifications";
import { useAppStore, useSetting } from "../state/store";
import { settingsTab } from "../routes";
import type { ThemePreference } from "../state/types";

export interface SettingsPageProps {
  route: string;
}

/**
 * Settings as a structured document.
 *
 * Each section is a heading and a hairline; each setting is a row with its
 * label as prose on the left and its control on the right. No card per group,
 * no box per control — the rhythm does the work.
 */
export function SettingsPage({ route }: SettingsPageProps) {
  const tab = settingsTab(route);

  return (
    <Page>
      <Page.Content width="medium">
        {tab === "profile" ? <ProfileSettings /> : null}
        {tab === "notifications" ? <NotificationSettings /> : null}
        {tab === "security" ? <SecuritySettings /> : null}
        {tab === "appearance" ? <AppearanceSettings /> : null}
      </Page.Content>
    </Page>
  );
}

const LANGUAGES = [
  { value: "en-GB", label: "English (UK)" },
  { value: "en-US", label: "English (US)" },
  { value: "de-DE", label: "German" },
  { value: "fr-FR", label: "French" },
  { value: "ja-JP", label: "Japanese" },
];

const TIMEZONES = [
  { value: "Europe/Berlin", label: "Berlin" },
  { value: "Europe/London", label: "London" },
  { value: "America/New_York", label: "New York" },
  { value: "Asia/Tokyo", label: "Tokyo" },
];

function ProfileSettings() {
  const [name, setName] = useSetting<string>("profile", "name");
  const [email, setEmail] = useSetting<string>("profile", "email");
  const [language, setLanguage] = useSetting<string>("profile", "language");
  const [timezone, setTimezone] = useSetting<string>("profile", "timezone");

  return (
    <AgentContext
      page="settings.profile"
      title="Profile settings"
      description="Personal details and localisation"
      context={
        "The signed-in user's own profile. The email address is the account's login " +
        "identity, so changing it is treated as sensitive and needs confirmation."
      }
      suggestions={[
        "Change my language to German",
        "Set my timezone to Tokyo",
        "What can you change here?",
      ]}
    >
      <Page.Header
        eyebrow="Settings"
        title="Profile"
        description="How you appear across the workspace, and where your times are shown from."
      />

      <SettingsSection id="profile" title="Identity">
        <SettingRow label="Display name" description="Shown on comments and activity entries.">
          <div style={{ width: 220 }}>
            <Input
              agentId="profile.name"
              agent={{ description: "The user's display name, shown on comments and activity." }}
              aria-label="Display name"
              value={name}
              onValueChange={(next, meta) => setName(next, meta.source)}
              validate={(next) =>
                next.trim().length < 2 ? "Enter at least two characters." : undefined
              }
            />
          </div>
        </SettingRow>

        <SettingRow
          label="Email address"
          description="Used for sign-in and account recovery, so changes are confirmed with you."
        >
          <div style={{ width: 220 }}>
            <Input
              agentId="profile.email"
              agent={{
                description: "Primary email address and login identity.",
                sensitive: true,
                requiresConfirmation: true,
              }}
              aria-label="Email address"
              type="email"
              value={email}
              onValueChange={(next, meta) => setEmail(next, meta.source)}
              validate={(next) => (next.includes("@") ? undefined : "Enter a valid email address.")}
            />
          </div>
        </SettingRow>
      </SettingsSection>

      <SettingsSection id="localisation" title="Region">
        <SettingRow label="Language" description="The language the interface is shown in.">
          <div style={{ width: 220 }}>
            <Select
              agentId="profile.language"
              agent={{ description: "Interface language." }}
              aria-label="Language"
              value={language}
              options={LANGUAGES}
              onValueChange={(next, meta) => setLanguage(next, meta.source)}
            />
          </div>
        </SettingRow>

        <SettingRow label="Timezone" description="Used for timestamps and digest delivery.">
          <div style={{ width: 220 }}>
            <Select
              agentId="profile.timezone"
              agent={{ description: "Timezone used for timestamps and digest delivery." }}
              aria-label="Timezone"
              value={timezone}
              options={TIMEZONES}
              onValueChange={(next, meta) => setTimezone(next, meta.source)}
            />
          </div>
        </SettingRow>
      </SettingsSection>
    </AgentContext>
  );
}

const FREQUENCIES = [
  { value: "realtime", label: "As it happens", description: "Every event, immediately" },
  { value: "daily", label: "Daily digest", description: "One summary each morning" },
  { value: "weekly", label: "Weekly digest", description: "One summary each Monday" },
  { value: "monthly", label: "Monthly digest", description: "One summary each month" },
];

function NotificationSettings() {
  const { dispatch } = useAppStore();
  const toast = useNotifications();

  const [email, setEmail] = useSetting<boolean>("notifications", "email");
  const [push, setPush] = useSetting<boolean>("notifications", "push");
  const [sms, setSms] = useSetting<boolean>("notifications", "sms");
  const [quietHours, setQuietHours] = useSetting<boolean>("notifications", "quietHours");
  const [frequency, setFrequency] = useSetting<string>("notifications", "frequency");

  return (
    <AgentContext
      page="settings.notifications"
      title="Notification settings"
      description="Notification preferences"
      context={
        "Controls which channels send notifications and how often digests go out. " +
        "The SMS channel depends on an external provider that is currently unavailable, " +
        "so writes to it will be refused by the application."
      }
      actions={[
        {
          id: "notifications.reset",
          label: "Reset notification preferences",
          description: "Return every notification setting to its default value.",
          requiresConfirmation: true,
          run: () => {
            dispatch({ type: "reset-notifications", source: "agent" });
            toast.notify({
              tone: "info",
              title: "Notification preferences reset",
              source: "agent",
            });
          },
        },
      ]}
      suggestions={[
        "Turn off email notifications",
        "Change the notification frequency to weekly",
        "Reset notification preferences",
      ]}
    >
      <Page.Header
        eyebrow="Settings"
        title="Notifications"
        description="Choose how and how often we contact you."
        actions={
          <Button
            size="sm"
            variant="secondary"
            onClick={() => dispatch({ type: "reset-notifications", source: "user" })}
          >
            Reset to defaults
          </Button>
        }
      />

      <SettingsSection id="notifications" title="Channels">
        <SettingRow
          label="Email notifications"
          description="Sent to your profile email address."
        >
          <Switch
            agentId="notifications.email"
            agent={{ description: "Controls whether email notifications are enabled." }}
            ariaLabel="Email notifications"
            checked={email}
            onCheckedChange={(next, meta) => setEmail(next, meta.source)}
          />
        </SettingRow>

        <SettingRow
          label="Push notifications"
          description="Delivered to signed-in browsers and devices."
        >
          <Switch
            agentId="notifications.push"
            agent={{ description: "Controls browser and mobile push notifications." }}
            ariaLabel="Push notifications"
            checked={push}
            onCheckedChange={(next, meta) => setPush(next, meta.source)}
          />
        </SettingRow>

        <SettingRow
          label="SMS notifications"
          description="Currently unavailable — the SMS provider is offline, so this setting cannot be changed."
        >
          <Switch
            agentId="notifications.sms"
            agent={{
              description:
                "SMS notifications. The SMS provider is currently unavailable, so the " +
                "application refuses changes to this setting.",
            }}
            ariaLabel="SMS notifications"
            checked={sms}
            onCheckedChange={(next, meta) => setSms(next, meta.source)}
          />
        </SettingRow>
      </SettingsSection>

      <SettingsSection id="delivery" title="Delivery">
        <SettingRow
          label="Frequency"
          description="How often digest notifications are sent."
          controlWidth="wide"
        >
          <Select
            agentId="notifications.frequency"
            agent={{ description: "How often digest notifications are sent." }}
            aria-label="Frequency"
            value={frequency}
            options={FREQUENCIES}
            onValueChange={(next, meta) => setFrequency(next, meta.source)}
          />
        </SettingRow>

        <SettingRow
          label="Quiet hours"
          description="Hold notifications between 22:00 and 07:00, in your local timezone."
        >
          <Switch
            agentId="notifications.quiet-hours"
            agent={{ description: "Suppresses notifications between 22:00 and 07:00." }}
            ariaLabel="Quiet hours"
            checked={quietHours}
            onCheckedChange={(next, meta) => setQuietHours(next, meta.source)}
          />
        </SettingRow>
      </SettingsSection>
    </AgentContext>
  );
}

function SecuritySettings() {
  const [twoFactor, setTwoFactor] = useSetting<boolean>("security", "twoFactor");
  const [timeout_, setTimeout_] = useSetting<string>("security", "sessionTimeout");

  return (
    <AgentContext
      page="settings.security"
      title="Security settings"
      description="Authentication and sessions"
      context={
        "Security-relevant settings. Every change here requires explicit user " +
        "confirmation, regardless of who requested it."
      }
      suggestions={["Turn on two-factor authentication", "Shorten my session timeout"]}
    >
      <Page.Header
        eyebrow="Settings"
        title="Security"
        description="Protect access to this workspace. Changes here are always confirmed with you."
      />

      <SettingsSection id="security" title="Authentication">
        <SettingRow
          label="Two-factor authentication"
          description="Require a verification code in addition to a password."
        >
          <Switch
            agentId="security.two-factor"
            agent={{ description: "Requires a second factor at sign-in." }}
            ariaLabel="Two-factor authentication"
            checked={twoFactor}
            sensitive
            requiresConfirmation
            onCheckedChange={(next, meta) => setTwoFactor(next, meta.source)}
          />
        </SettingRow>

        <SettingRow
          label="Session timeout"
          description="How long a session stays signed in while idle."
          controlWidth="wide"
        >
          <Select
            agentId="security.session-timeout"
            agent={{
              description: "How long a session stays signed in while idle.",
              sensitive: true,
            }}
            aria-label="Session timeout"
            value={timeout_}
            options={[
              { value: "1h", label: "1 hour" },
              { value: "8h", label: "8 hours" },
              { value: "24h", label: "24 hours" },
              { value: "30d", label: "30 days" },
            ]}
            onValueChange={(next, meta) => setTimeout_(next, meta.source)}
          />
        </SettingRow>
      </SettingsSection>
    </AgentContext>
  );
}

function AppearanceSettings() {
  const [theme, setTheme] = useSetting<ThemePreference>("appearance", "theme");
  const [density, setDensity] = useSetting<string>("appearance", "density");

  // Theme and density are both token-level switches: the whole system responds
  // to a data attribute on the root, so no component needs to know.
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    if (density === "comfortable") root.removeAttribute("data-density");
    else root.setAttribute("data-density", density);
  }, [density]);

  return (
    <AgentContext
      page="settings.appearance"
      title="Appearance settings"
      description="Theme and density"
      context="Presentation-only settings. Changing them is low-risk and applies immediately."
      suggestions={["Switch to dark mode", "Use the compact layout"]}
    >
      <Page.Header
        eyebrow="Settings"
        title="Appearance"
        description="How the interface looks. These changes apply immediately."
      />

      <SettingsSection id="appearance" title="Display">
        <SettingRow
          label="Theme"
          description="Follow the system, or pick one."
          controlWidth="wide"
        >
          <Select
            agentId="appearance.theme"
            agent={{ description: "Colour theme: follow the system, or force light or dark." }}
            aria-label="Theme"
            value={theme}
            options={[
              { value: "system", label: "Match system" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
            onValueChange={(next, meta) => setTheme(next as ThemePreference, meta.source)}
          />
        </SettingRow>

        <SettingRow
          label="Density"
          description="Row height and spacing throughout the application."
          controlWidth="wide"
        >
          <Select
            agentId="appearance.density"
            agent={{ description: "Row height and spacing throughout the application." }}
            aria-label="Density"
            value={density}
            options={[
              { value: "comfortable", label: "Comfortable" },
              { value: "compact", label: "Compact" },
            ]}
            onValueChange={(next, meta) => setDensity(next, meta.source)}
          />
        </SettingRow>
      </SettingsSection>
    </AgentContext>
  );
}
