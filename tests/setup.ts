import { createCanvas } from "canvas";
import type { DiceWrapper } from "../src/renderer";

class Path2DShim {
    // biome-ignore lint/complexity/noUselessConstructor: shim must accept path string
    constructor(_d?: string) {}
}
globalThis.Path2D = Path2DShim as unknown as typeof Path2D;

const originalGetContext = globalThis.HTMLCanvasElement.prototype.getContext;
globalThis.HTMLCanvasElement.prototype.getContext = function (
    contextId: string,
    options?: CanvasRenderingContext2DSettings,
): RenderingContext | null {
    if (contextId === "2d") {
        const nodeCanvas = createCanvas(this.width, this.height);
        const ctx = nodeCanvas.getContext("2d");

        Object.defineProperty(this, "width", {
            get: () => nodeCanvas.width,
            set: (v) => {
                nodeCanvas.width = v;
            },
        });
        Object.defineProperty(this, "height", {
            get: () => nodeCanvas.height,
            set: (v) => {
                nodeCanvas.height = v;
            },
        });
        this.toDataURL = nodeCanvas.toDataURL.bind(nodeCanvas);

        return ctx as unknown as CanvasRenderingContext2D;
    }
    return originalGetContext.call(this, contextId, options);
};

export async function preprogrammed(
    sides: number,
    values: number[],
): Promise<DiceWrapper> {
    const { createDie } = await import("../src/renderer");
    const wrapper = await createDie(sides);
    let i = 0;
    for (const die of wrapper.dice) {
        die.physics.readFace = () => values[i++] ?? values[values.length - 1];
    }
    return wrapper;
}
