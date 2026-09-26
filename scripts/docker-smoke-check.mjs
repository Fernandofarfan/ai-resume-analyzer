import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..");

console.log("🔍 Validating Docker packaging and dependency layers...");

const dockerfilePath = join(ROOT, "Dockerfile");
if (!existsSync(dockerfilePath)) {
    console.error("❌ Dockerfile not found at root");
    process.exit(1);
}

const content = readFileSync(dockerfilePath, "utf8");

const requiredLayers = [
    "COPY --from=build-env /app/build/client /app/build/client",
    "COPY --from=build-env /app/server/index.mjs /app/server/index.mjs",
    "COPY --from=build-env /app/server/config.mjs /app/server/config.mjs",
    "COPY --from=build-env /app/server/ai.mjs /app/server/ai.mjs",
    "COPY --from=build-env /app/server/lib.mjs /app/server/lib.mjs",
    "COPY --from=build-env /app/shared /app/shared",
];

for (const layer of requiredLayers) {
    if (!content.includes(layer)) {
        console.error(`❌ Missing layer in Dockerfile: "${layer}"`);
        process.exit(1);
    }
}

const requiredFiles = [
    join(ROOT, "server", "index.mjs"),
    join(ROOT, "server", "config.mjs"),
    join(ROOT, "server", "ai.mjs"),
    join(ROOT, "server", "lib.mjs"),
    join(ROOT, "shared", "schema.mjs"),
    join(ROOT, "shared", "limits.mjs"),
    join(ROOT, "package.json"),
];

for (const file of requiredFiles) {
    if (!existsSync(file)) {
        console.error(`❌ Required file missing: "${file}"`);
        process.exit(1);
    }
}

console.log(
    "✅ Docker packaging validation passed: All runtime layers and shared schemas are present!",
);
