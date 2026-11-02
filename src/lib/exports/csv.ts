/**
 * CSV that spreadsheets open as meant: a byte-order mark so Excel reads it as UTF-8,
 * CRLF line ends, and cells quoted where they need it. Text a spreadsheet would run as a
 * formula (starting with =, +, -, @, a tab or a carriage return) gets a leading
 * apostrophe, so a name someone typed can never become a formula. Numbers stay numbers.
 */
export type CsvValue = string | number | null | undefined;

const FORMULA_START = /^[=+\-@\t\r]/;
const NEEDS_QUOTES = /[",\r\n]|^\s|\s$/;

export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }
  const text = FORMULA_START.test(value) ? `'${value}` : value;
  return NEEDS_QUOTES.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(rows: CsvValue[][]): string {
  return `﻿${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}
