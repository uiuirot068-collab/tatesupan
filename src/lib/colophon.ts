/**
 * TSP-LOOP-005 — 横書き専用「奥付ページ」のデータモデルと純粋ロジック。
 *
 * 奥付は本文文字列（`content`）へは一切挿入されない。本文とは完全に独立した
 * 1ページ（`writing-mode: horizontal-tb`）として、本文全ページの後ろに追加
 * される。ここでは React / DOM に依存しない型・既定値・正規化・項目操作
 * （追加/削除/並び替え/編集）だけを定義する。描画は
 * `src/components/ColophonPageCard.tsx`、UI は `PageSettingsPanel.tsx`。
 *
 * 重要な設計:
 *  - 表示ラベル(`label`)と内部ID(`id`)を分離する。ユーザーは「書名」→「作品名」
 *    のように label を自由に変更できるが、`id` は安定させる。テンプレートを
 *    切り替えても入力済みデータ（fields / freeText / font / order / visible）は
 *    失われない（4テンプレートは同一 ColophonSettings を描画するだけ）。
 *  - 旧ドキュメント（この機能が存在しなかった頃の保存データ）は
 *    `normalizeColophonSettings(undefined)` が既定値を返すため、そのまま
 *    正常に開ける。migration は増やさない（optional な default merge 方式）。
 */

export type ColophonTemplateId = "standard" | "center" | "minimal" | "classic";

export const COLOPHON_TEMPLATE_IDS: readonly ColophonTemplateId[] = [
  "standard",
  "center",
  "minimal",
  "classic",
] as const;

export const COLOPHON_TEMPLATE_LABELS: Record<ColophonTemplateId, string> = {
  standard: "標準",
  center: "中央",
  minimal: "ミニマル",
  classic: "クラシック",
};

/** 奥付フォント: 空文字は「本文と同じ」を意味する（既定）。 */
export const COLOPHON_FONT_SAME_AS_BODY = "";

export interface ColophonField {
  /** 内部ID。テンプレート変更・label 変更をまたいで安定させる。 */
  id: string;
  /** 表示ラベル。ユーザーが自由に変更できる（例: 「書名」→「作品名」）。 */
  label: string;
  /** 項目の値。 */
  value: string;
  /** 奥付ページ上に表示するか。 */
  visible: boolean;
}

/**
 * A. PAGE POSITION — 横書き奥付「ページ」を作品全体のどこへ入れるか。
 *  - `end`: 常に作品最終ページの後ろ（dynamic。本文ページ数が増減しても追従）。
 *  - `after-body-page`: 指定した「本文ページ番号」の直後（本文100P・20なら
 *    BodyPage20 → ColophonPage → BodyPage21）。本文 pagination 自体は不変。
 * B. BLOCK PLACEMENT（下記 ColophonPlacement）とは完全に別概念。
 */
export type ColophonPagePosition =
  | { mode: "end" }
  | { mode: "after-body-page"; afterBodyPage: number };

/**
 * B. BLOCK PLACEMENT — 奥付ページ「内」で、奥付情報ブロックをどこへ置くか。
 * テンプレートとは独立（テンプレート変更で placement は維持）。4 templates ×
 * 9 positions を別レイアウトとして実装せず、ColophonPage > PlacementArea >
 * ColophonBlock > Template の入れ子で表現する。
 */
export interface ColophonPlacement {
  horizontal: "left" | "center" | "right";
  vertical: "top" | "center" | "bottom";
  /** ノド（綴じ側）余白を避けて配置基準にするか。 */
  respectGutter: boolean;
  /** 天地の余白の内側を配置基準にするか。 */
  respectVerticalMargins: boolean;
}

export const DEFAULT_COLOPHON_PLACEMENT: ColophonPlacement = {
  horizontal: "center",
  vertical: "center",
  respectGutter: true,
  respectVerticalMargins: true,
};

export const DEFAULT_COLOPHON_PAGE_POSITION: ColophonPagePosition = { mode: "end" };

