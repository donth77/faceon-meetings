/** A guest's name, remembered on this device so the next meeting is prefilled. */
const KEY = "faceon.guestName";

export function loadGuestName(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return ""; // storage blocked
  }
}

export function saveGuestName(name: string): void {
  try {
    localStorage.setItem(KEY, name);
  } catch {
    // storage blocked: they type it again next time
  }
}
