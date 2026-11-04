import { describe, expect, it } from "vitest";

import {
  BACKGROUND_SIZE,
  neededSize,
  videoRequest,
  type VideoView,
} from "./video-views";

const view = (overrides: Partial<VideoView> = {}): VideoView => ({
  onScreen: true,
  pageShown: true,
  width: 640,
  height: 360,
  pixelRatio: 1,
  ...overrides,
});

describe("the size a view needs", () => {
  it("is its size in device pixels on a sharp screen", () => {
    expect(neededSize(view({ pixelRatio: 2 }))).toEqual({
      width: 1280,
      height: 720,
    });
    expect(neededSize(view({ width: 621.5, pixelRatio: 1.25 }))).toEqual({
      width: 777,
      height: 450,
    });
  });

  it("counts no more than two device pixels per CSS pixel", () => {
    expect(neededSize(view({ pixelRatio: 3 }))).toEqual({
      width: 1280,
      height: 720,
    });
  });

  it("is never less than its CSS size, even zoomed out", () => {
    expect(neededSize(view({ pixelRatio: 0.5 }))).toEqual({
      width: 640,
      height: 360,
    });
  });

  it("is the smallest while its page is in the background", () => {
    expect(neededSize(view({ pageShown: false, pixelRatio: 2 }))).toEqual(
      BACKGROUND_SIZE,
    );
  });
});

describe("what to ask the media server for", () => {
  it("asks for nothing when no view needs the video", () => {
    expect(videoRequest([], null)).toBeNull();
    expect(
      videoRequest([view({ onScreen: false }), view({ width: 0 })], null),
    ).toBeNull();
  });

  it("hands over the largest view, and asks for the most any view needs", () => {
    const stage = view({ width: 1200, height: 675 });
    const pip = view({ width: 344, height: 194, pixelRatio: 2 });
    expect(videoRequest([pip, stage], null)).toEqual({
      view: stage,
      size: { width: 1200, height: 675 },
    });
  });

  it("keeps the view it has while that one still needs the video", () => {
    const stage = view({ width: 400, height: 225 });
    const pip = view({ width: 800, height: 450 });
    expect(videoRequest([stage, pip], stage)?.view).toBe(stage);
  });

  it("moves to another view when its own scrolls out of sight", () => {
    const strip = view({ onScreen: false });
    const pip = view({ width: 344, height: 194 });
    expect(videoRequest([strip, pip], strip)).toEqual({
      view: pip,
      size: { width: 344, height: 194 },
    });
  });

  it("asks for the smallest while every view's page is in the background", () => {
    const stage = view({ width: 1200, height: 675, pageShown: false });
    expect(videoRequest([stage], stage)).toEqual({
      view: stage,
      size: BACKGROUND_SIZE,
    });
  });

  it("asks for the picture-in-picture window's size while the stage's page is hidden", () => {
    const stage = view({ width: 1200, height: 675, pageShown: false });
    const pip = view({ width: 344, height: 194, pixelRatio: 2 });
    expect(videoRequest([stage, pip], stage)).toEqual({
      view: stage,
      size: { width: 688, height: 388 },
    });
  });

  it("prefers a view whose page is showing when none is handed over yet", () => {
    const stage = view({ width: 1200, height: 675, pageShown: false });
    const pip = view({ width: 344, height: 194 });
    expect(videoRequest([stage, pip], null)?.view).toBe(pip);
  });
});
