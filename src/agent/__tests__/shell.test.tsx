import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { AgentAppShell, useAgentShell } from "../components/AgentAppShell";

function Controls() {
  const shell = useAgentShell();
  return (
    <>
      <button type="button" onClick={shell.toggle}>
        toggle
      </button>
      <button type="button" onClick={shell.toggleFullscreen}>
        fullscreen
      </button>
      <button type="button" onClick={() => shell.setSplit("50/50")}>
        half
      </button>
      <span data-testid="width">{Math.round(shell.widthPercent)}</span>
    </>
  );
}

function Shell({ storageKey = "test-shell" }: { storageKey?: string | null }) {
  return (
    <AgentAppShell storageKey={storageKey} split="75/25">
      <AgentAppShell.Main>
        <Controls />
      </AgentAppShell.Main>
      <AgentAppShell.AgentPanel label="Assistant">
        <p>panel</p>
      </AgentAppShell.AgentPanel>
      <AgentAppShell.Footer>
        <p>footer</p>
      </AgentAppShell.Footer>
    </AgentAppShell>
  );
}

const shellElement = () => document.querySelector(".agent-shell")!;

beforeEach(() => {
  localStorage.clear();
});

describe("agent app shell", () => {
  it("defaults to the configured split and renders all three regions", () => {
    render(<Shell />);

    expect(screen.getByTestId("width").textContent).toBe("25");
    expect(screen.getByRole("complementary", { name: "Assistant" })).toBeInTheDocument();
    expect(screen.getByText("footer")).toBeInTheDocument();
    expect(shellElement()).toHaveAttribute("data-agent-panel-open", "true");
  });

  it("collapses and restores the panel", async () => {
    render(<Shell />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "toggle" }));
    expect(shellElement()).toHaveAttribute("data-agent-panel-open", "false");
    expect(shellElement().className).toContain("agent-shell--collapsed");

    await user.click(screen.getByRole("button", { name: "toggle" }));
    expect(shellElement()).toHaveAttribute("data-agent-panel-open", "true");
  });

  it("supports fullscreen agent mode", async () => {
    render(<Shell />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "fullscreen" }));

    expect(shellElement().className).toContain("agent-shell--fullscreen");
  });

  it("changes the split on request", async () => {
    render(<Shell />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "half" }));

    expect(screen.getByTestId("width").textContent).toBe("50");
  });

  it("persists the panel state across mounts", async () => {
    const first = render(<Shell />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "half" }));
    await user.click(screen.getByRole("button", { name: "toggle" }));
    first.unmount();

    render(<Shell />);

    expect(screen.getByTestId("width").textContent).toBe("50");
    expect(shellElement()).toHaveAttribute("data-agent-panel-open", "false");
  });

  it("does not persist when persistence is disabled", async () => {
    const first = render(<Shell storageKey={null} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "half" }));
    first.unmount();

    render(<Shell storageKey={null} />);

    expect(screen.getByTestId("width").textContent).toBe("25");
  });

  it("exposes a keyboard-operable resize separator", async () => {
    render(<Shell />);
    const user = userEvent.setup();
    const separator = screen.getByRole("separator", { name: "Resize agent panel" });

    separator.focus();
    await user.keyboard("{ArrowLeft}");

    expect(Number(screen.getByTestId("width").textContent)).toBeGreaterThan(25);
  });
});
