import { describe, expect, it } from "vitest";
import { calculate } from "../src/calculate";

describe("calculate", () => {
    describe("no modifiers", () => {
        it("sums all dice", () => {
            expect(
                calculate(
                    [3, 4, 2],
                    [],
                    0,
                    () => 0,
                ),
            ).toEqual({
                steps: [],
                total: 9,
            });
        });

        it("applies bonus", () => {
            expect(
                calculate(
                    [3, 4, 2],
                    [],
                    5,
                ),
            ).toEqual({
                steps: [],
                total: 14,
            });

            expect(
                calculate(
                    [3, 4, 2],
                    [],
                    -2,
                ),
            ).toEqual({
                steps: [],
                total: 7,
            });
        });
    });

    describe("keep highest", () => {
        it("keeps the N highest values", () => {
            expect(
                calculate(
                    [1, 5, 3, 6],
                    [{ type: "kh", value: 2 }],
                    0,
                    () => 0,
                ),
            ).toEqual({
                steps: [{ kh2: [5, 6] }],
                total: 11,
            });

            expect(
                calculate(
                    [4, 4, 4, 1],
                    [{ type: "kh", value: 3 }],
                    0,
                    () => 0,
                ),
            ).toEqual({
                steps: [{ kh3: [4, 4, 4] }],
                total: 12,
            });
        });

        it("keeps all when N equals count", () => {
            expect(
                calculate(
                    [3, 1, 4],
                    [{ type: "kh", value: 3 }],
                    0,
                    () => 0,
                ),
            ).toEqual({
                steps: [{ kh3: [3, 1, 4] }],
                total: 8,
            });
        });
    });

    describe("keep lowest", () => {
        it("keeps the N lowest values", () => {
            expect(
                calculate(
                    [1, 5, 3, 6],
                    [{ type: "kl", value: 2 }],
                    0,
                    () => 0,
                ),
            ).toEqual({
                steps: [{ kl2: [1, 3] }],
                total: 4,
            });

            expect(
                calculate(
                    [4, 4, 4, 1],
                    [{ type: "kl", value: 3 }],
                    0,
                    () => 0,
                ),
            ).toEqual({
                steps: [{ kl3: [4, 4, 1] }],
                total: 9,
            });
        });
    });

    describe("drop lowest", () => {
        it("drops the N lowest values", () => {
            expect(
                calculate(
                    [1, 5, 3, 6],
                    [{ type: "dl", value: 1 }],
                    0,
                    () => 0,
                ),
            ).toEqual({
                steps: [{ dl1: [5, 3, 6] }],
                total: 14,
            });

            expect(
                calculate(
                    [2, 2, 5, 3],
                    [{ type: "dl", value: 2 }],
                    0,
                    () => 0,
                ),
            ).toEqual({
                steps: [{ dl2: [5, 3] }],
                total: 8,
            });
        });
    });

    describe("drop highest", () => {
        it("drops the N highest values", () => {
            expect(
                calculate(
                    [1, 5, 3, 6],
                    [{ type: "dh", value: 1 }],
                    0,
                    () => 0,
                ),
            ).toEqual({
                steps: [{ dh1: [1, 5, 3] }],
                total: 9,
            });

            expect(
                calculate(
                    [6, 5, 5, 3],
                    [{ type: "dh", value: 2 }],
                    0,
                    () => 0,
                ),
            ).toEqual({
                steps: [{ dh2: [5, 3] }],
                total: 8,
            });
        });
    });

    describe("reroll below (once)", () => {
        it("rerolls dice below threshold once", () => {
            const result = calculate(
                [1, 5, 2, 6],
                [{ type: "rb", value: 3 }],
                0,
                () => 4,
            );
            expect(result).toEqual({
                steps: [{ rb3: [4, 5, 4, 6] }],
                total: 19,
            });
        });

        it("keeps rerolled value even if still below threshold", () => {
            const result = calculate(
                [1, 5],
                [{ type: "rb", value: 3 }],
                0,
                () => 2,
            );
            expect(result).toEqual({
                steps: [{ rb3: [2, 5] }],
                total: 7,
            });
        });
    });

    describe("reroll below (recursive)", () => {
        it("rerolls until all dice meet threshold", () => {
            let callCount = 0;
            const values = [2, 1, 4];
            const result = calculate(
                [1, 5],
                [{ type: "rm", value: 3 }],
                0,
                () => values[callCount++],
            );
            expect(result).toEqual({
                steps: [{ rm3: [2, 5] }, { rm3: [1, 5] }, { rm3: [4, 5] }],
                total: 9,
            });
        });
    });

    describe("minimum", () => {
        it("replaces values below threshold", () => {
            expect(
                calculate(
                    [1, 5, 2, 6],
                    [{ type: "m", value: 3 }],
                    0,
                    () => 0,
                ),
            ).toEqual({
                steps: [{ m3: [3, 5, 3, 6] }],
                total: 17,
            });
        });

        it("does not change values at or above threshold", () => {
            expect(
                calculate(
                    [3, 4, 5],
                    [{ type: "m", value: 3 }],
                    0,
                    () => 0,
                ),
            ).toEqual({
                steps: [{ m3: [3, 4, 5] }],
                total: 12,
            });
        });
    });

    describe("modifier chaining", () => {
        it("applies modifiers left to right", () => {
            // 4d6dl1
            expect(
                calculate(
                    [3, 1, 4, 2],
                    [{ type: "dl", value: 1 }],
                    0,
                    () => 0,
                ),
            ).toEqual({
                steps: [{ dl1: [3, 4, 2] }],
                total: 9,
            });
        });

        it("chains keep and drop", () => {
            // 4d6kh3dl1
            expect(
                calculate(
                    [3, 1, 4, 2],
                    [
                        { type: "kh", value: 3 },
                        { type: "dl", value: 1 },
                    ],
                    0,
                    () => 0,
                ),
            ).toEqual({
                steps: [{ kh3: [3, 4, 2] }, { dl1: [3, 4] }],
                total: 7,
            });
        });

        it("chains reroll and keep", () => {
            // 4d6rb2kh3
            const result = calculate(
                [1, 3, 4, 2],
                [
                    { type: "rb", value: 2 },
                    { type: "kh", value: 3 },
                ],
                0,
                () => 5,
            );
            expect(result).toEqual({
                steps: [{ rb2: [5, 3, 4, 2] }, { kh3: [5, 3, 4] }],
                total: 12,
            });
        });

        it("produces different results based on modifier order", () => {
            const initial = [1, 1, 4, 2];
            const reroll = () => 5;

            // rb2kh3: reroll first, then keep highest
            // [1, 1, 4, 2] → [5, 5, 4, 2] → [5, 5, 4] = 14
            const rerollFirst = calculate(
                initial,
                [
                    { type: "rb", value: 2 },
                    { type: "kh", value: 3 },
                ],
                0,
                reroll,
            );

            // kh3rb2: keep highest first, then reroll
            // [1, 1, 4, 2] → [4, 2, 1] → [4, 2, 5] = 11
            const keepFirst = calculate(
                initial,
                [
                    { type: "kh", value: 3 },
                    { type: "rb", value: 2 },
                ],
                0,
                reroll,
            );

            expect(rerollFirst.total).toBe(14);
            expect(keepFirst.total).toBe(11);
        });
    });
});
