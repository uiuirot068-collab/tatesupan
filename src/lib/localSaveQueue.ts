/**
 * TSP-SAFE-001: the ONE writer of open documents to this browser (IndexedDB).
 *
 * Before this, the editor wrote every autosave with an unconditional `put`:
 *  - a failed write was dropped (nothing retried it until the next keystroke),
 *  - two tabs on the same work silently overwrote each other (last write won),
 *  - a work deleted in one tab came back with the other tab's next autosave.
 *
 * Every write now goes through this queue:
 *  - Writes are serialized, and only the LATEST unsaved state of each work is
 *    kept. A failed write stays here and is retried with a back-off; if more
 *    is typed meanwhile, the newer state replaces it, so an older text can
 *    never be written after a newer one.
 *  - Each write carries the revision this screen last read or wrote. If the
 *    stored work moved on (another tab saved it), nothing is overwritten:
 *    this screen's text is kept as a separate rescue copy, and later writes
 *    of this screen go to that copy. Both versions survive.
 *  - If the stored work is gone (deleted in another tab), nothing is written,
 *    so a deleted work never comes back by itself.
 *
 * Storage access is injected (`LocalSaveStore`), so this file has no Dexie
 * import and the rules above are tested directly (localSaveQueue.test.ts).
 */
import type { AutosaveJob } from "./pendingAutosave";

export type LocalWriteResult =
  | {
      kind: "saved";
      revision: number;
      /**
       * Set when the work was renamed on the bookshelf since this screen read
       * it: the write kept that title, and the screen should show it too.
       */
      renamedTitle?: string;
    }
  /** The stored work was saved by someone else after this screen read it. */
  | { kind: "changed" }
  /** The stored work no longer exists. */
  | { kind: "deleted" };

export interface LocalSaveStore<TSettings> {
  /**
   * Writes `job` only if the stored revision still equals `expectedRevision`
   * (undefined = this screen never read a revision: skip that check, but
   * still never re-create a missing work).
   */
  write(job: AutosaveJob<TSettings>, expectedRevision: number | undefined): Promise<LocalWriteResult>;
  /** Creates a NEW work holding `job` under `title`; returns its id and revision. */
  createCopy(job: AutosaveJob<TSettings>, title: string): Promise<{ id: number; revision: number }>;
}

export type LocalSaveEvent<TSettings> =
  | { type: "saving"; docId: number }
  | { type: "saved"; docId: number; renamedTitle?: string }
  | { type: "error"; docId: number; error: unknown }
  /** `docId` was changed elsewhere; this screen's text went to `copyId`. */
  | { type: "rescued"; docId: number; copyId: number; copyTitle: string }
  /** `docId` was deleted elsewhere; `job` (this screen's text) was NOT written. */
  | { type: "deleted"; docId: number; job: AutosaveJob<TSettings> };

type Timer = unknown;

export interface LocalSaveQueueOptions {
  /** Back-off between retries of a failed write (the last value repeats). */
  retryDelaysMs?: readonly number[];
  setTimer?: (callback: () => void, ms: number) => Timer;
  clearTimer?: (timer: Timer) => void;
  /** Title of the rescue copy made when two screens wrote the same work. */
  rescueTitle?: (title: string) => string;
}

export const DEFAULT_RETRY_DELAYS_MS = [2000, 5000, 10000, 30000] as const;

export function rescueCopyTitle(title: string): string {
  const base = title.trim() || "無題";
  return `${base}（書きかけの控え）`;
}

export class LocalSaveQueue<TSettings = unknown> {
  /** Latest unsaved state per work (keyed by the id the editor used). */
  private readonly latest = new Map<number, AutosaveJob<TSettings>>();
  /** Revision this screen last read or wrote, per stored work. */
  private readonly revisions = new Map<number, number>();
  /** A work changed elsewhere: this screen's writes go to its rescue copy. */
  private readonly redirects = new Map<number, { id: number; title: string; fromTitle: string }>();
  /** Renamed on the bookshelf: jobs still carrying the old title keep the new one. */
  private readonly renames = new Map<number, { from: string; to: string }>();
  /** Works found deleted: never written again from this screen. */
  private readonly deleted = new Set<number>();
  /** Jobs whose last write failed (waiting for the retry timer). */
  private readonly failed = new Set<AutosaveJob<TSettings>>();
  private readonly listeners = new Set<(event: LocalSaveEvent<TSettings>) => void>();
  private chain: Promise<void> = Promise.resolve();
  private retryTimer: Timer | null = null;
  private retryAttempt = 0;
  private readonly retryDelaysMs: readonly number[];
  private readonly setTimer: (callback: () => void, ms: number) => Timer;
  private readonly clearTimer: (timer: Timer) => void;
  private readonly rescueTitle: (title: string) => string;

  constructor(private readonly store: LocalSaveStore<TSettings>, options: LocalSaveQueueOptions = {}) {
    this.retryDelaysMs = options.retryDelaysMs?.length ? options.retryDelaysMs : DEFAULT_RETRY_DELAYS_MS;
    this.setTimer = options.setTimer ?? ((callback, ms) => setTimeout(callback, ms));
    this.clearTimer = options.clearTimer ?? ((timer) => clearTimeout(timer as ReturnType<typeof setTimeout>));
    this.rescueTitle = options.rescueTitle ?? rescueCopyTitle;
  }

