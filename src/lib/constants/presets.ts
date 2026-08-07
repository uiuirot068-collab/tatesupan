export type PageNumberPosition = 'bottom-center' | 'bottom-right' | 'bottom-left' | 'none';

export interface PagePreset {
  id: string;
  name: string;
  width: number;
  height: number;
  unit: 'mm' | 'px';
  dpi?: number;
  marginTop: number;
  marginBottom: number;
  marginInner: number;
  marginOuter: number;
  fontSize: number;
  pageNumberPosition: PageNumberPosition;
  targetCharCount?: number;
  showFooter?: boolean;
  footerContent?: {
    logoPath: string;
    text: string;
    url: string;
    hashtag: string;
  };
}

export const PAGE_PRESETS: Record<string, PagePreset> = {
  a5: {
    id: 'a5',
    name: 'A5（148×210mm）',
    width: 148,
    height: 210,
    unit: 'mm',
    marginTop: 18,
    marginBottom: 18,
    marginInner: 20,
    marginOuter: 12,
    fontSize: 9.5,
    pageNumberPosition: 'bottom-center',
  },
  b5: {
    id: 'b5',
    name: 'B5（182×257mm）',
    width: 182,
    height: 257,
    unit: 'mm',
    marginTop: 22,
    marginBottom: 22,
    marginInner: 24,
    marginOuter: 15,
    fontSize: 10,
    pageNumberPosition: 'bottom-center',
  },
  b6: {
    id: 'b6',
    name: 'B6（128×182mm）',
    width: 128,
    height: 182,
    unit: 'mm',
    marginTop: 15,
    marginBottom: 15,
    marginInner: 18,
    marginOuter: 10,
    fontSize: 9,
    pageNumberPosition: 'bottom-center',
  },
  shinsho: {
    id: 'shinsho',
    name: '新書（103×182mm）',
    width: 103,
    height: 182,
    unit: 'mm',
    marginTop: 14,
    marginBottom: 14,
    marginInner: 16,
    marginOuter: 9,
    fontSize: 9,
    pageNumberPosition: 'bottom-center',
  },
  a6: {
    id: 'a6',
    name: 'A6（105×148mm）',
    width: 105,
    height: 148,
    unit: 'mm',
    marginTop: 12,
    marginBottom: 12,
    marginInner: 15,
    marginOuter: 8,
    fontSize: 9,
    pageNumberPosition: 'bottom-center',
  },
  bunko: {
    id: 'bunko',
    name: '文庫（105×148mm）',
    width: 105,
    height: 148,
    unit: 'mm',
    marginTop: 12,
    marginBottom: 12,
    marginInner: 15,
    marginOuter: 8,
    fontSize: 9,
    pageNumberPosition: 'bottom-center',
  },
  web: {
    id: 'web',
    name: 'Web閲覧用(768×1024px)',
    width: 768,
    height: 1024,
    unit: 'px',
    dpi: 72,
    marginTop: 15,
    marginBottom: 25,
    marginInner: 15,
    marginOuter: 15,
    fontSize: 15,
    pageNumberPosition: 'bottom-right',
    targetCharCount: 600,
    showFooter: true,
    footerContent: {
      logoPath: '/img/caroad_main2.png',
      text: 'TateSpun',
      url: 'https://tatespun.pages.dev/',
      hashtag: '#スパンテイル',
    },
  },
};
