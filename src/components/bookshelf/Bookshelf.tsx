"use client";

/* eslint-disable @next/next/no-img-element -- Rack SVG segments intentionally use native img elements so their exact geometry joins without image optimization wrappers. */

import type { DocumentRecord } from "@/lib/db";
import { countVisualLength } from "@/lib/tategaki";
import type { Project } from "@/types/database";
import type { ProjectCloudImageMeta } from "@/lib/supabase/manuscriptImages";
import {
  cloudImageDetailLine,
  cloudImageWarningLabel,
  computeCloudImageWarning,
  contentHasImages,
} from "@/lib/cloudImageSync";
import { useEffect, useId, useRef, useState } from "react";
import { BookSpine, type BookSpineColors } from "./BookSpine";
import type { SpineStatusIcon } from "./SpineStatusIcons";
import styles from "./Bookshelf.module.css";
import {
  GUIDE_BOOK_WIDTH,
  bookWidthForCharacterCount,
  packShelfBooks,
  shelfFrontLipWidth,
  shelfMetricsForAvailableWidth,
  shelfMetricsForContentWidth,
} from "./bookshelfLayout";
import { assignBookPaletteIndices } from "./bookshelfPalette";

interface BookshelfProps {
  documents?: DocumentRecord[];
  cloudProjects?: Project[];
  /** TSP-LOOP-007: projectId -> 一時挿絵の期限/欠損メタ（軽量）。 */
  cloudImageMetas?: Map<string, ProjectCloudImageMeta>;
  onOpen?: (id: number) => void;
  onOpenCloud?: (id: string) => void;
  onRename?: (id: number, title: string) => Promise<void>;
  onDelete?: (id: number) => void;
  /** ログイン中、ローカル保存の作品に「ブラウザ保存」表示を出す */
  showLocalOnlyLabel?: boolean;
  showEmptyState?: boolean;
  /** 2段目以降を「もっとみる」で折りたたむ（NON-EMPTY Home専用）。既定はfalseで全段表示、既存挙動を維持する。 */
  collapsible?: boolean;
}

const BOOK_COLORS: BookSpineColors[] = [
  { spineColor: "#8796a6", decorationColor: "#6d7d8e", lineColor: "#5e6c7a", darkLineColor: "#b0bdca" },
  { spineColor: "#8f9b87", decorationColor: "#74806d", lineColor: "#65705f", darkLineColor: "#b2bcaa" },
  { spineColor: "#a58c6d", decorationColor: "#897256", lineColor: "#756149", darkLineColor: "#c9b392" },
  { spineColor: "#998da3", decorationColor: "#7e7289", lineColor: "#6e6478", darkLineColor: "#c0b4c7" },
  { spineColor: "#8d8377", decorationColor: "#73695f", lineColor: "#625a52", darkLineColor: "#b5aaa0" },
];

const GUIDE_COLORS: BookSpineColors = {
  spineColor: "#c5a059",
  decorationColor: "#b38f48",
  lineColor: "#1f2a44",
  darkLineColor: "#bca663",
};

