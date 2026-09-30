import { isEphemeralDocId } from "@/constants/demoData";
import { countVisualLength } from "./tategaki";

export interface BookshelfMetadataRecord {
  id: number;
  title: string;
  updatedAt: number;
  characterCount: number;
  isCollection: boolean;
}

export interface BookshelfDocumentSource {
  id: number;
  title: string;
  content: string;
  updatedAt: number;
  isCollection?: boolean;
  isSample?: boolean;
}

/**
 * Converts a document into the metadata-only record shared with external
 * bookshelf readers. The returned object intentionally contains no manuscript
 * body, settings, notes, or image data.
 */
export function bookshelfMetadataFromDocument(
  document: BookshelfDocumentSource,
): BookshelfMetadataRecord | null {
  if (document.isSample || isEphemeralDocId(document.id)) return null;

  return {
    id: document.id,
    title: document.title,
    updatedAt: document.updatedAt,
    characterCount: countVisualLength(document.content),
    isCollection: document.isCollection ?? false,
  };
}
