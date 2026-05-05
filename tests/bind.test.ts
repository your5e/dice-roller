import { afterEach, describe, expect, it, vi } from "vitest";
import { bind } from "../src/index";

describe("bind", () => {
    afterEach(() => {
        document.body.innerHTML = "";
        vi.restoreAllMocks();
    });

    it("logs notation, steps starting with initial roll, and total", () => {
        document.body.innerHTML = '<span class="roll">1d20</span>';
        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

        bind(".roll");
        document.querySelector(".roll")?.dispatchEvent(new MouseEvent("click"));

        expect(consoleSpy).toHaveBeenCalledOnce();
        const result = consoleSpy.mock.calls[0][0];
        expect(result.notation).toBe("1d20");
        expect(result.steps).toHaveLength(1);
        expect(result.steps[0]["1d20"]).toHaveLength(1);
        expect(result.total).toBeGreaterThanOrEqual(1);
        expect(result.total).toBeLessThanOrEqual(20);
    });

    it("logs each modifier as a step", () => {
        document.body.innerHTML =
            '<span class="roll" data-roll="2d20kh1">with advantage</span>';
        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

        bind(".roll");
        document.querySelector(".roll")?.dispatchEvent(new MouseEvent("click"));

        expect(consoleSpy).toHaveBeenCalledOnce();
        const result = consoleSpy.mock.calls[0][0];
        expect(result.notation).toBe("2d20kh1");
        expect(result.steps).toHaveLength(2);
        expect(result.steps[0]["2d20"]).toHaveLength(2);
        expect(result.steps[1].kh1).toHaveLength(1);
        expect(result.total).toBeGreaterThanOrEqual(1);
        expect(result.total).toBeLessThanOrEqual(20);
    });

    it("reads expression from data-roll attribute over text", () => {
        document.body.innerHTML = '<span class="roll" data-roll="2d6">1d20</span>';
        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

        bind(".roll");
        document.querySelector(".roll")?.dispatchEvent(new MouseEvent("click"));

        expect(consoleSpy).toHaveBeenCalledOnce();
        const result = consoleSpy.mock.calls[0][0];
        expect(result.notation).toBe("2d6");
        expect(result.steps).toHaveLength(1);
        expect(result.steps[0]["2d6"]).toHaveLength(2);
        expect(result.total).toBeGreaterThanOrEqual(2);
        expect(result.total).toBeLessThanOrEqual(12);
    });

    it("binds to multiple elements", () => {
        document.body.innerHTML = `
            <span class="roll">1d4</span>
            <span class="roll">1d6</span>
        `;
        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

        bind(".roll");
        const elements = document.querySelectorAll(".roll");
        elements[0].dispatchEvent(new MouseEvent("click"));
        elements[1].dispatchEvent(new MouseEvent("click"));

        expect(consoleSpy).toHaveBeenCalledTimes(2);
    });

    it("logs empty result on invalid expression", () => {
        document.body.innerHTML = '<span class="roll">invalid</span>';
        const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

        bind(".roll");
        document.querySelector(".roll")?.dispatchEvent(new MouseEvent("click"));

        expect(consoleSpy).toHaveBeenCalledOnce();
        const result = consoleSpy.mock.calls[0][0];
        expect(result.steps).toHaveLength(0);
        expect(result.total).toBe(0);
    });
});
