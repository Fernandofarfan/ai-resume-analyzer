import { useEffect, useRef } from "react";

const FOCUSABLE =
    'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])';

// Minimal accessible-dialog behavior: Escape to close, a focus trap, initial
// focus on the first focusable element, and restoration of the previously
// focused element on close.
export function useDialog(isOpen: boolean, onClose: () => void) {
    const dialogRef = useRef<HTMLDivElement>(null);
    const restoreRef = useRef<Element | null>(null);
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    useEffect(() => {
        if (!isOpen) return;

        const originalOverflow = typeof document !== "undefined" ? document.body.style.overflow : "";
        if (typeof document !== "undefined") {
            document.body.style.overflow = "hidden";
        }

        restoreRef.current = document.activeElement;
        const dialog = dialogRef.current;

        const getFocusable = (): HTMLElement[] =>
            dialog
                ? Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
                      (el) => !el.hasAttribute("disabled")
                  )
                : [];

        // Prefer an element explicitly marked for autofocus (e.g. the safe
        // "Cancel" action in a destructive dialog), otherwise fall back to the
        // first focusable element.
        const preferred = dialog?.querySelector<HTMLElement>("[data-autofocus]");
        (preferred ?? getFocusable()[0])?.focus();

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.stopPropagation();
                onCloseRef.current();
                return;
            }
            if (event.key === "Tab") {
                const focusable = getFocusable();
                if (focusable.length === 0) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            }
        };

        document.addEventListener("keydown", onKeyDown);
        return () => {
            if (typeof document !== "undefined") {
                document.body.style.overflow = originalOverflow;
            }
            document.removeEventListener("keydown", onKeyDown);
            (restoreRef.current as HTMLElement | null)?.focus?.();
        };
    }, [isOpen]);

    return dialogRef;
}
