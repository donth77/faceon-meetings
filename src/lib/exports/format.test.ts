import { describe, expect, it } from "vitest";

import {
  attachment,
  fileName,
  fileNameFrom,
  spreadsheetDay,
  spreadsheetTime,
} from "./format";

describe("export formats", () => {
  it("writes local times spreadsheets read", () => {
    const at = new Date(Date.UTC(2026, 10, 2, 23, 30));
    expect(spreadsheetTime(at, "UTC")).toBe("2026-11-02 23:30");
    expect(spreadsheetTime(at, "Asia/Tokyo")).toBe("2026-11-03 08:30");
    expect(spreadsheetDay(at.toISOString(), "Asia/Tokyo")).toBe("2026-11-03");
  });

  it("names files every system accepts", () => {
    expect(fileName('Q3: plan/review "final"?')).toBe(
      "Q3- plan-review -final-",
    );
    expect(fileName("   ")).toBe("FaceOn");
    expect(fileName("a".repeat(150))).toHaveLength(100);
  });

  it("gives an ASCII name and the real one, and reads them back", () => {
    const header = attachment("Réunion d’équipe 2026-11-02 attendance.csv");
    expect(header).toContain(
      'filename="R_union d__quipe 2026-11-02 attendance.csv"',
    );
    expect(fileNameFrom(header)).toBe(
      "Réunion d’équipe 2026-11-02 attendance.csv",
    );
    expect(fileNameFrom('attachment; filename="plain.csv"')).toBe("plain.csv");
    expect(fileNameFrom(null)).toBeNull();
  });
});
