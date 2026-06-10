import { describe, expect, it } from "vitest";
import { clipToPoints } from "../../src/textures/clip";

const pixelAt = (imageData: ImageData, x: number, y: number) => {
    const i = (y * imageData.width + x) * 4;
    return { r: imageData.data[i], g: imageData.data[i + 1], b: imageData.data[i + 2] };
};

describe("clipToPoints", () => {
    it("restricts drawing to within the clipped polygon", () => {
        const canvas = document.createElement("canvas");
        canvas.width = 100;
        canvas.height = 100;
        const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, 100, 100);
        const triangle = [
            { x: 50, y: 10 },
            { x: 90, y: 90 },
            { x: 10, y: 90 },
        ];

        clipToPoints(ctx, triangle, () => {
            // attempt to fill entire canvas with red
            ctx.fillStyle = "#ff0000";
            ctx.fillRect(0, 0, 100, 100);
        });

        const imageData = ctx.getImageData(0, 0, 100, 100);

        // red inside triangle
        const inside = pixelAt(imageData, 50, 50);
        expect(inside.r).toBe(255);
        expect(inside.g).toBe(0);
        expect(inside.b).toBe(0);

        // white outside triangle
        const outside = pixelAt(imageData, 10, 10);
        expect(outside.r).toBe(255);
        expect(outside.g).toBe(255);
        expect(outside.b).toBe(255);
    });

    it("restores context after callback completes", () => {
        const canvas = document.createElement("canvas");
        canvas.width = 100;
        canvas.height = 100;
        const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, 100, 100);

        const triangle = [
            { x: 50, y: 10 },
            { x: 90, y: 90 },
            { x: 10, y: 90 },
        ];

        clipToPoints(ctx, triangle, () => {});

        // after clipToPoints, drawing should not be clipped
        ctx.fillStyle = "#0000ff";
        ctx.fillRect(0, 0, 100, 100);

        const imageData = ctx.getImageData(0, 0, 100, 100);

        const outside = pixelAt(imageData, 10, 10);
        expect(outside.r).toBe(0);
        expect(outside.g).toBe(0);
        expect(outside.b).toBe(255);
    });
});
