import { beforeEach, describe, expect, it } from "vitest";
import { deletePreset, getPreset, listPresets, savePreset } from "@/lib/presets";

beforeEach(() => {
  window.localStorage.clear();
});

describe("presets", () => {
  it("saves presets under normalized slug names and lists them alphabetically", () => {
    savePreset(" My First Preset ", "version: 1\n");
    savePreset("Beta", "nodes: []\n");

    expect(getPreset("my-first-preset")).toBe("version: 1\n");
    expect(listPresets()).toEqual([
      { name: "beta", yaml: "nodes: []\n" },
      { name: "my-first-preset", yaml: "version: 1\n" },
    ]);
  });

  it("removes invalid characters, truncates long names, and rejects empty slugs", () => {
    savePreset("Feature/Plan 4!!! Export Presets With A Very Long Name", "yaml");

    expect(listPresets()).toEqual([
      { name: "featureplan-4-export-presets-with-a-very", yaml: "yaml" },
    ]);
    expect(() => savePreset(" !!! ", "yaml")).toThrow("Preset name is required");
  });

  it("deletes presets by normalized name", () => {
    savePreset("Demo Preset", "yaml");

    deletePreset("Demo Preset");

    expect(getPreset("demo-preset")).toBeNull();
    expect(listPresets()).toEqual([]);
  });
});
