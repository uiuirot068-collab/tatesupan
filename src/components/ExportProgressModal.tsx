interface ExportProgressModalProps {
  /** 例: "PDF", "画像" — 「〜を生成中...」の主語になる。 */
  label: string;
  current: number;
  total: number;
}

/**
 * 出力処理中に画面全体を覆い、誤操作を防ぐブロッキング進捗モーダル。
 * total が 0 の場合は件数の分からない単発出力（JPG単ページ書き出し等）とみなし、
 * ページ数を表示せずスピナーのみ表示する。
 */
export default function ExportProgressModal({ label, current, total }: ExportProgressModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="alertdialog"
      aria-modal="true"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-4 rounded-xl bg-base px-8 py-6 shadow-xl">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-ink/20 border-t-accent" />
        <p className="whitespace-nowrap text-sm font-medium text-ink">
          {total > 0 ? `${label}を生成中... ${current} / ${total} ページ` : `${label}を生成中...`}
        </p>
      </div>
    </div>
  );
}
