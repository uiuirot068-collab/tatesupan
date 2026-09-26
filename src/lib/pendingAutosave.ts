/**
 * Autosave flush contract (Phase 6.1).
 *
 * The editor debounces local (IndexedDB) saves by 1.5 s. Before Phase 6.1 the
 * pending save was only a timer: unmounting the editor or switching documents
 * cleared it, so edits typed just before leaving were lost.
 *
 * The pending save is now a JOB that carries its own document id and the
 * committed state it will write. Whoever takes the job writes exactly that
 * document's data, so a flush can never write document A's text into B (or
 * B's into A), however late it runs. A job is taken once: the debounce timer
 * and a flush (document switch, unmount, pagehide) never both write it.
 * See docs/TATESPUN_EDITOR_STATE_ARCHITECTURE.md §7.
 */
export interface AutosaveJob<TSettings = unknown> {
  docId: number;
  title: string;
  content: string;
  settings: TSettings;
  plotNote: string;
}

export class PendingAutosave<TSettings = unknown> {
  private job: AutosaveJob<TSettings> | null = null;

  /** Replaces the pending job with the latest committed state. */
  schedule(job: AutosaveJob<TSettings>): void {
    this.job = job;
  }

  /** Removes and returns the pending job; null when nothing is unsaved. */
  take(): AutosaveJob<TSettings> | null {
    const job = this.job;
    this.job = null;
    return job;
  }

  /** Drops the pending job (an explicit save already wrote the same state). */
  clear(): void {
    this.job = null;
  }

  get hasPending(): boolean {
    return this.job !== null;
  }
}

/**
 * Writes the pending job now, if there is one. Resolves to the job that was
 * written (null when nothing was pending). `write` receives the job's own
 * document id — never the currently open document's.
 */
export async function flushPendingAutosave<TSettings>(
  pending: PendingAutosave<TSettings>,
  write: (job: AutosaveJob<TSettings>) => Promise<void>
): Promise<AutosaveJob<TSettings> | null> {
  const job = pending.take();
  if (!job) return null;
  await write(job);
  return job;
}
