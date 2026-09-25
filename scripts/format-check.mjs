import fs from "node:fs";
import path from "node:path";

const CHECK_EXTENSIONS = new Set([
    ".ts",
    ".tsx",
    ".js",
    ".mjs",
    ".json",
    ".css",
    ".md",
]);

const IGNORE_DIRS = new Set([
    "node_modules",
    ".git",
    "build",
    ".react-router",
    "dist",
    ".system_generated",
    "public",
]);

const walkDir = (dir, fileList = []) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        if (IGNORE_DIRS.has(entry.name)) continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walkDir(fullPath, fileList);
        } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (CHECK_EXTENSIONS.has(ext)) {
                fileList.push(fullPath);
            }
        }
    }
    return fileList;
};

console.log("🔍 Validating source code formatting and whitespace...");

const rootDir = process.cwd();
const files = walkDir(rootDir);
const errors = [];

for (const file of files) {
    const rel = path.relative(rootDir, file).replace(/\\/g, "/");
    const content = fs.readFileSync(file, "utf8");
    const lines = content.split("\n");

    lines.forEach((line, index) => {
        // Strip carriage return if present before testing trailing space
        const clean = line.endsWith("\r") ? line.slice(0, -1) : line;
        if (/[ \t]+$/.test(clean)) {
            errors.push(`${rel}:${index + 1} - Trailing whitespace detected`);
        }
    });

    if (content.length > 0 && !content.endsWith("\n")) {
        errors.push(`${rel} - File must end with a newline`);
    }
}

if (errors.length > 0) {
    console.error(`❌ Formatting validation failed with ${errors.length} issue(s):`);
    for (const err of errors.slice(0, 30)) {
        console.error(`   ${err}`);
    }
    if (errors.length > 30) {
        console.error(`   ... and ${errors.length - 30} more`);
    }
    process.exit(1);
} else {
    console.log(`✅ Formatting check passed cleanly for all ${files.length} files!`);
}
