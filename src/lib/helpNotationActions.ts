export const RUBY_HELP_NOTATION = "｜親文字《よみ》";
export const TCY_HELP_NOTATION = "[tate]12[/tate]";

export async function copyHelpNotation(
  notation: string,
  writeText?: (value: string) => Promise<void>
): Promise<boolean> {
  const writer =
    writeText ??
    (typeof navigator !== "undefined" && navigator.clipboard?.writeText
      ? navigator.clipboard.writeText.bind(navigator.clipboard)
      : null);
  if (!writer) return false;
  try {
    await writer(notation);
    return true;
  } catch {
    return false;
  }
}
