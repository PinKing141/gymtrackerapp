import { useState } from "react";
import { HistoryScreen } from "./HistoryScreen.jsx";
import { PersonalBestsScreen } from "./PersonalBestsScreen.jsx";
import { ProgressScreen } from "./ProgressScreen.jsx";
import { colors } from "../theme.js";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "records", label: "Records" },
  { key: "history", label: "History" },
];

export function ProgressHubScreen({ app, historyDetailIndex, setHistoryDetailIndex, setApp }) {
  const [tab, setTab] = useState("overview");

  return (
    <div>
      <div style={{ padding: "calc(env(safe-area-inset-top, 0px) + 16px) 20px 0" }}>
        <div style={{ display: "flex", gap: 6, padding: 4, borderRadius: 12, background: "rgba(255,255,255,0.04)", border: `1px solid ${colors.border}` }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              style={{
                flex: 1,
                minWidth: 0,
                padding: "9px 4px",
                borderRadius: 9,
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 12,
                fontWeight: 700,
                background: tab === t.key ? "rgba(78,161,255,0.18)" : "transparent",
                color: tab === t.key ? colors.accent : colors.textMuted,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "overview" && <ProgressScreen app={app} />}
      {tab === "records" && <PersonalBestsScreen app={app} />}
      {tab === "history" && (
        <HistoryScreen app={app} detailIndex={historyDetailIndex} setDetailIndex={setHistoryDetailIndex} setApp={setApp} />
      )}
    </div>
  );
}
