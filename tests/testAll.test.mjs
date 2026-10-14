// TSP-IMPROVE-002 (P0-3): the comparison behind `npm run test:all`.
import assert from "node:assert/strict";
import test from "node:test";
import { compareWithKnown, failuresFromVitestJson } from "../scripts/test-all-lib.mjs";

const known = [{ id: "a.test.ts > old" }, { id: "a.test.ts > fixed" }, { id: "gone.test.ts > x" }];

test("only failures missing from the known list fail the run", () => {
  const r = compareWithKnown(["a.test.ts > old"], ["a.test.ts > fixed"], known);
  assert.equal(r.ok, true);
  assert.deepEqual(r.known, ["a.test.ts > old"]);
  assert.deepEqual(r.fixed, ["a.test.ts > fixed"]);
  assert.deepEqual(r.notSeen, ["gone.test.ts > x"]);

  const bad = compareWithKnown(["a.test.ts > old", "b.test.ts > new"], [], known);
  assert.equal(bad.ok, false);
  assert.deepEqual(bad.unexpected, ["b.test.ts > new"]);
});

test("vitest json becomes repo-relative ids; a file that cannot load is a failure", () => {
  const report = {
    testResults: [
      {
        name: "/repo/src/a.test.ts",
        status: "failed",
        assertionResults: [
          { ancestorTitles: ["group"], title: "breaks", status: "failed", failureMessages: ["\nAssertionError: x\n at"] },
          { ancestorTitles: [], title: "works", status: "passed" },
          { ancestorTitles: [], title: "later", status: "skipped" },
        ],
      },
      { name: "/repo/src/b.test.ts", status: "failed", message: "SyntaxError: nope", assertionResults: [] },
    ],
  };
  const r = failuresFromVitestJson(report, "/repo");
  assert.deepEqual(r.failures.map((f) => f.id), ["src/a.test.ts > group > breaks", "src/b.test.ts > (file failed to load)"]);
  assert.equal(r.failures[0].message, "AssertionError: x");
  assert.deepEqual(r.passedIds, ["src/a.test.ts > works"]);
  assert.equal(r.skipped, 1);
});
