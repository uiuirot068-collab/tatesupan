// TSP-V2 Phase 2 P2-L05 — Japanese Typesetting Capability PoC engine.
//
// Demonstrates a deterministic pipeline:
//   source text -> tokens (ruby/tcy/text) -> logical units (1 unit per
//   composition-relevant cell/run) -> rule-decision layer (kinsoku/hanging)
//   -> positioned lines (source-mapped) -> renderer (HTML, in build-*.js)
//
// PoC-only. Not the Phase 3 Canonical Layout Model. The rule CONSTANTS
// below are copied verbatim from src/lib/tategaki.ts (read-only reference,
// cited inline) — this is the CURRENT PRODUCT's already-shipped rule set,
// classified as PRODUCT REQUIREMENT (kinsoku/hanging/ruby/TCY notation
// itself is a frozen Master §10 requirement) vs. LEGACY IMPLEMENTATION
// DETAIL (the exact iterative algorithm in tategaki.ts is NOT reproduced;
// this PoC's break algorithm is a new, simplified, single-pass
// reimplementation built to demonstrate the ARCHITECTURE, not to be the
// Phase 3 engine). The full kinsoku class table and the dash/ellipsis
// primary-source rule remain OPEN per Master's Phase 1 standards-
// verification status — nothing here freezes them.

// ---- Rule constants, verbatim from src/lib/tategaki.ts ----
const RUBY_PATTERN = /[｜|]([^｜|《》\n]+)《([^《》\n]+)》|([一-龠々〆ヵヶ]+)《([^《》\n]+)》/g;
const TCY_PATTERN = /\[tate\]([^[\]\n]{1,8})\[\/tate\]|(?<!\d)\d{2}(?!\d)|[!?！？]{2}(?![!?！？])/g;
const DASH_RUN_FAMILY = /[―—]/;
const ELLIPSIS_RUN_FAMILY = /[…‥]/;
const LINE_START_PROHIBITED = new Set(
  "、。，．！？‼⁉）］｝〕〉》」』】〙〗ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶー々ゝゞヽヾ"
);
const LINE_END_PROHIBITED = new Set("（［｛〔〈《「『【〘〖");
const HANGING_PUNCTUATION = new Set("、。，．");
const HANGING_CLOSE_BRACKETS = new Set("」』）］｝〕〉》】〙〗");

// ---------------------------------------------------------------------
// STAGE 1: source text -> tokens (ruby / tcy / text), each source-mapped.
// ---------------------------------------------------------------------
function tokenize(source) {
  const tokens = [];
  const combined = new RegExp(`${RUBY_PATTERN.source}|${TCY_PATTERN.source}`, "g");
  let lastIndex = 0;
  let m;
  while ((m = combined.exec(source))) {
    if (m.index > lastIndex) {
      tokens.push({ type: "text", value: source.slice(lastIndex, m.index), start: lastIndex, end: m.index });
    }
    if (m[1] !== undefined || m[3] !== undefined) {
      // ruby (either ｜base《rt》 or bare-kanji-run《rt》)
      const base = m[1] !== undefined ? m[1] : m[3];
      const rt = m[1] !== undefined ? m[2] : m[4];
      tokens.push({ type: "ruby", base, rt, start: m.index, end: combined.lastIndex });
    } else {
      // tcy: explicit [tate]...[/tate] (group 5) or bare auto-detect (whole match)
      const value = m[5] !== undefined ? m[5] : m[0];
      tokens.push({ type: "tcy", value, start: m.index, end: combined.lastIndex });
    }
    lastIndex = combined.lastIndex;
  }
  if (lastIndex < source.length) {
    tokens.push({ type: "text", value: source.slice(lastIndex), start: lastIndex, end: source.length });
  }
  return tokens;
}

