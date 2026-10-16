import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const result = spawnSync(
    process.execPath,
    [
        "../../node_modules/@tauri-apps/cli/tauri.js",
        "android",
        "init",
        ...process.argv.slice(2),
    ],
    { stdio: "inherit" },
);
if (result.status !== 0) process.exit(result.status ?? 1);
// CLI templates may target a preview API. Keep builds on the installed stable API.
const file = "src-tauri/gen/android/app/build.gradle.kts";
const source = readFileSync(file, "utf8")
    .replace(/compileSdk = \d+/, "compileSdk = 36")
    .replace(/targetSdk = \d+/, "targetSdk = 36");
writeFileSync(file, source);
console.log("Android project configured for stable API 36.");
