"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import styles from "./Bookshelf.module.css";
import { SpineStatusIcons, type SpineStatusIcon } from "./SpineStatusIcons";
import { truncateSpineTitle, type BookWidth } from "./bookshelfLayout";

export interface BookSpineColors {
  spineColor: string;
  decorationColor: string;
  lineColor: string;
  darkLineColor: string;
}

interface BookSpineProps extends BookSpineColors {
  title: string;
  updatedAtLabel: string;
  characterCount: number;
  isSample?: boolean;
  isCollection?: boolean;
  isLocalOnly?: boolean;
  showMenu?: boolean;
  menuId: string;
  isMenuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onOpen: () => void;
  onRename: (title: string) => Promise<void>;
  onDelete?: () => void;
  statusIcons?: SpineStatusIcon[];
  bookWidth?: BookWidth;
}

const GUIDE_STATUS_ICONS: SpineStatusIcon[] = [
  { kind: "shosin", label: "使い方ガイド" },
];

export function BookSpine({
  title,
  updatedAtLabel,
  characterCount,
  isSample,
  isCollection,
  isLocalOnly,
  showMenu = true,
  menuId,
  isMenuOpen,
  onToggleMenu,
  onCloseMenu,
  spineColor,
  decorationColor,
  lineColor,
  darkLineColor,
  onOpen,
  onRename,
  onDelete,
  statusIcons,
  bookWidth,
}: BookSpineProps) {
  const [bookArtwork, setBookArtwork] = useState("");
  const fullTitle = title || "無題のドキュメント";
  const visibleTitle = truncateSpineTitle(fullTitle);
  const resolvedBookWidth = bookWidth ?? 46;
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(title);
  const menuRootRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    const artworkPath = isSample
      ? "/assets/bookshelf/book_5_46.svg"
      : `/assets/bookshelf/book_6_${resolvedBookWidth}.svg`;
    void fetch(artworkPath, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load book artwork (${response.status})`);
        return response.text();
      })
      .then((source) => {
        const parsed = new DOMParser().parseFromString(source, "image/svg+xml");
        const svg = parsed.documentElement;
        svg.setAttribute("preserveAspectRatio", "none");
        svg.setAttribute("aria-hidden", "true");
        svg.removeAttribute("width");
        svg.removeAttribute("height");
        setBookArtwork(svg.outerHTML);
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) console.error(error);
      });

    return () => controller.abort();
  }, [isSample, resolvedBookWidth]);

  const closeMenu = (restoreFocus: boolean) => {
    setIsEditingTitle(false);
    setTitleDraft(title);
    onCloseMenu();
    if (restoreFocus) menuButtonRef.current?.focus();
  };

  useEffect(() => {
    if (!isMenuOpen) return;

    const handleOutsidePointerDown = (event: PointerEvent) => {
      if (menuRootRef.current?.contains(event.target as Node)) return;
      setIsEditingTitle(false);
      setTitleDraft(title);
      onCloseMenu();
    };
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setIsEditingTitle(false);
      setTitleDraft(title);
      onCloseMenu();
      menuButtonRef.current?.focus();
    };

    document.addEventListener("pointerdown", handleOutsidePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isMenuOpen, onCloseMenu, title]);

  const commitTitle = async () => {
    const nextTitle = titleDraft.trim();
    setIsEditingTitle(false);
    if (nextTitle !== title) await onRename(nextTitle);
    onCloseMenu();
  };

  const cancelTitleEdit = () => {
    setTitleDraft(title);
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation();
    if (event.key === "Enter") {
      event.preventDefault();
      void commitTitle();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setTitleDraft(title);
      setIsEditingTitle(false);
      onCloseMenu();
      menuButtonRef.current?.focus();
    }
  };

  const colorStyle = {
    "--book-spine-color": spineColor,
    "--book-decoration-color": decorationColor,
    "--book-line-color": lineColor,
    "--book-dark-line-color": darkLineColor,
    "--book-width": `${resolvedBookWidth}px`,
  } as CSSProperties;
  const visibleStatusIcons = isSample
    ? GUIDE_STATUS_ICONS
    : (statusIcons?.slice(0, 2) ?? []);
  const statusDescription = isSample
    ? ""
    : visibleStatusIcons.map(({ label }) => label).join("、");

  return (
    <article className={styles.bookItem} style={colorStyle}>
      <button
        type="button"
        className={styles.bookButton}
        onClick={onOpen}
        title={fullTitle}
        aria-label={`「${fullTitle}」を開く${statusDescription ? `。${statusDescription}` : ""}`}
      >
        {bookArtwork ? (
          <span
            className={styles.bookSvg}
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: bookArtwork }}
          />
        ) : (
          <span className={`${styles.bookSvg} ${styles.bookSvgLoading}`} aria-hidden="true" />
        )}
        <SpineStatusIcons statuses={visibleStatusIcons} />
        <span className={styles.bookTitle} aria-hidden="true">
          <span className={styles.bookTitleText}>{visibleTitle}</span>
        </span>
      </button>

      {showMenu && (
        <div className={styles.bookMenu} ref={menuRootRef}>
          <button
            ref={menuButtonRef}
            type="button"
            className={styles.menuTrigger}
            aria-label={`「${fullTitle}」の作品メニュー`}
            title="作品メニュー"
            aria-expanded={isMenuOpen}
            aria-controls={menuId}
            aria-haspopup="dialog"
            onClick={() => {
              setIsEditingTitle(false);
              setTitleDraft(title);
              onToggleMenu();
            }}
          >
            <span aria-hidden="true">•••</span>
          </button>
          {isMenuOpen && (
            <>
              <div
                className={styles.mobileMenuBackdrop}
                aria-hidden="true"
                onPointerDown={(event) => {
                  event.preventDefault();
                  closeMenu(true);
                }}
              />
              <div
                id={menuId}
                className={styles.menuPanel}
                role="dialog"
                aria-label={`${fullTitle}の操作`}
              >
              <button
                type="button"
                className={styles.closeMenuButton}
                aria-label="メニューを閉じる"
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => closeMenu(true)}
              >
                ×
              </button>
              <p className={styles.menuTitle}>{fullTitle}</p>
              <p>最終更新: {updatedAtLabel}</p>
              <p>文字数目安: {characterCount} 字</p>
              {(isSample || isCollection || isLocalOnly) && (
                <p className={styles.bookLabels}>
                  {isSample && <span>サンプル</span>}
                  {isCollection && <span>短編集</span>}
                  {isLocalOnly && <span>ブラウザ保存</span>}
                </p>
              )}
              {isEditingTitle ? (
                <div className={styles.titleEditor}>
                  <input
                    type="text"
                    value={titleDraft}
                    autoFocus
                    aria-label="作品タイトル"
                    onChange={(event) => setTitleDraft(event.target.value)}
                    onKeyDown={handleTitleKeyDown}
                    className={styles.titleInput}
                  />
                  <div className={styles.titleEditorActions}>
                    <button
                      type="button"
                      className={styles.cancelTitleButton}
                      onClick={cancelTitleEdit}
                    >
                      キャンセル
                    </button>
                    <button
                      type="button"
                      className={styles.saveTitleButton}
                      onClick={() => void commitTitle()}
                    >
                      保存
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className={styles.menuAction}
                  onClick={() => {
                    setTitleDraft(title);
                    setIsEditingTitle(true);
                  }}
                >
                  タイトルを変更
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  className={styles.deleteAction}
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onCloseMenu();
                    onDelete();
                  }}
                >
                  削除
                </button>
              )}
              </div>
            </>
          )}
        </div>
      )}
    </article>
  );
}