// ---------------------------------------------------------------------
// STAGE 2: tokens -> logical units. One unit per composition-relevant
// cell or keep-together run, each retaining its source range.
// ---------------------------------------------------------------------
function expandToUnits(tokens) {
  const units = [];
  for (const token of tokens) {
    if (token.type === "ruby") {
      // Ruby base occupies its natural per-character cell count (each base
      // char = 1 cell); the whole base run is a keep-together group (base
      // must never split across a line — Master §10, Freeze §7/9-10) and
      // carries the ruby annotation (rt) as associated metadata, not its
      // own cell.
      const baseChars = Array.from(token.base);
      const groupId = `ruby@${token.start}`;
      baseChars.forEach((ch, i) => {
        units.push({
          kind: "rubyBase",
          display: ch,
          rt: i === 0 ? token.rt : null, // rt drawn once, associated with the group
          cells: 1,
          start: token.start, // whole-group source range (base+rt+markup)
          end: token.end,
          groupId,
          keepTogetherGroup: groupId,
          category: new Set(),
        });
      });
      continue;
    }
    if (token.type === "tcy") {
      // TCY consumes exactly 1 cell regardless of content length — CURRENT_
      // PRODUCT_COMPATIBILITY_MATRIX.md row 21, a deliberate simplification,
      // classified PRODUCT REQUIREMENT (not this PoC's invention).
      units.push({
        kind: "tcy",
        display: token.value,
        cells: 1,
        start: token.start,
        end: token.end,
        category: new Set(),
      });
      continue;
    }
    // text: split into chars, grouping consecutive dash/ellipsis runs.
    const chars = Array.from(token.value);
    let charOffset = token.start;
    let i = 0;
    while (i < chars.length) {
      const ch = chars[i];
      if (DASH_RUN_FAMILY.test(ch) || ELLIPSIS_RUN_FAMILY.test(ch)) {
        const family = DASH_RUN_FAMILY.test(ch) ? "dashRun" : "ellipsisRun";
        const familyRe = family === "dashRun" ? DASH_RUN_FAMILY : ELLIPSIS_RUN_FAMILY;
        let j = i;
        while (j < chars.length && familyRe.test(chars[j])) j++;
        const runChars = chars.slice(i, j);
        const runStart = charOffset;
        const runEnd = charOffset + runChars.join("").length;
        units.push({
          kind: family,
          display: runChars.join(""),
          cells: runChars.length,
          start: runStart,
          end: runEnd,
          keepTogetherGroup: `${family}@${runStart}`,
          category: new Set(),
        });
        charOffset = runEnd;
        i = j;
        continue;
      }
      const cat = new Set();
      if (LINE_START_PROHIBITED.has(ch)) cat.add("lineStartProhibited");
      if (LINE_END_PROHIBITED.has(ch)) cat.add("lineEndProhibited");
      if (HANGING_PUNCTUATION.has(ch)) cat.add("hangingPunct");
      if (HANGING_CLOSE_BRACKETS.has(ch)) cat.add("hangingCloseBracket");
      units.push({
        kind: "char",
        display: ch,
        cells: 1,
        start: charOffset,
        end: charOffset + ch.length,
        category: cat,
      });
      charOffset += ch.length;
      i++;
    }
  }
  return units;
}

