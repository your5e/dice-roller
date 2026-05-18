import { createCanvas } from "canvas";

// Patch HTMLCanvasElement to use node-canvas in happy-dom
const originalGetContext = globalThis.HTMLCanvasElement.prototype.getContext;
globalThis.HTMLCanvasElement.prototype.getContext = function (
    contextId: string,
    options?: CanvasRenderingContext2DSettings,
): RenderingContext | null {
    if (contextId === "2d") {
        const nodeCanvas = createCanvas(this.width, this.height);
        const ctx = nodeCanvas.getContext("2d");

        // Sync canvas properties
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
