import { mkdirSync, writeFileSync } from "node:fs";
import { createCanvas, registerFont } from "canvas";
import { Window } from "happy-dom";
import { decompress } from "wawoff2";
import { VARELA_ROUND_DIGITS_WOFF2 } from "../src/fonts/varela-round";
import {
    D4DebugTexture,
    D4KintsugiTexture,
    D4TemplateTexture,
} from "../src/textures/d4";
import {
    D6DebugTexture,
    D6KintsugiTexture,
    D6TemplateTexture,
} from "../src/textures/d6";
import {
    D8DebugTexture,
    D8KintsugiTexture,
    D8TemplateTexture,
} from "../src/textures/d8";
import {
    D10DebugTexture,
    D10KintsugiTexture,
    D10TemplateTexture,
    DPercentileDebugTexture,
    DPercentileKintsugiTexture,
    DPercentileTemplateTexture,
} from "../src/textures/d10";
import {
    D12DebugTexture,
    D12KintsugiTexture,
    D12TemplateTexture,
} from "../src/textures/d12";
import {
    D20DebugTexture,
    D20KintsugiTexture,
    D20TemplateTexture,
} from "../src/textures/d20";

// ttf needed for the non-browser canvas
const woff2Buffer = Buffer.from(VARELA_ROUND_DIGITS_WOFF2, "base64");
const ttfBuffer = await decompress(woff2Buffer);
const fontPath = "/tmp/varela-round.ttf";
writeFileSync(fontPath, ttfBuffer);
registerFont(fontPath, { family: "Varela Round" });

mkdirSync("dist/template", { recursive: true });
mkdirSync("dist/debug", { recursive: true });
mkdirSync("dist/kintsugi", { recursive: true });

type CanvasLike = { toBuffer: (type: string) => Buffer };

function setupDocument(width: number, height: number): void {
    const window = new Window();
    const originalCreateElement = window.document.createElement.bind(window.document);
    window.document.createElement = ((tagName: string) => {
        if (tagName.toLowerCase() === "canvas") {
            return createCanvas(width, height) as unknown as HTMLCanvasElement;
        }
        return originalCreateElement(tagName);
    }) as typeof window.document.createElement;
    globalThis.document = window.document as unknown as Document;
}

function writePng(path: string, canvas: HTMLCanvasElement): void {
    writeFileSync(path, (canvas as unknown as CanvasLike).toBuffer("image/png"));
    console.log(path);
}

console.log("-- d4");
const d4TemplateTexture = new D4TemplateTexture();
setupDocument(d4TemplateTexture.width, d4TemplateTexture.height);
writePng("dist/template/d4.png", await d4TemplateTexture.createCanvas());
const d4DebugTexture = new D4DebugTexture();
writePng("dist/debug/d4.png", await d4DebugTexture.createCanvas());
const d4KintsugiTexture = new D4KintsugiTexture({ seed: 1 });
writePng("dist/kintsugi/d4.png", await d4KintsugiTexture.createCanvas());

console.log("-- d6");
const d6TemplateTexture = new D6TemplateTexture();
setupDocument(d6TemplateTexture.width, d6TemplateTexture.height);
writePng("dist/template/d6.png", await d6TemplateTexture.createCanvas());
const d6DebugTexture = new D6DebugTexture();
writePng("dist/debug/d6.png", await d6DebugTexture.createCanvas());
const d6KintsugiTexture = new D6KintsugiTexture({ seed: 35 });
writePng("dist/kintsugi/d6.png", await d6KintsugiTexture.createCanvas());

console.log("-- d8");
const d8TemplateTexture = new D8TemplateTexture();
setupDocument(d8TemplateTexture.width, d8TemplateTexture.height);
writePng("dist/template/d8.png", await d8TemplateTexture.createCanvas());
const d8DebugTexture = new D8DebugTexture();
writePng("dist/debug/d8.png", await d8DebugTexture.createCanvas());
const d8KintsugiTexture = new D8KintsugiTexture({ seed: 1 });
writePng("dist/kintsugi/d8.png", await d8KintsugiTexture.createCanvas());

console.log("-- d12");
const d12TemplateTexture = new D12TemplateTexture();
setupDocument(d12TemplateTexture.width, d12TemplateTexture.height);
writePng("dist/template/d12.png", await d12TemplateTexture.createCanvas());
const d12DebugTexture = new D12DebugTexture();
writePng("dist/debug/d12.png", await d12DebugTexture.createCanvas());
const d12KintsugiTexture = new D12KintsugiTexture({ seed: 2 });
writePng("dist/kintsugi/d12.png", await d12KintsugiTexture.createCanvas());

console.log("-- d10");
const d10TemplateTexture = new D10TemplateTexture();
setupDocument(d10TemplateTexture.width, d10TemplateTexture.height);
writePng("dist/template/d10.png", await d10TemplateTexture.createCanvas());
const d10DebugTexture = new D10DebugTexture();
writePng("dist/debug/d10.png", await d10DebugTexture.createCanvas());
const d10KintsugiTexture = new D10KintsugiTexture({ seed: 1 });
writePng("dist/kintsugi/d10.png", await d10KintsugiTexture.createCanvas());

console.log("-- percentile");
const percentileTemplateTexture = new DPercentileTemplateTexture();
setupDocument(percentileTemplateTexture.width, percentileTemplateTexture.height);
writePng(
    "dist/template/percentile.png",
    await percentileTemplateTexture.createCanvas(),
);
const percentileDebugTexture = new DPercentileDebugTexture();
writePng("dist/debug/percentile.png", await percentileDebugTexture.createCanvas());
const percentileKintsugiTexture = new DPercentileKintsugiTexture({ seed: 1 });
writePng(
    "dist/kintsugi/percentile.png",
    await percentileKintsugiTexture.createCanvas(),
);

console.log("-- d20");
const d20TemplateTexture = new D20TemplateTexture();
setupDocument(d20TemplateTexture.width, d20TemplateTexture.height);
writePng("dist/template/d20.png", await d20TemplateTexture.createCanvas());
const d20DebugTexture = new D20DebugTexture();
writePng("dist/debug/d20.png", await d20DebugTexture.createCanvas());
const d20KintsugiTexture = new D20KintsugiTexture({ seed: 2 });
writePng("dist/kintsugi/d20.png", await d20KintsugiTexture.createCanvas());
