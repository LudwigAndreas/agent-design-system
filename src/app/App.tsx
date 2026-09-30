import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./app.css";
import { AgentAppShell, useAgentShell } from "../agent/components/AgentAppShell";
import { AgentChat } from "../agent/components/AgentChat";
import { AgentStatusRegion } from "../agent/components/AgentStatusRegion";
import { AgentProvider } from "../agent/react/AgentProvider";
import { useAgent } from "../agent/hooks/useAgent";
import type { AgentPolicyResolver } from "../agent/types/policy";
import { Button } from "../design-system/Button";
import {
  IconBell,
  IconHome,
  IconLock,
  IconPalette,
  IconPanel,
  IconSettings,
  IconSparkle,
  IconTable,
  IconTerminal,
  IconUser,
} from "../design-system/icons";
import { Menu } from "../design-system/Menu";
import { NotificationsProvider, useNotifications } from "../design-system/Notifications";
import { Avatar } from "../design-system/primitives";
import { Sidebar } from "../design-system/Sidebar";
import { Tooltip } from "../design-system/Tooltip";
import { createLocalAgentAdapter } from "./adapters/localAgentAdapter";
import { AccountsPage } from "./pages/AccountsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DesignSystemPage } from "./pages/DesignSystemPage";
import { DeveloperPage } from "./pages/DeveloperPage";
import { SettingsPage } from "./pages/SettingsPage";
import { DEFAULT_ROUTE, ROUTES, isRouteId, topLevel } from "./routes";
import { AppStoreProvider, useAppStore } from "./state/store";

/**
 * The reference application.
 *
 * Note what the application owns and the design system does not: the router,
 * the domain state, the authorization policy, the notification surface, and the
 * agent provider implementation. The design system owns the interaction
 * mechanism that connects them to the agent.
 */
export function App() {
  return (
    <AppStoreProvider>
      <NotificationsProvider>
        <AgentHost />
      </NotificationsProvider>
    </AppStoreProvider>
  );
}

function AgentHost() {
  const [route, setRoute] = useState<string>(DEFAULT_ROUTE);
  const toast = useNotifications();

  // The adapter is the only provider-specific object in the whole tree.
  const adapter = useMemo(() => createLocalAgentAdapter(), []);

  const routeRef = useRef(route);
  routeRef.current = route;

  const navigate = useCallback((target: string) => {
    if (!isRouteId(target)) throw new Error(`Unknown route "${target}".`);
    setRoute(target);
  }, []);

  /**
   * Application authorization and confirmation rules. The design system
   * provides the mechanism; deciding what is consequential is a product
   * decision and lives here.
   */
  const policy = useCallback<AgentPolicyResolver>((context) => {
    const { action, element } = context;
    const target = "target" in action ? action.target : "";

    if (target.startsWith("accounts.delete")) {
      return {
        requiresConfirmation: true,
        destructive: true,
        reason: "Deleting accounts is permanent and cannot be undone.",
        confirmLabel: "Delete permanently",
      };
    }

    if (target.startsWith("accounts.suspend")) {
      return {
        requiresConfirmation: true,
        reason: "Suspending an account signs its users out immediately.",
        confirmLabel: "Suspend",
      };
    }

    if (target.startsWith("security.")) {
      return {
        requiresConfirmation: true,
        sensitive: true,
        reason: "Security settings always need your confirmation.",
      };
    }

    // Filtering and searching only change what is displayed, so they run freely
    // even though the underlying action type is a write.
    if (action.type === "filter" || action.type === "search") {
      return { requiresConfirmation: false };
    }

    // Opening a dialog is not consequential in itself — whatever is inside it is.
    if (action.type === "open-dialog") return { requiresConfirmation: false };

    if (element?.id === "notifications.reset") {
      return {
        requiresConfirmation: true,
        reason: "This replaces all of your notification preferences with the defaults.",
        confirmLabel: "Reset preferences",
      };
    }

    return undefined;
  }, []);

  const environment = useMemo(
    () => ({
      getRoute: () => ({ route: routeRef.current }),
      navigate: (target: string) => navigate(target),
      getNotifications: () => toast.toAgentState(),
    }),
    [navigate, toast],
  );

  return (
    <AgentProvider
      adapter={adapter}
      policy={policy}
      environment={environment}
      // Shortened from the 1500ms default: this app's writes are synchronous,
      // so a refused write should surface quickly rather than appear to hang.
      verifyTimeoutMs={700}
      defaultSuggestions={[
        "Take me to notification settings",
        "Turn off email notifications",
        "Show me accounts that haven't logged in for 30 days",
      ]}
    >
      <AgentStatusRegion />
      <RouteRegistrar />
      <AgentToastBridge />
      <AgentAppShell split="75/25" storageKey="onecheck-agent-panel">
        <AgentAppShell.Main>
          <Workspace route={route} onNavigate={navigate} />
        </AgentAppShell.Main>
        <AgentAppShell.AgentPanel label="Agent">
          <AgentChat />
        </AgentAppShell.AgentPanel>
      </AgentAppShell>
    </AgentProvider>
  );
}

