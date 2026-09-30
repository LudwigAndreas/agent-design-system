import { AgentContext } from "../../agent/components/AgentContext";
import { AgentDemoPanel } from "../../agent/components/AgentDemoPanel";
import { Button } from "../../design-system/Button";
import { Page } from "../../design-system/Page";
import { Badge } from "../../design-system/primitives";
import { SettingsSection } from "../../design-system/Section";
import { SettingRow } from "../../design-system/SettingRow";
import { useAgent } from "../../agent/hooks/useAgent";
import { useAppStore } from "../state/store";

/**
 * Developer-facing page. It demonstrates driving the agent layer directly,
 * without the chat: the same actions, through the same runtime.
 */
export function DeveloperPage() {
  const agent = useAgent();
  const { state, dispatch } = useAppStore();

  const examples = [
    {
      label: 'navigate("settings.notifications")',
      run: () => agent.navigate("settings.notifications"),
    },
    { label: 'focus("notifications.email")', run: () => agent.focus("notifications.email") },
    {
      label: 'set-value("profile.name", "Jo Fields")',
      run: () =>
        agent.executeAction({ type: "set-value", target: "profile.name", value: "Jo Fields" }),
    },
    {
      label: 'toggle("notifications.email", false)',
      run: () =>
        agent.executeAction({ type: "toggle", target: "notifications.email", value: false }),
    },
    {
      label: 'select-option("notifications.frequency", "weekly")',
      run: () =>
        agent.executeAction({
          type: "select-option",
          target: "notifications.frequency",
          value: "weekly",
        }),
    },
    {
      label: 'open-dialog("dialog.delete-accounts")',
      run: () => agent.executeAction({ type: "open-dialog", target: "dialog.delete-accounts" }),
    },
    {
      label: 'toggle("notifications.sms", true) — refused by the app',
      run: () => agent.executeAction({ type: "toggle", target: "notifications.sms", value: true }),
    },
    {
      label: 'set-value("profile.name", "") — rejected by validation',
      run: () => agent.executeAction({ type: "set-value", target: "profile.name", value: "" }),
    },
    {
      label: 'toggle("does.not.exist") — unknown target',
      run: () => agent.executeAction({ type: "toggle", target: "does.not.exist" }),
    },
  ];

  return (
    <AgentContext
      page="developer"
      title="Agent inspector"
      description="Developer tooling for the agent interaction layer"
      context="A developer view. Running an action here goes through the same runtime the chat uses."
    >
      <Page>
        <Page.Content width="wide">
          <Page.Header
            eyebrow="Workspace"
            title="Agent inspector"
            description="Run semantic actions against the live UI and watch the lifecycle, confirmation and verification behave exactly as they do for the agent."
          />

          <SettingsSection
            id="examples"
            title="Run an action"
            description="Actions that target another screen navigate there first."
          >
            {examples.map((example) => (
              <div className="app-example" key={example.label}>
                <code className="app-example__code">{example.label}</code>
                <Button size="sm" variant="secondary" onClick={() => void example.run()}>
                  Run
                </Button>
              </div>
            ))}
          </SettingsSection>

          <SettingsSection
            id="backend"
            title="Simulated backend"
            description="Toggle the SMS provider to compare a refused write with a successful one."
          >
            <SettingRow
              label="SMS provider"
              description="While offline, the application refuses writes to the SMS notification setting."
            >
              <Badge dot tone={state.smsServiceAvailable ? "success" : "danger"}>
                {state.smsServiceAvailable ? "available" : "offline"}
              </Badge>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  dispatch({ type: "set-sms-service", available: !state.smsServiceAvailable })
                }
              >
                {state.smsServiceAvailable ? "Take offline" : "Bring online"}
              </Button>
            </SettingRow>
          </SettingsSection>

          <AgentDemoPanel />
        </Page.Content>
      </Page>
    </AgentContext>
  );
}
