import { beforeEach, describe, expect, it, vi } from "vitest";
import { createD100 } from "../src/geometries/d10";

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
        return document.createElement(tagName);
    });
});

describe("d100 result combination", () => {
    it("combines 00 + 0 as 100", async () => {
        const d100 = await createD100();
        d100.dice[0].physics.readFace = () => 100;
        d100.dice[1].physics.readFace = () => 10;
        expect(d100.readResult()).toBe(100);
    });

    it("combines 30 + 7 as 37", async () => {
        const d100 = await createD100();
        d100.dice[0].physics.readFace = () => 30;
        d100.dice[1].physics.readFace = () => 7;
        expect(d100.readResult()).toBe(37);
    });

    it("combines 10 + 1 as 11", async () => {
        const d100 = await createD100();
        d100.dice[0].physics.readFace = () => 10;
        d100.dice[1].physics.readFace = () => 1;
        expect(d100.readResult()).toBe(11);
    });

    it("combines 90 + 9 as 99", async () => {
        const d100 = await createD100();
        d100.dice[0].physics.readFace = () => 90;
        d100.dice[1].physics.readFace = () => 9;
        expect(d100.readResult()).toBe(99);
    });

    it("combines 00 + 1 as 1", async () => {
        const d100 = await createD100();
        d100.dice[0].physics.readFace = () => 100;
        d100.dice[1].physics.readFace = () => 1;
        expect(d100.readResult()).toBe(1);
    });
});

describe("d100 dice creation", () => {
    it("d100 creates two dice: tens (10-100) and ones (1-10)", async () => {
        const d100 = await createD100();
        expect(d100.dice.length).toBe(2);

        const tensValues = d100.dice[0].physics.faces.map((f) => f.value).sort((a, b) => a - b);
        expect(tensValues).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);

        const onesValues = d100.dice[1].physics.faces.map((f) => f.value).sort((a, b) => a - b);
        expect(onesValues).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });
});
