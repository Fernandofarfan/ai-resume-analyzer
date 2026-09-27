import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatSize(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

    // Determine the appropriate unit by calculating the log, clamped to the
    // available units so huge inputs cannot index past the array.
    const i = Math.min(sizes.length - 1, Math.max(0, Math.floor(Math.log(bytes) / Math.log(k))));

    // Format with 2 decimal places and round
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// `crypto.randomUUID` is only available in secure contexts; over plain HTTP
// (LAN testing) it is undefined, so fall back instead of throwing a TypeError.
export const generateUUID = (): string =>
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `id_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

// Trigger a client-side download. The anchor is attached to the document and the
// object URL is revoked on a later task: revoking synchronously after `click()`
// can abort the download in some browsers.
export const downloadBlob = (blob: Blob, filename: string): void => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
};