export interface ColophonSettings {
  /** 奥付ページを追加するか。既定は false。 */
  enabled: boolean;
  templateId: ColophonTemplateId;
  /** CSS font-family 文字列。"" = 本文と同じ（既定）。 */
  fontFamily: string;
  fields: ColophonField[];
  /** 奥付下部の自由記述欄（plain text。HTML は解釈しない）。 */
  freeText: string;
  /** A. ページ位置（本文の何ページ後 / 作品末尾）。 */
  pagePosition: ColophonPagePosition;
  /** B. ページ内のブロック配置。 */
  placement: ColophonPlacement;
}

/** 新規奥付の初期項目。id は安定した内部キー、label は編集可能な表示名。 */
export function defaultColophonFields(seedTitle = ""): ColophonField[] {
  return [
    { id: "title", label: "書名", value: seedTitle, visible: true },
    { id: "author", label: "著者名", value: "", visible: true },
    { id: "circle", label: "サークル名", value: "", visible: true },
    { id: "date", label: "発行日", value: "", visible: true },
    { id: "printer", label: "印刷所", value: "", visible: true },
    { id: "contact", label: "連絡先", value: "", visible: true },
    { id: "publisher", label: "発行者", value: "", visible: false },
  ];
}

export function createDefaultColophonSettings(seedTitle = ""): ColophonSettings {
  return {
    enabled: false,
    templateId: "standard",
    fontFamily: COLOPHON_FONT_SAME_AS_BODY,
    fields: defaultColophonFields(seedTitle),
    freeText: "",
    pagePosition: { ...DEFAULT_COLOPHON_PAGE_POSITION },
    placement: { ...DEFAULT_COLOPHON_PLACEMENT },
  };
}

/**
 * 「使い方ガイド」document 専用の奥付設定（実例として1ページだけ有効化する）。
 * 通常の新規 document の既定は colophon OFF のまま——これはガイドだけ。
 */
