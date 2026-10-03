/**
 * CST-PORT-011: 作品設定（PageSettings）と表紙のつなぎ目。
 *
 * 表紙は作品ごとのデータなので、作品の settings と一緒に保存する（ローカル・
 * クラウドとも settings JSON のまま。DB の形は変えない）。ただし本文の組版には
 * 関係しないので、プレビュー・書き出しの組版には cover を除いた settings を渡し、
 * 表紙をいじっても本文の組み直しが起きないようにする。
 */
import type { PageSettings } from "../pageLayout";
import { normalizeCoverSettings } from "./coverModel";

/** 本文の組版に渡す settings（cover を外す）。 */
export function settingsWithoutCover(settings: PageSettings): PageSettings {
  if (settings.cover === undefined) return settings;
  const { cover: _cover, ...rest } = settings;
  void _cover;
  return rest;
}

/** 読み込んだ settings の cover を正しい形にそろえる（未作成なら undefined のまま）。 */
export function normalizeSettingsCover(settings: PageSettings): PageSettings {
  const raw: unknown = settings.cover;
  if (raw === undefined) return settings;
  if (!raw || typeof raw !== "object") return settingsWithoutCover(settings);
  return { ...settings, cover: normalizeCoverSettings(raw) };
}

/**
 * cover を持たない settings（プレビューから戻ってくる変更など）で上書きするとき、
 * いまの表紙を消さないように引き継ぐ。
 */
export function keepCover(previous: PageSettings, next: PageSettings): PageSettings {
  if ("cover" in next && next.cover !== undefined) return next;
  if (previous.cover === undefined) return next;
  return { ...next, cover: previous.cover };
}
