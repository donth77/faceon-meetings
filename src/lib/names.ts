/** The first word of a display name ("Maya Chen" → "Maya"); the whole name if it has one word. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}
