import { createCanvas } from "canvas";

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
