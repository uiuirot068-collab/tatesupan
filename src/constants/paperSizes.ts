export interface PaperSizeConfig {
  name: string;
  width: number;      // 横幅 (mm)
  height: number;     // 縦幅 (mm)
  marginTop: number;    // 天 (mm)
  marginBottom: number; // 地 (mm)
  marginGutter: number; // ノド (mm)
  marginEdge: number;   // 小口 (mm)
}

export const PAPER_SIZE_TEMPLATES: Record<string, PaperSizeConfig> = {
  'Web閲覧用': {
    name: 'Web閲覧用',
    width: 148,
    height: 210,
    marginTop: 15,
    marginBottom: 25,
    marginGutter: 15,
    marginEdge: 15,
  },
  'A5': {
    name: 'A5',
    width: 148,
    height: 210,
    marginTop: 18,
    marginBottom: 18,
    marginGutter: 20,
    marginEdge: 15,
  },
  'B5': {
    name: 'B5',
    width: 182,
    height: 257,
    marginTop: 20,
    marginBottom: 20,
    marginGutter: 22,
    marginEdge: 18,
  },
  'B6': {
    name: 'B6',
    width: 128,
    height: 182,
    marginTop: 16,
    marginBottom: 16,
    marginGutter: 18,
    marginEdge: 13,
  },
  '新書': {
    name: '新書',
    width: 103,
    height: 182,
    marginTop: 14,
    marginBottom: 14,
    marginGutter: 16,
    marginEdge: 11,
  },
  'A6': {
    name: 'A6',
    width: 105,
    height: 148,
    marginTop: 13,
    marginBottom: 13,
    marginGutter: 15,
    marginEdge: 10,
  },
  '文庫': {
    name: '文庫',
    width: 105,
    height: 148,
    marginTop: 13,
    marginBottom: 13,
    marginGutter: 15,
    marginEdge: 10,
  },
};
