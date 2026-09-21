/**
 * TSP-B5 描写語・修飾表現チェックβ — local analyzer (pure; no React, no DOM, no network, no AI).
 *
 * WHAT THIS IS (and is not)
 * Candidate detection for "expressions that explain a property / state / manner",
 * as a prompt for the writer to reconsider, NOT a quality judgement.
 *   A  narrowest: direct adjective / state / evaluation / manner
 *   B  broader attributive / adverbial modifiers that may already work as description
 *   C  broadest: time / place / purpose / identification modifiers
 * A/B/C are detection breadth, never "bad writing" ranks.
 *
 * ANALYSIS APPROACH (honest description — see qa/b5-description-check)
 * There is no full morphological analyzer (no POS dictionary) in the browser build:
 * the smallest real one (kuromoji/IPADIC) costs a 17 MB dictionary + ~300 MB RSS (measured, see
 * qa/b5-description-check/evidence/kuromoji-alternative-measurement.json). Instead this is *structure-based*, dictionary-lite:
 *   1. productive Japanese morphology that generalises to unseen sentences
 *      (…しい / …しそう / …的な / …っぽい / …やかな / …げに / reduplicated & …っと/…り mimetics,
 *       verb 連体形 + noun, …のような, …ながら, 名詞+の+名詞);
 *   2. small CLOSED-CLASS tables (i-adjective stems, common 形容動詞, degree adverbs,
 *      place / person / time nouns) — vocabulary tables, not phrase lists: they fire in
 *      any sentence context;
 *   3. a clause-boundary heuristic to choose the modifier phrase's span.
 * Precision/recall are therefore limited (no lexical POS disambiguation); the tool is a
 * beta "気づきの補助". Everything runs on the device.
 */

export type DescriptionCategory = "A" | "B" | "C";
export type DescriptionMode = "A" | "AB" | "ABC";

export interface DescriptionCandidate {
  /** Offsets into the analysed string (paragraph-local unless stated otherwise). */
  start: number;
  end: number;
  category: DescriptionCategory;
  ruleId: string;
  /** Short label shown in the detail (roadmap candidate labels). */
  label: string;
  /** Why this phrase was picked up. */
  reason: string;
}

export const DESCRIPTION_MODES: readonly DescriptionMode[] = ["A", "AB", "ABC"];
export const DEFAULT_DESCRIPTION_MODE: DescriptionMode = "A";

export const DESCRIPTION_MODE_LABELS: Record<DescriptionMode, string> = {
  A: "A",
  AB: "A+B",
  ABC: "A+B+C",
};

export const DESCRIPTION_MODE_SUMMARIES: Record<DescriptionMode, string> = {
  A: "いちばん絞って確認：形容・状態・様子をそのまま説明している表現",
  AB: "少し広げる：情景として働いているかもしれない連体・連用の修飾まで",
  ABC: "広く観察：時間・場所・用途・識別などの修飾まで",
};

export const DESCRIPTION_CATEGORY_LABELS: Record<DescriptionCategory, string> = {
  A: "A｜直接の形容・状態・様子",
  B: "B｜描写になりうる修飾",
  C: "C｜時間・場所・用途・識別",
};

/** Shown with every candidate: keeping it may be right; this only invites a look. */
export const DESCRIPTION_KEEP_NOTE =
  "必要であればそのまま残してください。情景・動作・感覚・たとえで見せる余地がないか、確かめるためのチェックです。";

export const DESCRIPTION_NOT_A_JUDGEMENT_NOTE =
  "A・B・Cは文章の良し悪しではなく、拾う範囲の広さです。";

export function categoriesForMode(mode: DescriptionMode): readonly DescriptionCategory[] {
  return mode === "A" ? ["A"] : mode === "AB" ? ["A", "B"] : ["A", "B", "C"];
}

export function normalizeDescriptionMode(value: unknown): DescriptionMode {
  return value === "AB" || value === "ABC" ? value : "A";
}

// ---------------------------------------------------------------- tables

const H = "[\\p{Script=Han}々〆]";
const K = "[ァ-ヴー]";
const h = "[ぁ-ん]";