/** Publishes the route table so the agent can only navigate where it should. */
function RouteRegistrar() {
  const agent = useAgent();

  useEffect(() => {
    const unregisters = ROUTES.map((route) => agent.registry.registerRoute(route));
    return () => unregisters.forEach((unregister) => unregister());
  }, [agent.registry]);

  return null;
}

/**
 * Surfaces agent-caused changes as toasts with an Undo, so a change the user did
 * not make is never silent.
 */
function AgentToastBridge() {
  const agent = useAgent();
  const toast = useNotifications();

  useEffect(
    () =>
      agent.events.subscribe((event) => {
        if (event.type === "action-completed" && event.result.success) {
          const { action, result } = event;
          // Navigation and focus are visible on their own; don't narrate them.
          if (["navigate", "focus", "reveal", "scroll-to"].includes(action.type)) return;

          toast.notify({
            tone: "success",
            title: result.message ?? "Change applied",
            description: `Changed by the agent · ${action.target}`,
            source: "agent",
            action: result.undo
              ? { label: "Undo", onClick: () => void agent.undo(action.id) }
              : undefined,
          });
        }

        if (event.type === "action-failed") {
          toast.notify({
            tone: "danger",
            title: "The agent couldn't make that change",
            description: event.error.userMessage ?? event.error.message,
            source: "agent",
          });
        }
      }),
    [agent, toast],
  );

  return null;
}

const SETTINGS_NAV = [
  { route: "settings.profile", label: "Profile", icon: <IconUser size={14} /> },
  { route: "settings.notifications", label: "Notifications", icon: <IconBell size={14} /> },
  { route: "settings.security", label: "Security", icon: <IconLock size={14} /> },
  { route: "settings.appearance", label: "Appearance", icon: <IconPalette size={14} /> },
] as const;

function Workspace({ route, onNavigate }: { route: string; onNavigate: (route: string) => void }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="app-workspace" data-sidebar={sidebarOpen ? "open" : "closed"}>
      {sidebarOpen ? (
        <>
          <WorkspaceSidebar route={route} onNavigate={onNavigate} />
          <div
            className="app-sidebar-scrim"
            role="presentation"
            onClick={() => setSidebarOpen(false)}
          />
        </>
      ) : null}

      <div className="app-main">
        <Topbar
          route={route}
          onNavigate={onNavigate}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((open) => !open)}
        />
        <div className="app-scroll">
          <Routes route={route} onNavigate={onNavigate} />
        </div>
      </div>
    </div>
  );
}

