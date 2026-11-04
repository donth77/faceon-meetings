import { describe, expect, it } from "vitest";

import { NotesRun } from "./run";

describe("one run of AI notes at a time", () => {
  it("stops the run before it when another starts", () => {
    const run = new NotesRun();
    const first = run.begin();
    const second = run.begin();
    expect(first.aborted).toBe(true);
    expect(second.aborted).toBe(false);
  });

  it("starts again after Strict Mode's rehearsal stops it", () => {
    // Mount: the notes start. The rehearsed unmount stops them; the remount resumes them.
    const run = new NotesRun();
    const first = run.begin();
    run.interrupt();
    expect(first.aborted).toBe(true);
    expect(run.resumes()).toBe(true);
    const second = run.begin();
    expect(second.aborted).toBe(false);
    // Only once.
    expect(run.resumes()).toBe(false);
  });

  it("doesn't start again once a run has finished", () => {
    const run = new NotesRun();
    const signal = run.begin();
    run.end(signal);
    run.interrupt();
    expect(signal.aborted).toBe(false);
    expect(run.resumes()).toBe(false);
  });

  it("doesn't start again after Cancel", () => {
    const run = new NotesRun();
    const signal = run.begin();
    run.stop();
    run.interrupt();
    expect(signal.aborted).toBe(true);
    expect(run.resumes()).toBe(false);
  });

  it("ignores an earlier run ending after a later one began", () => {
    const run = new NotesRun();
    const first = run.begin();
    const second = run.begin();
    run.end(first);
    run.interrupt();
    expect(second.aborted).toBe(true);
    expect(run.resumes()).toBe(true);
  });

  it("has nothing to start again when nothing was running", () => {
    const run = new NotesRun();
    run.interrupt();
    expect(run.resumes()).toBe(false);
  });
});
