// TSP-SAFE-001: the one save queue of this tab (lib/localSaveQueue.ts), bound
// to IndexedDB. Shared by every editor instance of the tab, so a write still
// running after leaving the editor and the next screen's load are ordered.
import type { PageSettings } from "./pageLayout";
import { createDocumentCopy, saveDocumentIfUnchanged } from "./db";
import { LocalSaveQueue } from "./localSaveQueue";

let queue: LocalSaveQueue<PageSettings> | null = null;

export function getLocalSaveQueue(): LocalSaveQueue<PageSettings> {
  if (!queue) {
    queue = new LocalSaveQueue<PageSettings>({
      write: (job, expectedRevision) => saveDocumentIfUnchanged(job, expectedRevision),
      createCopy: (job, title) => createDocumentCopy(job, title),
    });
  }
  return queue;
}