/** i-adjective base forms (closed, high-frequency). Inflections are generated from the stem. */
const I_ADJECTIVES = [
  "青い", "赤い", "白い", "黒い", "黄色い", "茶色い", "丸い", "四角い", "長い", "短い", "高い", "低い", "広い", "狭い",
  "深い", "浅い", "重い", "軽い", "速い", "遅い", "早い", "暗い", "明るい", "強い", "弱い", "太い", "細い", "厚い",
  "薄い", "熱い", "暑い", "寒い", "冷たい", "暖かい", "温かい", "涼しい", "若い", "古い", "新しい", "悪い", "少ない",
  "甘い", "辛い", "苦い", "酸っぱい", "怖い", "恐ろしい", "淡い", "濃い", "鋭い", "鈍い", "臭い", "汚い", "安い",
  "眠い", "痛い", "粗い", "固い", "硬い", "堅い", "柔らかい", "幼い", "賢い", "醜い", "渋い", "緩い", "忙しい",
  "楽しい", "悲しい", "寂しい", "淋しい", "嬉しい", "美しい", "優しい", "厳しい", "激しい", "険しい", "珍しい",
  "貧しい", "苦しい", "眩しい", "懐かしい", "恋しい", "愛しい", "難しい", "易しい", "詳しい", "正しい", "大きい",
  "小さい", "細かい", "危うい", "儚い", "脆い", "尊い", "騒がしい", "慌ただしい", "香ばしい", "頼もしい",
  "恥ずかしい", "おかしい", "可愛い", "かわいい", "愛らしい", "美味しい", "おいしい", "素晴らしい", "すばらしい",
  "凄い", "すごい", "酷い", "ひどい", "狡い", "鬱陶しい", "うっとうしい", "重たい", "眠たい", "瑞々しい", "生々しい",
  "薄暗い", "蒸し暑い", "生温い", "手強い", "力強い", "心強い", "弱々しい", "荒々しい", "神々しい", "若々しい",
  "近い", "遠い", "多い", "面白い", "つまらない", "汚らしい", "たくましい", "逞しい", "力ない", "はかない", "かたい", "やわらかい",
  "つめたい", "あたたかい", "まぶしい", "うつくしい", "やさしい", "あかるい", "くらい", "ちいさい", "おおきい",
  "ほそい", "ふとい", "ながい", "みじかい", "しろい", "くろい", "あかい", "あおい", "ふかい", "あさい",
  "ゆるい", "こわい", "するどい", "にぶい", "きたない", "いたい", "ねむい", "うれしい", "たのしい", "かなしい",
  "さびしい", "むずかしい", "はずかしい", "なつかしい", "けわしい", "あつい", "さむい", "すずしい", "あまい",
  "からい", "にがい", "うすい", "こい", "ぬるい", "だるい", "まずい", "危ない", "眩い", "まばゆい",
  "ぎこちない", "あどけない", "情けない", "頼りない", "切ない", "くだらない", "たわいない", "あっけない", "しつこい",
  "しぶとい", "ずるい", "心細い", "煙たい", "野暮ったい", "みっともない", "そっけない", "素っ気ない", "そそっかしい",
  "気だるい", "眠たい", "生臭い", "毛深い", "手早い", "素早い", "細長い", "幅広い", "奥深い", "根強い", "力強い",
];
/** 近く / 遠く / 多く are mostly place/quantity nouns, not manner adverbs. */
const NO_KU_FORM = new Set(["近", "遠", "多"]);

function adjectivePattern(): string {
  const stems = Array.from(new Set(I_ADJECTIVES.map((word) => word.slice(0, -1)))).sort((a, b) => b.length - a.length);
  const withKu = stems.filter((stem) => !NO_KU_FORM.has(stem)).join("|");
  const withoutKu = stems.filter((stem) => NO_KU_FORM.has(stem)).join("|");
  return `(?:(?:${withKu})(?:い|く|かっ|かろ|くて|くな|けれ|(?:そう|げ)(?:な|に)?)|(?:${withoutKu})(?:い|かっ|くて|くな|けれ))`;
}

