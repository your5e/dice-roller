import { readFileSync } from "node:fs";
import { build } from "esbuild";

function readLicense(path: string): string {
    return readFileSync(path, "utf-8").trim();
}

function extractCommentBlock(path: string): string {
    const content = readFileSync(path, "utf-8");
    const match = content.match(/\/\*\n([\s\S]*?)\n\s*\*\//);
    if (!match) throw new Error(`No comment block found in ${path}`);
    return match[1];
}

function stripCommentPrefix(text: string): string {
    return text
        .split("\n")
        .map((line) => line.replace(/^ \* ?/, ""))
        .join("\n");
}

function formatAsComment(text: string): string {
    return text
        .split("\n")
        .map((line) => ` * ${line}`.trimEnd())
        .join("\n");
}

const threeLicense = readLicense("node_modules/three/LICENSE");
const cannonLicense = stripCommentPrefix(
    extractCommentBlock("node_modules/cannon-es/LICENSE"),
);
const lucideLicense = readLicense("node_modules/lucide/LICENSE");
const varelaLicense = extractCommentBlock("src/fonts/varela-round.ts");

const separator =
    "\n *\n * ---------------------------------------------------------------------------\n *\n";

const banner = [
    "/*!",
    " * @license",
    " *",
    formatAsComment(threeLicense),
    separator,
    formatAsComment(cannonLicense),
    separator,
    formatAsComment(lucideLicense),
    separator,
    formatAsComment(varelaLicense),
    " */",
].join("\n");

await build({
    entryPoints: ["src/index.ts"],
    bundle: true,
    format: "iife",
    globalName: "DiceRoller",
    banner: { js: banner },
    outfile: "dist/dice-roller.js",
});
