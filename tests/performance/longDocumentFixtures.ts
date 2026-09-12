const PARAGRAPHS = [
  "｜東京《とうきょう》の朝、Mole は時計を見た。午前10時、窓の外では雨が――静かに続いている。『まだ間に合う』と彼は言った。",
  "la mort という語をノートに写し、2026年の予定を確かめる。数字12と[tate]A5[/tate]、句読点、括弧（確認用）を混ぜた本文である。",
  "長い原稿でも、段落の境界と禁則、ルビの読み、半角 Latin / numbers の向きは変えてはならない。だから同じ調子の文章を丁寧に積み重ねる。",
  "『本当に進めますか？』――返事はすぐには来なかった。庭の木々が揺れ、遠くで列車の音がした。彼女は第34章の続きを書き始めた。",
] as const;

const IMAGE_MARKER = "【IMG:perf-image:48:64:center】";

/** Deterministic Japanese manuscript with production notation and exact UTF-16 length. */
export function makeLongDocumentFixture(targetLength: number, includeImage = false): string {
  if (!Number.isInteger(targetLength) || targetLength < 1) throw new Error("targetLength must be a positive integer");
  let content = "";
  let paragraph = 0;
  while (content.length < targetLength) {
    const image = includeImage && paragraph > 0 && paragraph % 24 === 0 ? `${IMAGE_MARKER}\n` : "";
    content += `${image}${PARAGRAPHS[paragraph % PARAGRAPHS.length]}\n`;
    paragraph += 1;
  }
  return content.slice(0, targetLength);
}
