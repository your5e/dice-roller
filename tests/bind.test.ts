import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bind, onRoll, tray } from "../src/index";

function waitForRoll(): Promise<unknown> {
    return new Promise((resolve) => {
        onRoll(resolve);
    });
}

describe("bind", () => {
    beforeEach(() => {
        tray();
    });

    afterEach(() => {
        document.body.innerHTML = "";
        vi.restoreAllMocks();
        onRoll(() => {});
    });

    it("logs notation, steps starting with initial roll, and total", async () => {
        document.body.innerHTML = '<span class="roll">1d20</span>';

        bind(".roll");
        const resultPromise = waitForRoll();
        document.querySelector(".roll")?.dispatchEvent(new MouseEvent("click"));
        const result = await resultPromise;

        expect(result).toEqual({
            notation: "1d20",
            total: expect.any(Number),
            label_totals: { "": expect.any(Number) },
            expressions: [
                {
                    notation: "1d20",
                    steps: [{ "1d20": [expect.any(Number)] }],
                    total: expect.any(Number),
                },
            ],
        });
    });

    it("logs each modifier as a step", async () => {
        document.body.innerHTML =
            '<span class="roll" data-roll="2d20kh1">with advantage</span>';

        bind(".roll");
        const resultPromise = waitForRoll();
        document.querySelector(".roll")?.dispatchEvent(new MouseEvent("click"));
        const result = await resultPromise;

        expect(result).toEqual({
            notation: "2d20kh1",
            total: expect.any(Number),
            label_totals: { "": expect.any(Number) },
            expressions: [
                {
                    notation: "2d20kh1",
                    steps: [
                        { "2d20": [expect.any(Number), expect.any(Number)] },
                        { "kh1": [expect.any(Number)] },
                    ],
                    total: expect.any(Number),
                },
            ],
        });
    });

    it("reads expression from data-roll attribute over text", async () => {
        document.body.innerHTML = '<span class="roll" data-roll="2d6">1d20</span>';

        bind(".roll");
        const resultPromise = waitForRoll();
        document.querySelector(".roll")?.dispatchEvent(new MouseEvent("click"));
        const result = await resultPromise;

        expect(result).toEqual({
            notation: "2d6",
            total: expect.any(Number),
            label_totals: { "": expect.any(Number) },
            expressions: [
                {
                    notation: "2d6",
                    steps: [{ "2d6": [expect.any(Number), expect.any(Number)] }],
                    total: expect.any(Number),
                },
            ],
        });
    });

    it("binds to multiple elements", async () => {
        document.body.innerHTML = `
            <span class="roll">1d4</span>
            <span class="roll">1d6</span>
        `;
        const results: unknown[] = [];
        onRoll((result) => results.push(result));

        bind(".roll");
        const elements = document.querySelectorAll(".roll");
        elements[0].dispatchEvent(new MouseEvent("click"));

        while (results.length < 1) {
            await new Promise((resolve) => setTimeout(resolve, 1));
        }

        elements[1].dispatchEvent(new MouseEvent("click"));

        while (results.length < 2) {
            await new Promise((resolve) => setTimeout(resolve, 1));
        }

        expect(results).toHaveLength(2);
    });

    it("logs empty result on invalid expression", async () => {
        document.body.innerHTML = '<span class="roll">invalid</span>';

        bind(".roll");
        const resultPromise = waitForRoll();
        document.querySelector(".roll")?.dispatchEvent(new MouseEvent("click"));
        const result = await resultPromise;

        expect(result).toEqual({
            notation: "invalid",
            total: 0,
            label_totals: {},
            expressions: [],
        });
    });
});
