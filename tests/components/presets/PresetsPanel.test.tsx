import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PresetsPanel } from "@/components/presets/PresetsPanel";
import { savePreset } from "@/lib/presets";

beforeEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("PresetsPanel", () => {
  it("loads and deletes saved presets", () => {
    savePreset("Demo", "version: 1\n");
    const onLoad = vi.fn();
    const onSaveCurrent = vi.fn();

    render(<PresetsPanel onLoad={onLoad} onSaveCurrent={onSaveCurrent} />);

    fireEvent.click(screen.getByRole("button", { name: "demo" }));
    expect(onLoad).toHaveBeenCalledWith("version: 1\n");

    fireEvent.click(screen.getByRole("button", { name: "Delete demo" }));
    expect(screen.queryByRole("button", { name: "demo" })).not.toBeInTheDocument();
  });

  it("prompts for a preset name when saving current diagram", () => {
    vi.spyOn(window, "prompt").mockReturnValue("New Preset");
    const onSaveCurrent = vi.fn();

    render(<PresetsPanel onLoad={vi.fn()} onSaveCurrent={onSaveCurrent} />);

    fireEvent.click(screen.getByRole("button", { name: "Save current as…" }));

    expect(onSaveCurrent).toHaveBeenCalledWith("New Preset");
  });
});