/** 形容動詞 stems with a distinct look/state meaning (closed-class table; productive patterns below). */
const NA_ADJECTIVES = [
  "静か", "穏やか", "鮮やか", "華やか", "爽やか", "賑やか", "滑らか", "柔らか", "細か", "微か", "僅か", "豊か", "明らか",
  "緩やか", "健やか", "朗らか", "密か", "仄か", "綺麗", "きれい", "立派", "素敵", "すてき", "大切", "大事", "特別",
  "有名", "不思議", "奇妙", "微妙", "複雑", "単純", "自由", "冷静", "勇敢", "正直", "素直", "元気", "丁寧", "上品",
  "派手", "地味", "贅沢", "孤独", "清潔", "新鮮", "深刻", "貴重", "幸せ", "不幸", "悲惨", "残酷", "神秘", "可哀想",
  "かわいそう", "卑怯", "慎重", "大胆", "繊細", "純粋", "頑固", "器用", "不器用", "無邪気", "真っ白", "真っ黒",
  "真っ赤", "真っ青", "真っ暗", "真っ直ぐ", "まっすぐ", "しなやか", "なめらか", "おだやか", "あざやか", "はなやか",
  "さわやか", "にぎやか", "ささやか", "かすか", "わずか", "ゆたか", "ふしぎ", "みごと", "見事", "無口", "陽気", "陰気",
  "退屈", "面倒", "厄介", "気軽", "気の毒", "不気味", "不安", "自然", "安全", "危険", "平和", "安らか", "健康", "素朴",
  "優雅", "壮大", "壮麗", "荘厳", "厳か", "淡々", "頑丈", "粗末", "妙", "変", "楽", "大き", "小さ", "おかし",
];
const NA_EXCLUDED_NI = new Set(["確か"]);

const DEGREE_ADVERBS = [
  "とても", "とっても", "すごく", "非常に", "大変", "かなり", "ずいぶん", "随分", "ひどく", "極めて", "実に", "少し",
  "すこし", "ちょっと", "ほんの", "わずかに", "やや", "いかにも", "まるで", "あたかも", "さながら", "いっそう", "一層",
  "ますます", "なんとも", "何とも", "妙に", "異様に", "徐々に", "次第に", "だんだん", "しだいに", "やけに", "むやみに",
  "ひときわ", "格別", "至って", "めっぽう", "この上なく", "たいそう", "いたく", "はなはだ", "甚だ", "かすかに", "微かに",
];

/** Person / kin / pronoun heads whose 「〜の」 identifies whose / which. */
const PERSON_HEADS = [
  "私", "僕", "俺", "わたし", "あたし", "彼", "彼女", "あなた", "君", "きみ", "お前", "母", "父", "兄", "姉", "弟", "妹",
  "祖母", "祖父", "叔父", "叔母", "先生", "友人", "友達", "恋人", "妻", "夫", "息子", "娘", "隣", "向かい", "主人",
  "少女", "少年", "男", "女", "老人", "老婆", "彼ら", "彼女ら", "皆",
];
const PLACE_HEADS = [
  "家", "部屋", "教室", "庭", "公園", "街", "町", "村", "山", "海", "川", "森", "畑", "店", "学校", "病院", "図書館", "駅",
  "港", "橋", "道", "空", "国", "島", "城", "寺", "神社", "屋上", "廊下", "台所", "玄関", "窓", "扉", "壁", "校庭", "広場",
  "教会", "会社", "工場", "市場", "浜", "湖", "池", "谷", "丘", "野原", "都会", "田舎", "故郷", "地下", "天井", "床",
  "机", "棚", "階段", "路地", "通り", "交差点", "ホーム", "ベンチ", "テーブル", "ベッド", "ソファ", "駅前", "町外れ",
];
const PLACE_SUFFIXES = ["前", "内", "外", "上", "下", "端", "通り", "町", "市", "県", "駅", "公園", "学校", "病院", "店", "屋", "室", "館", "場", "所", "口"];
const PLACE_POSITIONS = [
  "上", "下", "中", "前", "後ろ", "横", "隣", "奥", "隅", "端", "先", "外", "内", "向こう", "そば", "近く", "周り", "辺り",
  "傍", "脇", "間", "裏", "表", "底", "頂", "真ん中", "ほとり",
];
const TIME_WORDS = [
  "今日", "昨日", "明日", "今朝", "今夜", "昨夜", "昨晩", "毎日", "毎朝", "毎晩", "毎年", "先週", "来週", "今週", "今月",
  "先月", "来月", "今年", "去年", "来年", "昔", "朝", "昼", "夕方", "夕暮れ", "夜", "深夜", "早朝", "真夜中", "夏", "冬",
  "春", "秋", "正午", "午前", "午後", "放課後", "当時", "最近", "翌日", "翌朝", "その日", "あの日", "ある日", "ある朝",
  "ある晩", "子供の頃", "幼い頃", "あの頃", "その頃", "昼間", "夜中", "明け方", "日暮れ", "週末", "休日", "季節",
];
const TIME_HEAD_NOUNS = ["とき", "時", "あいだ", "間", "前", "後", "頃", "ころ", "うち", "たび", "度", "最中", "直後", "直前", "瞬間", "間際", "後で"];

