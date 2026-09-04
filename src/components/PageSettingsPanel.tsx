"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import {
  computePageLayout,
  updatePageOverrides,
  type ColumnCount,
  type HashiraPosition,
  type MasterPageSettings,
  type NombrePosition,
  type PageLayout,
  type PageSettings,
  type PaperSizeKey,
  recommendedNombreFontSizePt,
  resolvePaperSize,
} from "@/lib/pageLayout";
import { PAPER_SIZE_TEMPLATES } from "@/constants/paperSizes";
import { FONT_FAMILY_OPTIONS, NOMBRE_FONT_SAME_AS_BODY } from "@/constants/fonts";
import { calculateCapacityFromMargins, calculateCustomLayout } from "@/utils/layoutCalculator";

interface PageSettingsPanelProps {
  settings: PageSettings;
  layout: PageLayout;
  onChange: (next: PageSettings) => void;
  plotNote: string;
  onPlotNoteChange: (plotNote: string) => void;
  onOpenHelp: () => void;
  /** 1-based printed page numbers currently selected in the preview. */
  selectedPageNumbers: number[];
  /**
   * TSP-LOOP-022: rendered as the phone's dedicated 設定 workspace (not the
   * collapsible strip that sits above the desktop editor). In that mode the
   * panel opens on its first tab by default — the whole surface exists to
   * show settings, so the "collapse on narrow viewports" behaviour that made
   * sense for the inline strip is skipped.
   */
  mobileSurface?: boolean;
}

type SettingsTab = "page" | "master" | "plot";

// layoutMode === "margin"（余白から設定する）のとき、これらのフィールドが
// 変更されたら天地・ノド・小口余白から charsPerLine / linesPerColumn を
// 逆算して settings に反映する。
const MARGIN_MODE_TRIGGER_KEYS = new Set<keyof PageSettings>([
  "marginTop",
  "marginBottom",
  "marginGutter",
  "marginOuter",
  "fontSizePt",
]);

// layoutMode === "capacity"（文字数・行数から設定する）のとき、これらの
// フィールドが変更されたら1行の文字数・1段の行数から小口余白
// （marginOuter）を逆算して settings に反映する。
const CAPACITY_MODE_TRIGGER_KEYS = new Set<keyof PageSettings>([
  "charsPerLine",
  "linesPerColumn",
  "fontSizePt",
  "marginTop",
  "marginBottom",
  "marginGutter",
]);

// 数値1文字ぶんの入力途中（"4" → "42" の途中で "" や "4" を経由する等）で
// geometry/pagination の再計算が走ってUIが固まるのを防ぐため、これらの
// フィールドは「入力中のdraft文字列」として保持し、「設定を反映」操作で
// まとめて validate した上で一括コミットする。用紙サイズpresetの切り替えや
// layoutMode切り替えは（この一覧に関わらず）従来どおり即時反映のまま。
const DRAFT_FIELD_KEYS = [
  "marginTop",
  "marginBottom",
  "marginGutter",
  "marginOuter",
  "fontSizePt",
  "lineHeightRatio",
  "columnGapMm",
  "charsPerLine",
  "linesPerColumn",
] as const;

type DraftFieldKey = (typeof DRAFT_FIELD_KEYS)[number];
type DraftValues = Record<DraftFieldKey, string>;

const toDraftValues = (settings: PageSettings): DraftValues =>
  Object.fromEntries(DRAFT_FIELD_KEYS.map((key) => [key, String(settings[key])])) as DraftValues;

/**
 * TSP-LOOP-029 issue C: 1行の文字数 / 1段の行数 are TARGET values — the physical
 *版面 (paper − 余白, at the chosen font / line-height) may hold fewer, and
 * `computePageLayout` clamps them. The panel must show that clamped EFFECTIVE
 * value so it never disagrees with the Preview status / pagination / export
 * ("40字×17行 と表示しているのに実際は 39字×15行 で組む" was the bug).
 */
const effectiveGrid = (settings: PageSettings, layout: PageLayout): PageSettings => ({
  ...settings,
  charsPerLine: layout.charsPerLine,
  linesPerColumn: layout.linesPerColumn,
});

// 用紙サイズ・段数（1段/2段）の組み合わせごとの版面パラメータ一式を
// PAPER_SIZE_TEMPLATES の cols1/cols2 から取り出して settings に反映する。
// これらの値（marginTop/Bottom/Gutter/Outer=mm, fontSizePt=pt）は用紙が
// isPx（Web閲覧用など）かどうかに関わらず常にcanonicalなmm/ptとして
// そのまま settings に渡す——px→mm/pt変換が必要なのは用紙の外形
// （width/height）だけで、それは pageLayout.ts の resolvePaperSize() 側で
// 行われる。ここで変換すると computePageLayout() 側の変換と重複する。
const applyPaperTemplate = (
  base: PageSettings,
  paperSize: PaperSizeKey,
  columnCount: ColumnCount
): PageSettings => {
  const template = PAPER_SIZE_TEMPLATES[paperSize];
  const profile = columnCount === 2 ? template.cols2 : template.cols1;
  // TSP-LOOP-021 §7C: ノンブルの位置・地からの距離・文字サイズは、ユーザーが
  // まだ手動で触っていない（nombreLayoutCustomized !== true）ときだけ、切り
  // 替えた用紙 preset の推奨値へ追従させる。カスタム済みなら一切上書きしない。
  // 推奨サイズは preset ごとに固定値を持たず、その preset の本文フォント -3pt
  // （最小 6pt。TSP-LOOP-021 §4）を版面から導出する（§7B: 全 preset 同一座標に
  // しない）。
  // TSP-LOOP-022 HUMAN-QA: preset ごとに明示された nombreFontSize /
  // headerFontSize を優先し、無い preset は従来どおり本文 -3pt へフォールバック。
  const nombreOverrides: Partial<MasterPageSettings> = base.masterPage.nombreLayoutCustomized
    ? {}
    : {
        nombrePosition: profile.nombrePosition as NombrePosition,
        nombreBottomMargin: profile.nombreDistance,
        nombreFontSize:
          profile.nombreFontSize ?? recommendedNombreFontSizePt(profile.fontSizePt),
        ...(profile.headerFontSize != null
          ? { headerFontSize: profile.headerFontSize }
          : {}),
      };
  return {
    ...base,
    paperSize,
    columnCount,
    marginTop: profile.marginTop,
    marginBottom: profile.marginBottom,
    marginGutter: profile.marginGutter,
    marginOuter: profile.marginOuter,
    fontSizePt: profile.fontSizePt,
    lineHeightRatio: profile.lineSpacing,
    columnGapMm: profile.columnGap,
    charsPerLine: profile.charsPerLine,
    linesPerColumn: profile.linesPerColumn,
    masterPage: {
      ...base.masterPage,
      ...nombreOverrides,
    },
  };
};

