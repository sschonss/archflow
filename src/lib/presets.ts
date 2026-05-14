const STORAGE_KEY = "archflow.presets";

export interface Preset {
  name: string;
  yaml: string;
}

export function listPresets(): Preset[] {
  const presets = readPresets();
  return Object.entries(presets)
    .map(([name, yaml]) => ({ name, yaml }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function savePreset(name: string, yaml: string): void {
  const slug = normalizeName(name);
  const presets = readPresets();
  presets[slug] = yaml;
  writePresets(presets);
}

export function deletePreset(name: string): void {
  const slug = normalizeName(name);
  const presets = readPresets();
  delete presets[slug];
  writePresets(presets);
}

export function getPreset(name: string): string | null {
  const slug = normalizeName(name);
  return readPresets()[slug] ?? null;
}

function normalizeName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

  if (!slug) throw new Error("Preset name is required");
  return slug;
}

function readPresets(): Record<string, string> {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    const presets: Record<string, string> = {};
    for (const [name, yaml] of Object.entries(parsed)) {
      if (typeof yaml === "string") presets[name] = yaml;
    }
    return presets;
  } catch {
    return {};
  }
}

function writePresets(presets: Record<string, string>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}
