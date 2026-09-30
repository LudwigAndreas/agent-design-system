import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Markdown } from "../components/Markdown";

describe("assistant markdown", () => {
  it("renders emphasis, code and lists", () => {
    const { container } = render(
      <Markdown text={"Email is **on**.\n\n- push `off`\n- sms off"} />,
    );

    expect(container.querySelector("strong")?.textContent).toBe("on");
    expect(container.querySelector("code")?.textContent).toBe("off");
    expect(container.querySelectorAll("li")).toHaveLength(2);
  });

  it("renders fenced code, including a fence that is still streaming", () => {
    const { container } = render(
      <Markdown text={'```ts\ntoggle("notifications.email", false)'} />,
    );

    const code = container.querySelector("pre code");
    expect(code?.textContent).toContain('toggle("notifications.email", false)');
  });

  it("never turns model output into markup", () => {
    const { container } = render(
      <Markdown text={'<img src=x onerror="alert(1)"> <script>alert(2)</script>'} />,
    );

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    // The angle brackets survive as text, which is the honest rendering.
    expect(container.textContent).toContain("<img src=x");
  });

  it("allows only http and mailto links", () => {
    const { container } = render(
      <Markdown text={"[safe](https://example.com) and [unsafe](javascript:alert(1))"} />,
    );

    expect(screen.getByRole("link", { name: "safe" })).toHaveAttribute(
      "href",
      "https://example.com",
    );
    // The label survives as text; the dangerous href is dropped entirely.
    expect(container.querySelectorAll("a")).toHaveLength(1);
    expect(container.textContent).toContain("unsafe");
  });
});
