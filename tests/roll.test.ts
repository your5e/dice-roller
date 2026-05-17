import { describe, expect, it } from "vitest";
import { roll } from "../src/index";

describe("roll", () => {
    it("rolls simple dice", () => {
        const result = roll("2d6");

        expect(result.steps).toHaveLength(1);
        expect(result.steps[0]["2d6"]).toHaveLength(2);
        expect(result.total).toBeGreaterThanOrEqual(2);
        expect(result.total).toBeLessThanOrEqual(12);
    });

    it("rolls with advantage", () => {
        const result = roll("2d20kh1");

        expect(result.steps).toHaveLength(2);
        expect(result.steps[0]["2d20"]).toHaveLength(2);
        expect(result.steps[1].kh1).toHaveLength(1);
        expect(result.total).toBeGreaterThanOrEqual(1);
        expect(result.total).toBeLessThanOrEqual(20);
    });

    it("rolls with disadvantage", () => {
        const result = roll("2d20kl1");

        expect(result.steps).toHaveLength(2);
        expect(result.steps[0]["2d20"]).toHaveLength(2);
        expect(result.steps[1].kl1).toHaveLength(1);
        expect(result.total).toBeGreaterThanOrEqual(1);
        expect(result.total).toBeLessThanOrEqual(20);
    });

    it("rolls ability scores", () => {
        const result = roll("4d6dl1");

        expect(result.steps).toHaveLength(2);
        expect(result.steps[0]["4d6"]).toHaveLength(4);
        expect(result.steps[1].dl1).toHaveLength(3);
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

        expect(result.steps).toHaveLength(2);
        expect(result.steps[0]["2d6"]).toHaveLength(2);
        expect(result.steps[1]["1d8"]).toHaveLength(1);
        expect(result.total).toBeGreaterThanOrEqual(10);
        expect(result.total).toBeLessThanOrEqual(27);
    });

    it("combines damage with multiple types", () => {
        const result = roll("1d8+5 2d6");

        expect(result.steps).toHaveLength(2);
        expect(result.steps[0]["1d8"]).toHaveLength(1);
        expect(result.steps[1]["2d6"]).toHaveLength(2);
        expect(result.total).toBeGreaterThanOrEqual(8);
        expect(result.total).toBeLessThanOrEqual(25);
    });

    it("initial roll values sum to total when no modifiers", () => {
        const result = roll("3d6");
        const values = result.steps[0]["3d6"];
        const sum = values.reduce((a, b) => a + b, 0);

        expect(result.total).toBe(sum);
    });

    it("initial roll values plus bonus sum to total", () => {
        const result = roll("3d6+5");
        const values = result.steps[0]["3d6"];
        const sum = values.reduce((a, b) => a + b, 0);

        expect(result.total).toBe(sum + 5);
    });

    it("rerolls use the same die size", () => {
        for (let i = 0; i < 100; i++) {
            const result = roll("1d4rb3");
            const finalValues = result.steps[1].rb3;

            for (const value of finalValues) {
                expect(value).toBeGreaterThanOrEqual(1);
                expect(value).toBeLessThanOrEqual(4);
            }
        }
    });

    it("returns empty result when no valid expressions found", () => {
        const result = roll("garbage");

        expect(result.steps).toHaveLength(0);
        expect(result.total).toBe(0);
    });

    it("ignores invalid parts of expression", () => {
        const result = roll("1d20 garbage 2d6");

        expect(result.steps).toHaveLength(2);
        expect(result.steps[0]["1d20"]).toHaveLength(1);
        expect(result.steps[1]["2d6"]).toHaveLength(2);
    });

    describe("d100", () => {
        it("rolls a percentile value", () => {
            const result = roll("1d100");

            expect(result.steps).toHaveLength(1);
            expect(result.steps[0]["1d100"]).toHaveLength(1);
            expect(result.total).toBeGreaterThanOrEqual(1);
            expect(result.total).toBeLessThanOrEqual(100);
        });

        it("produces varied results across multiple rolls", () => {
            const seen = new Set<number>();

            for (let i = 0; i < 100; i++) {
                const result = roll("1d100");
                seen.add(result.total);
            }

            expect(seen.size).toBeGreaterThanOrEqual(20);
        });
    });
});
