// File downloads for the Data & Backup screen: a full JSON backup and an
// Excel workbook of training stats.
import { toPlainAppData, today } from "../storage.js";
import { getWeekKey } from "../streaks.js";

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

// A complete, re-importable snapshot of the app data. This is what the
// Import/Restore flows read back, so it must carry everything — including
// workout presets, cardio/basketball sessions and nutrition.
export function downloadBackupFile(app) {
  try {
    const payload = toPlainAppData(app);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    downloadBlob(blob, `orion-gym-backup-${today()}.json`);
  } catch {
    // Ignore export failures in-browser.
  }
}

export async function downloadStatsWorkbook(app, streakSummary) {
  try {
    // The spreadsheet writer is only needed for this one export, so it's
    // kept out of the startup bundle and fetched on first use.
    const { default: writeExcelFile } = await import("write-excel-file/browser");
    const sessions = [...(app.sessions || [])].sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
    const recovery = [...(app.recovery || [])].sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
    const bodyStats = [...(app.bodyStats || [])].sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
    const cell = (value) => (value === undefined || value === null || value === "" ? null : value);
    const widths = (...chars) => chars.map((width) => ({ width }));

    const sessionsByWeek = sessions.reduce((acc, session) => {
      const key = getWeekKey(session.date || today());
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const summaryRows = [
      ["Orion Gym - Workout Export"],
      ["Generated", new Date().toLocaleString()],
      [null],
      ["Metric", "Value"],
      ["Total sessions", sessions.length],
      ["Current streak (weeks on target)", cell(streakSummary.currentStreak)],
      ["Sessions this week", cell(streakSummary.currentWeekCount)],
      ["Weekly target", cell(streakSummary.weeklyTarget)],
      ["Recovery logs", recovery.length],
      ["Bodyweight entries", bodyStats.length],
    ];

    const sessionRows = [
      ["Date", "Workout", "Energy", "Duration_Min", "Prehab_Done", "Core_Done", "Notes"],
      ...sessions.map((session) => [
        cell(session.date),
        cell(session.workoutSnapshot?.title || session.workoutSnapshot?.shortTitle || session.workoutId),
        cell(session.energy),
        Number(session.duration) || 0,
        session.prehabDone ? "Yes" : "No",
        session.coreDone ? "Yes" : "No",
        cell(session.notes),
      ]),
    ];

    const trendRows = [
      ["Week", "Sessions", "Bodyweight_lbs", "Sleep_hours", "Water_litres"],
      ...Object.entries(sessionsByWeek).sort(([a], [b]) => a.localeCompare(b)).map(([week, count]) => [week, count, null, null, null]),
    ];
    const maxLen = Math.max(trendRows.length - 1, bodyStats.length, recovery.length);
    for (let i = 1; i <= maxLen; i += 1) {
      if (!trendRows[i]) trendRows[i] = [null, null, null, null, null];
      if (bodyStats[i - 1]) trendRows[i][2] = cell(bodyStats[i - 1].weight);
      if (recovery[i - 1]) {
        trendRows[i][3] = cell(recovery[i - 1].sleep);
        trendRows[i][4] = cell(recovery[i - 1].water);
      }
    }

    await writeExcelFile([
      { sheet: "Summary", data: summaryRows, columns: widths(36, 18) },
      { sheet: "Sessions", data: sessionRows, columns: widths(12, 22, 10, 14, 12, 10, 40) },
      { sheet: "Trend Data", data: trendRows, columns: widths(12, 10, 14, 12, 12) },
    ]).toFile(`orion-gym-workout-stats-${today()}.xlsx`);
  } catch {
    // Ignore export failures in-browser.
  }
}
