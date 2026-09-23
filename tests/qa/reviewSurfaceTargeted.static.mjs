import fs from "node:fs";
const read=(p)=>fs.readFileSync(p,"utf8");
const surface=read("src/hooks/useReviewSurface.ts");
const hub=read("src/components/ReviewHub.tsx");
const editor=read("src/components/EditorPane.tsx");
const help=read("public/docs/help.md");
const checks=[
 ["mobile-only Review breakpoint", surface.includes('const MOBILE_REVIEW_QUERY = "(max-width: 767px)"') && !surface.includes("new ResizeObserver(")],
 ["Hub supports focused tool detail", hub.includes("focusToolId?: ReviewHubToolId | null") && hub.includes("visibleTools")],
 ["mobile full Hub is distinct", editor.includes("reviewHubFocusTool === null") && editor.includes("toggleReviewHubAll")],
 ["writing check targeted", editor.includes('openReviewTool("writing-check")')],
 ["work session targeted", editor.includes('openReviewTool("character-count")')],
 ["read aloud targeted while idle", editor.includes('openReviewTool("read-aloud")')],
 ["description targeted", editor.includes('openReviewTool("description-check")')],
 ["active read aloud directly controllable", editor.includes('readAloud.state.status !== "idle"') && editor.includes("<ReadAloudFooterControl")],
 ["desktop Preview Review Bar preserved", editor.includes("<DesktopReviewBar")],
 ["desktop full Hub clears focus", editor.includes("onToggleReviewHub={toggleReviewHubAll}")],
 ["desktop WorkSession targeted", editor.includes('workSessionPill={<WorkSessionFooterPill state={workSession} onOpen={() => openReviewTool("character-count")} />}')],
 ["Help documents mobile-specific placement", help.includes("PC・タブレットでは見直しバーはプレビュー下") || !help.includes("モバイルやコンパクト表示では")],
];
let failed=0; for(const [label,pass] of checks){console.log(`${pass?"[PASS]":"[FAIL]"} ${label}`); if(!pass)failed++;} if(failed)process.exit(1); console.log("[PASS] Review surface targeted retry static gate");
