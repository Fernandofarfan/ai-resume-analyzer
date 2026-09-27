// PDF processing via pdfjs-dist. Enforces hard limits on page count, canvas
// resolution and extracted text size so that a malicious or pathological PDF
// cannot freeze the browser or exhaust memory.

export interface PageExtractionInfo {
    pageNumber: number;
    charCount: number;
    hasMultipleColumns: boolean;
    isScanned: boolean;
}

export interface PdfProcessResult {
    text: string;
    image: File | null;
    noText: boolean;
    hasMultipleColumns: boolean;
    extractionQuality: "high" | "medium" | "low";
    pageCount?: number;
    scannedPagesCount?: number;
    pages?: PageExtractionInfo[];
    error?: string;
}

import { MAX_PDF_BYTES, MAX_PDF_PAGES } from "./limits";

const MAX_PAGES = MAX_PDF_PAGES;
const MAX_CANVAS_DIMENSION = 2400;
const MAX_TEXT_CHARS = 45_000;
const MIN_TEXT_CHARS = 30;
const BASE_SCALE = 4;

interface PdfTextItem {
    str: string;
    transform?: number[];
    hasEOL?: boolean;
}

interface PdfJsPage {
    getViewport: (opts: { scale: number }) => { width: number; height: number };
    render: (opts: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => {
        promise: Promise<void>;
        cancel?: () => void;
    };
    getTextContent: () => Promise<{ items: PdfTextItem[] }>;
    cleanup?: () => void;
}

interface PdfJsDocument {
    numPages: number;
    getPage: (pageNumber: number) => Promise<PdfJsPage>;
    cleanup?: () => Promise<void>;
    destroy: () => void;
}

interface PdfJsLib {
    GlobalWorkerOptions: { workerSrc: string };
    getDocument: (opts: { data: ArrayBuffer }) => { promise: Promise<PdfJsDocument> };
}

let pdfjsLib: PdfJsLib | null = null;
let loadPromise: Promise<PdfJsLib> | null = null;

const loadPdfJs = async (): Promise<PdfJsLib> => {
    if (pdfjsLib) return pdfjsLib;
    if (loadPromise) return loadPromise;

    loadPromise = (async () => {
        // @ts-expect-error - pdfjs-dist/build/pdf.mjs is not a typed module
        const lib = (await import("pdfjs-dist/build/pdf.mjs")) as PdfJsLib;
        lib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        pdfjsLib = lib;
        return lib;
    })();

    try {
        return await loadPromise;
    } catch (err) {
        // A single transient chunk-load failure must not poison the cache:
        // without this reset every later parse would reuse the rejected promise.
        loadPromise = null;
        throw err;
    }
};

const assertNotAborted = (signal?: AbortSignal): void => {
    if (signal?.aborted) {
        throw new DOMException("Operation aborted", "AbortError");
    }
};

const openPdfDocument = async (file: File, signal?: AbortSignal): Promise<PdfJsDocument> => {
    assertNotAborted(signal);

    if (file.size > MAX_PDF_BYTES) {
        throw new Error(
            `PDF exceeds the maximum size of ${Math.round(MAX_PDF_BYTES / 1024 / 1024)} MB`,
        );
    }

    const lib = await loadPdfJs();
    assertNotAborted(signal);

    const arrayBuffer = await file.arrayBuffer();
    assertNotAborted(signal);

    // Basic %PDF signature check before handing the bytes to pdf.js.
    const headerBytes = new Uint8Array(arrayBuffer.slice(0, 5));
    if (String.fromCharCode(...Array.from(headerBytes)) !== "%PDF-") {
        throw new Error("Invalid PDF: missing %PDF header");
    }

    let pdf: PdfJsDocument;
    try {
        pdf = await lib.getDocument({ data: arrayBuffer }).promise;
    } catch (err) {
        if ((err as { name?: string } | null)?.name === "PasswordException") {
            throw new Error("PDF is password-protected", { cause: err });
        }
        throw new Error("Failed to parse PDF (corrupted or unsupported)", { cause: err });
    }

    if (pdf.numPages > MAX_PAGES) {
        pdf.destroy();
        throw new Error(`PDF exceeds the maximum of ${MAX_PAGES} pages`);
    }

    return pdf;
};

const renderFirstPage = async (
    pdf: PdfJsDocument,
    originalName: string,
    signal?: AbortSignal,
): Promise<File | null> => {
    assertNotAborted(signal);
    const page = await pdf.getPage(1);
    assertNotAborted(signal);

    const baseViewport = page.getViewport({ scale: 1 });
    // Clamp the scale so the resulting canvas never exceeds the resolution cap.
    // A tiny positive floor guards against zero-scale edge cases without ever
    // pushing the canvas back over the limit.
    const scale = Math.max(
        0.05,
        Math.min(
            BASE_SCALE,
            MAX_CANVAS_DIMENSION / Math.max(baseViewport.width, baseViewport.height),
        ),
    );
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    const context = canvas.getContext("2d");
    if (!context) {
        throw new Error("Canvas 2D context is unavailable");
    }
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    const renderTask = page.render({ canvasContext: context, viewport });
    const onAbort = () => {
        try {
            renderTask.cancel?.();
        } catch {
            // Already finished.
        }
    };
    if (signal) {
        if (signal.aborted) {
            onAbort();
        } else {
            signal.addEventListener("abort", onAbort, { once: true });
        }
    }
    try {
        await renderTask.promise;
    } finally {
        signal?.removeEventListener("abort", onAbort);
    }
    assertNotAborted(signal);

    return new Promise<File | null>((resolve) => {
        canvas.toBlob(
            (blob) => {
                if (blob) {
                    const cleanName = originalName.replace(/\.pdf$/i, "");
                    resolve(new File([blob], `${cleanName}.jpg`, { type: "image/jpeg" }));
                } else {
                    resolve(null);
                }
            },
            // JPEG encodes an order of magnitude faster than PNG at this
            // resolution and keeps the stored preview within quota; the page is
            // a rendered photo of a document, so lossy compression is invisible.
            "image/jpeg",
            0.9,
        );
    });
};

export const buildPageText = (items: PdfTextItem[]): string => {
    const positioned = items
        .filter((item) => item.str && item.str.trim().length > 0)
        .map((item) => ({
            str: item.str,
            x: item.transform?.[4] ?? 0,
            y: item.transform?.[5] ?? 0,
        }))
        .sort((a, b) => {
            // Group by vertical position (top-to-bottom), then left-to-right,
            // so multi-column layouts are reconstructed in reading order.
            if (Math.abs(b.y - a.y) > 3) return b.y - a.y;
            return a.x - b.x;
        });

    const lines: string[] = [];
    let currentY: number | null = null;
    let currentLine = "";
    for (const item of positioned) {
        if (currentY === null || Math.abs(item.y - currentY) > 3) {
            if (currentLine) lines.push(currentLine.trimEnd());
            currentLine = item.str;
            currentY = item.y;
        } else {
            currentLine += " " + item.str;
        }
    }
    if (currentLine) lines.push(currentLine.trimEnd());
    return lines.join("\n");
};

// Heuristic detection of multi-column layouts: within a single visual line, a
// large horizontal gap between two runs of text strongly suggests columns.
export const detectColumns = (items: PdfTextItem[]): boolean => {
    const positioned = items
        .filter((item) => item.str && item.str.trim().length > 0)
        .map((item) => ({ x: item.transform?.[4] ?? 0, y: item.transform?.[5] ?? 0 }))
        .sort((a, b) => a.y - b.y);

    if (positioned.length < 4) return false;

    const lines: number[][] = [];
    let current: number[] = [];
    let lastY: number | null = null;
    for (const p of positioned) {
        if (lastY === null || Math.abs(p.y - lastY) > 3) {
            if (current.length) lines.push(current);
            current = [p.x];
            lastY = p.y;
        } else {
            current.push(p.x);
        }
    }
    if (current.length) lines.push(current);

    for (const xs of lines) {
        xs.sort((a, b) => a - b);
        for (let i = 1; i < xs.length; i++) {
            if (xs[i] - xs[i - 1] > 100) return true;
        }
    }
    return false;
};

const extractText = async (
    pdf: PdfJsDocument,
    signal?: AbortSignal,
): Promise<{
    text: string;
    hasMultipleColumns: boolean;
    pageCount: number;
    scannedPagesCount: number;
    pages: PageExtractionInfo[];
}> => {
    let fullText = "";
    let hasColumns = false;
    const pages: PageExtractionInfo[] = [];
    let scannedPagesCount = 0;

    for (let i = 1; i <= pdf.numPages; i++) {
        assertNotAborted(signal);
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageCols = detectColumns(textContent.items);
        if (pageCols) hasColumns = true;

        const pageText = buildPageText(textContent.items);
        const charCount = pageText.trim().length;
        const isScanned = charCount < MIN_TEXT_CHARS;
        if (isScanned) scannedPagesCount++;

        pages.push({
            pageNumber: i,
            charCount,
            hasMultipleColumns: pageCols,
            isScanned,
        });

        // Release the per-page resources eagerly; holding every page until the
        // document is destroyed spikes memory on long/scanned PDFs.
        page.cleanup?.();

        fullText += pageText + "\n";

        if (fullText.length > MAX_TEXT_CHARS) {
            break;
        }
    }

    return {
        text: fullText.trim().slice(0, MAX_TEXT_CHARS),
        hasMultipleColumns: hasColumns,
        pageCount: pdf.numPages,
        scannedPagesCount,
        pages,
    };
};

// Load the PDF once and produce both the first-page preview image and the
// extracted text, avoiding a double parse of the same document.
export const processPdf = async (file: File, signal?: AbortSignal): Promise<PdfProcessResult> => {
    let pdf: PdfJsDocument | null = null;
    try {
        pdf = await openPdfDocument(file, signal);
        const image = await renderFirstPage(pdf, file.name, signal);
        const { text, hasMultipleColumns, pageCount, scannedPagesCount, pages } = await extractText(
            pdf,
            signal,
        );
        const noText = text.trim().length < MIN_TEXT_CHARS;
        const extractionQuality: "high" | "medium" | "low" =
            noText || scannedPagesCount > 0 ? "low" : text.length > 300 ? "high" : "medium";
        return {
            text,
            image,
            noText,
            hasMultipleColumns,
            extractionQuality,
            pageCount,
            scannedPagesCount,
            pages,
        };
    } catch (err) {
        if (signal?.aborted || (err instanceof Error && err.name === "AbortError")) {
            throw err;
        }
        const message = err instanceof Error ? err.message : String(err);
        return {
            text: "",
            image: null,
            noText: true,
            hasMultipleColumns: false,
            extractionQuality: "low",
            pageCount: 0,
            scannedPagesCount: 0,
            pages: [],
            error: message,
        };
    } finally {
        if (pdf) {
            try {
                await pdf.cleanup?.();
            } catch {
                // Best-effort resource release.
            }
            pdf.destroy();
        }
    }
};

export const extractPdfText = async (file: File, signal?: AbortSignal): Promise<string> => {
    let pdf: PdfJsDocument | null = null;
    try {
        pdf = await openPdfDocument(file, signal);
        const { text } = await extractText(pdf, signal);
        return text;
    } catch (err) {
        // A user cancellation is not a parse failure: let callers distinguish it
        // from "no extractable text" (scanned PDF).
        if (signal?.aborted || (err instanceof Error && err.name === "AbortError")) {
            throw err;
        }
        console.error("Failed to extract text from PDF:", err);
        return "";
    } finally {
        if (pdf) {
            try {
                await pdf.cleanup?.();
            } catch {
                // Best-effort resource release.
            }
            pdf.destroy();
        }
    }
};
