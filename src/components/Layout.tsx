import { ReactNode } from "react";

export function Layout({
  left,
  center,
  right,
  bottom,
}: {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
  bottom: ReactNode;
}) {
  return (
    <div style={{ display: "grid", gridTemplateRows: "1fr auto", height: "100vh" }}>
      <div style={{ display: "grid", gridTemplateColumns: "170px 1fr 240px" }}>
        <aside style={paneStyle("right")}>{left}</aside>
        <main style={{ overflow: "hidden" }}>{center}</main>
        <aside style={paneStyle("left")}>{right}</aside>
      </div>
      {bottom}
    </div>
  );
}

function paneStyle(borderSide: "left" | "right"): React.CSSProperties {
  return {
    background: "var(--bg-elev)",
    [`border${borderSide === "right" ? "Right" : "Left"}`]: "1px solid var(--border)",
    padding: 12,
    overflowY: "auto",
    fontSize: 12,
  } as React.CSSProperties;
}