// ---------------------------------------------------------------------
// STAGE 3: rule-decision layer -> break units into lines.
// Simplified single-pass reimplementation (NOT tategaki.ts's iterative
// fixed-point algorithm) built to demonstrate the ARCHITECTURE: rule
// decisions are made on the logical unit stream, before any position is
// assigned — not derived from browser/DOM measurement.
// ---------------------------------------------------------------------
function breakIntoLines(units, capacityCells) {
  const lines = [];
  const trace = [];
  let i = 0;
  while (i < units.length) {
    let cells = 0;
    let j = i;
    // naive fill: accumulate whole units (a keepTogether run/ruby-group
    // counts by its total cells, never split mid-run) until capacity.
    while (j < units.length) {
      const u = units[j];
      const group = u.keepTogetherGroup || u.groupId;
      let groupCells = u.cells;
      let groupEnd = j + 1;
      if (group) {
        // measure the whole group's total cells so it's never split
        while (groupEnd < units.length && (units[groupEnd].keepTogetherGroup || units[groupEnd].groupId) === group) {
          groupCells += units[groupEnd].cells;
          groupEnd++;
        }
      }
      if (cells > 0 && cells + groupCells > capacityCells) break;
      cells += groupCells;
      j = groupEnd;
    }
    const naiveEnd = j; // naive candidate break: line = units[i..naiveEnd)
    let finalEnd = naiveEnd;
    const decisions = [];

    // Rule 1 — hanging punctuation (ぶら下げ), checked FIRST and only for
    // 、。when it is exactly the next unit: it gets one extra slot on the
    // CURRENT line (TSP-LOOP-029 issue A) rather than the generic
    // push-out below — plus a directly-following closing bracket hangs
    // together with it (TSP-LOOP-029 R3), never left orphaned at the next
    // line's head. This takes priority over Rule 2 because 、。are also
    // members of LINE_START_PROHIBITED (they may never start a line
    // EITHER way) — hanging is the more specific, preferred resolution
    // for this exact category, not a fallback.
    if (finalEnd < units.length && units[finalEnd].category && units[finalEnd].category.has("hangingPunct")) {
      decisions.push({ rule: "hanging punctuation (ぶら下げ, extra slot)", unit: describeUnit(units[finalEnd]) });
      finalEnd++;
      if (finalEnd < units.length && units[finalEnd].category && units[finalEnd].category.has("hangingCloseBracket")) {
        decisions.push({ rule: "hanging close-bracket rides with 。/、 (TSP-LOOP-029 R3)", unit: describeUnit(units[finalEnd]) });
        finalEnd++;
      }
    }

    // Rule 2 — 行頭禁則 (line-start prohibited, 追い出し/push-out): for any
    // OTHER lineStartProhibited unit (closing brackets, small kana, etc.
    // — not 、。, already handled by Rule 1 above), pull it back onto the
    // current line instead of letting it start the next one.
    while (finalEnd < units.length && units[finalEnd].category && units[finalEnd].category.has("lineStartProhibited")) {
      decisions.push({ rule: "line-start-prohibited (追い出し)", unit: describeUnit(units[finalEnd]) });
      finalEnd++;
    }

    // Rule 3 — 行末禁則 (line-end prohibited, opening bracket cannot end a
    // line): if the current LAST unit on the line is lineEndProhibited,
    // move it to the next line instead (only if the line has >1 unit, so
    // a line is never emptied).
    while (finalEnd > i + 1 && units[finalEnd - 1].category && units[finalEnd - 1].category.has("lineEndProhibited")) {
      decisions.push({ rule: "line-end-prohibited (opening bracket pushed to next line)", unit: describeUnit(units[finalEnd - 1]) });
      finalEnd--;
    }

    const lineUnits = units.slice(i, finalEnd);
    lines.push(lineUnits);
    trace.push({
      lineIndex: lines.length - 1,
      sourceRange: [lineUnits[0].start, lineUnits[lineUnits.length - 1].end],
      naiveBreakAfterUnitIndex: naiveEnd - 1,
      naiveBreakUnit: describeUnit(units[naiveEnd - 1]),
      naiveNextUnit: naiveEnd < units.length ? describeUnit(units[naiveEnd]) : null,
      ruleDecisions: decisions,
      finalLineText: lineUnits.map((u) => u.display).join(""),
      finalCellCount: lineUnits.reduce((s, u) => s + u.cells, 0),
      nextLineStartUnit: finalEnd < units.length ? describeUnit(units[finalEnd]) : null,
    });
    i = finalEnd;
  }
  return { lines, trace };
}

function describeUnit(u) {
  if (!u) return null;
  return { kind: u.kind, display: u.display, start: u.start, end: u.end, cells: u.cells };
}

function runCapability(source, capacityCells) {
  const tokens = tokenize(source);
  const units = expandToUnits(tokens);
  const { lines, trace } = breakIntoLines(units, capacityCells);
  return { source, capacityCells, tokens, units, lines, trace };
}

module.exports = { tokenize, expandToUnits, breakIntoLines, runCapability, RUBY_PATTERN, TCY_PATTERN, DASH_RUN_FAMILY, ELLIPSIS_RUN_FAMILY, LINE_START_PROHIBITED, LINE_END_PROHIBITED, HANGING_PUNCTUATION, HANGING_CLOSE_BRACKETS };
