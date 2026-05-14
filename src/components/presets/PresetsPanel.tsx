import { useCallback, useState } from "react";
import { deletePreset, listPresets } from "@/lib/presets";

interface PresetsPanelProps {
  onLoad: (yaml: string) => void;
  onSaveCurrent: (name: string) => void;
}

export function PresetsPanel({ onLoad, onSaveCurrent }: PresetsPanelProps) {
  const [presets, setPresets] = useState(() => listPresets());

  const refresh = useCallback(() => setPresets(listPresets()), []);

  const handleSaveCurrent = () => {
    const name = window.prompt("Preset name");
    if (!name) return;
    onSaveCurrent(name);
    refresh();
  };

  const handleDelete = (name: string) => {
    deletePreset(name);
    refresh();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <button type="button" onClick={handleSaveCurrent} style={buttonStyle}>
        Save current as…
      </button>
      {presets.length === 0 ? (
        <div style={{ color: "var(--text-dim)", fontSize: 12 }}>No saved presets</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {presets.map((preset) => (
            <div key={preset.name} style={{ display: "flex", gap: 4 }}>
              <button
                type="button"
                onClick={() => onLoad(preset.yaml)}
                style={{ ...buttonStyle, flex: "1 1 auto", textAlign: "left" }}
              >
                {preset.name}
              </button>
              <button
                type="button"
                aria-label={`Delete ${preset.name}`}
                onClick={() => handleDelete(preset.name)}
                style={{ ...buttonStyle, flex: "0 0 auto" }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  padding: "6px 8px",
  fontSize: 12,
  backgroundColor: "var(--bg-secondary)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: 4,
};
