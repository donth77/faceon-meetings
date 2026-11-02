import { globalShortcut } from "electron";

/**
 * The mute shortcut, which works while another app is in front. It's registered only
 * during a meeting, so it never takes those keys from other apps the rest of the time.
 */
export class MuteShortcut {
  private active: string | null = null;

  constructor(private readonly onPress: () => void) {}

  /** The accelerator now in use: null when off, outside a meeting, or taken elsewhere. */
  sync(want: {
    enabled: boolean;
    accelerator: string;
    inMeeting: boolean;
  }): string | null {
    const next = want.enabled && want.inMeeting ? want.accelerator : null;
    if (next === this.active) return this.active;
    if (this.active) globalShortcut.unregister(this.active);
    this.active = null;
    if (next) {
      try {
        if (globalShortcut.register(next, this.onPress)) this.active = next;
      } catch {
        // Not a shortcut this system accepts.
      }
    }
    return this.active;
  }
}
