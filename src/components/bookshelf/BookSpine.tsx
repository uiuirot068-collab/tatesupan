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
  showMenu?: boolean;
  menuId: string;
  isMenuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onOpen: () => void;
  onRename: (title: string) => Promise<void>;
  onDelete?: () => void;
  statusIcons?: SpineStatusIcon[];
}

const MAX_VISIBLE_TITLE_LENGTH = 12;
const GUIDE_STATUS_ICONS: SpineStatusIcon[] = [
  { kind: "shosin", label: "使い方ガイド" },
];

export function BookSpine({
  title,
  updatedAtLabel,
  characterCount,
  isSample,
  isCollection,
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
}: BookSpineProps) {
  const fullTitle = title || "無題のドキュメント";
  const titleCharacters = Array.from(fullTitle);
  const visibleTitle =
    titleCharacters.length > MAX_VISIBLE_TITLE_LENGTH
      ? `${titleCharacters.slice(0, MAX_VISIBLE_TITLE_LENGTH - 1).join("")}…`
      : fullTitle;
  const titleSize =
    titleCharacters.length > 10
      ? styles.titleSmall
      : titleCharacters.length > 7
        ? styles.titleMedium
        : styles.titleNormal;
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(title);
  const menuRootRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

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
        <svg
          className={styles.bookSvg}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="-4.5 -42.5 109 362.5"
          aria-hidden="true"
          focusable="false"
        >
          <g className="spine-body">
            <g opacity=".7">
              <path
                fill="#707070"
                d="M0-29.563c0 5.09 0 290.029 0 341.214 0 5.055 2.22 7.83 5.98 7.83 20.476 0 86.611-.001 88.521 0 2.261.001 5.499-2.083 5.499-5.926 0-45.799 0-341.663 0-345.636 0-4.306-3.398-5.396-5.499-5.396H5.98C2.22-37.478 0-35.157 0-29.563ZM80 248.5H20V35.891h60V248.5Z"
              />
            </g>
          </g>
          <g className="spine-decoration" fill="#616161">
            <rect x="5.98" y="-37.479" width="4.998" height="356.958" />
            <rect x="89.504" y="-37.479" width="4.998" height="356.958" />
            <rect x="7.23" y="13.792" width="82.454" height="6.769" />
            <rect x="7.23" y="24.543" width="82.454" height="6.769" />
          </g>
          <g className="spine-status-band">
            <rect y="262.5" width="104.499" height="43" />
          </g>
          <g className="spine-line">
            <path d="M104.5-32.083c0-3.611-1.42-6.635-3.999-8.516-2.271-1.654-4.733-1.902-6-1.902H5.98C-.582-42.499-4.5-37.664-4.5-29.564v341.212c0 7.807 4.114 12.852 10.48 12.852h88.522c4.828 0 9.997-4.397 9.997-10.947v-70.103c.001-102.466 0-272.526.001-275.533ZM100 313.552c0 3.845-3.238 5.929-5.499 5.928-1.91-.001-68.044 0-88.521 0-3.76 0-5.98-2.774-5.98-7.832 0-51.182 0-336.122 0-341.212 0-5.593 2.22-7.915 5.98-7.915h88.521c2.101 0 5.499 1.091 5.499 5.396-.001 3.973 0 299.838 0 345.635Z" />
            <rect x="-4.5" y="257.5" width="108.999" height="5" />
            <rect x="-4.5" y="305.5" width="108.999" height="5" />
          </g>
        </svg>
        <SpineStatusIcons statuses={visibleStatusIcons} />
        <span className={styles.bookTitle} aria-hidden="true">
          <span className={`${styles.bookTitleText} ${titleSize}`}>{visibleTitle}</span>
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
              {(isSample || isCollection) && (
                <p className={styles.bookLabels}>
                  {isSample && <span>サンプル</span>}
                  {isCollection && <span>短編集</span>}
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
