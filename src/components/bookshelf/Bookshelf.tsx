"use client";

/* eslint-disable @next/next/no-img-element -- Rack SVG segments intentionally use native img elements so their exact geometry joins without image optimization wrappers. */

import type { DocumentRecord } from "@/lib/db";
import { useEffect, useRef, useState } from "react";
import { BookSpine, type BookSpineColors } from "./BookSpine";
import styles from "./Bookshelf.module.css";

interface BookshelfProps {
  documents: DocumentRecord[];
  onOpen: (id: number) => void;
  onRename: (id: number, title: string) => Promise<void>;
  onDelete: (id: number) => void;
}

const BOOK_COLORS: BookSpineColors[] = [
  { spineColor: "#667b68", decorationColor: "#485b4b", lineColor: "#29332b", darkLineColor: "#93a394" },
  { spineColor: "#66758c", decorationColor: "#48566d", lineColor: "#29303c", darkLineColor: "#929eaf" },
  { spineColor: "#756887", decorationColor: "#584d69", lineColor: "#302b38", darkLineColor: "#9d91aa" },
  { spineColor: "#9a7a52", decorationColor: "#745a3b", lineColor: "#382e22", darkLineColor: "#aa9678" },
];

const GUIDE_COLORS: BookSpineColors = {
  spineColor: "#c5a059",
  decorationColor: "#b38f48",
  lineColor: "#1f2a44",
  darkLineColor: "#bca663",
};

const RACK_SCALE = 0.6;
const RACK_OVERLAP = 0.75;
const RACK_END_WIDTH = 122.262;
const RACK_CENTER_WIDTH = 117.27;
const BOOK_PITCH = 52.5;
const BOOKS_SIDE_SPACE = 70;
const MAX_BOOKS_PER_SHELF = 8;

function shelfMetrics(bookCount: number) {
  const scaledCenterWidth = RACK_CENTER_WIDTH * RACK_SCALE;
  const centerCount = Math.max(
    1,
    Math.ceil((bookCount * BOOK_PITCH - BOOKS_SIDE_SPACE) / scaledCenterWidth),
  );
  const rackSegmentCount = centerCount + 2;
  const shelfWidth =
    (RACK_END_WIDTH * 2 + RACK_CENTER_WIDTH * centerCount) * RACK_SCALE -
    RACK_OVERLAP * (rackSegmentCount - 1);

  return { centerCount, shelfWidth };
}

function booksThatFit(availableWidth: number): number {
  for (let count = MAX_BOOKS_PER_SHELF; count > 1; count -= 1) {
    if (shelfMetrics(count).shelfWidth <= availableWidth) return count;
  }
  return 1;
}

function colorsForDocument(id: number): BookSpineColors {
  return BOOK_COLORS[Math.abs(id) % BOOK_COLORS.length];
}

function estimateCharCount(content: string): number {
  return content.replace(/\s/g, "").length;
}

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

export function Bookshelf({ documents, onOpen, onRename, onDelete }: BookshelfProps) {
  const [openMenuProjectId, setOpenMenuProjectId] = useState<number | null>(null);
  const [booksPerShelf, setBooksPerShelf] = useState(MAX_BOOKS_PER_SHELF);
  const [availableWidth, setAvailableWidth] = useState<number | null>(null);
  const bookshelfRef = useRef<HTMLDivElement>(null);
  const regularDocuments = documents.filter((doc) => !doc.isSample);
  const sampleDocuments = documents.filter((doc) => doc.isSample);
  const shelfDocuments: DocumentRecord[][] = [];

  useEffect(() => {
    const bookshelf = bookshelfRef.current;
    if (!bookshelf) return;

    const updateLayout = (width: number) => {
      setAvailableWidth(width);
      setBooksPerShelf(booksThatFit(width));
    };
    const observer = new ResizeObserver(([entry]) => {
      updateLayout(entry.contentRect.width);
    });

    updateLayout(bookshelf.clientWidth);
    observer.observe(bookshelf);
    return () => observer.disconnect();
  }, []);

  for (let index = 0; index < regularDocuments.length; index += booksPerShelf) {
    shelfDocuments.push(regularDocuments.slice(index, index + booksPerShelf));
  }

  for (const sampleDocument of sampleDocuments) {
    const lastShelf = shelfDocuments.at(-1);
    if (!lastShelf || lastShelf.length >= booksPerShelf) {
      shelfDocuments.push([sampleDocument]);
    } else {
      lastShelf.push(sampleDocument);
    }
  }

  return (
    <div className={styles.bookshelf} ref={bookshelfRef}>
      <div className={styles.shelves}>
        {shelfDocuments.map((shelf, shelfIndex) => {
          const { centerCount, shelfWidth } = shelfMetrics(shelf.length);
          const needsOverflowFallback =
            availableWidth !== null && shelfWidth > availableWidth;

          return (
            <div
              key={shelfIndex}
              className={`${styles.shelfViewport} ${
                needsOverflowFallback ? styles.shelfViewportOverflow : ""
              }`}
            >
              <div className={styles.shelfStage} style={{ width: shelfWidth }}>
                <div className={styles.booksRow}>
                  {shelf.map((doc) => (
                    <BookSpine
                      key={doc.id}
                      title={doc.title}
                      updatedAtLabel={formatUpdatedAt(doc.updatedAt)}
                      characterCount={estimateCharCount(doc.content)}
                      isSample={doc.isSample}
                      isCollection={doc.isCollection}
                      showMenu={!doc.isSample}
                      menuId={`bookshelf-menu-${doc.id}`}
                      isMenuOpen={openMenuProjectId === doc.id}
                      onToggleMenu={() =>
                        setOpenMenuProjectId((currentId) =>
                          currentId === doc.id ? null : doc.id,
                        )
                      }
                      onCloseMenu={() => setOpenMenuProjectId(null)}
                      {...(doc.isSample ? GUIDE_COLORS : colorsForDocument(doc.id))}
                      onOpen={() => onOpen(doc.id)}
                      onRename={(title) => onRename(doc.id, title)}
                      onDelete={doc.isSample ? undefined : () => onDelete(doc.id)}
                    />
                  ))}
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
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
