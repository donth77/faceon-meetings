import { toast } from "sonner";

/**
 * Copies text and says how it went in a toast: `copied` (with an optional
 * `description`), or `failed` when the browser refuses.
 */
export async function copyText(
  text: string,
  messages: { copied: string; failed: string; description?: string },
): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(
      messages.copied,
      messages.description ? { description: messages.description } : undefined,
    );
  } catch {
    toast.error(messages.failed);
  }
}
