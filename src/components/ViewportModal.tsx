"use client";

import {
  useEffect,
  useRef,
  type HTMLAttributes,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

const modalStack: symbol[] = [];

function removeFromModalStack(id: symbol): void {
  const index = modalStack.lastIndexOf(id);
  if (index >= 0) modalStack.splice(index, 1);
}

interface ViewportModalProps {
  title: string;
  titleId: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  showCloseButton?: boolean;
  panelClassName?: string;
  overlayProps?: HTMLAttributes<HTMLDivElement>;
  dialogProps?: HTMLAttributes<HTMLDivElement>;
  closeButtonProps?: ButtonHTMLAttributes<HTMLButtonElement>;
}

/**
 * Shared body-portal dialog shell for Editor interactions.
 *
 * The panel stays centered at every viewport width. Its header/footer remain
 * reachable while only the body scrolls. A tiny stack registry makes Escape
 * belong to the most recently opened dialog instead of triggering every
 * document-level listener at once.
 */
export default function ViewportModal({
  title,
  titleId,
  closeLabel,
  onClose,
  children,
  footer,
  showCloseButton = true,
  panelClassName = "max-w-sm",
  overlayProps,
  dialogProps,
  closeButtonProps,
}: ViewportModalProps) {
  const idRef = useRef(Symbol("tatespun-viewport-modal"));
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const id = idRef.current;
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    modalStack.push(id);

    const focusTarget = closeButtonRef.current
      ?? dialogRef.current?.querySelector<HTMLElement>(
        "button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex='-1'])"
      );
    focusTarget?.focus();

    const closeTopModalOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || modalStack.at(-1) !== id) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onClose();
    };
    document.addEventListener("keydown", closeTopModalOnEscape, true);

    return () => {
      document.removeEventListener("keydown", closeTopModalOnEscape, true);
      removeFromModalStack(id);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  const overlayClassName = [
    "fixed inset-0 z-[80] flex items-center justify-center overflow-hidden bg-black/40 p-4",
    overlayProps?.className,
  ].filter(Boolean).join(" ");
  const dialogClassName = [
    "flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden rounded-xl border border-ink/15 bg-base text-left shadow-2xl",
    panelClassName,
    dialogProps?.className,
  ].filter(Boolean).join(" ");

  return createPortal(
    <div
      {...overlayProps}
      className={overlayClassName}
      onClick={onClose}
    >
      <div
        {...dialogProps}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={dialogClassName}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-ink/10 px-4 py-3">
          <h2 id={titleId} className="text-sm font-bold text-ink">
            {title}
          </h2>
          {showCloseButton && (
            <button
              {...closeButtonProps}
              ref={closeButtonRef}
              type="button"
              aria-label={closeLabel}
              data-viewport-modal-close=""
              onClick={onClose}
              className={[
                "rounded p-1 text-ink/55 hover:bg-ink/5 hover:text-ink",
                closeButtonProps?.className,
              ].filter(Boolean).join(" ")}
            >
              ✕
            </button>
          )}
        </div>

        <div data-viewport-modal-body="" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
          {children}
        </div>

        {footer && (
          <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-ink/10 px-4 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
