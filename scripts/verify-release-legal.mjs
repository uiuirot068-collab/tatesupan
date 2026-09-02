// TSP-LOOP-009 — public-beta legal / user-information surface gate.
//
// Docs / navigation only. Verifies that /privacy and /terms exist as real
// routes, the footer links to them (no more "準備中" placeholders), the
// inquiry link is the canonical Google Form, and the Privacy Policy actually
// discloses the TSP-LOOP-006 / 007 behaviour it must.
//
// Run:  node scripts/verify-release-legal.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => {
  const p = path.join(repoRoot, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
};

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? "PASS" : "FAIL"}: ${name}`);
  if (!cond) failures += 1;
}
/** all substrings present (whitespace-insensitive on the haystack). */
function has(hay, ...needles) {
  const h = (hay ?? "").replace(/\s+/g, "");
  return needles.every((n) => h.includes(n.replace(/\s+/g, "")));
}

const privacy = read("src/app/privacy/page.tsx");
const terms = read("src/app/terms/page.tsx");
const legalShell = read("src/components/legal/LegalArticle.tsx");
const home = read("src/app/page.tsx");

const FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSfKtzQy7a6kufXDnhdkWkkeourqbSEJWxEHW7NQn4Wq1bQhhA/viewform?usp=dialog";

/* ---------------- routes exist ---------------- */

check("1. /privacy route source exists (src/app/privacy/page.tsx)", privacy !== null);
check("2. /terms route source exists (src/app/terms/page.tsx)", terms !== null);
check("2b. shared LegalArticle shell exists (not a modal, has a home link)", legalShell !== null && /href="\/"/.test(legalShell ?? ""));
check(
  "2b2. LegalArticle owns a full-height vertical scroll container (globals.css locks html/body to overflow:hidden)",
  /h-dvh[\s\S]{0,40}overflow-y-auto/.test(legalShell ?? "") &&
    /overflow-x-hidden/.test(legalShell ?? "") &&
    !/min-h-dvh/.test(legalShell ?? "") &&
    // the fix must be route-local — globals.css must NOT be modified for this
    !/data-legal-page|legal-page/.test(read("src/app/globals.css") ?? "")
);
check(
  "2c. both pages are default-exported page components with a heading",
  /export default function \w+Page\(\)/.test(privacy ?? "") &&
    /export default function \w+Page\(\)/.test(terms ?? "") &&
    has(privacy, 'title="プライバシーポリシー"') &&
    has(terms, 'title="利用規約"')
);

/* ---------------- footer wiring ---------------- */

check(
  "3. footer links 利用規約 -> /terms and プライバシーポリシー -> /privacy",
  /<Link\s+href="\/terms"[\s\S]{0,180}利用規約[\s\S]{0,20}<\/Link>/.test(home ?? "") &&
    /<Link\s+href="\/privacy"[\s\S]{0,200}プライバシーポリシー[\s\S]{0,20}<\/Link>/.test(home ?? "")
);
check(
  "4. footer お問い合わせ -> canonical Google Form (new tab, noopener noreferrer)",
  (() => {
    const h = home ?? "";
    // canonical URL lives in the shared constant; footer references it
    const urlOk = (legalShell ?? "").includes(FORM_URL) && /INQUIRY_FORM_URL/.test(h);
    // the お問い合わせ anchor uses that constant + opens safely in a new tab
    const anchor = h.match(/<a\b[\s\S]{0,400}?お問い合わせ[\s\S]{0,20}?<\/a>/);
    const a = anchor ? anchor[0] : "";
    return (
      urlOk &&
      /href=\{INQUIRY_FORM_URL\}/.test(a) &&
      /target="_blank"/.test(a) &&
      /rel="noopener noreferrer"/.test(a)
    );
  })()
);
check(
  "5. no '準備中のページです' placeholder remains on the footer legal items",
  !/準備中のページです/.test(home ?? "")
);
check(
  "5b. visible footer labels unchanged (利用規約 / プライバシーポリシー / お問い合わせ)",
  has(home, "利用規約") && has(home, "プライバシーポリシー") && has(home, "お問い合わせ")
);

/* ---------------- privacy content contract ---------------- */

check("6a. privacy: operator caload + 制定日 2026年9月1日", has(privacy, "caload") && has(privacy, "2026年9月1日"));
check(
  "6b. privacy: external services named (Supabase / Discord / Google Apps Script / Google Spreadsheet / Google Forms)",
  has(privacy, "Supabase") && has(privacy, "Discord") && has(privacy, "Google Apps Script") && has(privacy, "Google Spreadsheet") && has(privacy, "Google Forms")
);
check(
  "6c. privacy: 72時間 temporary cloud image copy + it is the COPY that expires, not the browser original",
  has(privacy, "72時間") &&
    has(privacy, "クラウド上の一時コピー") &&
    has(privacy, "元画像を、TateSpunが72時間後に自動削除することはありません")
);
check(
  "6d. privacy: browser-local storage (localStorage / IndexedDB) + Guest vs Member distinction",
  has(privacy, "localStorage") && has(privacy, "IndexedDB") &&
    has(privacy, "Guest（未登録）の挿入画像には、TateSpun側の72時間のクラウド保存期限はありません") &&
    has(privacy, "Memberが画像を含む作品について「クラウドに保存」")
);
check(
  "6e. privacy: browser-data-deletion / other-device caveat + user should back up",
  has(privacy, "ブラウザのサイトデータ削除") && has(privacy, "別ブラウザ・別端末") &&
    has(privacy, "利用者自身でもバックアップしてください")
);
check(
  "6f. privacy: Writing Check β is local, no manuscript text to external AI/API",
  has(privacy, "Writing Check β") &&
    has(privacy, "ブラウザ内で動作するローカル機能") &&
    has(privacy, "作品本文を外部AIや外部文章解析APIへ送信することはありません")
);
check(
  "6g. privacy: anonymous feedback does NOT auto-attach manuscript / title / email / selection",
  has(privacy, "匿名フィードバックに、作品本文、作品タイトル、アカウントのメールアドレス、選択中の文章などを自動的に添付することはありません")
);
check(
  "6h. privacy: feedback images are NOT auto-stripped of EXIF / image metadata",
  has(privacy, "EXIF") &&
    has(privacy, "画像メタデータをTateSpun側で自動削除する処理は、現在実装していません")
);
check(
  "6i. privacy: feedback retention wording does NOT falsely promise automatic deletion",
  has(privacy, "保存期間を一律に定めず保管する場合があります") &&
    has(privacy, "「送信後一定期間で必ず削除される」という仕様ではありません")
);
check(
  "6j. privacy: abuse/rate-limit uses a transient hash, not raw IP as a record",
  has(privacy, "一時的な識別用ハッシュ") &&
    has(privacy, "生のIPアドレスを、フィードバック本文や通常のフィードバック記録として保存することを目的としたものではありません")
);
check(
  "6k. privacy: account / email auth via Supabase Auth",
  has(privacy, "認証のためのメールアドレス") && has(privacy, "Supabase Auth")
);
check("6l. privacy: inquiry form link present", (privacy ?? "").includes("INQUIRY_FORM_URL") || (privacy ?? "").includes(FORM_URL));

/* ---------------- terms content contract ---------------- */

check("7a. terms: β版 / operator caload / 制定日 2026年9月1日", has(terms, "β版") && has(terms, "caload") && has(terms, "2026年9月1日"));
check(
  "7b. terms: user (not operator) retains rights to their content",
  has(terms, "コンテンツの権利は、利用者または正当な権利者に帰属します") &&
    has(terms, "運営者が、利用者の作品について著作権を取得するものではありません")
);
check(
  "7c. terms: browser + cloud storage caveat (data may become unavailable)",
  has(terms, "ブラウザデータの削除、端末・ブラウザの変更、障害その他の事情によって、データを利用できなくなる場合があります")
);
check(
  "7d. terms: Member inserted images -> 72h temporary cloud copy",
  has(terms, "クラウドへ一時保存される画像コピーには72時間の保存期限があります")
);
check(
  "7e. terms: backup recommendation",
  has(terms, "大切な作品・元画像は、利用者自身でも必ず保管してください")
);
check("7f. terms: inquiry form link present", (terms ?? "").includes("INQUIRY_FORM_URL") || (terms ?? "").includes(FORM_URL));

/* ---------------- help navigation (TSP-LOOP-009 nav delta) ---------------- */

// the specific <button> element whose body contains the 使い方を見る label
const useGuideBtn = (() => {
  const src = home ?? "";
  const label = src.indexOf(">使い方を見る<");
  if (label < 0) return "";
  const open = src.lastIndexOf("<button", label);
  const close = src.indexOf("</button>", label);
  return open >= 0 && close >= 0 ? src.slice(open, close + 9) : "";
})();

check(
  "9a. home '使い方を見る' card is enabled — no `disabled`, no 準備中, no forced opacity dimming",
  useGuideBtn.length > 0 &&
    !/\bdisabled\b/.test(useGuideBtn) &&
    !/使い方導線は準備中です|準備中/.test(useGuideBtn) &&
    !/\bopacity-50\b/.test(useGuideBtn.replace(/disabled:opacity-\d+/g, ""))
);
check(
  "9b. card opens the existing HelpModal (same guide as the header ？), not a new page",
  /import HelpModal from "@\/components\/HelpModal"/.test(home ?? "") &&
    /onClick=\{\(\) => setIsHelpOpen\(true\)\}/.test(useGuideBtn) &&
    /\{isHelpOpen && <HelpModal onClose=\{\(\) => setIsHelpOpen\(false\)\} \/>\}/.test(home ?? "")
);
check(
  "9c. no new /guide route added",
  !fs.existsSync(path.join(repoRoot, "src/app/guide"))
);
check(
  "9d. help content not duplicated in page.tsx (no inline help.md fetch, no markdown renderer)",
  (() => {
    const noComments = (home ?? "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
    return !/\/docs\/help\.md/.test(noComments) && !/ReactMarkdown|react-markdown/.test(noComments);
  })()
);

/* ---------------- no invented legal facts / no dev leakage ---------------- */

check(
  "8a. no invented legal entity / address / phone / representative / court",
  !/株式会社|合同会社|有限会社|代表取締役|所在地|〒\d|TEL[:：]|電話番号|管轄裁判所|準拠法/.test(`${privacy}${terms}`)
);
check(
  "8b. no QA / dev-fixture content in the legal pages",
  !/bookshelf-qa|qa_fixture|fakeProject|qa6_missing|qa7_missing|console\.log/.test(`${privacy}${terms}${legalShell}`)
);

/* ---------------- done ---------------- */

console.log("");
if (failures === 0) {
  console.log("All release-legal checks passed.");
} else {
  console.log(`${failures} release-legal check(s) FAILED.`);
  process.exit(1);
}
