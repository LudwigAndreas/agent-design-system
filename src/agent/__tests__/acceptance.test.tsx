import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "../../app/App";

/**
 * The acceptance scenario, end to end through the real application.
 *
 * > "All accounts created before 11.09.2025 that are mine, in my unit,
 * >  approved by priya@northwind.example — export them."
 *
 * Every hard part of that sentence is exercised: a locale-ambiguous date, two
 * context references the agent must not resolve itself, a directory lookup,
 * a conjunction, and an export that must be handed to the user rather than
 * performed.
 */

const ACCEPTANCE =
  "All accounts created before 11.09.2025 that are mine, in my unit, " +
  "approved by priya@northwind.example — export them";

async function ask(prompt: string) {
  const user = userEvent.setup();
  await user.click(screen.getByLabelText("Message the agent"));
  await user.paste(prompt);
  await user.click(screen.getByRole("button", { name: "Send" }));
  return user;
}

/** The count the accounts toolbar reports. */
const visibleCount = () =>
  Number(/(\d+) of \d+/.exec(document.body.textContent ?? "")?.[1] ?? NaN);

describe("acceptance: compound query then staged export", () => {
  it("builds the query, resolves every reference, and stages the export", async () => {
    render(<App />);
    const user = await ask(ACCEPTANCE);

    // --- the query is applied, and the agent reports the real count --------
    const staged = await screen.findByRole("group", { name: "Export matching accounts" }, {
      timeout: 5000,
    });

    // Three accounts satisfy all four conditions in the seeded data.
    await waitFor(() => expect(visibleCount()).toBe(3));

    // --- the resolved values are visible, not the raw ones -----------------
    // The date was written 11.09.2025 and must never be shown that way again.
    expect(within(staged).getByText(/11 September 2025/)).toBeInTheDocument();
    expect(staged.textContent).not.toMatch(/11\.09\.2025/);
    // The email resolved to a person, and the user can see who.
    expect(within(staged).getByText(/Priya Raman/)).toBeInTheDocument();
    // The context references resolved to names, never to ids.
    expect(within(staged).getByText(/Ellen Nakamura/)).toBeInTheDocument();
    expect(within(staged).getByText(/Northern region/)).toBeInTheDocument();
    expect(staged.textContent).not.toMatch(/usr_|unit-north/);

    // --- nothing has happened yet ------------------------------------------
    expect(within(staged).getByText(/nothing has happened yet/i)).toBeInTheDocument();
    expect(within(staged).getByText(/3 records match/)).toBeInTheDocument();
    expect(within(staged).queryByText(/^Download/)).not.toBeInTheDocument();

    // --- the user triggers it, and only then does it run -------------------
    await user.click(
      within(staged).getByRole("button", { name: "Export matching accounts" }),
    );

    await waitFor(() => expect(within(staged).getByText(/Exported 3 accounts/)).toBeInTheDocument());
    expect(within(staged).getByRole("link", { name: /Download/ })).toBeInTheDocument();
  }, 20_000);

  it("shows each condition as a chip the user can remove", async () => {
    render(<App />);
    const user = await ask(ACCEPTANCE);
    await screen.findByRole("group", { name: "Export matching accounts" }, { timeout: 5000 });

    const chips = await screen.findByRole("list", { name: "Active query" });
    const items = within(chips).getAllByRole("listitem");
    expect(items).toHaveLength(4);
    // A condition the agent built reads the same as one the user composed.
    expect(chips.textContent).toContain("Created is before 11 September 2025");
    expect(chips.textContent).toContain("Approver is Priya Raman");

    await user.click(
      within(chips).getByRole("button", { name: /Remove condition: Approver is Priya Raman/ }),
    );

    // Removing a condition re-queries: more accounts now match.
    await waitFor(() => expect(visibleCount()).toBeGreaterThan(3));
    expect(
      within(await screen.findByRole("list", { name: "Active query" })).getAllByRole("listitem"),
    ).toHaveLength(3);
  }, 20_000);

  it("marks the staged export stale once the query changes", async () => {
    render(<App />);
    const user = await ask(ACCEPTANCE);
    const staged = await screen.findByRole("group", { name: "Export matching accounts" }, {
      timeout: 5000,
    });

    const chips = await screen.findByRole("list", { name: "Active query" });
    await user.click(
      within(chips).getByRole("button", { name: /Remove condition: Approver is Priya Raman/ }),
    );

    // The first trigger stops at the staleness check and runs nothing.
    await user.click(
      within(staged).getByRole("button", { name: "Export matching accounts" }),
    );

    await waitFor(() =>
      expect(within(staged).getByText(/the query has changed/i)).toBeInTheDocument(),
    );
    expect(within(staged).queryByText(/Exported/)).not.toBeInTheDocument();

    // Proceeding runs against the current query, not the recorded one.
    await user.click(
      within(staged).getByRole("button", { name: "Run with current query" }),
    );
    await waitFor(() => expect(within(staged).getByText(/Exported \d+ accounts/)).toBeInTheDocument());
    expect(within(staged).getByText(/Exported/).textContent).not.toContain("3 accounts");
  }, 20_000);

  it("abandons the whole query when the approver cannot be resolved", async () => {
    render(<App />);
    await ask(
      "All accounts created before 11.09.2025 that are mine, approved by ghost@nowhere.example",
    );

    await waitFor(
      () => expect(screen.getAllByText(/No user was found with email/).length).toBeGreaterThan(0),
      { timeout: 5000 },
    );

    // Nothing was applied: the table is untouched and no chips exist.
    expect(visibleCount()).toBe(10);
    expect(screen.queryByRole("list", { name: "Active query" })).not.toBeInTheDocument();
  }, 20_000);

  it("reports an ambiguous approver rather than picking one", async () => {
    render(<App />);
    await ask("Show me accounts approved by ops@onecheck.example");

    await waitFor(
      () => expect(screen.getAllByText(/matches 2 user records/).length).toBeGreaterThan(0),
      { timeout: 5000 },
    );
    expect(visibleCount()).toBe(10);
  }, 20_000);
});
