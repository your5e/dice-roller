import { describe, expect, it } from "vitest";
import { calculate } from "../src/calculate";

describe("calculate", () => {
    describe("no modifiers", () => {
        it("requests dice then returns total", () => {
            const calc = calculate({
                expression: "3d6",
                count: 3,
                sides: 6,
                modifiers: [],
                bonus: 0,
            });
            expect(calc.state()).toEqual({
                type: "roll",
                sides: 6,
                indices: [0, 1, 2],
            });

            calc.provide([3, 4, 2]);
            expect(calc.state()).toEqual({
                type: "done",
                steps: [{ "3d6": [3, 4, 2] }],
                total: 9,
            });
        });

        it("applies positive bonus", () => {
            const calc = calculate({
                expression: "3d6+5",
                count: 3,
                sides: 6,
                modifiers: [],
                bonus: 5,
            });
            expect(calc.state()).toEqual({
                type: "roll",
                sides: 6,
                indices: [0, 1, 2],
            });

            calc.provide([3, 4, 2]);
            expect(calc.state()).toEqual({
                type: "done",
                steps: [{ "3d6": [3, 4, 2] }, { bonus: 5 }],
                total: 14,
            });
        });

        it("applies negative bonus", () => {
            const calc = calculate({
                expression: "3d6-2",
                count: 3,
                sides: 6,
                modifiers: [],
                bonus: -2,
            });
            expect(calc.state()).toEqual({
                type: "roll",
                sides: 6,
                indices: [0, 1, 2],
            });

            calc.provide([3, 4, 2]);
            expect(calc.state()).toEqual({
                type: "done",
                steps: [{ "3d6": [3, 4, 2] }, { bonus: -2 }],
                total: 7,
            });
        });
    });

    describe("keep highest", () => {
        it("keeps the N highest values", () => {
            const calc = calculate({
                expression: "4d6kh2",
                count: 4,
                sides: 6,
                modifiers: [{ type: "kh", value: 2 }],
                bonus: 0,
            });
            expect(calc.state()).toEqual({
                type: "roll",
                sides: 6,
                indices: [0, 1, 2, 3],
            });

            calc.provide([1, 5, 3, 6]);
            expect(calc.state()).toEqual({
                type: "done",
                steps: [{ "4d6": [1, 5, 3, 6] }, { kh2: [5, 6] }],
                total: 11,
            });
        });

        it("handles ties", () => {
            const calc = calculate({
                expression: "4d6kh3",
                count: 4,
                sides: 6,
                modifiers: [{ type: "kh", value: 3 }],
                bonus: 0,
            });
            expect(calc.state()).toEqual({
                type: "roll",
                sides: 6,
                indices: [0, 1, 2, 3],
            });

            calc.provide([4, 4, 4, 1]);
            expect(calc.state()).toEqual({
                type: "done",
                steps: [{ "4d6": [4, 4, 4, 1] }, { kh3: [4, 4, 4] }],
                total: 12,
            });
        });

        it("keeps all when N equals count", () => {
            const calc = calculate({
                expression: "3d6kh3",
                count: 3,
                sides: 6,
                modifiers: [{ type: "kh", value: 3 }],
                bonus: 0,
            });
            expect(calc.state()).toEqual({
                type: "roll",
                sides: 6,
                indices: [0, 1, 2],
            });

            calc.provide([3, 1, 4]);
            expect(calc.state()).toEqual({
                type: "done",
                steps: [{ "3d6": [3, 1, 4] }, { kh3: [3, 1, 4] }],
                total: 8,
            });
        });
    });

    describe("keep lowest", () => {
        it("keeps the N lowest values", () => {
            const calc = calculate({
                expression: "4d6kl2",
                count: 4,
                sides: 6,
                modifiers: [{ type: "kl", value: 2 }],
                bonus: 0,
            });
            expect(calc.state()).toEqual({
                type: "roll",
                sides: 6,
                indices: [0, 1, 2, 3],
            });

            calc.provide([1, 5, 3, 6]);
            expect(calc.state()).toEqual({
                type: "done",
                steps: [{ "4d6": [1, 5, 3, 6] }, { kl2: [1, 3] }],
                total: 4,
            });
        });

        it("handles ties", () => {
            const calc = calculate({
                expression: "4d6kl3",
                count: 4,
                sides: 6,
                modifiers: [{ type: "kl", value: 3 }],
                bonus: 0,
            });
            expect(calc.state()).toEqual({
                type: "roll",
                sides: 6,
                indices: [0, 1, 2, 3],
            });

            calc.provide([4, 4, 4, 1]);
            expect(calc.state()).toEqual({
                type: "done",
                steps: [{ "4d6": [4, 4, 4, 1] }, { kl3: [4, 4, 1] }],
                total: 9,
            });
        });
    });

    describe("drop lowest", () => {
        it("drops the N lowest values", () => {
            const calc = calculate({
                expression: "4d6dl1",
                count: 4,
                sides: 6,
                modifiers: [{ type: "dl", value: 1 }],
                bonus: 0,
            });
            expect(calc.state()).toEqual({
                type: "roll",
                sides: 6,
                indices: [0, 1, 2, 3],
            });

            calc.provide([1, 5, 3, 6]);
            expect(calc.state()).toEqual({
                type: "done",
                steps: [{ "4d6": [1, 5, 3, 6] }, { dl1: [5, 3, 6] }],
                total: 14,
            });
        });

        it("drops multiple lowest values", () => {
            const calc = calculate({
                expression: "4d6dl2",
                count: 4,
                sides: 6,
                modifiers: [{ type: "dl", value: 2 }],
                bonus: 0,
            });
            expect(calc.state()).toEqual({
                type: "roll",
                sides: 6,
                indices: [0, 1, 2, 3],
            });

            calc.provide([2, 2, 5, 3]);
            expect(calc.state()).toEqual({
                type: "done",
                steps: [{ "4d6": [2, 2, 5, 3] }, { dl2: [5, 3] }],
                total: 8,
            });
        });
    });

    describe("drop highest", () => {
        it("drops the N highest values", () => {
            const calc = calculate({
                expression: "4d6dh1",
                count: 4,
                sides: 6,
                modifiers: [{ type: "dh", value: 1 }],
                bonus: 0,
            });
            expect(calc.state()).toEqual({
                type: "roll",
                sides: 6,
                indices: [0, 1, 2, 3],
            });

            calc.provide([1, 5, 3, 6]);
            expect(calc.state()).toEqual({
                type: "done",
                steps: [{ "4d6": [1, 5, 3, 6] }, { dh1: [1, 5, 3] }],
                total: 9,
            });
        });

        it("drops multiple highest values", () => {
            const calc = calculate({
                expression: "4d6dh2",
                count: 4,
                sides: 6,
                modifiers: [{ type: "dh", value: 2 }],
                bonus: 0,
            });
            expect(calc.state()).toEqual({
                type: "roll",
                sides: 6,
                indices: [0, 1, 2, 3],
            });

            calc.provide([6, 5, 5, 3]);
            expect(calc.state()).toEqual({
                type: "done",
                steps: [{ "4d6": [6, 5, 5, 3] }, { dh2: [5, 3] }],
                total: 8,
            });
        });
    });

    describe("reroll below (once)", () => {
        it("requests reroll for dice below threshold", () => {
            const calc = calculate({
                expression: "4d6rb3",
                count: 4,
                sides: 6,
                modifiers: [{ type: "rb", value: 3 }],
                bonus: 0,
            });
            expect(calc.state()).toEqual({
                type: "roll",
                sides: 6,
                indices: [0, 1, 2, 3],
            });

            calc.provide([1, 5, 2, 6]);
            expect(calc.state()).toEqual({
                type: "roll",
                sides: 6,
                indices: [0, 2],
            });

            calc.provide([4, 4]);
            expect(calc.state()).toEqual({
                type: "done",
                steps: [{ "4d6": [1, 5, 2, 6] }, { rb3: [4, 5, 4, 6] }],
                total: 19,
            });
        });

        it("keeps rerolled value even if still below threshold", () => {
            const calc = calculate({
                expression: "2d6rb3",
                count: 2,
                sides: 6,
                modifiers: [{ type: "rb", value: 3 }],
                bonus: 0,
            });
            expect(calc.state()).toEqual({
                type: "roll",
                sides: 6,
                indices: [0, 1],
            });

            calc.provide([1, 5]);
            expect(calc.state()).toEqual({
                type: "roll",
                sides: 6,
                indices: [0],
            });

            calc.provide([2]);
            expect(calc.state()).toEqual({
                type: "done",
                steps: [{ "2d6": [1, 5] }, { rb3: [2, 5] }],
                total: 7,
            });
        });

        it("completes immediately when no dice below threshold", () => {
            const calc = calculate({
                expression: "2d6rb3",
                count: 2,
                sides: 6,
                modifiers: [{ type: "rb", value: 3 }],
                bonus: 0,
            });
            expect(calc.state()).toEqual({
                type: "roll",
                sides: 6,
                indices: [0, 1],
            });

            calc.provide([3, 5]);
            expect(calc.state()).toEqual({
                type: "done",
                steps: [{ "2d6": [3, 5] }, { rb3: [3, 5] }],
                total: 8,
            });
        });
    });

    describe("reroll below (recursive)", () => {
        it("requests rerolls until all dice meet threshold", () => {
            const calc = calculate({
                expression: "2d6rm3",
                count: 2,
                sides: 6,
                modifiers: [{ type: "rm", value: 3 }],
                bonus: 0,
            });
            expect(calc.state()).toEqual({
                type: "roll",
                sides: 6,
                indices: [0, 1],
            });

            calc.provide([1, 5]);
            expect(calc.state()).toEqual({
                type: "roll",
                sides: 6,
                indices: [0],
            });

            calc.provide([2]);
            expect(calc.state()).toEqual({
                type: "roll",
                sides: 6,
                indices: [0],
            });

            calc.provide([1]);
            expect(calc.state()).toEqual({
                type: "roll",
                sides: 6,
                indices: [0],
            });

            calc.provide([4]);
            expect(calc.state()).toEqual({
                type: "done",
                steps: [
                    { "2d6": [1, 5] },
                    { rm3: [2, 5] },
                    { rm3: [1, 5] },
                    { rm3: [4, 5] },
                ],
                total: 9,
            });
        });

        it("completes immediately when all dice meet threshold", () => {
            const calc = calculate({
                expression: "2d6rm3",
                count: 2,
                sides: 6,
                modifiers: [{ type: "rm", value: 3 }],
                bonus: 0,
            });
            expect(calc.state()).toEqual({
                type: "roll",
                sides: 6,
                indices: [0, 1],
            });

            calc.provide([3, 5]);
            expect(calc.state()).toEqual({
                type: "done",
                steps: [{ "2d6": [3, 5] }, { rm3: [3, 5] }],
                total: 8,
            });
        });

        it("handles multiple dice needing rerolls", () => {
            const calc = calculate({
                expression: "3d6rm3",
                count: 3,
                sides: 6,
                modifiers: [{ type: "rm", value: 3 }],
                bonus: 0,
            });
            expect(calc.state()).toEqual({
                type: "roll",
                sides: 6,
                indices: [0, 1, 2],
            });

            calc.provide([1, 2, 5]);
            expect(calc.state()).toEqual({
                type: "roll",
                sides: 6,
                indices: [0, 1],
            });

            calc.provide([4, 1]);
            expect(calc.state()).toEqual({
                type: "roll",
                sides: 6,
                indices: [1],
            });

            calc.provide([3]);
            expect(calc.state()).toEqual({
                type: "done",
                steps: [
                    { "3d6": [1, 2, 5] },
                    { rm3: [4, 1, 5] },
                    { rm3: [4, 3, 5] },
                ],
                total: 12,
            });
        });
    });

    describe("minimum", () => {
        it("replaces values below threshold", () => {
            const calc = calculate({
                expression: "4d6m3",
                count: 4,
                sides: 6,
                modifiers: [{ type: "m", value: 3 }],
                bonus: 0,
            });
            expect(calc.state()).toEqual({
                type: "roll",
                sides: 6,
                indices: [0, 1, 2, 3],
            });

            calc.provide([1, 5, 2, 6]);
            expect(calc.state()).toEqual({
                type: "done",
                steps: [{ "4d6": [1, 5, 2, 6] }, { m3: [3, 5, 3, 6] }],
                total: 17,
            });
        });

        it("does not change values at or above threshold", () => {
            const calc = calculate({
                expression: "3d6m3",
                count: 3,
                sides: 6,
                modifiers: [{ type: "m", value: 3 }],
                bonus: 0,
            });
            expect(calc.state()).toEqual({
                type: "roll",
                sides: 6,
                indices: [0, 1, 2],
            });

            calc.provide([3, 4, 5]);
            expect(calc.state()).toEqual({
                type: "done",
                steps: [{ "3d6": [3, 4, 5] }, { m3: [3, 4, 5] }],
                total: 12,
            });
        });
    });

    describe("modifier chaining", () => {
        it("applies modifiers left to right", () => {
            const calc = calculate({
                expression: "4d6dl1",
                count: 4,
                sides: 6,
                modifiers: [{ type: "dl", value: 1 }],
                bonus: 0,
            });
            expect(calc.state()).toEqual({
                type: "roll",
                sides: 6,
                indices: [0, 1, 2, 3],
            });

            calc.provide([3, 1, 4, 2]);
            expect(calc.state()).toEqual({
                type: "done",
                steps: [{ "4d6": [3, 1, 4, 2] }, { dl1: [3, 4, 2] }],
                total: 9,
            });
        });

        it("chains keep and drop", () => {
            const calc = calculate({
                expression: "4d6kh3dl1",
                count: 4,
                sides: 6,
                modifiers: [
                    { type: "kh", value: 3 },
                    { type: "dl", value: 1 },
                ],
                bonus: 0,
            });
            expect(calc.state()).toEqual({
                type: "roll",
                sides: 6,
                indices: [0, 1, 2, 3],
            });

            calc.provide([3, 1, 4, 2]);
            expect(calc.state()).toEqual({
                type: "done",
                steps: [
                    { "4d6": [3, 1, 4, 2] },
                    { kh3: [3, 4, 2] },
                    { dl1: [3, 4] },
                ],
                total: 7,
            });
        });

        it("chains reroll and keep", () => {
            const calc = calculate({
                expression: "4d6rb2kh3",
                count: 4,
                sides: 6,
                modifiers: [
                    { type: "rb", value: 2 },
                    { type: "kh", value: 3 },
                ],
                bonus: 0,
            });
            expect(calc.state()).toEqual({
                type: "roll",
                sides: 6,
                indices: [0, 1, 2, 3],
            });

            calc.provide([1, 3, 4, 2]);
            expect(calc.state()).toEqual({
                type: "roll",
                sides: 6,
                indices: [0],
            });

            calc.provide([5]);
            expect(calc.state()).toEqual({
                type: "done",
                steps: [
                    { "4d6": [1, 3, 4, 2] },
                    { rb2: [5, 3, 4, 2] },
                    { kh3: [5, 3, 4] },
                ],
                total: 12,
            });
        });

        it("produces different results based on modifier order", () => {
            // rb2kh3: reroll first, then keep highest
            // [1, 1, 4, 2] → reroll 0,1 → [5, 5, 4, 2] → keep highest 3 → [5, 5, 4] = 14
            let calc = calculate({
                expression: "4d6rb2kh3",
                count: 4,
                sides: 6,
                modifiers: [
                    { type: "rb", value: 2 },
                    { type: "kh", value: 3 },
                ],
                bonus: 0,
            });
            expect(calc.state()).toEqual({
                type: "roll",
                sides: 6,
                indices: [0, 1, 2, 3],
            });

            calc.provide([1, 1, 4, 2]);
            expect(calc.state()).toEqual({
                type: "roll",
                sides: 6,
                indices: [0, 1],
            });

            calc.provide([5, 5]);
            expect(calc.state()).toEqual({
                type: "done",
                steps: [
                    { "4d6": [1, 1, 4, 2] },
                    { rb2: [5, 5, 4, 2] },
                    { kh3: [5, 5, 4] },
                ],
                total: 14,
            });

            // kh3rb2: keep highest first, then reroll
            // [1, 1, 4, 2] → keep highest 3 → [1, 4, 2] → reroll 0 → [5, 4, 2] = 11
            calc = calculate({
                expression: "4d6kh3rb2",
                count: 4,
                sides: 6,
                modifiers: [
                    { type: "kh", value: 3 },
                    { type: "rb", value: 2 },
                ],
                bonus: 0,
            });
            expect(calc.state()).toEqual({
                type: "roll",
                sides: 6,
                indices: [0, 1, 2, 3],
            });

            calc.provide([1, 1, 4, 2]);
            expect(calc.state()).toEqual({
                type: "roll",
                sides: 6,
                indices: [0],
            });

            calc.provide([5]);
            expect(calc.state()).toEqual({
                type: "done",
                steps: [
                    { "4d6": [1, 1, 4, 2] },
                    { kh3: [1, 4, 2] },
                    { rb2: [5, 4, 2] },
                ],
                total: 11,
            });
        });
    });

    describe("with bonus", () => {
        it("includes bonus step in output", () => {
            const calc = calculate({
                expression: "2d6+3",
                count: 2,
                sides: 6,
                modifiers: [],
                bonus: 3,
            });
            expect(calc.state()).toEqual({
                type: "roll",
                sides: 6,
                indices: [0, 1],
            });

            calc.provide([4, 5]);
            expect(calc.state()).toEqual({
                type: "done",
                steps: [{ "2d6": [4, 5] }, { bonus: 3 }],
                total: 12,
            });
        });

        it("includes bonus after modifiers", () => {
            const calc = calculate({
                expression: "4d6dl1+5",
                count: 4,
                sides: 6,
                modifiers: [{ type: "dl", value: 1 }],
                bonus: 5,
            });
            expect(calc.state()).toEqual({
                type: "roll",
                sides: 6,
                indices: [0, 1, 2, 3],
            });

            calc.provide([1, 3, 4, 5]);
            expect(calc.state()).toEqual({
                type: "done",
                steps: [
                    { "4d6": [1, 3, 4, 5] },
                    { dl1: [3, 4, 5] },
                    { bonus: 5 },
                ],
                total: 17,
            });
        });

        it("handles negative bonus", () => {
            const calc = calculate({
                expression: "1d20-3",
                count: 1,
                sides: 20,
                modifiers: [],
                bonus: -3,
            });
            expect(calc.state()).toEqual({
                type: "roll",
                sides: 20,
                indices: [0],
            });

            calc.provide([15]);
            expect(calc.state()).toEqual({
                type: "done",
                steps: [{ "1d20": [15] }, { bonus: -3 }],
                total: 12,
            });
        });
    });

    describe("labels", () => {
        it("tracks label in state", () => {
            const calc = calculate({
                expression: "slashing:2d6+3",
                label: "slashing",
                count: 2,
                sides: 6,
                modifiers: [],
                bonus: 3,
            });
            expect(calc.state()).toEqual({
                type: "roll",
                label: "slashing",
                sides: 6,
                indices: [0, 1],
            });

            calc.provide([4, 5]);
            expect(calc.state()).toEqual({
                type: "done",
                label: "slashing",
                steps: [{ "2d6": [4, 5] }, { bonus: 3 }],
                total: 12,
            });
        });

        it("normalises label to lowercase", () => {
            const calc = calculate({
                expression: "fire:1d6",
                label: "fire",
                count: 1,
                sides: 6,
                modifiers: [],
                bonus: 0,
            });
            expect(calc.state()).toEqual({
                type: "roll",
                label: "fire",
                sides: 6,
                indices: [0],
            });

            calc.provide([4]);
            expect(calc.state()).toEqual({
                type: "done",
                label: "fire",
                steps: [{ "1d6": [4] }],
                total: 4,
            });
        });
    });
});
