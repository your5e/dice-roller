import { describe, expect, it } from "vitest";
import { roll } from "../src/index";

describe("roll", () => {
    it("rolls simple dice", () => {
        const result = roll("2d6");

        expect(result.total).toBeGreaterThanOrEqual(2);
        expect(result.total).toBeLessThanOrEqual(12);
    });

    it("rolls with advantage", () => {
        const result = roll("2d20kh1");

        expect(result.kept).toHaveLength(1);
        expect(result.total).toBeGreaterThanOrEqual(1);
        expect(result.total).toBeLessThanOrEqual(20);
    });

    it("rolls with disadvantage", () => {
        const result = roll("2d20kl1");

        expect(result.kept).toHaveLength(1);
        expect(result.total).toBeGreaterThanOrEqual(1);
        expect(result.total).toBeLessThanOrEqual(20);
    });

    it("rolls ability scores", () => {
        const result = roll("4d6dl1");

        expect(result.kept).toHaveLength(3);
        expect(result.total).toBeGreaterThanOrEqual(3);
        expect(result.total).toBeLessThanOrEqual(18);
    });

    it("applies positive modifiers", () => {
        const result = roll("1d20+5");

        expect(result.total).toBeGreaterThanOrEqual(6);
        expect(result.total).toBeLessThanOrEqual(25);
    });

    it("applies negative modifiers", () => {
        const result = roll("1d20-3");

        expect(result.total).toBeGreaterThanOrEqual(-2);
        expect(result.total).toBeLessThanOrEqual(17);
    });

    it("combines multiple expressions", () => {
        const result = roll("2d6+7 1d8");

        expect(result.total).toBeGreaterThanOrEqual(10);
        expect(result.total).toBeLessThanOrEqual(27);
    });

    it("combines damage with multiple types", () => {
        const result = roll("1d8+5 2d6");

        expect(result.total).toBeGreaterThanOrEqual(8);
        expect(result.total).toBeLessThanOrEqual(25);
    });

    it("kept values sum to total minus bonus", () => {
        const result = roll("3d6+5");
        const sum = result.kept.reduce((a, b) => a + b, 0);

        expect(result.total).toBe(sum + 5);
    });

    it("kept values sum to total for combined expressions", () => {
        const result = roll("2d6+3 1d8");
        const sum = result.kept.reduce((a, b) => a + b, 0);

        expect(result.total).toBe(sum + 3);
    });

    it("rerolls use the same die size", () => {
        for (let i = 0; i < 100; i++) {
            const result = roll("1d4rb3");

            for (const value of result.kept) {
                expect(value).toBeGreaterThanOrEqual(1);
                expect(value).toBeLessThanOrEqual(4);
            }
        }
    });
});