export function createGuideColophonSettings(): ColophonSettings {
  return {
    enabled: true,
    templateId: "standard",
    fontFamily: COLOPHON_FONT_SAME_AS_BODY,
    fields: [
      { id: "title", label: "書名", value: "使い方ガイド", visible: true },
      { id: "author", label: "著者", value: "TateSpun", visible: true },
      { id: "note", label: "内容", value: "操作方法・プレビュー表示の確認用サンプル", visible: true },
    ],
    freeText:
      "テキストエディターのタイトル入力欄の下にある「📖 扉・奥付」から「奥付（横）」を選ぶと、" +
      "横書きの奥付を挿入できます。挿入後も同じ「📖 扉・奥付」から編集できます。\n\n" +
      "注意事項\n" +
      "① 横書き奥付は1ファイルにつき1ページのみ配置できます。\n" +
      "② 横書き奥付には縦書きのテキストや画像を入れられません。",
    pagePosition: { mode: "end" },
    placement: { ...DEFAULT_COLOPHON_PLACEMENT },
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function coerceString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** 一意な内部IDを生成する（衝突時のフォールバックにも使う）。 */
export function generateColophonFieldId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `col_${Date.now().toString(36)}_${rand}`;
}

function normalizeField(raw: unknown, usedIds: Set<string>): ColophonField | null {
  if (!isPlainObject(raw)) return null;
  let id = coerceString(raw.id).trim();
  if (id === "" || usedIds.has(id)) id = generateColophonFieldId();
  // 生成直後も衝突しうる（同一tick連続生成）ため、確実に一意化する。
  while (usedIds.has(id)) id = generateColophonFieldId();
  usedIds.add(id);
  return {
    id,
    label: coerceString(raw.label),
    value: coerceString(raw.value),
    visible: raw.visible !== false, // 未指定は表示扱い
  };
}

/**
 * 任意の保存値（旧ドキュメント含む）から、常に整合の取れた ColophonSettings を
 * 返す。決して例外を投げない。`raw` が未定義/不正なら既定値。fields が空配列
 * まで削られている場合も既定項目へ戻す（「全項目を消して二度と戻せない」
 * 状態を防ぐ）。
 */
export function normalizeColophonSettings(
  raw: unknown,
  fallbackTitle = ""
): ColophonSettings {
  const base = createDefaultColophonSettings(fallbackTitle);
  if (!isPlainObject(raw)) return base;

  const templateId = COLOPHON_TEMPLATE_IDS.includes(raw.templateId as ColophonTemplateId)
    ? (raw.templateId as ColophonTemplateId)
    : base.templateId;

  const pagePosition = normalizeColophonPagePosition(raw.pagePosition);
  const placement = normalizeColophonPlacement(raw.placement);

  let fields: ColophonField[] = base.fields;
  if (Array.isArray(raw.fields)) {
    const usedIds = new Set<string>();
    const normalized = raw.fields
      .map((entry) => normalizeField(entry, usedIds))
      .filter((entry): entry is ColophonField => entry !== null);
    if (normalized.length > 0) fields = normalized;
  }

  return {
    enabled: raw.enabled === true,
    templateId,
    fontFamily: coerceString(raw.fontFamily),
    fields,
    freeText: coerceString(raw.freeText),
    pagePosition,
    placement,
  };
}

/** 保存値から ColophonPagePosition を安全に復元する。不正なら `{ mode: "end" }`。 */
export function normalizeColophonPagePosition(raw: unknown): ColophonPagePosition {
  if (isPlainObject(raw) && raw.mode === "after-body-page") {
    const n = Math.floor(Number(raw.afterBodyPage));
    if (Number.isFinite(n) && n >= 1) return { mode: "after-body-page", afterBodyPage: n };
  }
  return { mode: "end" };
}

/** 保存値から ColophonPlacement を安全に復元する（各項目を個別に既定へフォールバック）。 */
export function normalizeColophonPlacement(raw: unknown): ColophonPlacement {
  const base = DEFAULT_COLOPHON_PLACEMENT;
  if (!isPlainObject(raw)) return { ...base };
  const horizontal = (["left", "center", "right"] as const).includes(raw.horizontal as never)
    ? (raw.horizontal as ColophonPlacement["horizontal"])
    : base.horizontal;
  const vertical = (["top", "center", "bottom"] as const).includes(raw.vertical as never)
    ? (raw.vertical as ColophonPlacement["vertical"])
    : base.vertical;
  return {
    horizontal,
    vertical,
    respectGutter: raw.respectGutter !== false,
    respectVerticalMargins: raw.respectVerticalMargins !== false,
  };
}

/* ------------------------------------------------------------------ *
 *  A. PAGE POSITION の解決（Presentation Page Sequence の基準）
 * ------------------------------------------------------------------ */

export interface ColophonInsertion {
  /** 奥付ページより前に来る本文ページ数（= 奥付の物理ページ番号 - 1）。 */
  precedingBodyPages: number;
  /** 保存済みの `after-body-page` 指定が現在の本文に存在せず、末尾へ一時退避したか。 */
  fallback: boolean;
  /** ユーザーが指定していた本文ページ番号（警告文用）。`end` なら null。 */
  requestedPage: number | null;
}

/**
 * ページ位置設定と現在の本文ページ数から、奥付の実効挿入位置を決める。
 * 範囲外（例: 300指定・本文280P）でも:
 *  - 保存値を書き換えない（呼び出し側が settings をいじらない）
 *  - crash しない・奥付を失わない
 *  - 一時的に作品最終ページ後へ fallback（本文が再び300P以上になれば自動復帰）
 */
export function resolveColophonInsertion(
  position: ColophonPagePosition,
  bodyPageCount: number
): ColophonInsertion {
  const n = Math.max(0, Math.floor(bodyPageCount));
  if (position.mode === "after-body-page") {
    const req = position.afterBodyPage;
    if (req <= n) return { precedingBodyPages: req, fallback: false, requestedPage: req };
    return { precedingBodyPages: n, fallback: true, requestedPage: req };
  }
  return { precedingBodyPages: n, fallback: false, requestedPage: null };
}

/** PageSettings 全体に対して colophon フィールドだけを既定マージする薄いヘルパー。 */
export function withColophonDefaults<T extends { colophon?: unknown }>(
  settings: T,
  fallbackTitle = ""
): T & { colophon: ColophonSettings } {
  return {
    ...settings,
    colophon: normalizeColophonSettings(settings?.colophon, fallbackTitle),
  };
}

/* ------------------------------------------------------------------ *
 *  項目操作（すべて純粋関数——新しい配列を返し、引数は変更しない）
 * ------------------------------------------------------------------ */

export function addColophonField(
  fields: ColophonField[],
  init?: Partial<Omit<ColophonField, "id">>
): ColophonField[] {
  const usedIds = new Set(fields.map((f) => f.id));
  let id = generateColophonFieldId();
  while (usedIds.has(id)) id = generateColophonFieldId();
  return [
    ...fields,
    {
      id,
      label: init?.label ?? "",
      value: init?.value ?? "",
      visible: init?.visible ?? true,
    },
  ];
}

export function removeColophonField(fields: ColophonField[], id: string): ColophonField[] {
  return fields.filter((f) => f.id !== id);
}

/** `direction` は -1（前へ / 上へ）または 1（後ろへ / 下へ）。範囲外は何もしない。 */
export function moveColophonField(
  fields: ColophonField[],
  id: string,
  direction: -1 | 1
): ColophonField[] {
  const index = fields.findIndex((f) => f.id === id);
  if (index === -1) return fields;
  const target = index + direction;
  if (target < 0 || target >= fields.length) return fields;
  const next = [...fields];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function updateColophonField(
  fields: ColophonField[],
  id: string,
  patch: Partial<Omit<ColophonField, "id">>
): ColophonField[] {
  return fields.map((f) => (f.id === id ? { ...f, ...patch, id: f.id } : f));
}

/* ------------------------------------------------------------------ *
 *  描画モデル（テンプレート共通。ColophonPageCard がこれを消費する）
 * ------------------------------------------------------------------ */

export interface ColophonRenderRow {
  id: string;
  label: string;
  value: string;
}

export interface ColophonRenderModel {
  rows: ColophonRenderRow[];
  freeText: string;
}

/* ------------------------------------------------------------------ *
 *  ノンブル（ページ番号）
 * ------------------------------------------------------------------ */

/** 奥付ページのノンブル解決結果。null なら「奥付にノンブルを出さない」。 */
export interface ColophonNombre {
  /** 表示するページ番号（本文最終ページの続き番号）。 */
  value: number;
  /** 物理ページ番号が奇数（recto / 見開き左）か。 */
  isOddPage: boolean;
}

/**
 * 本文のノンブル設定（masterPage）から、奥付ページに出すノンブルを決める。
 * 別のノンブル設定体系は作らず、本文と同じ nombrePosition / nombreStart /
 * hideNombreOnFirstPage をそのまま解釈する:
 *  - 本文ノンブルが「非表示」なら奥付にも出さない（null）。
 *  - ノンブルは「実際の作品ページ順（物理ページ順）」に従う。奥付を途中へ
 *    入れた場合、その位置の物理ページ番号 = precedingBodyPageCount + 1。
 *  - 位置・フォント・スタイルは呼び出し側（ColophonPageCard）が本文用
 *    NombreOverlay / resolveNombreFontFamily をそのまま再利用する。
 * 本文 pagination 自体はこの関数では一切変更しない。
 */
export function resolveColophonNombre(
  masterPage: {
    nombrePosition: string;
    nombreStart: number;
    hideNombreOnFirstPage: boolean;
  },
  precedingBodyPageCount: number
): ColophonNombre | null {
  if (masterPage.nombrePosition === "hidden") return null;
  const physicalPageNumber = Math.max(0, Math.floor(precedingBodyPageCount)) + 1;
  if (masterPage.hideNombreOnFirstPage && physicalPageNumber === 1) return null;
  return {
    value: masterPage.nombreStart + physicalPageNumber - 1,
    isOddPage: physicalPageNumber % 2 === 1,
  };
}

/**
 * 4テンプレート共通の描画データ。visible な項目だけを順序どおりに返す
 * （label が空でも value があれば出す。両方空の項目だけ除外する）。
 * テキストはそのまま——エスケープは React のテキストノードに任せる
 * （`dangerouslySetInnerHTML` は使わない）。
 */
export function colophonRenderModel(settings: ColophonSettings): ColophonRenderModel {
  const rows = settings.fields
    .filter((f) => f.visible && (f.label.trim() !== "" || f.value.trim() !== ""))
    .map((f) => ({ id: f.id, label: f.label, value: f.value }));
  return { rows, freeText: settings.freeText };
}
