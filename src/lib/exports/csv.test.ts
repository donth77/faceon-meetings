import { describe, expect, it } from "vitest";

import { csvCell, toCsv } from "./csv";

describe("CSV for spreadsheets", () => {
  it("starts with a byte-order mark and ends rows with CRLF", () => {
    const csv = toCsv([
      ["Name", "Minutes"],
      ["Ana", 30],
    ]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toBe("﻿Name,Minutes\r\nAna,30\r\n");
  });

  it("quotes cells with commas, quotes, line breaks or edge spaces", () => {
    expect(csvCell("Lee, Jordan")).toBe('"Lee, Jordan"');
    expect(csvCell('Ana "AJ" Silva')).toBe('"Ana ""AJ"" Silva"');
    expect(csvCell("two\nlines")).toBe('"two\nlines"');
    expect(csvCell(" padded")).toBe('" padded"');
    expect(csvCell("plain")).toBe("plain");
  });

  it("keeps text that looks like a formula as text", () => {
    for (const formula of [
      "=SUM(A1:A9)",
      "+1",
      "-2+3",
      "@cmd",
      "\t=1",
      "\r=1",
    ]) {
      expect(csvCell(formula).replace(/^"/, "").startsWith("'")).toBe(true);
    }
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
  });

  it("writes numbers as numbers, and nothing for missing values", () => {
    expect(csvCell(-5)).toBe("-5");
    expect(csvCell(Number.NaN)).toBe("");
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });
});
