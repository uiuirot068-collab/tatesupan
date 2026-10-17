// TSP-IMPROVE-002 (P0-4): keep test runs from rewriting the QA sample files
// committed under typesetting-v2/qa/ (PDF / JPG / ZIP / HTML / PNG).
//
// Many publication / preview tests write a QA sample as a side effect. By
// default those writes now go to a scratch folder instead of the repo:
//   $TATESPUN_QA_OUT_DIR (or <os tmp>/tatespun-qa-artifacts)/typesetting-v2/qa/...
// Reads of such a path prefer the scratch copy when one exists, so a test
// that writes a sample and reads it back still sees its own output, while
// reference inputs that only exist in the repo are read from the repo.
//
// To regenerate the committed samples on purpose:
//   UPDATE_QA_ARTIFACTS=1 npx vitest run --config <config>
//
// Patched on the node:fs module object + syncBuiltinESMExports() so that
// `import { writeFileSync } from "fs"` in test files sees the patch too.
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PATCHED = Symbol.for("tatespun.redirectQaArtifacts");

if (process.env.UPDATE_QA_ARTIFACTS !== "1" && !(fs as unknown as Record<symbol, boolean>)[PATCHED]) {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  const qaRoot = path.join(repoRoot, "typesetting-v2", "qa") + path.sep;
  const outRoot = path.resolve(process.env.TATESPUN_QA_OUT_DIR || path.join(os.tmpdir(), "tatespun-qa-artifacts"));

  const toScratch = (p: fs.PathLike | number): string | null => {
    if (typeof p !== "string" && !(p instanceof URL)) return null;
    const abs = path.resolve(p instanceof URL ? fileURLToPath(p) : p);
    if (!(abs + path.sep).startsWith(qaRoot)) return null;
    return path.join(outRoot, path.relative(repoRoot, abs));
  };

  const orig = {
    writeFileSync: fs.writeFileSync,
    mkdirSync: fs.mkdirSync,
    readFileSync: fs.readFileSync,
    existsSync: fs.existsSync,
  };

  fs.writeFileSync = ((file: fs.PathOrFileDescriptor, ...rest: unknown[]) => {
    const scratch = toScratch(file as fs.PathLike);
    if (scratch) orig.mkdirSync(path.dirname(scratch), { recursive: true });
    return (orig.writeFileSync as (...a: unknown[]) => void)(scratch ?? file, ...rest);
  }) as typeof fs.writeFileSync;

  fs.mkdirSync = ((dir: fs.PathLike, ...rest: unknown[]) => {
    const scratch = toScratch(dir);
    return (orig.mkdirSync as (...a: unknown[]) => string | undefined)(scratch ?? dir, ...rest);
  }) as typeof fs.mkdirSync;

  fs.readFileSync = ((file: fs.PathOrFileDescriptor, ...rest: unknown[]) => {
    const scratch = toScratch(file as fs.PathLike);
    const target = scratch && orig.existsSync(scratch) ? scratch : file;
    return (orig.readFileSync as (...a: unknown[]) => unknown)(target, ...rest);
  }) as typeof fs.readFileSync;

  fs.existsSync = ((p: fs.PathLike) => {
    const scratch = toScratch(p);
    return (scratch !== null && orig.existsSync(scratch)) || orig.existsSync(p);
  }) as typeof fs.existsSync;

  (fs as unknown as Record<symbol, boolean>)[PATCHED] = true;
  syncBuiltinESMExports();
}