const alt = (words: readonly string[]) => [...words].sort((a, b) => b.length - a.length).join("|");

// ---------------------------------------------------------------- rules

interface Rule {
  id: string;
  category: DescriptionCategory;
  label: string;
  reason: string;
  regex: RegExp;
  /** Return false to reject a match (e.g. a lookbehind that regex flavour can't express cheaply). */
  accept?: (match: RegExpExecArray, text: string) => boolean;
  /** Extend the span backwards to the modifier phrase's start (clause-boundary heuristic). */
  extendBack?: boolean;
}

const LABEL_A = "形容表現候補";
const NOT_FOLLOWED_NA = "(?![のらどんかよねぞぜっ])";
/** Words that look like reduplication / 〜っと but are not descriptive (time, certainty, discourse). */
const NOT_MIMETIC = new Set(["それぞれ", "いろいろ", "わざわざ", "そろそろ", "つぎつぎ", "ずっ", "きっ", "やっ", "もっ", "やっぱり", "ちゃんと", "ちょっ", "ばっ"]);

const RULES: Rule[] = [
  // ---------------- A: direct adjective / state / evaluation / manner
  {
    id: "a-adj-shii",
    category: "A",
    label: LABEL_A,
    reason: "「〜しい」の形容詞で、性質・気持ち・様子をそのまま説明しています。",
    regex: new RegExp(`${H}{1,3}${h}{0,2}(?:しい|しく(?:て|な[いかっ]*)?|しかっ|しけれ)`, "gu"),
    // 「降るらしい」「来るらしい」は伝聞の助動詞で形容詞ではない（愛らしい・汚らしいは語彙表側で拾う）。
    accept: (match) => !/らし(?:い|く|かっ)$/u.test(match[0]),
  },
  {
    id: "a-adj-lexicon",
    category: "A",
    label: LABEL_A,
    reason: "形容詞（〜い）で、性質・状態をそのまま説明しています。",
    regex: new RegExp(adjectivePattern(), "gu"),
  },
  {
    id: "a-adj-ppoi",
    category: "A",
    label: LABEL_A,
    reason: "「〜っぽい」「〜めいた」などで、印象や性質を述べています。",
    regex: new RegExp(`(?:${H}{1,4}|${K}{2,5}|${h}{2,4})(?:っぽ(?:い|く|さ|かっ|けれ)|めいた|めいて|じみた|じみて)|${H}{1,3}(?:ったるい|ったい|っこい|くさい)`, "gu"),
  },
  {
    id: "a-state-darake",
    category: "A",
    label: LABEL_A,
    reason: "「〜だらけ」「〜まみれ」で、状態・見た目をそのまま説明しています。",
    regex: new RegExp(`(?:${H}{1,3}|${K}{2,5})(?:だらけ|まみれ|ずくめ)(?:の|で)?`, "gu"),
  },
  {
    id: "a-eval-no-yoi",
    category: "A",
    label: LABEL_A,
    reason: "「〜のよい／〜のいい」で、心地・印象を評価として説明しています。",
    regex: new RegExp(`${H}{2,4}の(?:よい|いい|良い|悪い|わるい|よさ|悪さ)`, "gu"),
  },
  {
    id: "a-suffix-teki",
    category: "A",
    label: LABEL_A,
    reason: "「〜的な」で、性質や印象を述べています。",
    regex: new RegExp(`${H}{1,3}的(?:な|に)${NOT_FOLLOWED_NA}`, "gu"),
  },
  {
    id: "a-suffix-ge-sou",
    category: "A",
    label: LABEL_A,
    reason: "「〜げ」「〜しそう」で、様子・気配を説明しています。",
    regex: new RegExp(`${H}{1,3}(?:し?げ|しそう)(?:な|に)${NOT_FOLLOWED_NA}`, "gu"),
  },
  {
    id: "a-nadj-lexicon",
    category: "A",
    label: LABEL_A,
    reason: "形容動詞的な表現（〜な・〜に）で、様子・性質を説明しています。",
    regex: new RegExp(`(?:${alt(NA_ADJECTIVES)})(?:な${NOT_FOLLOWED_NA}|に(?![もはがをのへ])|(?:だった|でした|です|だ)(?![けがのっ]))`, "gu"),
    accept: (match) => !(match[0].endsWith("に") && NA_EXCLUDED_NI.has(match[0].slice(0, -1))),
  },
  {
    id: "a-nadj-generic",
    category: "A",
    label: LABEL_A,
    reason: "「〜な＋名詞」の形（形容動詞的な連体修飾）で、様子・性質を説明しています。",
    regex: new RegExp(`(?:${H}{2,3}|${K}{3,6})な(?=${H}|${K})`, "gu"),
    accept: (match) => !/^(?:何|同|一|二|三)な/u.test(match[0]),
  },
  {
    id: "a-nadj-yaka",
    category: "A",
    label: LABEL_A,
    reason: "「〜やか」「〜らか」の形で、様子・質感を説明しています。",
    regex: new RegExp(`${H}{1,2}(?:や|ら)か(?:な${NOT_FOLLOWED_NA}|に(?![もはがをのへ]))|${H}か(?:な${NOT_FOLLOWED_NA})`, "gu"),
    accept: (match) => !/^(?:何|誰|幾)/u.test(match[0]),
  },
  {
    id: "a-mimetic-redup",
    category: "A",
    label: LABEL_A,
    reason: "音や感じをそのまま写す語（擬音・擬態語）で、様子を説明しています。",
    regex: new RegExp(`(?:([ぁ-ん]{2,3})\\1|([ァ-ヴ]{2,3})\\2)(?:っと|と)?|${H}々と`, "gu"),
    accept: (match) => !NOT_MIMETIC.has(match[0].replace(/(?:っと|と)$/u, "")),
  },
  {
    id: "a-mimetic-tto-ri",
    category: "A",
    label: LABEL_A,
    reason: "「そっと」「ゆっくり」「ぼんやり」など、動作や状態の様子を表す副詞です。",
    regex: new RegExp(`[ぁ-ん][ゃゅょ]?っと|${h}[っん]${h}{1,2}り(?:と)?|${h}[ゃゅょ]?${h}んと|${K}{1,3}(?:ッと|リと)`, "gu"),
    accept: (match) => !NOT_MIMETIC.has(match[0].replace(/と$/u, "")),
  },
  {
    id: "a-adverb-degree",
    category: "A",
    label: LABEL_A,
    reason: "程度・様子を強めたり和らげたりする副詞です。",
    regex: new RegExp(`(?:${alt(DEGREE_ADVERBS)})`, "gu"),
  },

  // ---------------- B: attributive / adverbial modifiers that may already be description
  {
    id: "b-simile",
    category: "B",
    label: "連用修飾候補",
    reason: "「〜のように／〜のような」で、たとえ（比喩・様子）として働いている修飾です。",
    regex: /(?:の|た|だ)よう(?:な|に)(?!なる|なっ|なり)/gu,
    // 「そのような／このように」は指示（そのような＝そういう）で、たとえではない。
    accept: (match, text) => !(match[0].startsWith("の") && /[そこあど]/u.test(text[match.index - 1] ?? "")),
    extendBack: true,
  },
  {
    id: "b-relative-clause",
    category: "B",
    label: "連体修飾候補",
    reason: "動詞などで名詞を詳しく説明する修飾です（情景の描写として働いている場合があります）。",
    regex: new RegExp(`(?:[っんい]|し|ち|り|き|ぎ|み|び|じ|ひ|に|え|け|せ|て|ね|へ|め|れ|げ|ぜ|で|べ|${H})(?:た|だ)(?=${H}|${K})|ている(?=${H}|${K})|ていた(?=${H}|${K})|ていない(?=${H}|${K})|なかった(?=${H}|${K})`, "gu"),
    accept: (match, text) => {
      const after = text.slice(match.index + match[0].length);
      if (/^(?:見た|着た|来た|出た|得た|似た|見だ)$/u.test(match[0]) && /^(?:目|感じ|通り|限り)/u.test(after)) return false;
      // 時間名詞へ続くものは C（時間）として別に拾う。
      if (new RegExp(`^(?:${alt(TIME_HEAD_NOUNS)})`, "u").test(after)) return false;
      // 「〜した」＋漢語（勉強した結果 など）を含め、名詞が続くものだけを対象にする。
      return true;
    },
    extendBack: true,
  },
  {
    id: "b-nagara",
    category: "B",
    label: "連用修飾候補",
    reason: "「〜ながら」で、同時に起きている動作・様子を添える修飾です。",
    regex: new RegExp(`(?:${H}{1,4}${h}{0,3}|し)ながら`, "gu"),
    extendBack: true,
  },
  {
    id: "b-kake",
    category: "B",
    label: "連体修飾候補",
    reason: "「〜かけの」で、途中の状態を添える修飾です。",
    regex: new RegExp(`${H}{1,3}${h}{0,2}かけ(?:の|た(?=${H}|${K}))`, "gu"),
  },
  {
    id: "b-material-color",
    category: "B",
    label: "連体修飾候補",
    reason: "色・素材・形などを添える修飾です。",
    regex: new RegExp(`(?:${H}{1,2}|${K}{2,5})(?:色|状|型|製|柄|風|調|式|質|づくり|作り)(?:の|に|で)`, "gu"),
  },

  // ---------------- C: time / place / purpose / identification
  {
    id: "c-time-noun",
    category: "C",
    label: "連体修飾候補（時間）",
    reason: "時間を示す修飾です。",
    regex: new RegExp(`(?:${alt(TIME_WORDS)})の`, "gu"),
  },
  {
    id: "c-time-number",
    category: "C",
    label: "連体修飾候補（時間）",
    reason: "時間を示す修飾です。",
    regex: new RegExp(`[0-9０-９一二三四五六七八九十百千]+(?:年|月|日|時|分|秒|週|か月|ヶ月|時間|年間|日間)(?:前|後|ほど前|ごろ|頃)?の`, "gu"),
  },
  {
    id: "c-time-no-head",
    category: "C",
    label: "連体修飾候補（時間）",
    reason: "「〜の前／後／最中」など、時間の位置を示す修飾です。",
    regex: new RegExp(`(?:${H}{1,4}|${K}{2,6})の(?:後|前|最中|途中|うち|とき|時|頃|ころ|あと|まえ|翌日|翌朝)(?:で|に|は|、|の)`, "gu"),
  },
  {
    id: "c-time-before-after",
    category: "C",
    label: "連体修飾候補（時間）",
    reason: "時間の前後・最中を示す修飾です。",
    regex: new RegExp(`(?:戦争|試験|授業|会議|食事|出発|到着|卒業|入学|結婚|事件|事故|地震|嵐|葬儀|式)(?:前|後|中|直後|直前|以前|以降)の`, "gu"),
  },
  {
    id: "c-time-clause",
    category: "C",
    label: "連体修飾候補（時間）",
    reason: "「〜たとき」「〜た後」など、時間を示す節です。",
    regex: new RegExp(`(?:[っんいしちりきぎみびえけせめれべ]た|る|う|く|ぐ|す|つ|ぬ|ぶ|む|ている|ていた)(?:${alt(TIME_HEAD_NOUNS)})(?:に|の|、|は|で)`, "gu"),
    extendBack: true,
  },
  {
    id: "c-place-position",
    category: "C",
    label: "連体修飾候補（場所）",
    reason: "場所・位置を示す修飾です。",
    regex: new RegExp(`(?:${H}|${K}){1,4}の(?:${alt(PLACE_POSITIONS)})(?:の|に|で|を|には)`, "gu"),
  },
  {
    id: "c-place-noun",
    category: "C",
    label: "連体修飾候補（場所）",
    reason: "場所を示す修飾です。",
    regex: new RegExp(`(?:${alt(PLACE_HEADS)}|${H}{1,3}(?:${alt(PLACE_SUFFIXES)}))の`, "gu"),
  },
  {
    id: "c-purpose",
    category: "C",
    label: "連体修飾候補（用途）",
    reason: "用途・目的を示す修飾です。",
    regex: new RegExp(`(?:${H}|${K}){1,4}(?:用|向け|専用)の|(?:の)?ための|(?:ない|る|う)よう(?:に|な)(?!なる|なっ|なり)`, "gu"),
  },
  {
    id: "c-identification",
    category: "C",
    label: "連体修飾候補（識別）",
    reason: "誰の・どれの、と特定する修飾です。",
    regex: new RegExp(`(?:${alt(PERSON_HEADS)}|${H}{1,3}(?:さん|くん|君|ちゃん|様|氏|先生|殿))の|(?:この|その|あの|どの|こんな|そんな|あんな|どんな)(?=${H}|${K})`, "gu"),
    accept: (match, text) => !isCompoundNoun(match, text),
  },
  {
    id: "c-no-modifier",
    category: "C",
    label: "連体修飾候補",
    reason: "「〜の」で名詞を修飾しています（所属・関係・識別など）。",
    regex: new RegExp(`(?:${H}{1,4}|${K}{2,6})の(?=${H}|${K})`, "gu"),
    accept: (match, text) => !isCompoundNoun(match, text),
  },
];

