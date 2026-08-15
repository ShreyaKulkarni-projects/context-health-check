import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const result = await build({
  entryPoints: [join(__dirname, "src/main.ts")],
  bundle: true,
  format: "iife",
  target: "es2020",
  write: false,
  minify: process.env.NODE_ENV === "production",
});

// The HTML parser ends a <script> block on the literal byte sequence "</script",
// even inside a JS string. gpt-tokenizer's bundled vocab table is built from
// real web-crawl text and does contain that exact sequence somewhere in its
// ~100k-200k entries, which silently truncated the script and broke the page.
// "<\/script" is valid, identical JS inside a string literal but no longer
// matches the HTML parser's close-tag scan.
const bundledJs = result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const template = readFileSync(join(__dirname, "index.html"), "utf8");
const output = template.replace("<!-- BUILD:INJECT_BUNDLE -->", `<script>\n${bundledJs}\n</script>`);

mkdirSync(join(__dirname, "dist"), { recursive: true });
writeFileSync(join(__dirname, "dist/index.html"), output);

console.log("Built packages/web-demo/dist/index.html - a single, dependency-free static file.");