  subscribe(listener: (event: LocalSaveEvent<TSettings>) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * The editor (re)read work `docId` at `revision`. Clears what this screen
   * remembered about it (an earlier rescue redirect or deletion), because the
   * screen now shows exactly the stored work again.
   */
  setBase(docId: number, revision: number): void {
    this.revisions.set(docId, revision);
    this.redirects.delete(docId);
    this.renames.delete(docId);
    this.deleted.delete(docId);
  }

  /** Where a write for `docId` lands (its rescue copy after a conflict). */
  targetOf(docId: number): number {
    return this.redirects.get(docId)?.id ?? docId;
  }

  /**
   * The job as written to its target. A rescue copy keeps its own title
   * (「…（書きかけの控え）」) until the screen renames the work.
   */
  private retarget(job: AutosaveJob<TSettings>): AutosaveJob<TSettings> {
    const rename = this.renames.get(job.docId);
    if (rename && job.title === rename.from) job = { ...job, title: rename.to };
    const redirect = this.redirects.get(job.docId);
    if (!redirect) return job;
    return { ...job, docId: redirect.id, title: job.title === redirect.fromTitle ? redirect.title : job.title };
  }

  /** True while some state of this screen is not yet in IndexedDB. */
  get hasUnsaved(): boolean {
    return this.latest.size > 0;
  }

  hasUnsavedFor(docId: number): boolean {
    return this.latest.has(docId);
  }

  /** Records `job` as the newest state of its work and writes it. */
  submit(job: AutosaveJob<TSettings>): Promise<void> {
    if (this.deleted.has(job.docId)) {
      this.emit({ type: "deleted", docId: job.docId, job });
      return this.chain;
    }
    this.latest.set(job.docId, job);
    return this.flush();
  }

  /** Writes everything unsaved now (also what is waiting for a retry). */
  flush(): Promise<void> {
    if (this.retryTimer !== null) {
      this.clearTimer(this.retryTimer);
      this.retryTimer = null;
    }
    this.failed.clear();
    const run = this.chain.then(() => this.drain());
    this.chain = run.catch(() => undefined);
    return this.chain;
  }

  /** Resolves once every write started so far has finished. */
  whenIdle(): Promise<void> {
    return this.chain;
  }

  /**
   * Keeps `job` as a NEW work (used after a deletion, when the person chose
   * to keep this screen's text). Later writes of `job.docId` go to the copy.
   */
  async keepAsCopy(job: AutosaveJob<TSettings>, title: string): Promise<{ id: number; revision: number }> {
    let result: { id: number; revision: number } | null = null;
    const run = this.chain.then(async () => {
      result = await this.store.createCopy(job, title);
      this.revisions.set(result.id, result.revision);
      this.redirects.set(job.docId, { id: result.id, title, fromTitle: job.title });
      this.deleted.delete(job.docId);
    });
    this.chain = run.catch(() => undefined);
    await run;
    return result!;
  }

  private emit(event: LocalSaveEvent<TSettings>): void {
    for (const listener of this.listeners) listener(event);
  }

  private async drain(): Promise<void> {
    // Loop until nothing is left that has not just failed: text typed while
    // a write was running is written in the same drain.
    for (;;) {
      const next = Array.from(this.latest.entries()).find(([, job]) => !this.failed.has(job));
      if (!next) break;
      const [docId, job] = next;
      await this.writeOne(docId, job);
    }
    if (this.failed.size > 0) this.scheduleRetry();
  }

  private async writeOne(docId: number, job: AutosaveJob<TSettings>): Promise<void> {
    const written = this.retarget(job);
    const target = written.docId;
    this.emit({ type: "saving", docId });
    let result: LocalWriteResult;
    try {
      result = await this.store.write(written, this.revisions.get(target));
    } catch (error) {
      this.failed.add(job);
      this.emit({ type: "error", docId, error });
      return;
    }

    if (result.kind === "saved") {
      this.revisions.set(target, result.revision);
      if (result.renamedTitle !== undefined) this.renames.set(docId, { from: written.title, to: result.renamedTitle });
      if (this.latest.get(docId) === job) this.latest.delete(docId);
      this.retryAttempt = 0;
      this.emit({ type: "saved", docId, renamedTitle: result.renamedTitle });
      return;
    }

    if (result.kind === "deleted") {
      this.deleted.add(docId);
      this.latest.delete(docId);
      this.emit({ type: "deleted", docId, job });
      return;
    }

    // Changed elsewhere: keep this screen's text as its own work. The stored
    // work keeps the other screen's text — nothing is thrown away.
    const copyTitle = this.rescueTitle(job.title);
    let copy: { id: number; revision: number };
    try {
      copy = await this.store.createCopy(written, copyTitle);
    } catch (error) {
      this.failed.add(job);
      this.emit({ type: "error", docId, error });
      return;
    }
    this.revisions.set(copy.id, copy.revision);
    this.redirects.set(docId, { id: copy.id, title: copyTitle, fromTitle: job.title });
    if (this.latest.get(docId) === job) this.latest.delete(docId);
    this.retryAttempt = 0;
    this.emit({ type: "rescued", docId, copyId: copy.id, copyTitle });
  }

  private scheduleRetry(): void {
    if (this.retryTimer !== null) return;
    const delays = this.retryDelaysMs;
    const delay = delays[Math.min(this.retryAttempt, delays.length - 1)];
    this.retryAttempt += 1;
    this.retryTimer = this.setTimer(() => {
      this.retryTimer = null;
      void this.flush();
    }, delay);
  }
}