/** 「女の子」「男の人」は「の」を含めて一語の名詞で、修飾ではない。 */
function isCompoundNoun(match: RegExpExecArray, text: string): boolean {
  const next = text[match.index + match[0].length] ?? "";
  return /[男女]の$/u.test(match[0]) && (next === "子" || next === "人");
}

const CLAUSE_BOUNDARY = /[、。！？!?\n「」『』（）()]/u;
const BACK_PARTICLES = new Set(["は", "が"]);
const MAX_BACK = 18;

/** Moves `start` back to the start of the modifier phrase: stop after 、。 quotes and a subject particle. */
function extendToPhraseStart(text: string, start: number): number {
  let i = start;
  const floor = Math.max(0, start - MAX_BACK);
  while (i > floor) {
    const prev = text[i - 1];
    if (CLAUSE_BOUNDARY.test(prev) || BACK_PARTICLES.has(prev)) break;
    i -= 1;
  }
  return i;
}

/**
 * All candidates of every category found in one paragraph (no newline expected), sorted by start.
 * Same-category overlaps are merged to the longer span, so a phrase is reported once.
 */
export function analyzeDescriptionParagraph(text: string): DescriptionCandidate[] {
  if (text.length === 0) return [];
  const found: DescriptionCandidate[] = [];
  for (const rule of RULES) {
    rule.regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = rule.regex.exec(text)) !== null) {
      if (match[0].length === 0) {
        rule.regex.lastIndex += 1;
        continue;
      }
      if (rule.accept && !rule.accept(match, text)) continue;
      let start = match.index;
      const end = match.index + match[0].length;
      if (rule.extendBack) start = extendToPhraseStart(text, start);
      found.push({ start, end, category: rule.category, ruleId: rule.id, label: rule.label, reason: rule.reason });
    }
  }
  return dedupeSameCategory(found).sort((a, b) => a.start - b.start || a.end - b.end);
}

function dedupeSameCategory(candidates: DescriptionCandidate[]): DescriptionCandidate[] {
  const result: DescriptionCandidate[] = [];
  for (const category of ["A", "B", "C"] as const) {
    const list = candidates
      .filter((candidate) => candidate.category === category)
      .sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));
    let last: DescriptionCandidate | null = null;
    for (const candidate of list) {
      if (last && candidate.start < last.end) {
        if (candidate.end - candidate.start > last.end - last.start) {
          result[result.indexOf(last)] = candidate;
          last = candidate;
        }
        continue;
      }
      result.push(candidate);
      last = candidate;
    }
  }
  return result;
}

export function filterCandidatesByMode<T extends { category: DescriptionCategory }>(candidates: readonly T[], mode: DescriptionMode): T[] {
  const allowed = categoriesForMode(mode);
  return candidates.filter((candidate) => allowed.includes(candidate.category));
}
