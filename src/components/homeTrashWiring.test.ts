import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * TSP-SAFE-004 wiring contract: the bookshelf's 削除 goes to the ゴミ箱 and can
 * be undone. Semantics are tested in src/lib/trashSafety.test.ts (no DOM here).
 */

const home = readFileSync(resolve("src/app/home-v2/HomeV2Client.tsx"), "utf8");
const editor = readFileSync(resolve("src/components/TategakiEditor.tsx"), "utf8");

describe("bookshelf: 削除 → ゴミ箱", () => {
  it("the confirm no longer says it cannot be undone, and the action is ゴミ箱に移す", () => {
    expect(home).not.toContain("この操作は取り消せません");
    expect(home).toContain("をゴミ箱に移しますか？30日のあいだは元に戻せます。");
    expect(home).toContain("ゴミ箱に移す");
  });

  it("the last deleted work can be put back at once, and the ゴミ箱 opens from the bookshelf", () => {
    expect(home).toContain("setLastTrashed({ id, title });");
    expect(home).toContain("onClick={() => void handleRestore(undoable.id)}");
    expect(home).toMatch(/onClick=\{openTrash\}/);
    expect(home).toContain("<TrashModal");
  });

  it("QA: the ゴミ箱 and 元に戻す are on the empty bookshelf too", () => {
    expect(home.match(/renderTrashLinks\(/g)?.length).toBe(2);
    const empty = home.slice(home.indexOf('data-home-empty-onboarding=""'));
    expect(empty).toContain("renderTrashLinks(");
  });

  it("QA: putting a work back respects the 60-work limit", () => {
    const restore = home.slice(home.indexOf("const handleRestore = "), home.indexOf("const handlePurge = "));
    expect(restore.indexOf("LOCAL_DOCUMENT_LIMIT")).toBeLessThan(restore.indexOf("await restoreFromTrash(id);"));
    expect(restore).toContain("setIsLimitModalOpen(true);");
  });

  it("QA: an unusable storage is said, not left at 読み込み中", () => {
    expect(home).toContain("このブラウザの保存場所が使えないため、本棚を開けませんでした。");
  });

  it("each visit tidies the expired trash, images no work uses at most daily, and asks to keep the saved works", () => {
    expect(home).toContain(".then(() => (orphanSweepIsDue() ? removeOrphanImages().then(noteOrphanSweep) : undefined))");
    expect(home).toContain("void purgeExpiredTrash()");
    expect(home).toContain("void requestPersistentStorage();");
  });

  it("removing an image from a work keeps it while a trashed work still uses it", () => {
    expect(editor).toContain("Promise.all([listDocuments(), listTrash()])");
    expect(editor).toContain("...trashed.map((item) => item.document.content),");
  });
});
