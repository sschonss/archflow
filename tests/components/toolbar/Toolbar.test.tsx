import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Toolbar } from "@/components/toolbar/Toolbar";

describe("Toolbar", () => {
  it.each([
    ["canvas", "split"],
    ["split", "editor"],
    ["editor", "canvas"],
  ] as const)("cycles editor view mode from %s to %s", (viewMode, nextMode) => {
    const onViewModeChange = vi.fn();
    render(<Toolbar viewMode={viewMode} onViewModeChange={onViewModeChange} />);

    fireEvent.click(screen.getByRole("button", { name: new RegExp(`Editor: ${viewMode}`, "i") }));

    expect(onViewModeChange).toHaveBeenCalledWith(nextMode);
  });
});
