import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Each test gets the module fresh: it remembers its answers for the visit.
const load = () => import("./capabilities");

class FakeElement {
  constructor(readonly tagName = "DIV") {}
  isContentEditable = false;
}

/** A browser with just what a test needs; `media` lists the media queries that match. */
function browser({
  userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0",
  chromium = true,
  media = [] as string[],
  touchPoints = 0,
  window: extra = {} as Record<string, unknown>,
  navigator: navigatorExtra = {} as Record<string, unknown>,
  document: documentExtra = {} as Record<string, unknown>,
} = {}) {
  const handlers = new Map<string, (event: unknown) => void>();
  const changes: Array<() => void> = [];
  vi.stubGlobal("HTMLElement", FakeElement);
  vi.stubGlobal("window", {
    isSecureContext: true,
    matchMedia: (query: string) => ({
      matches: media.includes(query),
      addEventListener: (_: string, listener: () => void) =>
        changes.push(listener),
    }),
    addEventListener: (type: string, listener: (event: unknown) => void) =>
      handlers.set(type, listener),
    removeEventListener: (type: string) => handlers.delete(type),
    ...extra,
  });
  vi.stubGlobal("navigator", {
    userAgent,
    maxTouchPoints: touchPoints,
    userAgentData: chromium ? { brands: [{ brand: "Chromium" }] } : undefined,
    ...navigatorExtra,
  });
  vi.stubGlobal("document", {
    createElement: () => ({}),
    ...documentExtra,
  });
  return {
    press: (target: FakeElement) => handlers.get("keydown")?.({ target }),
    pointerChanged: () => changes.forEach((listener) => listener()),
  };
}

