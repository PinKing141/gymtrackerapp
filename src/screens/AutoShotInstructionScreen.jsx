import { colors, radii, typeScale } from "../theme.js";

const SECTIONS = [
  {
    title: "What Auto Mode Does",
    body: "Auto Mode uses your phone camera to detect the basketball, track its motion near the hoop, classify make or miss, and log the result into the active workout.",
  },
  {
    title: "Best Setup",
    items: [
      "Put the phone on a stable surface or tripod.",
      "Keep the hoop visible in the frame the whole time.",
      "Use good lighting so the ball looks clearly orange.",
      "Keep only one basketball in frame if possible.",
    ],
  },
  {
    title: "How To Start",
    items: [
      "Open a basketball workout and switch to Auto Mode.",
      "Tap Start Camera.",
      "Allow camera access on your phone.",
      "Tap Calibrate Rim before serious testing.",
    ],
  },
  {
    title: "How To Calibrate The Rim",
    items: [
      "Tap Calibrate Rim.",
      "Press on the middle of the rim.",
      "Drag outward to the rim edge.",
      "Release and save the circle if it matches the hoop.",
      "Recalibrate any time the phone position changes a lot.",
    ],
  },
  {
    title: "Detection Tuning",
    items: [
      "Raise Confidence Threshold if the wrong object gets detected as the ball.",
      "Lower Confidence Threshold slightly if the app rarely finds the ball.",
      "Raise Shot Log Threshold if bad auto logs are slipping through.",
      "Use Auto Rim Re-Lock for small camera drift, but recalibrate after larger moves.",
    ],
  },
  {
    title: "If It Is Missing Shots",
    items: [
      "Improve lighting or change the phone angle.",
      "Recalibrate the rim.",
      "Keep the full shot path in the camera frame.",
      "Use the QA panel and export a report after testing.",
      "Use manual MAKE or MISS as a fallback when needed.",
    ],
  },
];

function HelpSection({ title, body, items }) {
  return (
    <div style={{ padding: 14, borderRadius: radii.lg, background: "rgba(255,255,255,0.05)", border: `1px solid ${colors.border}` }}>
      <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 900, color: colors.textPrimary }}>{title}</h3>
      {body && <p style={{ ...typeScale.bodySm, color: colors.textSecondary, margin: 0 }}>{body}</p>}
      {items && (
        <div style={{ display: "grid", gap: 8 }}>
          {items.map((item) => (
            <p key={item} style={{ ...typeScale.bodySm, color: colors.textSecondary, margin: 0 }}>
              • {item}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export function AutoShotInstructionScreen({ onClose }) {
  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 290,
      background: "#050507",
      display: "flex",
      flexDirection: "column",
    }}>
      <div style={{
        padding: "calc(env(safe-area-inset-top, 0px) + 14px) 16px 12px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "rgba(10,10,15,0.92)",
        borderBottom: `1px solid ${colors.border}`,
        backdropFilter: "blur(12px)",
        flexShrink: 0,
      }}>
        <button
          onClick={onClose}
          style={{ border: 0, background: "none", color: colors.textMuted, fontWeight: 700, fontSize: 14, cursor: "pointer", padding: "6px 0" }}
        >
          Close
        </button>
        <div style={{ textAlign: "center" }}>
          <p style={{ ...typeScale.overline, color: "#FF9F1C", textTransform: "uppercase", margin: 0 }}>Help</p>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: colors.textPrimary }}>Auto Shot Setup Guide</h2>
        </div>
        <div style={{ width: 48 }} />
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px calc(env(safe-area-inset-bottom, 0px) + 20px)", display: "grid", gap: 12 }}>
        <div style={{ padding: 16, borderRadius: radii.xl, background: "linear-gradient(135deg, rgba(255,122,26,0.18), rgba(88,80,236,0.14))", border: `1px solid ${colors.border}` }}>
          <p style={{ ...typeScale.overline, color: "#FF9F1C", textTransform: "uppercase", margin: "0 0 6px" }}>Read This First</p>
          <p style={{ margin: 0, color: colors.textPrimary, fontWeight: 900, fontSize: 18 }}>Manual rim calibration is still required.</p>
          <p style={{ ...typeScale.bodySm, color: colors.textSecondary, margin: "8px 0 0" }}>
            The current system can automatically detect the ball and track shots, but it still starts from a saved hoop calibration.
          </p>
        </div>

        {SECTIONS.map((section) => (
          <HelpSection key={section.title} {...section} />
        ))}
      </div>
    </div>
  );
}