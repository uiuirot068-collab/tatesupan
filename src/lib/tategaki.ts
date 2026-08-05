export type TategakiToken =
  | { type: "text"; value: string }
  | { type: "ruby"; base: string; rt: string }
  | { type: "tcy"; value: string };

const RUBY_PATTERN = /｜([^｜《》\n]+)《([^《》\n]+)》|([一-龠々〆ヵヶ]+)《([^《》\n]+)》/g;
const TCY_PATTERN = /(?<!\d)\d{2}(?!\d)|[!?！？]{2}(?![!?！？])/g;

/**
 * Parses raw editor text into a flat token stream:
 * ruby notation (｜漢字《かんじ》 or 漢字《かんじ》) becomes `ruby` tokens,
 * tate-chu-yoko candidates (2-digit numbers, !!/!?/?? pairs) become `tcy` tokens,
 * everything else stays as `text`.
 */
export function tokenizeTategaki(source: string): TategakiToken[] {
  const tokens: TategakiToken[] = [];
  let lastIndex = 0;

  for (const match of source.matchAll(RUBY_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      tokens.push(...tokenizePlainText(source.slice(lastIndex, index)));
    }
    const base = match[1] ?? match[3] ?? "";
    const rt = match[2] ?? match[4] ?? "";
    tokens.push({ type: "ruby", base, rt });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < source.length) {
    tokens.push(...tokenizePlainText(source.slice(lastIndex)));
  }

  return tokens;
}

function tokenizePlainText(text: string): TategakiToken[] {
  const tokens: TategakiToken[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(TCY_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      tokens.push({ type: "text", value: text.slice(lastIndex, index) });
    }
    tokens.push({ type: "tcy", value: match[0] });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < text.length) {
    tokens.push({ type: "text", value: text.slice(lastIndex) });
  }

  return tokens;
}

/** Visual character weight used for page-break accounting. */
function tokenLength(token: TategakiToken): number {
  if (token.type === "text") return token.value.length;
  if (token.type === "ruby") return token.base.length;
  return 1; // a tate-chu-yoko pair occupies a single character cell
}

export const DEFAULT_PAGE_SIZE = 800;

/**
 * Splits a token stream into pages of roughly `pageSize` visual characters.
 * Ruby and tate-chu-yoko tokens are never split; only plain text tokens can
 * break mid-token so pagination stays close to the target size.
 */
export function paginateTokens(
  tokens: TategakiToken[],
  pageSize: number = DEFAULT_PAGE_SIZE
): TategakiToken[][] {
  const effectivePageSize = pageSize >= 1 ? pageSize : 1;
  return paginateTokensBySize(tokens, effectivePageSize);
}

function paginateTokensBySize(
  tokens: TategakiToken[],
  pageSize: number
): TategakiToken[][] {
  const pages: TategakiToken[][] = [];
  let currentPage: TategakiToken[] = [];
  let currentCount = 0;

  const pushPage = () => {
    if (currentPage.length > 0) {
      pages.push(currentPage);
    }
    currentPage = [];
    currentCount = 0;
  };

  for (const token of tokens) {
    if (token.type === "text") {
      let remaining = token.value;
      while (remaining.length > 0) {
        const space = pageSize - currentCount;
        if (space <= 0) {
          pushPage();
          continue;
        }
        const chunk = remaining.slice(0, space);
        currentPage.push({ type: "text", value: chunk });
        currentCount += chunk.length;
        remaining = remaining.slice(chunk.length);
      }
      continue;
    }

    const length = tokenLength(token);
    if (currentCount > 0 && currentCount + length > pageSize) {
      pushPage();
    }
    currentPage.push(token);
    currentCount += length;
  }

  pushPage();

  return pages.length > 0 ? pages : [[]];
}

export function countVisualLength(source: string): number {
  return tokenizeTategaki(source).reduce((sum, t) => sum + tokenLength(t), 0);
}

/** Reverses `tokenizeTategaki`, re-serializing ruby tokens in `｜base《rt》` form. */
export function detokenizeTategaki(tokens: TategakiToken[]): string {
  return tokens
    .map((token) => {
      if (token.type === "ruby") return `｜${token.base}《${token.rt}》`;
      return token.value;
    })
    .join("");
}
