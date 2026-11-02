/**
 * "The meetings on this account changed here": one was scheduled, edited, deleted or given
 * a new passcode. Meeting reminders look at the calendar again when it's announced, in
 * this tab and the others open on this browser, instead of at their next ten-minute look,
 * so a meeting scheduled a few minutes ahead still gets its reminder.
 */
const EVENT = "faceon:meetings-changed";
const CHANNEL = "faceon.meetings";
/** This tab, so it hears its own changes once (the window event), not twice. */
const TAB = Math.random().toString(36).slice(2);

export function announceMeetingsChanged(): void {
  window.dispatchEvent(new Event(EVENT));
  try {
    const channel = new BroadcastChannel(CHANNEL);
    channel.postMessage({ from: TAB });
    channel.close();
  } catch {
    // No BroadcastChannel: other tabs catch up at their next look.
  }
}

/** Calls `onChange` whenever meetings change here or in another tab. Returns the unsubscribe. */
export function subscribeMeetingsChanged(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (event: MessageEvent<{ from?: string }>) => {
      if (event.data?.from !== TAB) onChange();
    };
  } catch {
    channel = null;
  }
  return () => {
    window.removeEventListener(EVENT, onChange);
    channel?.close();
  };
}