// TSP-LOOP-021 §7C: これらのフィールドをユーザーが変更したら「ノンブル配置を
// カスタムした」とみなし、以後の用紙 preset 切り替えで上書きしないようにする。
const NOMBRE_LAYOUT_KEYS = new Set<keyof MasterPageSettings>([
  "nombrePosition",
  "nombreBottomMargin",
  "nombreFontSize",
  "nombreFontFamily",
  // TSP-LOOP-022 HUMAN-QA: 柱の文字サイズもここに含める——手動で触ったら以後の
  // 用紙 preset 切り替えで preset 値（Web閲覧用 20pt 等）に上書きさせない。
  "headerFontSize",
]);

export default function PageSettingsPanel({
  settings,
  layout,
  onChange,
  plotNote,
  onPlotNoteChange,
  onOpenHelp,
  selectedPageNumbers,
  mobileSurface = false,
}: PageSettingsPanelProps) {
  // SSR/CSR のハイドレーション不一致を避けるため、初期値はサーバーと
  // 同じ "page" に固定し、window/localStorage に依存する判定は
  // マウント後の useEffect 内でのみ行う。
  const [activeTab, setActiveTab] = useState<SettingsTab | null>("page");
  const [plotMode, setPlotMode] = useState<"edit" | "preview">("edit");

  useEffect(() => {
    // TSP-LOOP-022: the dedicated phone 設定 workspace keeps its default open
    // tab — it isn't a strip stacked above the manuscript any more.
    if (mobileSurface) return;
    // モバイル画面（768px未満）は過去の閲覧履歴に関わらず必ず閉じる
    if (window.innerWidth < 768) {
      setActiveTab(null);
      return;
    }
    const hasOpened = localStorage.getItem("tatespun_has_opened_settings");
    if (!hasOpened) {
      localStorage.setItem("tatespun_has_opened_settings", "true");
      return; // 初回はオープンのまま
    }
    setActiveTab(null); // 2回目以降は閉じる
  }, [mobileSurface]);

  const toggleTab = (tab: SettingsTab) => {
    setActiveTab((current) => (current === tab ? null : tab));
  };

  // layoutMode に応じて、片方のパラメータ変更からもう片方を自動逆算する。
  // - "margin": 天地・ノド・小口余白 → charsPerLine / linesPerColumn
  // - "capacity": charsPerLine / linesPerColumn → marginOuter（小口余白）
  //
  // 戻り値が null の場合は「capacity → margin の逆算が物理的に成立しない」
  // ことを意味し、呼び出し側は next の一部（marginOuterだけ等）を差し替えて
  // 適用してはいけない。marginだけ旧値・capacityだけ新値という自己矛盾した
  // settingsを作らないよう、変更全体を丸ごと不採用にする。
  const applyLayoutModeAdjustment = (
    next: PageSettings,
    changedKey: keyof PageSettings
  ): PageSettings | null => {
    if (next.layoutMode === "margin" && MARGIN_MODE_TRIGGER_KEYS.has(changedKey)) {
      const { charsPerLine, linesPerColumn } = calculateCapacityFromMargins({
        paperSize: next.paperSize,
        marginTop: next.marginTop,
        marginBottom: next.marginBottom,
        marginGutter: next.marginGutter,
        marginOuter: next.marginOuter,
        fontSizePt: next.fontSizePt,
        lineHeightRatio: next.lineHeightRatio,
        columnCount: next.columnCount,
        columnGapMm: next.columnGapMm,
      });
      return { ...next, charsPerLine, linesPerColumn };
    }
    if (next.layoutMode === "capacity" && CAPACITY_MODE_TRIGGER_KEYS.has(changedKey)) {
      const paper = resolvePaperSize(next.paperSize);
      const { marginEdge, textAreaWidthMm } = calculateCustomLayout({
        paperWidth: paper.widthMm,
        marginGutter: next.marginGutter,
        fontSizePt: next.fontSizePt,
        lineHeightRatio: next.lineHeightRatio,
        linesPerColumn: next.linesPerColumn,
        columnsPerPage: next.columnCount,
        columnGapMm: next.columnGapMm,
      });
      // Invariant, two failure modes:
      // 1. `paper.widthMm - marginGutter - textAreaWidthMm < 0` — the
      //    requested linesPerColumn needs a column wider than the paper
      //    itself has room for at all (e.g. linesPerColumn=500 at a normal
      //    font size). calculateCustomLayout's own `Math.max(0, …)` clamps
      //    this to marginEdge=0 internally, which — checked in isolation —
      //    looks like a perfectly ordinary "zero margin" result instead of
      //    the physically-impossible target it actually is, so this must be
      //    detected here from the *unclamped* quantities, not from marginEdge.
      // 2. An outer margin wider than the text column it borders is never a
      //    well-formed page (the "frame" bigger than the "picture") — e.g. a
      //    linesPerColumn target far narrower than what marginGutter/
      //    marginOuter would otherwise allow on that paper's width.
      // Either way, returning null here (rather than silently keeping the
      // old marginOuter while still applying the new charsPerLine/
      // linesPerColumn in `next`) lets the caller reject the *entire*
      // candidate settings object, so margin and capacity never end up
      // describing two different, inconsistent page layouts at once.
      const fitsOnPaper = paper.widthMm - next.marginGutter - textAreaWidthMm >= 0;
      if (!fitsOnPaper || marginEdge > textAreaWidthMm) {
        return null;
      }
      return { ...next, marginOuter: marginEdge };
    }
    return next;
  };

  const update = <K extends keyof PageSettings>(key: K, value: PageSettings[K]) => {
    const next = applyLayoutModeAdjustment({ ...settings, [key]: value }, key);
    if (next) onChange(next);
  };

  // 用紙サイズpreset・段数の切り替え直後は、テンプレートが持つ暫定
  // charsPerLine/linesPerColumn をそのまま signal of truth として使わず、
  // 常にそのテンプレートのmargin/fontから改めて算出し直す（現在の
  // layoutModeが margin/capacity のどちらであっても関係なく）。これにより
  // 「marginOuter=15と表示されているのにcharsPerLine/linesPerColumnはそれと
  // 無関係な旧値のまま」という不整合が、preset適用の入り口で発生しなくなる。
  const deriveCapacityFromCurrentMargins = (base: PageSettings): PageSettings => {
    const { charsPerLine, linesPerColumn } = calculateCapacityFromMargins({
      paperSize: base.paperSize,
      marginTop: base.marginTop,
      marginBottom: base.marginBottom,
      marginGutter: base.marginGutter,
      marginOuter: base.marginOuter,
      fontSizePt: base.fontSizePt,
      lineHeightRatio: base.lineHeightRatio,
      columnCount: base.columnCount,
      columnGapMm: base.columnGapMm,
    });
    return { ...base, charsPerLine, linesPerColumn };
  };

  // DRAFT_FIELD_KEYS の入力途中文字列。キー入力のたびに settings へ反映して
  // computePageLayout/paginateTokens を毎回再計算させると、値によっては
  // プレビュー全体が固まる（UXとして危険）ため、ここではdraftだけを更新し、
  // 「設定を反映」（またはEnter）を押した時に限り一括で settings へコミットする。
  // TSP-LOOP-029 issue C: seed / sync the draft from the EFFECTIVE grid so the
  // input never shows a target (40) the 版面 can't hold while Preview shows 39.
  const displaySettings = effectiveGrid(settings, layout);
  const [draft, setDraft] = useState<DraftValues>(() => toDraftValues(displaySettings));
  const [commitError, setCommitError] = useState<string | null>(null);
  const [commitNote, setCommitNote] = useState<string | null>(null);

  // settings側のこれらのフィールドが実際に変わった時だけ（用紙サイズpreset
  // 適用・段数変更・このパネル自身のコミット成功時など）draftを追従させる。
  // settings全体を依存にすると、他パネル発の無関係な変更（例:
  // PreviewPaneのノンブル非表示チェック）のたびに入力中のdraftが上書きされてしまう。
  useEffect(() => {
    setDraft(toDraftValues(effectiveGrid(settings, layout)));
    setCommitError(null);
    setCommitNote(null);
  }, [
    settings.marginTop,
    settings.marginBottom,
    settings.marginGutter,
    settings.marginOuter,
    settings.fontSizePt,
    settings.lineHeightRatio,
    settings.columnGapMm,
    settings.charsPerLine,
    settings.linesPerColumn,
    // effective values can move without a settings change (font/margin edits),
    // so keep the input in sync with what Preview actually composes.
    layout.charsPerLine,
    layout.linesPerColumn,
  ]);

  const setDraftField = (key: DraftFieldKey, raw: string) => {
    setDraft((prev) => ({ ...prev, [key]: raw }));
    setCommitError(null);
    setCommitNote(null);
  };

  const isDraftDirty = DRAFT_FIELD_KEYS.some(
    (key) => draft[key] !== String(displaySettings[key]),
  );

  const commitDraft = () => {
    const parsed = {} as Record<DraftFieldKey, number>;
    for (const key of DRAFT_FIELD_KEYS) {
      const raw = draft[key].trim();
      if (raw === "") {
        setCommitError("すべての項目を入力してください。");
        return;
      }
      const num = Number(raw);
      if (!Number.isFinite(num)) {
        setCommitError("数値として認識できない値があります。");
        return;
      }
      parsed[key] = num;
    }

    if (
      parsed.marginTop < 0 ||
      parsed.marginBottom < 0 ||
      parsed.marginGutter < 0 ||
      parsed.marginOuter < 0
    ) {
      setCommitError("余白は0以上の値を指定してください。");
      return;
    }
    if (parsed.fontSizePt <= 0) {
      setCommitError("フォントサイズは0より大きい値を指定してください。");
      return;
    }
    if (parsed.lineHeightRatio <= 0) {
      setCommitError("行間倍率は0より大きい値を指定してください。");
      return;
    }
    if (parsed.columnGapMm < 0) {
      setCommitError("段間は0以上の値を指定してください。");
      return;
    }
    if (parsed.charsPerLine < 0 || parsed.linesPerColumn < 0) {
      setCommitError("1行の文字数・1段の行数は0以上の値を指定してください。");
      return;
    }

    const rawCandidate: PageSettings = {
      ...settings,
      marginTop: parsed.marginTop,
      marginBottom: parsed.marginBottom,
      marginGutter: parsed.marginGutter,
      marginOuter: parsed.marginOuter,
      fontSizePt: parsed.fontSizePt,
      lineHeightRatio: parsed.lineHeightRatio,
      columnGapMm: parsed.columnGapMm,
      charsPerLine: parsed.charsPerLine,
      linesPerColumn: parsed.linesPerColumn,
    };
    // "marginTop" は MARGIN_MODE_TRIGGER_KEYS / CAPACITY_MODE_TRIGGER_KEYS の
    // 両方に含まれるため、現在の layoutMode に対応する方の逆算だけが働く。
    const candidate = applyLayoutModeAdjustment(rawCandidate, "marginTop");
    if (!candidate) {
      // capacity → margin の逆算が成立しない（小口が本文領域より広くなる
      // 等）。marginだけ前回値・capacityだけ入力値、という自己矛盾した
      // settingsを絶対に作らないため、変更全体を丸ごと不採用にし、
      // 直前の正常な settings をそのまま維持する。
      setCommitError(
        "指定した文字数・行数では、現在の余白に収まる版面になりません。値を見直してください。"
      );
      return;
    }

    const candidateLayout = computePageLayout(candidate);
    if (
      candidateLayout.textAreaWidthMm <= 0 ||
      candidateLayout.textAreaHeightMm <= 0 ||
      candidateLayout.charsPerLine < 1 ||
      candidateLayout.linesPerColumn < 1
    ) {
      setCommitError("この設定では本文領域を確保できません。値を見直してください。");
      return;
    }

    // TSP-LOOP-029 issue C: store the EFFECTIVE grid (what pagination / Preview /
    // export actually use), never a target the 版面 can't hold. Tell the user
    // when their value was adjusted, and by what.
    const committed: PageSettings = {
      ...candidate,
      charsPerLine: candidateLayout.charsPerLine,
      linesPerColumn: candidateLayout.linesPerColumn,
    };
    const charsClamped = candidate.charsPerLine > candidateLayout.charsPerLine;
    const linesClamped = candidate.linesPerColumn > candidateLayout.linesPerColumn;
    setCommitError(null);
    setCommitNote(
      charsClamped || linesClamped
        ? "この余白・文字サイズでは、" +
            (charsClamped ? `1行 最大 ${candidateLayout.charsPerLine} 字` : "") +
            (charsClamped && linesClamped ? "・" : "") +
            (linesClamped ? `1段 最大 ${candidateLayout.linesPerColumn} 行` : "") +
            " です。入力値を自動調整しました。"
        : null,
    );
    onChange(committed);
  };

  const handleDraftKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    commitDraft();
  };

  const handleLayoutModeChange = (mode: PageSettings["layoutMode"]) => {
    onChange({ ...settings, layoutMode: mode });
  };

  const updateMasterPage = <K extends keyof MasterPageSettings>(
    key: K,
    value: MasterPageSettings[K]
  ) => {
    onChange({
      ...settings,
      masterPage: {
        ...settings.masterPage,
        [key]: value,
        // §7C: ノンブルの位置・距離・サイズ・書体を触ったら「カスタム済み」に
        // 印を付け、以後の用紙 preset 切り替えでユーザーの指定を保持する。
        ...(NOMBRE_LAYOUT_KEYS.has(key) ? { nombreLayoutCustomized: true } : {}),
      },
    });
  };

  const handlePaperSizeChange = (key: PaperSizeKey) => {
    const next = applyPaperTemplate(settings, key, settings.columnCount);
    onChange(deriveCapacityFromCurrentMargins(next));
  };

  const handleColumnCountChange = (count: ColumnCount) => {
    const next = applyPaperTemplate(settings, settings.paperSize, count);
    onChange(deriveCapacityFromCurrentMargins(next));
  };

  const handleHideNombreOnFirstPageChange = (checked: boolean) => {
    onChange({
      ...settings,
      masterPage: {
        ...settings.masterPage,
        hideNombreOnFirstPage: checked,
        // チェックが入れられたら「隠しノンブル」も自動で有効化する
        showHiddenNombre: checked ? true : settings.masterPage.showHiddenNombre,
      },
    });
  };

  // 選択ページの柱テキスト入力欄。「入力して適用すると選択ページすべてを
  // 上書き」という仕様のため、settingsの既存値をここへ書き戻すことはしない
  // ——さもないと画面を開いただけで（あるいは選択を切り替えただけで）既存の
  // 個別指定を上書きしてしまいかねない。選択が変わるたびに空へリセットする
  // ことで、直前の選択向けに書いたdraftを別ページへ誤爆させないようにする。
  const [hashiraDraft, setHashiraDraft] = useState("");
  const selectedPageKey = selectedPageNumbers.join(",");
  // 選択の変化をレンダー中に検知して同期リセットする（React公式が推奨する
  // 「レンダー中にstateを調整する」パターン）。useEffectで行うと余分な
  // 再レンダーを1回挟むため、react-hooks/set-state-in-effect が指摘する
  // アンチパターンを避けてここで直接行う。
  const [prevSelectedPageKey, setPrevSelectedPageKey] = useState(selectedPageKey);
  if (selectedPageKey !== prevSelectedPageKey) {
    setPrevSelectedPageKey(selectedPageKey);
    setHashiraDraft("");
  }

  const hasSelection = selectedPageNumbers.length > 0;

  const handleApplyHashiraOverride = () => {
    if (!hasSelection) return;
    onChange({
      ...settings,
      pageOverrides: updatePageOverrides(settings.pageOverrides, selectedPageNumbers, (prev) => ({
        ...prev,
        hashiraOverride: hashiraDraft,
      })),
    });
  };

  const handleClearHashiraOverride = () => {
    if (!hasSelection) return;
    onChange({
      ...settings,
      pageOverrides: updatePageOverrides(settings.pageOverrides, selectedPageNumbers, (prev) => {
        const rest = { ...prev };
        delete rest.hashiraOverride;
        return rest;
      }),
    });
    setHashiraDraft("");
  };

  // 選択ページ全部で一致している場合だけチェック済みにする（一部だけON等の
  // 混在状態は「未チェック」として扱う——複数選択時のmixed stateを厳密な
  // tri-state表示にはせず、誤って「全ページON」と読める表示を避ける簡易化）。
  const selectedAllHideNombre =
    hasSelection && selectedPageNumbers.every((n) => Boolean(settings.pageOverrides[n]?.hideNombre));
  const selectedAllHideHashira =
    hasSelection && selectedPageNumbers.every((n) => Boolean(settings.pageOverrides[n]?.hideHashira));

  const handleToggleSelectedHideNombre = (checked: boolean) => {
    if (!hasSelection) return;
    onChange({
      ...settings,
      pageOverrides: updatePageOverrides(settings.pageOverrides, selectedPageNumbers, (prev) => ({
        ...prev,
        hideNombre: checked,
      })),
    });
  };

  const handleToggleSelectedHideHashira = (checked: boolean) => {
    if (!hasSelection) return;
    onChange({
      ...settings,
      pageOverrides: updatePageOverrides(settings.pageOverrides, selectedPageNumbers, (prev) => ({
        ...prev,
        hideHashira: checked,
      })),
    });
  };

  return (
    <div className="border-b border-ink/10">
      <div className="grid grid-cols-4">
        <button
          type="button"
          data-demo-target="page-settings"
          onClick={() => toggleTab("page")}
          className={`cursor-pointer select-none border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "page"
              ? "border-accent bg-ink/5 text-ink"
              : "border-transparent text-ink/60 hover:bg-ink/5"
          }`}
        >
          {activeTab === "page" ? "▼" : "▶"} ページ設定
        </button>
        <button
          type="button"
          data-demo-target="nombre-settings"
          onClick={() => toggleTab("master")}
          className={`cursor-pointer select-none border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "master"
              ? "border-accent bg-ink/5 text-ink"
              : "border-transparent text-ink/60 hover:bg-ink/5"
          }`}
        >
          {activeTab === "master" ? "▼" : "▶"} ノンブル・柱
        </button>
        <button
          type="button"
          onClick={() => toggleTab("plot")}
          className={`cursor-pointer select-none border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "plot"
              ? "border-accent bg-ink/5 text-ink"
              : "border-transparent text-ink/60 hover:bg-ink/5"
          }`}
        >
          {activeTab === "plot" ? "▼" : "▶"} メモ
        </button>
        <button
          type="button"
          onClick={onOpenHelp}
          className="m-1 cursor-pointer whitespace-nowrap rounded-md border border-ink/15 bg-ink/5 px-2 py-1 text-sm font-medium text-ink/70 transition-colors hover:bg-ink/10 hover:text-ink sm:px-3"
          aria-label="使い方ガイドを開く"
          title="使い方ガイドを開く"
        >
          ヘルプ
        </button>
      </div>

      {activeTab === "page" && (
        <div className="w-full">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 pb-4 pt-3 sm:grid-cols-4">
        <label className="col-span-2 flex flex-col gap-1 sm:col-span-4">
          <span className="text-xs text-ink/60">用紙サイズ</span>
          <select
            value={settings.paperSize}
            onChange={(e) => handlePaperSizeChange(e.target.value as PaperSizeKey)}
            className="rounded border border-ink/20 bg-base px-2 py-1.5 text-sm text-ink"
          >
            {Object.entries(PAPER_SIZE_TEMPLATES).map(([key, size]) => (
              <option key={key} value={key}>
                {size.name}（{size.width}×{size.height}{size.isPx ? "px" : "mm"}）
              </option>
            ))}
          </select>
        </label>

        <div className="col-span-2 flex flex-wrap items-center justify-between gap-2 sm:col-span-4">
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => handleLayoutModeChange("margin")}
              className={`cursor-pointer select-none rounded px-3 py-1 text-xs font-medium transition-colors ${
                settings.layoutMode === "margin"
                  ? "bg-accent text-paper-ink"
                  : "bg-ink/10 text-ink/60 hover:bg-ink/15"
              }`}
            >
              余白から設定する
            </button>
            <button
              type="button"
              onClick={() => handleLayoutModeChange("capacity")}
              className={`cursor-pointer select-none rounded px-3 py-1 text-xs font-medium transition-colors ${
                settings.layoutMode === "capacity"
                  ? "bg-accent text-paper-ink"
                  : "bg-ink/10 text-ink/60 hover:bg-ink/15"
              }`}
            >
              文字数・行数から設定する
            </button>
          </div>

          <div className="ml-auto flex items-center gap-1.5 text-xs font-semibold">
            {settings.columnCount === 2 && (
              <span className="inline-flex items-center rounded-full bg-accent px-2.5 py-0.5 text-paper-ink">
                {layout.charsPerColumn}字
                <span className="ml-1 text-[10px] font-normal opacity-80">1段の文字数</span>
              </span>
            )}
            <span className="inline-flex items-center rounded-full bg-accent px-2.5 py-0.5 text-paper-ink">
              {layout.charsPerPage}字
              <span className="ml-1 text-[10px] font-normal opacity-80">1ページの文字数</span>
            </span>
          </div>
        </div>

        <MarginField
          label="天（上）"
          value={draft.marginTop}
          onChange={(v) => setDraftField("marginTop", v)}
          onKeyDown={handleDraftKeyDown}
        />
        <MarginField
          label="地（下）"
          value={draft.marginBottom}
          onChange={(v) => setDraftField("marginBottom", v)}
          onKeyDown={handleDraftKeyDown}
        />
        <MarginField
          label="ノド（閉じ側）"
          value={draft.marginGutter}
          onChange={(v) => setDraftField("marginGutter", v)}
          onKeyDown={handleDraftKeyDown}
        />
        <MarginField
          label="小口（外側）"
          value={draft.marginOuter}
          onChange={(v) => setDraftField("marginOuter", v)}
          onKeyDown={handleDraftKeyDown}
          disabled={settings.layoutMode === "capacity"}
        />

        <label className="flex flex-col gap-1">
          <span className="text-xs text-ink/60">フォント</span>
          <select
            value={settings.fontFamily}
            onChange={(e) => update("fontFamily", e.target.value)}
            className="rounded border border-ink/20 bg-base px-2 py-1.5 text-sm text-ink"
          >
            {FONT_FAMILY_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-ink/60">
            フォントサイズ（pt）
          </span>
          <input
            type="number"
            min={4}
            max={36}
            step={0.5}
            value={draft.fontSizePt}
            onChange={(e) => setDraftField("fontSizePt", e.target.value)}
            onKeyDown={handleDraftKeyDown}
            className="rounded border border-ink/20 bg-base px-2 py-1.5 text-sm text-ink"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-ink/60">行間倍率</span>
          <input
            type="number"
            min={1}
            max={3}
            step={0.1}
            value={draft.lineHeightRatio}
            onChange={(e) => setDraftField("lineHeightRatio", e.target.value)}
            onKeyDown={handleDraftKeyDown}
            className="rounded border border-ink/20 bg-base px-2 py-1.5 text-sm text-ink"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-ink/60">段数</span>
          <select
            value={settings.columnCount}
            onChange={(e) =>
              handleColumnCountChange(Number(e.target.value) as ColumnCount)
            }
            className="rounded border border-ink/20 bg-base px-2 py-1.5 text-sm text-ink"
          >
            <option value={1}>1段</option>
            <option value={2}>2段</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-ink/60">段間 mm</span>
          <input
            type="number"
            min={0}
            max={60}
            step={0.5}
            value={draft.columnGapMm}
            disabled={settings.columnCount === 1}
            onChange={(e) => setDraftField("columnGapMm", e.target.value)}
            onKeyDown={handleDraftKeyDown}
            className="rounded border border-ink/20 bg-base px-2 py-1.5 text-sm text-ink disabled:opacity-40"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-ink/60">1行の文字数</span>
          <input
            type="number"
            min={10}
            max={60}
            value={draft.charsPerLine}
            disabled={settings.layoutMode === "margin"}
            onChange={(e) => setDraftField("charsPerLine", e.target.value)}
            onKeyDown={handleDraftKeyDown}
            className="rounded border border-ink/20 bg-base px-2 py-1.5 text-sm text-ink disabled:opacity-40"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-ink/60">1段の行数</span>
          <input
            type="number"
            min={5}
            max={40}
            value={draft.linesPerColumn}
            disabled={settings.layoutMode === "margin"}
            onChange={(e) => setDraftField("linesPerColumn", e.target.value)}
            onKeyDown={handleDraftKeyDown}
            className="rounded border border-ink/20 bg-base px-2 py-1.5 text-sm text-ink disabled:opacity-40"
          />
        </label>

        {/* grid-cols-4 上で「段間mm・1行の文字数・1段の行数」が3枠を占め、
            このセルが同じ行の空いた4枠目へ自然に収まる（col-spanなし）。 */}
        <div className="flex flex-col justify-end gap-1">
          <button
            type="button"
            onClick={commitDraft}
            className="cursor-pointer select-none rounded bg-accent px-3 py-1.5 text-xs font-medium text-paper-ink hover:opacity-90"
          >
            設定を反映
          </button>
          {commitError ? (
            <span className="text-xs text-red-600">{commitError}</span>
          ) : commitNote ? (
            <span className="text-xs text-ink/60">{commitNote}</span>
          ) : isDraftDirty ? (
            <span className="text-xs text-ink/50">未反映の変更があります</span>
          ) : null}
        </div>
      </div>
        </div>
      )}

      {activeTab === "master" && (
        <div className="w-full">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 pb-4 pt-1 sm:grid-cols-4">
        <div className="col-span-2 flex flex-wrap items-end gap-3 sm:col-span-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-ink/60">ノンブル表示位置</span>
            <select
              value={settings.masterPage.nombrePosition}
              onChange={(e) =>
                updateMasterPage("nombrePosition", e.target.value as NombrePosition)
              }
              className="rounded border border-ink/20 bg-base px-2 py-1.5 text-sm text-ink"
            >
              <option value="center">中央</option>
              <option value="gutter">ノド（綴じ側）</option>
              <option value="outer">小口（外側）</option>
              <option value="hidden">非表示</option>
            </select>
          </label>

          <label className="flex w-auto max-w-fit flex-none flex-col gap-1">
            <span className="text-xs text-ink/60">開始ページ番号</span>
            <input
              type="number"
              min={1}
              step={1}
              value={settings.masterPage.nombreStart}
              onChange={(e) =>
                updateMasterPage("nombreStart", Number(e.target.value))
              }
              className="w-20 max-w-[80px] flex-none rounded border border-ink/20 bg-base px-2 py-1.5 text-sm text-ink"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-ink/60 whitespace-nowrap">ノンブル: 地からの距離 mm</span>
            <input
              type="number"
              min={0}
              max={60}
              step={0.5}
              value={settings.masterPage.nombreBottomMargin}
              onChange={(e) =>
                updateMasterPage("nombreBottomMargin", Number(e.target.value))
              }
              className="rounded border border-ink/20 bg-base px-2 py-1.5 text-sm text-ink"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-ink/60">ノンブルの文字サイズ (pt)</span>
            <input
              type="number"
              min={5}
              max={24}
              value={settings.masterPage.nombreFontSize ?? 8}
              onChange={(e) =>
                updateMasterPage("nombreFontSize", Number(e.target.value))
              }
              className="rounded border border-ink/20 bg-base px-2 py-1.5 text-sm text-ink"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-ink/60">ノンブルのフォント</span>
            <select
              value={settings.masterPage.nombreFontFamily ?? NOMBRE_FONT_SAME_AS_BODY}
              onChange={(e) => updateMasterPage("nombreFontFamily", e.target.value)}
              className="rounded border border-ink/20 bg-base px-2 py-1.5 text-sm text-ink"
            >
              <option value={NOMBRE_FONT_SAME_AS_BODY}>本文と同じ</option>
              {FONT_FAMILY_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="col-span-2 flex items-center gap-2 sm:col-span-2 sm:self-end sm:pb-1.5">
          <input
            type="checkbox"
            checked={settings.masterPage.hideNombreOnFirstPage}
            onChange={(e) =>
              handleHideNombreOnFirstPageChange(e.target.checked)
            }
            className="h-4 w-4 rounded border-ink/30"
          />
          <span className="text-xs text-ink/60">
            チェックしたページのノンブルを非表示
          </span>
        </label>

        <label className="col-span-2 flex items-center gap-2 sm:col-span-2 sm:self-end sm:pb-1.5">
          <input
            type="checkbox"
            checked={settings.masterPage.showHiddenNombre}
            onChange={(e) =>
              updateMasterPage("showHiddenNombre", e.target.checked)
            }
            className="h-4 w-4 rounded border-ink/30"
          />
          <span className="text-xs text-ink/60">隠しノンブル</span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-ink/60">奇数ページ柱</span>
          <input
            type="text"
            placeholder="例: 作品名"
            value={settings.masterPage.hashiraOdd}
            onChange={(e) => updateMasterPage("hashiraOdd", e.target.value)}
            className="rounded border border-ink/20 bg-base px-2 py-1.5 text-sm text-ink"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-ink/60">偶数ページ柱</span>
          <input
            type="text"
            placeholder="例: 章名"
            value={settings.masterPage.hashiraEven}
            onChange={(e) => updateMasterPage("hashiraEven", e.target.value)}
            className="rounded border border-ink/20 bg-base px-2 py-1.5 text-sm text-ink"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-ink/60">柱表示位置</span>
          <select
            value={settings.masterPage.hashiraPosition}
            onChange={(e) =>
              updateMasterPage("hashiraPosition", e.target.value as HashiraPosition)
            }
            className="rounded border border-ink/20 bg-base px-2 py-1.5 text-sm text-ink"
          >
            <option value="top">天側（上部）</option>
            <option value="bottom">地側（下部）</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-ink/60">柱の文字サイズ (pt)</span>
          <input
            type="number"
            min={5}
            max={24}
            value={settings.masterPage.headerFontSize ?? 8}
            onChange={(e) =>
              updateMasterPage("headerFontSize", Number(e.target.value))
            }
            className="rounded border border-ink/20 bg-base px-2 py-1.5 text-sm text-ink"
          />
        </label>

        <div className="col-span-2 rounded-md border border-ink/15 p-3 sm:col-span-4">
          <p className="mb-2 text-xs font-semibold text-ink/70">選択ページ</p>
          {!hasSelection ? (
            <p className="text-xs text-ink/50">
              プレビューでページを選択すると、そのページだけ柱やノンブル表示を変更できます。
            </p>
          ) : (
            <>
              <p className="mb-2 text-xs text-ink/50">
                {selectedPageNumbers.length}ページ選択中（{selectedPageNumbers.join("、")}ページ目）
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-ink/60">選択ページの柱</span>
                  <input
                    type="text"
                    value={hashiraDraft}
                    onChange={(e) => setHashiraDraft(e.target.value)}
                    placeholder="入力して「適用」を押すと選択ページを上書き"
                    className="w-56 rounded border border-ink/20 bg-base px-2 py-1.5 text-sm text-ink"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleApplyHashiraOverride}
                  className="cursor-pointer select-none rounded bg-accent px-3 py-1.5 text-xs font-medium text-paper-ink hover:opacity-90"
                >
                  選択ページに適用
                </button>
                <button
                  type="button"
                  onClick={handleClearHashiraOverride}
                  className="cursor-pointer select-none rounded border border-ink/20 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/5"
                >
                  個別指定を解除
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-4">
                <label className="flex cursor-pointer items-center gap-2 text-xs text-ink/60">
                  <input
                    type="checkbox"
                    checked={selectedAllHideNombre}
                    onChange={(e) => handleToggleSelectedHideNombre(e.target.checked)}
                    className="h-4 w-4 rounded border-ink/30"
                  />
                  ノンブル非表示
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-ink/60">
                  <input
                    type="checkbox"
                    checked={selectedAllHideHashira}
                    onChange={(e) => handleToggleSelectedHideHashira(e.target.checked)}
                    className="h-4 w-4 rounded border-ink/30"
                  />
                  柱非表示
                </label>
              </div>
            </>
          )}
        </div>
          </div>
        </div>
      )}

      {activeTab === "plot" && (
        <div className="w-full">
          <div className="flex items-center justify-end gap-1 px-4 pb-2 pt-1">
            <button
              type="button"
              onClick={() => setPlotMode("edit")}
              className={`cursor-pointer select-none rounded px-3 py-1 text-xs font-medium transition-colors ${
                plotMode === "edit"
                  ? "bg-accent text-paper-ink"
                  : "text-ink/60 hover:bg-ink/5"
              }`}
            >
              編集
            </button>
            <button
              type="button"
              onClick={() => setPlotMode("preview")}
              className={`cursor-pointer select-none rounded px-3 py-1 text-xs font-medium transition-colors ${
                plotMode === "preview"
                  ? "bg-accent text-paper-ink"
                  : "text-ink/60 hover:bg-ink/5"
              }`}
            >
              プレビュー
            </button>
          </div>

          <div className="px-4 pb-4">
            {plotMode === "edit" ? (
              <textarea
                value={plotNote}
                onChange={(e) => onPlotNoteChange(e.target.value)}
                placeholder="プロットや設定メモを入力してください&#10;&#10;# 見出し&#10;**太字** や *強調* 、- 箇条書きが使えます"
                spellCheck={false}
                className="h-64 w-full resize-y rounded border border-ink/20 bg-base p-2 font-mono text-sm leading-relaxed text-ink outline-none placeholder:text-ink/40"
              />
            ) : (
              <div className="h-64 overflow-y-auto rounded border border-ink/20 bg-base p-3">
                {plotNote.trim() === "" ? (
                  <p className="text-sm text-ink/40">メモはまだありません</p>
                ) : (
                  <MarkdownPreview text={plotNote} />
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const pattern = /(\*\*.+?\*\*|\*.+?\*)/g;
  let lastIndex = 0;
  let count = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("**")) {
      nodes.push(<strong key={`${keyPrefix}-${count++}`}>{token.slice(2, -2)}</strong>);
    } else {
      nodes.push(<em key={`${keyPrefix}-${count++}`}>{token.slice(1, -1)}</em>);
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function MarkdownPreview({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = (key: string) => {
    if (listItems.length > 0) {
      blocks.push(
        <ul key={key} className="list-disc space-y-1 pl-5">
          {listItems.map((item, idx) => (
            <li key={idx} className="text-sm leading-relaxed text-ink">
              {renderInline(item, `${key}-li-${idx}`)}
            </li>
          ))}
        </ul>
      );
      listItems = [];
    }
  };

  lines.forEach((line, idx) => {
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    const listMatch = /^[-*]\s+(.*)$/.exec(line);
    if (heading) {
      flushList(`list-${idx}`);
      const level = heading[1].length;
      const inline = renderInline(heading[2], `h-${idx}`);
      if (level === 1) {
        blocks.push(
          <h1 key={idx} className="mb-1 mt-3 text-lg font-bold text-ink first:mt-0">
            {inline}
          </h1>
        );
      } else if (level === 2) {
        blocks.push(
          <h2 key={idx} className="mb-1 mt-3 text-base font-bold text-ink first:mt-0">
            {inline}
          </h2>
        );
      } else {
        blocks.push(
          <h3 key={idx} className="mb-1 mt-2 text-sm font-bold text-ink first:mt-0">
            {inline}
          </h3>
        );
      }
    } else if (listMatch) {
      listItems.push(listMatch[1]);
    } else if (line.trim() === "") {
      flushList(`list-${idx}`);
      blocks.push(<div key={idx} className="h-2" />);
    } else {
      flushList(`list-${idx}`);
      blocks.push(
        <p key={idx} className="text-sm leading-relaxed text-ink">
          {renderInline(line, `p-${idx}`)}
        </p>
      );
    }
  });
  flushList("list-end");

  return <div className="space-y-0.5">{blocks}</div>;
}

function MarginField({
  label,
  value,
  onChange,
  onKeyDown,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-ink/60">{label} mm</span>
      <input
        type="number"
        min={0}
        max={60}
        step={0.5}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        className="rounded border border-ink/20 bg-base px-2 py-1.5 text-sm text-ink disabled:opacity-40"
      />
    </label>
  );
}
