import { describe, expect, it } from "vitest";
import { bookshelfMetadataFromDocument } from "./bookshelfMetadata";

describe("bookshelfMetadataFromDocument", () => {
  it("returns metadata only for a regular document", () => {
    expect(
      bookshelfMetadataFromDocument({
        id: 123,
        title: "春の本",
        content: "abc",
        updatedAt: 456,
      }),
    ).toEqual({
      id: 123,
      title: "春の本",
      updatedAt: 456,
      characterCount: 3,
      isCollection: false,
    });
  });

  it("preserves collection state", () => {
    expect(
      bookshelfMetadataFromDocument({
        id: 124,
        title: "短編集",
        content: "本文",
        updatedAt: 789,
        isCollection: true,
      })?.isCollection,
    ).toBe(true);
  });

  it("excludes the guide and demo", () => {
    expect(
      bookshelfMetadataFromDocument({
        id: -1,
        title: "使い方ガイド",
        content: "guide",
        updatedAt: 1,
        isSample: true,
      }),
    ).toBeNull();

    expect(
      bookshelfMetadataFromDocument({
        id: -2,
        title: "",
        content: "demo",
        updatedAt: 1,
      }),
    ).toBeNull();
  });
});
