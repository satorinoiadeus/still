import { build } from "esbuild";
import { writeFile } from "node:fs/promises";
const result = await build({
    entryPoints: ["src/main.tsx"],
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    minify: true,
    define: { "process.env.NODE_ENV": '"production"' },
    outfile: "still.js",
});
const js = result.outputFiles
    .find((x) => x.path.endsWith(".js"))
    .text.replace(/<\/script/gi, "<\\/script");
const css = result.outputFiles.find((x) => x.path.endsWith(".css")).text;
await writeFile(
    "Still.html",
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Still — Your quiet space</title><style>${css}</style></head><body><div id="root"></div><script>${js}</script></body></html>`,
);
console.log("Created offline single-file preview: Still.html");
