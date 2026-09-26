// Copies the pdf.js worker that matches the installed pdfjs-dist version into
// public/, so the main bundle and the worker can never drift apart.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(new URL("..", import.meta.url)));
const require = createRequire(import.meta.url);

const workerPath = join(
    dirname(require.resolve("pdfjs-dist/package.json")),
    "build",
    "pdf.worker.min.mjs",
);
const target = join(root, "public", "pdf.worker.min.mjs");

mkdirSync(dirname(target), { recursive: true });
copyFileSync(workerPath, target);
console.log(`pdf.worker.min.mjs synced from pdfjs-dist`);
