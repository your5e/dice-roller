import { describe, expect, it } from "vitest";
import { rollDice } from "../src/dice";

describe("rollDice", () => {
    it("returns the correct number of dice", () => {
        expect(rollDice(1, 6)).toHaveLength(1);
        expect(rollDice(4, 6)).toHaveLength(4);
        expect(rollDice(10, 20)).toHaveLength(10);
    });

    it("returns integers within the valid range", () => {
        for (let i = 0; i < 100; i++) {
            const rolls = rollDice(5, 6);
            for (const value of rolls) {
                expect(Number.isInteger(value)).toBe(true);
                expect(value).toBeGreaterThanOrEqual(1);
                expect(value).toBeLessThanOrEqual(6);
            }
        }

        for (let i = 0; i < 100; i++) {
            const rolls = rollDice(2, 20);
            for (const value of rolls) {
                expect(Number.isInteger(value)).toBe(true);
                expect(value).toBeGreaterThanOrEqual(1);
                expect(value).toBeLessThanOrEqual(20);
            }
        }
    });

    it("produces a fair distribution", () => {
        const sides = 6;
        const iterations = 60000;
        const counts: Record<number, number> = {};

        for (let i = 1; i <= sides; i++) {
            counts[i] = 0;
        }

        for (let i = 0; i < iterations; i++) {
            const [value] = rollDice(1, sides);
            counts[value]++;
        }

        const expected = iterations / sides;
        const tolerance = 0.05;

        for (let face = 1; face <= sides; face++) {
            const actual = counts[face];
            const deviation = Math.abs(actual - expected) / expected;
            expect(deviation).toBeLessThan(tolerance);
        }
    });
});
