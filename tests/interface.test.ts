import { beforeEach, describe, expect, it, vi } from "vitest";
import { roll, texture, tray } from "../src/index";
import type { Stage } from "../src/renderer";
import { getTrayDimensions } from "../src/renderer";

const originalCreateElement = document.createElement.bind(document);

vi.mock("three", async (importOriginal) => {
    const actual = await importOriginal<typeof import("three")>();
    return {
        ...actual,
        WebGLRenderer: class MockWebGLRenderer {
            domElement = {
                style: {},
                parentNode: null,
                childNodes: [],
            };
            setSize = vi.fn();
            setPixelRatio = vi.fn();
            render = vi.fn();
        },
    };
});

beforeEach(() => {
    const mockContext = {
        fillStyle: "",
        strokeStyle: "",
        lineWidth: 0,
        textAlign: "",
        textBaseline: "",
        font: "",
        letterSpacing: "",
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        closePath: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        rotate: vi.fn(),
        fillText: vi.fn(),
        roundRect: vi.fn(),
        measureText: vi.fn(() => ({ width: 10 })),
    };

    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
        if (tagName === "canvas") {
            return {
                width: 0,
                height: 0,
                getContext: () => mockContext,
            } as unknown as HTMLCanvasElement;
        }
        return originalCreateElement(tagName);
    });
});

function createMockContainer(width: number, height: number): HTMLElement {
    const container = document.createElement("div");
    Object.defineProperty(container, "clientWidth", { value: width });
    Object.defineProperty(container, "clientHeight", { value: height });
    container.appendChild = vi.fn().mockReturnValue(null);
    return container;
}

describe("camera sizing", () => {
    it("camera matches tray dimensions on initial setup", () => {
        const container = createMockContainer(800, 600);
        vi.spyOn(document, "querySelector").mockReturnValue(container);

        const stage = tray("#container") as Stage;
        const { halfWidth, halfDepth } = getTrayDimensions(800 / 600, 10);

        expect(stage.camera.left).toBeCloseTo(-halfWidth);
        expect(stage.camera.right).toBeCloseTo(halfWidth);
        expect(stage.camera.top).toBeCloseTo(halfDepth);
        expect(stage.camera.bottom).toBeCloseTo(-halfDepth);
    });

    it("camera is resized to fit", async () => {
        const container = createMockContainer(800, 600);
        vi.spyOn(document, "querySelector").mockReturnValue(container);

        const stage = tray("#container") as Stage;
        const initialHalfWidth = stage.physicsTray.halfWidth;
        const initialHalfDepth = stage.physicsTray.halfDepth;
        await roll("100d6");

        expect(stage.physicsTray.halfWidth).toBeGreaterThan(initialHalfWidth);
        expect(stage.physicsTray.halfDepth).toBeGreaterThan(initialHalfDepth);
        expect(stage.camera.left).toBeLessThan(-initialHalfWidth);
        expect(stage.camera.right).toBeGreaterThan(initialHalfWidth);
        expect(stage.camera.top).toBeGreaterThan(initialHalfDepth);
        expect(stage.camera.bottom).toBeLessThan(-initialHalfDepth);
    });

    it("camera is resized once at start, not every reroll", async () => {
        const container = createMockContainer(800, 600);
        vi.spyOn(document, "querySelector").mockReturnValue(container);

        const stage = tray("#container") as Stage;
        const updateSpy = vi.spyOn(stage.camera, "updateProjectionMatrix");

        await roll("20d6rm6");
        expect(updateSpy).toHaveBeenCalledTimes(1);
    });

    it("camera shrinks back to normal after large roll", async () => {
        const container = createMockContainer(800, 600);
        vi.spyOn(document, "querySelector").mockReturnValue(container);

        const stage = tray("#container") as Stage;
        const { halfWidth, halfDepth } = getTrayDimensions(800 / 600, 10);

        await roll("100d6");
        expect(stage.camera.right).toBeGreaterThan(halfWidth);

        await roll("1d6");
        expect(stage.camera.left).toBeCloseTo(-halfWidth);
        expect(stage.camera.right).toBeCloseTo(halfWidth);
        expect(stage.camera.top).toBeCloseTo(halfDepth);
        expect(stage.camera.bottom).toBeCloseTo(-halfDepth);
    });
});

describe("texture", () => {
    it("sets texture style on the tray", () => {
        const container = createMockContainer(800, 600);
        vi.spyOn(document, "querySelector").mockReturnValue(container);

        const stage = tray("#container") as Stage;
        expect(stage.physicsTray.textureStyle).toBe("standard");

        texture("kintsugi");
        expect(stage.physicsTray.textureStyle).toBe("kintsugi");
    });

    it("sets override flags via options", () => {
        const container = createMockContainer(800, 600);
        vi.spyOn(document, "querySelector").mockReturnValue(container);

        const stage = tray("#container") as Stage;
        expect(stage.physicsTray.overrideColours).toBe(false);
        expect(stage.physicsTray.overrideDamageColours).toBe(false);

        texture("kintsugi", { asColours: true, asDamage: true });
        expect(stage.physicsTray.overrideColours).toBe(true);
        expect(stage.physicsTray.overrideDamageColours).toBe(true);
    });

    it("throws if called before tray", async () => {
        vi.resetModules();
        const { texture: freshTexture } = await import("../src/index");
        expect(() => freshTexture("kintsugi")).toThrow("No tray");
    });
});