function WorkspaceSidebar({
  route,
  onNavigate,
}: {
  route: string;
  onNavigate: (route: string) => void;
}) {
  const { state, visibleAccounts } = useAppStore();

  return (
    <Sidebar
      header={
        <Menu
          align="start"
          label="Workspace"
          trigger={
            <button type="button" className="ds-workspace">
              <Avatar name="OneCheck" initials="1" size="lg" />
              <span className="ds-workspace__text">
                <span className="ds-workspace__name">OneCheck</span>
                <span className="ds-workspace__meta">{state.settings.profile.name}</span>
              </span>
            </button>
          }
          items={[
            { id: "h", label: "Workspace", heading: true },
            { id: "settings", label: "Settings", onSelect: () => onNavigate("settings.profile") },
            {
              id: "design",
              label: "Design system",
              description: "Component reference",
              onSelect: () => onNavigate("design-system"),
            },
            { id: "sep", separator: true },
            { id: "acct", label: state.settings.profile.email, disabled: true },
          ]}
        />
      }
      footer={
        <Sidebar.Item
          label="Design system"
          icon={<IconPalette size={14} />}
          current={route === "design-system"}
          onClick={() => onNavigate("design-system")}
        />
      }
    >
      <Sidebar.Section>
        <Sidebar.Item
          label="Dashboard"
          icon={<IconHome size={14} />}
          current={route === "dashboard"}
          onClick={() => onNavigate("dashboard")}
        />
        <Sidebar.Item
          label="Accounts"
          icon={<IconTable size={14} />}
          current={route === "accounts"}
          trailing={visibleAccounts.length}
          onClick={() => onNavigate("accounts")}
        />
        <Sidebar.Item
          label="Agent inspector"
          icon={<IconTerminal size={14} />}
          current={route === "developer"}
          onClick={() => onNavigate("developer")}
        />
      </Sidebar.Section>

      <Sidebar.Section label="Workspace">
        <Sidebar.Group
          label="Settings"
          icon={<IconSettings size={14} />}
          defaultOpen={topLevel(route) === "settings"}
          current={topLevel(route) === "settings"}
          onClick={() => onNavigate("settings.profile")}
        >
          {SETTINGS_NAV.map((item) => (
            <Sidebar.Item
              key={item.route}
              nested
              label={item.label}
              icon={item.icon}
              current={route === item.route}
              onClick={() => onNavigate(item.route)}
            />
          ))}
        </Sidebar.Group>
      </Sidebar.Section>
    </Sidebar>
  );
}

const CRUMBS: Record<string, string[]> = {
  dashboard: ["Dashboard"],
  accounts: ["Accounts"],
  developer: ["Agent inspector"],
  "design-system": ["Design system"],
  "settings.profile": ["Settings", "Profile"],
  "settings.notifications": ["Settings", "Notifications"],
  "settings.security": ["Settings", "Security"],
  "settings.appearance": ["Settings", "Appearance"],
};

function Topbar({
  route,
  onNavigate,
  sidebarOpen,
  onToggleSidebar,
}: {
  route: string;
  onNavigate: (route: string) => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}) {
  const shell = useAgentShell();
  const crumbs = CRUMBS[route] ?? ["Workspace"];

  return (
    <header className="app-topbar">
      <Tooltip content={sidebarOpen ? "Hide sidebar" : "Show sidebar"}>
        <Button
          size="sm"
          variant="ghost"
          iconOnly
          aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
          aria-expanded={sidebarOpen}
          onClick={onToggleSidebar}
        >
          <IconPanel size={14} />
        </Button>
      </Tooltip>

      <nav className="app-breadcrumb" aria-label="Breadcrumb">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <span key={crumb} style={{ display: "contents" }}>
              {index > 0 ? (
                <span className="app-breadcrumb__sep" aria-hidden="true">
                  /
                </span>
              ) : null}
              {isLast ? (
                <span className="app-breadcrumb__crumb app-breadcrumb__current" aria-current="page">
                  {crumb}
                </span>
              ) : (
                <button
                  type="button"
                  className="app-breadcrumb__crumb"
                  onClick={() => onNavigate("settings.profile")}
                >
                  {crumb}
                </button>
              )}
            </span>
          );
        })}
      </nav>

      {shell.open ? null : (
        <Button
          size="sm"
          variant="secondary"
          startIcon={<IconSparkle size={13} />}
          onClick={shell.toggle}
        >
          Agent
        </Button>
      )}
    </header>
  );
}

function Routes({ route, onNavigate }: { route: string; onNavigate: (route: string) => void }) {
  switch (topLevel(route)) {
    case "accounts":
      return <AccountsPage />;
    case "settings":
      return <SettingsPage route={route} />;
    case "developer":
      return <DeveloperPage />;
    case "design-system":
      return <DesignSystemPage />;
    default:
      return <DashboardPage onNavigate={onNavigate} />;
  }
}