function formatUpdatedAt(updatedAt: number): string {
  return new Date(updatedAt).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface RackSegmentProps {
  part: "left" | "center" | "right";
  className: string;
  width: string;
  height: string;
}

function RackSegment({ part, className, width, height }: RackSegmentProps) {
  return (
    <span className={styles.rackSegment}>
      <img
        className={`${className} ${styles.rackLight}`}
        src={`/assets/bookshelf/rack_${part}.svg`}
        alt=""
        width={width}
        height={height}
      />
      <img
        className={`${className} ${styles.rackDark}`}
        src={`/assets/bookshelf/rack_${part}_dark.svg`}
        alt=""
        width={width}
        height={height}
      />
    </span>
  );
}

export function Bookshelf({
  documents = [],
  cloudProjects = [],
  cloudImageMetas,
  onOpen,
  onOpenCloud,
  onRename,
  onDelete,
  showLocalOnlyLabel,
  showEmptyState = false,
  collapsible = false,
}: BookshelfProps) {
  const [openMenuProjectId, setOpenMenuProjectId] = useState<string | null>(null);
  const [availableWidth, setAvailableWidth] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const bookshelfRef = useRef<HTMLDivElement>(null);
  const shelvesId = useId();
  const regularDocuments = documents.filter((doc) => !doc.isSample);
  const sampleDocuments = documents.filter((doc) => doc.isSample);
  const books = [
    ...regularDocuments.map((doc) => ({
      key: `local-${doc.id}`,
      source: "local" as const,
      id: doc.id,
      title: doc.title,
      content: doc.content,
      updatedAt: doc.updatedAt,
      isSample: false,
      isCollection: doc.isCollection,
    })),
    ...cloudProjects.map((project) => ({
      key: `cloud-${project.id}`,
      source: "cloud" as const,
      id: project.id,
      title: project.title,
      content: project.content,
      updatedAt: new Date(project.updated_at).getTime(),
      isSample: false,
      isCollection: false,
    })),
    ...sampleDocuments.map((doc) => ({
      key: `sample-${doc.id}`,
      source: "local" as const,
      id: doc.id,
      title: doc.title,
      content: doc.content,
      updatedAt: doc.updatedAt,
      isSample: true,
      isCollection: doc.isCollection,
    })),
  ];
  const displayBooks = assignBookPaletteIndices(books);

  useEffect(() => {
    const bookshelf = bookshelfRef.current;
    if (!bookshelf) return;

    const updateLayout = (width: number) => {
      setAvailableWidth(width);
    };
    const observer = new ResizeObserver(([entry]) => {
      updateLayout(entry.contentRect.width);
    });

    updateLayout(bookshelf.clientWidth);
    observer.observe(bookshelf);
    return () => observer.disconnect();
  }, []);

  const measuredWidth = availableWidth ?? 320;
  const shelfBooks = packShelfBooks(
    [
      ...displayBooks.map((book) => {
        const characterCount = countVisualLength(book.content);
        return {
          item: book,
          width: book.isSample ? GUIDE_BOOK_WIDTH : bookWidthForCharacterCount(characterCount),
        };
      }),
    ],
    measuredWidth,
  );
  const hasCollapsedShelves = collapsible && shelfBooks.length > 1;
  const visibleShelfBooks =
    hasCollapsedShelves && !isExpanded ? shelfBooks.slice(0, 1) : shelfBooks;
  return (
    <div
      className={`${styles.bookshelf} ${showEmptyState ? styles.bookshelfEmpty : ""}`}
      ref={bookshelfRef}
    >
      <div className={styles.shelves} id={shelvesId}>
        {visibleShelfBooks.map((shelf, shelfIndex) => {
          const booksWidth = shelf.reduce(
            (total, book, index) => total + book.width + (index > 0 ? 8 : 0),
            0,
          );
          const { centerCount, shelfWidth } = showEmptyState
            ? shelfMetricsForAvailableWidth(measuredWidth)
            : shelfMetricsForContentWidth(booksWidth);
          const needsOverflowFallback =
            availableWidth !== null && shelfWidth > availableWidth;

          return (
            <div
              key={shelfIndex}
              className={`${styles.shelfViewport} ${
                needsOverflowFallback ? styles.shelfViewportOverflow : ""
              }`}
            >
              <div
                className={`${styles.shelfStage} ${showEmptyState ? styles.shelfStageEmpty : ""}`}
                style={{ width: shelfWidth }}
              >
                <div className={`${styles.booksRow} ${showEmptyState ? styles.booksRowEmpty : ""}`}>
                  {showEmptyState && shelfIndex === 0 && (
                    <p className={styles.emptyMessage}>
                      あなたの本が、ここに増えていきます。<br />
                      はじめの1冊は、使い方ガイドのとなりへ。
                    </p>
                  )}
                  {shelf.map(({ item: book }) => {
                    const characterCount = countVisualLength(book.content);
                    const menuKey = book.key;
                    const isCloud = book.source === "cloud";

                    // TSP-LOOP-007: クラウド作品の一時挿絵の期限/欠損 → ⚠️ + 詳細行。
                    // すべて同じ canonical helper（computeCloudImageWarning）由来。
                    let cloudStatusIcons: SpineStatusIcon[] | undefined;
                    let cloudImageDetail: string | undefined;
                    let cloudImageWarningText: string | undefined;
                    if (isCloud) {
                      const meta = cloudImageMetas?.get(String(book.id));
                      const status = {
                        hasReferencedImages: contentHasImages(book.content),
                        expiresAt: meta?.expiresAt ?? null,
                        missing: meta?.missing ?? false,
                      };
                      const now = Date.now();
                      const warning = computeCloudImageWarning(status, now);
                      cloudStatusIcons = [{ kind: "cloud", label: "クラウド保存" }];
                      if (warning.status !== "NONE") {
                        cloudImageWarningText = cloudImageWarningLabel(warning);
                        cloudStatusIcons.push({ kind: "warning", label: cloudImageWarningText });
                      }
                      cloudImageDetail =
                        cloudImageDetailLine(status, now, formatUpdatedAt) || undefined;
                    }

                    return (
                    <BookSpine
                      key={book.key}
                      title={book.title}
                      updatedAtLabel={formatUpdatedAt(book.updatedAt)}
                      characterCount={characterCount}
                      bookWidth={book.isSample ? undefined : bookWidthForCharacterCount(characterCount)}
                      isSample={book.isSample}
                      isCollection={book.isCollection}
                      isLocalOnly={showLocalOnlyLabel && !book.isSample && !isCloud}
                      statusIcons={isCloud ? cloudStatusIcons : undefined}
                      cloudImageDetail={cloudImageDetail}
                      cloudImageWarningText={cloudImageWarningText}
                      menuVariant={isCloud ? "info" : "full"}
                      showMenu={!book.isSample && (!isCloud || Boolean(cloudImageDetail))}
                      menuId={`bookshelf-menu-${menuKey}`}
                      isMenuOpen={openMenuProjectId === menuKey}
                      onToggleMenu={() =>
                        setOpenMenuProjectId((currentId) =>
                          currentId === menuKey ? null : menuKey,
                        )
                      }
                      onCloseMenu={() => setOpenMenuProjectId(null)}
                      {...(book.isSample ? GUIDE_COLORS : BOOK_COLORS[book.paletteIndex])}
                      onOpen={() => {
                        if (isCloud) onOpenCloud?.(String(book.id));
                        else onOpen?.(Number(book.id));
                      }}
                      onRename={(title) =>
                        isCloud || !onRename
                          ? Promise.resolve()
                          : onRename(Number(book.id), title)
                      }
                      onDelete={book.isSample || isCloud || !onDelete
                        ? undefined
                        : () => onDelete(Number(book.id))}
                    />
                    );
                  })}
                </div>

                <div className={styles.rackRow} aria-hidden="true">
                  <RackSegment
                    className={styles.rackEnd}
                    part="left"
                    width="122.262"
                    height="160.755"
                  />
                  {Array.from({ length: centerCount }, (_, index) => (
                    <RackSegment
                      key={index}
                      className={styles.rackCenter}
                      part="center"
                      width="117.27"
                      height="53.635"
                    />
                  ))}
                  <RackSegment
                    className={styles.rackEnd}
                    part="right"
                    width="122.262"
                    height="160.755"
                  />
                </div>
                <div
                  className={styles.shelfFrontLip}
                  style={{ width: shelfFrontLipWidth(centerCount) }}
                  aria-hidden="true"
                />
              </div>
            </div>
          );
        })}
      </div>

      {hasCollapsedShelves && (
        <button
          type="button"
          className={styles.shelfToggle}
          onClick={() => setIsExpanded((expanded) => !expanded)}
          aria-expanded={isExpanded}
          aria-controls={shelvesId}
        >
          {isExpanded ? "▲ とじる ▲" : "▼ もっとみる ▼"}
        </button>
      )}
    </div>
  );
}