describe("capabilities", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("are all missing on the server", async () => {
    const { CAPABILITIES, supports } = await load();
    for (const capability of CAPABILITIES) {
      expect(supports(capability)).toBe(false);
    }
  });

  it("know picture-in-picture by Document Picture-in-Picture, and opening it by itself in Chrome", async () => {
    const pip = { documentPictureInPicture: { requestWindow: () => {} } };
    browser({ window: pip, navigator: { mediaSession: {} } });
    let found = await load();
    expect(found.supports("pictureInPicture")).toBe(true);
    expect(found.supports("autoPictureInPicture")).toBe(true);

    vi.resetModules();
    // Firefox: the window, but not Chrome's media session action.
    browser({ window: pip, chromium: false, navigator: { mediaSession: {} } });
    found = await load();
    expect(found.supports("pictureInPicture")).toBe(true);
    expect(found.supports("autoPictureInPicture")).toBe(false);

    vi.resetModules();
    browser();
    found = await load();
    expect(found.supports("pictureInPicture")).toBe(false);
    expect(found.supports("autoPictureInPicture")).toBe(false);
  });

  it("join calls only with WebRTC", async () => {
    browser();
    vi.stubGlobal("RTCPeerConnection", function RTCPeerConnection() {});
    expect((await load()).supports("calls")).toBe(true);
    vi.resetModules();
    browser();
    vi.stubGlobal("RTCPeerConnection", undefined);
    expect((await load()).supports("calls")).toBe(false);
  });

  it("use a camera and microphone only where getUserMedia exists (not on an insecure page)", async () => {
    browser({ navigator: { mediaDevices: { getUserMedia: () => {} } } });
    expect((await load()).supports("media")).toBe(true);
    vi.resetModules();
    browser();
    expect((await load()).supports("media")).toBe(false);
  });

  it("offer the share menu only in Chromium, and sharing only where getDisplayMedia exists", async () => {
    const mediaDevices = { getDisplayMedia: () => {} };
    browser({ navigator: { mediaDevices } });
    let found = await load();
    expect(found.supports("screenShare")).toBe(true);
    expect(found.supports("shareOptions")).toBe(true);

    vi.resetModules();
    browser({ chromium: false, navigator: { mediaDevices } });
    found = await load();
    expect(found.supports("screenShare")).toBe(true);
    expect(found.supports("shareOptions")).toBe(false);

    vi.resetModules();
    browser({ navigator: { mediaDevices: {} } });
    found = await load();
    expect(found.supports("screenShare")).toBe(false);
    expect(found.supports("shareOptions")).toBe(false);
  });

  it("choose a speaker only with setSinkId", async () => {
    browser();
    vi.stubGlobal(
      "HTMLMediaElement",
      class {
        setSinkId() {}
      },
    );
    expect((await load()).supports("chooseSpeaker")).toBe(true);
    vi.resetModules();
    browser();
    vi.stubGlobal("HTMLMediaElement", class {});
    expect((await load()).supports("chooseSpeaker")).toBe(false);
  });

  it("go full screen only where the browser says it can (not on iPhone)", async () => {
    browser({ document: { fullscreenEnabled: true } });
    expect((await load()).supports("fullscreen")).toBe(true);
    vi.resetModules();
    browser({ document: {} });
    expect((await load()).supports("fullscreen")).toBe(false);
  });

  it("run backgrounds with WebGL2 and a way to make video, and motion backgrounds with H.264", async () => {
    const canvas = (webgl2: boolean) => ({
      captureStream: () => {},
      getContext: () => (webgl2 ? { getExtension: () => null } : null),
    });
    browser({
      document: {
        createElement: (tag: string) =>
          tag === "canvas" ? canvas(true) : { canPlayType: () => "maybe" },
      },
    });
    let found = await load();
    expect(found.supports("effects")).toBe(true);
    expect(found.supports("motionBackgrounds")).toBe(true);

    vi.resetModules();
    browser({
      document: {
        createElement: (tag: string) =>
          tag === "canvas" ? canvas(false) : { canPlayType: () => "" },
      },
    });
    found = await load();
    expect(found.supports("effects")).toBe(false);
    expect(found.supports("motionBackgrounds")).toBe(false);
  });

  it("run strong noise suppression with an AudioWorklet on a secure page", async () => {
    browser();
    vi.stubGlobal("AudioWorkletNode", function AudioWorkletNode() {});
    expect((await load()).supports("strongNoise")).toBe(true);
    vi.resetModules();
    browser({ window: { isSecureContext: false } });
    vi.stubGlobal("AudioWorkletNode", function AudioWorkletNode() {});
    expect((await load()).supports("strongNoise")).toBe(false);
  });

  describe("notifications", () => {
    const iPhone =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile Safari/604.1";

    it("are there with the Notification API", async () => {
      browser();
      vi.stubGlobal("Notification", function Notification() {});
      const found = await load();
      expect(found.supports("notifications")).toBe(true);
      expect(found.supports("notificationsOnceInstalled")).toBe(false);
    });

    it("come once the app is on the Home Screen, on an iPhone or iPad", async () => {
      browser({ userAgent: iPhone, chromium: false });
      expect((await load()).supports("notificationsOnceInstalled")).toBe(true);

      vi.resetModules();
      // An iPad asking for desktop sites says it's a Mac, with a touch screen.
      browser({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/18.0 Safari/605.1.15",
        chromium: false,
        touchPoints: 5,
      });
      expect((await load()).supports("notificationsOnceInstalled")).toBe(true);
    });

    it("aren't promised where installing wouldn't bring them, or it's installed already", async () => {
      browser({ chromium: false });
      expect((await load()).supports("notificationsOnceInstalled")).toBe(false);

      vi.resetModules();
      browser({
        userAgent: iPhone,
        chromium: false,
        media: ["(display-mode: standalone)"],
      });
      expect((await load()).supports("notificationsOnceInstalled")).toBe(false);
    });
  });

  describe("a keyboard", () => {
    it("comes with a mouse or a trackpad", async () => {
      browser({ media: ["(any-pointer: fine)"] });
      expect((await load()).supports("keyboard")).toBe(true);
    });

    it("isn't assumed on a touchscreen until a key is pressed outside a text field", async () => {
      const device = browser({ media: [] });
      const { subscribeCapability, supports } = await load();
      const changed = vi.fn();
      subscribeCapability("keyboard", changed);
      expect(supports("keyboard")).toBe(false);

      // An on-screen keyboard types into text fields only.
      device.press(new FakeElement("INPUT"));
      expect(supports("keyboard")).toBe(false);
      expect(changed).not.toHaveBeenCalled();

      device.press(new FakeElement("DIV"));
      expect(supports("keyboard")).toBe(true);
      expect(changed).toHaveBeenCalledTimes(1);
    });

    it("tells listeners when a mouse turns up, and only listeners of the keyboard", async () => {
      const device = browser();
      const { subscribeCapability } = await load();
      const keyboard = vi.fn();
      const effects = vi.fn();
      subscribeCapability("keyboard", keyboard);
      const stop = subscribeCapability("effects", effects);
      device.pointerChanged();
      expect(keyboard).toHaveBeenCalled();
      expect(effects).not.toHaveBeenCalled();
      expect(stop).toBeTypeOf("function");
    });
  });
});
