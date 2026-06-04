import { mkdirSync, writeFileSync } from "node:fs";
import { createCanvas, registerFont } from "canvas";
import { Window } from "happy-dom";
import { decompress } from "wawoff2";
import { VARELA_ROUND_DIGITS_WOFF2 } from "../src/fonts/varela-round";
import {
    D4DebugTexture,
    D4KintsugiTexture,
    D4PrideTexture,
    D4TemplateTexture,
} from "../src/textures/d4";
import {
    D6DebugTexture,
    D6KintsugiTexture,
    D6PrideTexture,
    D6TemplateTexture,
} from "../src/textures/d6";
import {
    D8DebugTexture,
    D8KintsugiTexture,
    D8PrideTexture,
    D8TemplateTexture,
} from "../src/textures/d8";
import {
    D10DebugTexture,
    D10KintsugiTexture,
    D10PrideTexture,
    D10TemplateTexture,
    DPercentileDebugTexture,
    DPercentileKintsugiTexture,
    DPercentilePrideTexture,
    DPercentileTemplateTexture,
} from "../src/textures/d10";
import {
    D12DebugTexture,
    D12KintsugiTexture,
    D12PrideTexture,
    D12TemplateTexture,
} from "../src/textures/d12";
import {
    D20DebugTexture,
    D20KintsugiTexture,
    D20PrideTexture,
    D20TemplateTexture,
} from "../src/textures/d20";

const DICE_NAMES = ["d4", "d6", "d8", "d10", "d12", "d20", "percentile"] as const;
const TEXTURE_NAMES = ["template", "debug", "kintsugi", "pride"] as const;

type DiceName = (typeof DICE_NAMES)[number];
type TextureName = (typeof TEXTURE_NAMES)[number];

const args = process.argv.slice(2);
const requestedDice = new Set<DiceName>();
const requestedTextures = new Set<TextureName>();

for (const arg of args) {
    if (DICE_NAMES.includes(arg as DiceName)) {
        requestedDice.add(arg as DiceName);
    } else if (TEXTURE_NAMES.includes(arg as TextureName)) {
        requestedTextures.add(arg as TextureName);
    } else {
        console.error(`Unknown argument: ${arg}`);
        console.error(`Dice: ${DICE_NAMES.join(", ")}`);
        console.error(`Textures: ${TEXTURE_NAMES.join(", ")}`);
        process.exit(1);
    }
}

function shouldGenerateDie(name: DiceName): boolean {
    return requestedDice.size === 0 || requestedDice.has(name);
}

function shouldGenerateTexture(name: TextureName): boolean {
    return requestedTextures.size === 0 || requestedTextures.has(name);
}

// ttf needed for the non-browser canvas
const woff2Buffer = Buffer.from(VARELA_ROUND_DIGITS_WOFF2, "base64");
const ttfBuffer = await decompress(woff2Buffer);
const fontPath = "/tmp/varela-round.ttf";
writeFileSync(fontPath, ttfBuffer);
registerFont(fontPath, { family: "Varela Round" });

for (const name of TEXTURE_NAMES) {
    if (shouldGenerateTexture(name)) {
        mkdirSync(`dist/${name}`, { recursive: true });
    }
}

type CanvasLike = { toBuffer: (type: string) => Buffer };
type TextureClass = new () => { createCanvas: () => Promise<HTMLCanvasElement> };
type TemplateClass = new () => {
    width: number;
    height: number;
    createCanvas: () => Promise<HTMLCanvasElement>;
};
type KintsugiClass = new (opts: {
    seed: number;
}) => {
    createCanvas: () => Promise<HTMLCanvasElement>;
};

interface DieConfig {
    name: DiceName;
    Template: TemplateClass;
    Debug: TextureClass;
    Kintsugi: KintsugiClass;
    Pride: TextureClass;
    seed: number;
}

const DICE_CONFIG: DieConfig[] = [
    {
        name: "d4",
        Template: D4TemplateTexture,
        Debug: D4DebugTexture,
        Kintsugi: D4KintsugiTexture,
        Pride: D4PrideTexture,
        seed: 1,
    },
    {
        name: "d6",
        Template: D6TemplateTexture,
        Debug: D6DebugTexture,
        Kintsugi: D6KintsugiTexture,
        Pride: D6PrideTexture,
        seed: 35,
    },
    {
        name: "d8",
        Template: D8TemplateTexture,
        Debug: D8DebugTexture,
        Kintsugi: D8KintsugiTexture,
        Pride: D8PrideTexture,
        seed: 1,
    },
    {
        name: "d10",
        Template: D10TemplateTexture,
        Debug: D10DebugTexture,
        Kintsugi: D10KintsugiTexture,
        Pride: D10PrideTexture,
        seed: 1,
    },
    {
        name: "d12",
        Template: D12TemplateTexture,
        Debug: D12DebugTexture,
        Kintsugi: D12KintsugiTexture,
        Pride: D12PrideTexture,
        seed: 2,
    },
    {
        name: "d20",
        Template: D20TemplateTexture,
        Debug: D20DebugTexture,
        Kintsugi: D20KintsugiTexture,
        Pride: D20PrideTexture,
        seed: 2,
    },
    {
        name: "percentile",
        Template: DPercentileTemplateTexture,
        Debug: DPercentileDebugTexture,
        Kintsugi: DPercentileKintsugiTexture,
        Pride: DPercentilePrideTexture,
        seed: 1,
    },
];

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

for (const die of DICE_CONFIG) {
    if (!shouldGenerateDie(die.name)) continue;
    console.log(`-- ${die.name}`);
    const templateTexture = new die.Template();
    setupDocument(templateTexture.width, templateTexture.height);
    if (shouldGenerateTexture("template")) {
        writePng(`dist/template/${die.name}.png`, await templateTexture.createCanvas());
    }
    if (shouldGenerateTexture("debug")) {
        writePng(`dist/debug/${die.name}.png`, await new die.Debug().createCanvas());
    }
    if (shouldGenerateTexture("kintsugi")) {
        writePng(
            `dist/kintsugi/${die.name}.png`,
            await new die.Kintsugi({ seed: die.seed }).createCanvas(),
        );
    }
    if (shouldGenerateTexture("pride")) {
        writePng(`dist/pride/${die.name}.png`, await new die.Pride().createCanvas());
    }
}
