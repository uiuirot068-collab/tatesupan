"use client";

/**
 * CST-PORT-012: images of the (at most) two pages the open 3D book shows.
 *
 * Only while the book is open or ajar, only the two pages of the current
 * spread. A page is photographed again when its source changes (typing,
 * settings, images); the old image stays on screen until the new one is
 * ready, so the book never flashes blank while editing.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { capturePreviewPageTexture } from "@/utils/book3dCapture";
import type { Book3DPageTexture } from "./Book3DPreview";

type Entry = { source: unknown; texture: Book3DPageTexture };

export type Book3DPageTextureSource = {
  /** true while the book is open / ajar and visible */
  enabled: boolean;
  /** presentation indices of the spread (null = no page on that side) */
  indices: ReadonlyArray<number | null>;
  /** identity changes whenever any page content / setting may have changed */
  source: unknown;
  /** do not capture now (an export is running) */
  paused: boolean;
  /** mounts the preview pages at these presentation indices (virtualized preview) */
  mount: (indices: number[]) => void;
  /** the preview element of a presentation index, if mounted */
  elementAt: (index: number) => HTMLElement | null;
};

const CAPTURE_DELAY_MS = 350;
const MOUNT_RETRIES = 12;
const KEEP_ENTRIES = 6;

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function useBook3DPageTextures({
  enabled,
  indices,
  source,
  paused,
  mount,
  elementAt,
}: Book3DPageTextureSource): Record<number, Book3DPageTexture> {
  const [entries, setEntries] = useState<Map<number, Entry>>(() => new Map());
  const entriesRef = useRef(entries);
  const callbacks = useRef({ mount, elementAt });
  useLayoutEffect(() => {
    entriesRef.current = entries;
    callbacks.current = { mount, elementAt };
  });
  const runRef = useRef(0);

  const wanted = indices.filter((index): index is number => index !== null);
  const wantedKey = wanted.join(",");

  useEffect(() => {
    if (!enabled || paused || wanted.length === 0) return;
    const stale = wanted.filter((index) => entriesRef.current.get(index)?.source !== source);
    if (stale.length === 0) return;
    const run = ++runRef.current;
    // pages never photographed before show as "preparing" right away
    setEntries((current) => {
      const next = new Map(current);
      let changed = false;
      for (const index of stale) {
        if (!next.has(index)) {
          next.set(index, { source: null, texture: { status: "loading" } });
          changed = true;
        }
      }
      return changed ? next : current;
    });
    const timer = window.setTimeout(async () => {
      for (const index of stale) {
        if (run !== runRef.current) return;
        callbacks.current.mount(wanted);
        let element: HTMLElement | null = null;
        for (let attempt = 0; attempt < MOUNT_RETRIES && !element; attempt += 1) {
          await nextFrame();
          element = callbacks.current.elementAt(index);
          if (!element) await wait(60);
        }
        if (run !== runRef.current) return;
        let texture: Book3DPageTexture = { status: "missing" };
        if (element) {
          try {
            texture = { status: "ready", url: await capturePreviewPageTexture(element) };
          } catch {
            texture = { status: "missing" };
          }
        }
        if (run !== runRef.current) {
          if (texture.status === "ready") URL.revokeObjectURL(texture.url);
          return;
        }
        const next = new Map(entriesRef.current);
        const previous = next.get(index)?.texture;
        if (previous?.status === "ready") {
          if (texture.status === "ready") URL.revokeObjectURL(previous.url);
          else texture = previous; // keep the last good image
        }
        next.delete(index);
        next.set(index, { source, texture });
        // keep only the most recent few
        while (next.size > KEEP_ENTRIES) {
          const oldest = next.keys().next().value as number;
          const dropped = next.get(oldest)?.texture;
          if (dropped?.status === "ready") URL.revokeObjectURL(dropped.url);
          next.delete(oldest);
        }
        entriesRef.current = next;
        setEntries(next);
      }
      callbacks.current.mount([]);
    }, CAPTURE_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
    };
    // wantedKey stands for `wanted`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, paused, wantedKey, source]);

  // release every image when the preview goes away
  useEffect(
    () => () => {
      runRef.current += 1;
      for (const entry of entriesRef.current.values()) {
        if (entry.texture.status === "ready") URL.revokeObjectURL(entry.texture.url);
      }
    },
    [],
  );

  const result: Record<number, Book3DPageTexture> = {};
  for (const index of wanted) {
    const entry = entries.get(index);
    if (entry) result[index] = entry.texture;
  }
  return result;
}
