/**
 * One run of AI notes at a time, in a component that can be taken down and put back
 * without losing its state: React's Strict Mode rehearses that in development, and a page
 * Next.js keeps hidden, to come back to, does it for real. Leaving stops a run so no
 * call is wasted; a run stopped that way starts again when the component is back, rather
 * than leaving "Making notes…" with nothing behind it.
 */
export class NotesRun {
  private current: AbortController | null = null;
  private interrupted = false;

  /** Starts a run, stopping any before it. Its signal says when to give up. */
  begin(): AbortSignal {
    this.current?.abort();
    this.current = new AbortController();
    this.interrupted = false;
    return this.current.signal;
  }

  /** The run with this signal finished, or failed: nothing to stop or start again. */
  end(signal: AbortSignal): void {
    if (this.current?.signal === signal) this.current = null;
  }

  /** Cancelled, or what was made was deleted: stops the run for good. */
  stop(): void {
    this.current?.abort();
    this.current = null;
    this.interrupted = false;
  }

  /** The component is going: stops a run under way, to start again if it comes back. */
  interrupt(): void {
    if (!this.current) return;
    this.current.abort();
    this.current = null;
    this.interrupted = true;
  }

  /** The component is back: whether a run it stopped on the way out starts again. */
  resumes(): boolean {
    const resume = this.interrupted;
    this.interrupted = false;
    return resume;
  }
}
