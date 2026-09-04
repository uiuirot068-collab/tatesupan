// TSP-LOOP-027 — feature-guide → real-Help navigation.
//
// Structural contracts only. The behavioural proof (open at section, scroll
// restoration, default Help untouched) is the browser walkthrough — not regex.
//
// Run:  node scripts/verify-tsp027-help-navigation.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => {
  const p = path.join(repoRoot, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
};

let failures = 0;
const check = (name, cond) => {
  console.log(`${cond ? "PASS" : "FAIL"}: ${name}`);
  if (!cond) failures += 1;
};

const helpSections = read("src/lib/helpSections.ts");
const helpModal = read("src/components/HelpModal.tsx");
const guide = read("src/app/guide/page.tsx");
const helpMd = read("public/docs/help.md");
const homePage = read("src/app/page.tsx");
const editor = read("src/components/TategakiEditor.tsx");

/* ---------------- 1. stable Help section IDs exist ---------------- */

const idListMatch = helpSections?.match(
  /HELP_SECTION_IDS\s*=\s*\[([\s\S]*?)\]\s*as const/,
);
const sectionIds = idListMatch
  ? [...idListMatch[1].matchAll(/"([a-z0-9-]+)"/g)].map((m) => m[1])
  : [];
check("1. src/lib/helpSections.ts exports a HELP_SECTION_IDS list", sectionIds.length >= 1);
check(
  "1b. helpSections.ts exposes a typed HelpSectionId + helpSectionDomId() destination helper",
  !!helpSections &&
    /export type HelpSectionId/.test(helpSections) &&
    /export function helpSectionDomId\(/.test(helpSections) &&
    /help-section-\$\{id\}/.test(helpSections),
);

/* ---------------- 2. IDs are semantic, not ordinal ---------------- */

check(
  "2. every Help section ID is semantic (lowercase-kebab, not section-N / heading-N / a bare number)",
  sectionIds.length > 0 &&
    sectionIds.every(
      (id) =>
        /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(id) &&
        !/^(section|heading|item|step)-?\d+$/.test(id) &&
        !/^\d+$/.test(id),
    ),
);

/* ---------------- 3. feature guide has a Help CTA ---------------- */

check(
  "3. /guide renders a ［使い方を見る →］ CTA per card",
  !!guide && /使い方を見る\s*→/.test(guide) && /data-feature-help-cta=\{/.test(guide),
);
check(
  "3b. the CTA is a real <button>, not a hover-only affordance",
  !!guide &&
    /<button[\s\S]*?data-feature-help-cta=\{card\.helpSection\}[\s\S]*?onClick=\{\(\) => setHelpSection\(card\.helpSection\)\}/.test(
      guide,
    ),
);

/* ---------------- 4. guide cards use the stable mapping ---------------- */

const cardSections = guide
  ? [...guide.matchAll(/helpSection:\s*"([a-z0-9-]+)"/g)].map((m) => m[1])
  : [];
check(
  "4. guide imports the typed HelpSectionId contract (no free-form strings)",
  !!guide && /import type \{ HelpSectionId \} from "@\/lib\/helpSections"/.test(guide),
);
check(
  "4b. every guide card's helpSection is a known stable ID",
  cardSections.length === 10 && cardSections.every((s) => sectionIds.includes(s)),
);
check(
  "4c. cards 01–10 each carry a helpSection (10/10 coverage)",
  (() => {
    const cards = [...guide.matchAll(/n:\s*"(\d\d)"[\s\S]{0,400}?helpSection:\s*"([a-z0-9-]+)"/g)];
    const ns = cards.map((m) => m[1]);
    return (
      ns.join(",") === "01,02,03,04,05,06,07,08,09,10" &&
      cards.every((m) => sectionIds.includes(m[2]))
    );
  })(),
);

/* ---------------- 5. HelpModal direct-open API ---------------- */

check(
  "5. HelpModal accepts an optional initialSectionId: HelpSectionId target",
  !!helpModal &&
    /initialSectionId\?:\s*HelpSectionId/.test(helpModal) &&
    /import \{[\s\S]*?helpSectionDomId[\s\S]*?\} from "@\/lib\/helpSections"/.test(helpModal),
);
check(
  "5b. HelpModal puts the stable id on the target heading via a components override",
  !!helpModal &&
    /h2:\s*headingComponent\("h2"\)/.test(helpModal) &&
    /id=\{id \? helpSectionDomId\(id\) : undefined\}/.test(helpModal),
);
check(
  "5c. scroll-to-section is a computed destination (offsetTop of the matched id), not brittle nav",
  !!helpModal &&
    /querySelector<HTMLElement>\(\s*`\[id="\$\{helpSectionDomId\(initialSectionId\)\}"\]`/.test(helpModal) &&
    /\.scrollTop\s*=\s*Math\.max\(0, el\.offsetTop/.test(helpModal) &&
    !/nth-child|:nth-|childNodes\[\d|children\[\d|textContent ===|innerText/.test(helpModal),
);

/* ---------------- 6. one canonical Help — no duplication ---------------- */

check(
  "6. /guide reuses the real HelpModal (imports it, does not re-implement Help)",
  !!guide &&
    /import HelpModal from "@\/components\/HelpModal"/.test(guide) &&
    /<HelpModal\s+initialSectionId=\{helpSection\}/.test(guide),
);
check(
  "6b. /guide does not duplicate Help content (no help.md fetch, no markdown renderer, no GuideHelpModal)",
  !!guide &&
    !/help\.md/.test(guide) &&
    !/ReactMarkdown|react-markdown/.test(guide) &&
    !/GuideHelpModal/.test(guide),
);
check(
  "6c. HelpModal is still the single component that loads help.md",
  !!helpModal &&
    /fetch\(withBasePath\("\/docs\/help\.md"\)\)/.test(helpModal) &&
    !/help\.md/.test(homePage ?? "") &&
    (editor ?? "").split("help.md").length === 1,
);

/* ---------------- 7. default / manual Help unchanged ---------------- */

check(
  "7. default Help open has no target — Header / mobile-nav path renders <HelpModal onClose= only",
  !!editor &&
    /<HelpModal onClose=\{\(\) => setIsHelpOpen\(false\)\} \/>/.test(editor) &&
    !/isHelpOpen && <HelpModal[^>]*initialSectionId/.test(editor),
);
check(
  "7b. initialSectionId is optional — HelpModal works with no target",
  !!helpModal && /initialSectionId\?:/.test(helpModal) &&
    /if \(!initialSectionId\) return;/.test(helpModal),
);

/* ---------------- 8. CARD 06 stays 目次, no 扉 ---------------- */

check(
  "8. guide card 06 is 目次 and advertises no title-page creation",
  !!guide &&
    (() => {
      const c6 = guide.match(/n:\s*"06"[\s\S]{0,400}?\},/);
      return (
        !!c6 &&
        /目次も作れる/.test(c6[0]) &&
        /helpSection:\s*"table-of-contents"/.test(c6[0]) &&
        !/扉|タイトルページ|title.?page/i.test(c6[0])
      );
    })(),
);
check(
  "8b. the new Help 目次 section does not advertise title-page creation",
  !!helpMd &&
    (() => {
      const start = helpMd.indexOf("## 目次 <!-- help-id: table-of-contents -->");
      const sec = helpMd.slice(start, helpMd.indexOf("\n## ", start + 1));
      return start !== -1 && /目次作成/.test(sec) && !/扉作成|タイトルページ/.test(sec);
    })(),
);

/* ---------------- 9. feedback card stays separate ---------------- */

check(
  "9. β feedback card keeps its own ［報告する］ and is not turned into a Help card",
  !!guide &&
    /data-guide-feedback-cta=""/.test(guide) &&
    (() => {
      const beta = guide.match(/data-feature-card="beta"[\s\S]*?<\/section>/);
      return !!beta && !/data-feature-help-cta|使い方を見る/.test(beta[0]);
    })(),
);

/* ---------------- 10. no backend / schema changes ---------------- */

check(
  "10. TSP-027 surface touches no backend (helpSections / HelpModal / guide import no supabase / edge / db)",
  [helpSections, helpModal, guide].every(
    (src) =>
      !!src &&
      !/supabase|functions\.invoke|edge function|edge runtime|\.sql\b|db\.(get|put|add|table)|createClient/i.test(src),
  ),
);

/* ---------------- 11. no brittle navigation anywhere in the path ---------------- */

check(
  "11. no text-search / nth-child / pixel-scroll navigation in HelpModal or guide",
  [helpModal, guide].every(
    (src) =>
      !!src &&
      !/nth-child|:nth-of-type|:nth-|scrollTo\(\s*0\s*,\s*\d{3,}|scrollTop\s*=\s*\d{3,}\b/.test(src),
  ),
);

/* ---------------- 12. every mapped ID exists in rendered Help metadata ---------------- */

const markerIds = helpMd
  ? [...helpMd.matchAll(/^#{1,6}[ \t]+.*?<!--[ \t]*help-id:[ \t]*([a-z0-9-]+)[ \t]*-->[ \t]*$/gm)].map(
      (m) => m[1],
    )
  : [];
check(
  "12. every HELP_SECTION_IDS entry has a matching `<!-- help-id: … -->` marker in help.md",
  sectionIds.length > 0 && sectionIds.every((id) => markerIds.includes(id)),
);
check(
  "12b. every help.md marker is a declared HELP_SECTION_IDS entry (no orphans)",
  markerIds.length > 0 && markerIds.every((id) => sectionIds.includes(id)),
);
check(
  "12c. marker ids are unique and cover all 10 cards",
  markerIds.length === new Set(markerIds).size &&
    cardSections.every((s) => markerIds.includes(s)),
);
check(
  "12d. HelpModal strips the markers so they never render as visible text",
  !!helpModal && /MARKER_STRIP_RE|replace\(MARKER_STRIP_RE/.test(helpModal),
);

/* ---------------- done ---------------- */

console.log("");
if (failures === 0) {
  console.log("All TSP-027 help-navigation checks passed.");
} else {
  console.log(`${failures} TSP-027 help-navigation check(s) FAILED.`);
  process.exit(1);
}
