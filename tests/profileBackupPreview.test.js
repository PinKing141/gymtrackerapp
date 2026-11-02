import { describe, expect, it } from "vitest";
import { describeBackupSnapshot, formatBackupCounts, summarizeBackupData } from "../src/profileBackupPreview.js";

describe("restore preview labels", () => {
  it("says when and why the backup was taken", () => {
    const takenAt = new Date(2026, 10, 2, 14, 5).getTime();
    expect(describeBackupSnapshot({ takenAt, reason: "import" })).toBe("Backup from Mon 2 Nov, 14:05 · saved before your last import");
    expect(describeBackupSnapshot({ takenAt, reason: "daily" })).toBe("Backup from Mon 2 Nov, 14:05 · daily snapshot");
    expect(describeBackupSnapshot({ takenAt, reason: "unknown" })).toBe("Backup from Mon 2 Nov, 14:05");
  });

  it("falls back to a plain heading for backups without a record", () => {
    expect(describeBackupSnapshot(null)).toBe("Backup found");
  });

  it("formats the counts shown for the backup and the current data", () => {
    const summary = summarizeBackupData({ sessions: [{}, {}], recovery: [{}], bodyStats: [], personalBests: { Row: {} } });
    expect(formatBackupCounts(summary)).toBe("2 workouts · 1 recovery logs · 0 weigh-ins · 1 PBs");
  });
});
