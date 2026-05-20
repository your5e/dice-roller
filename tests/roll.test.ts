import type * as THREE from "three";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { onRoll, roll, tray } from "../src/index";
import type { Tray } from "../src/physics/tray";

describe("roll", () => {
    beforeEach(() => {
        tray();
        onRoll(() => {});
    });

    afterEach(() => {
        onRoll(() => {});
    });
    it("rolls simple dice", async () => {
        const result = await roll("2d6", { sync: true });

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
        expect(result.total).toBeGreaterThanOrEqual(2);
        expect(result.total).toBeLessThanOrEqual(12);
    });

    it("rolls with advantage", async () => {
        const result = await roll("2d20kh1", { sync: true });

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
        expect(result.total).toBeGreaterThanOrEqual(1);
        expect(result.total).toBeLessThanOrEqual(20);
    });

    it("rolls with disadvantage", async () => {
        const result = await roll("2d20kl1", { sync: true });

        expect(result).toEqual({
            notation: "2d20kl1",
            total: expect.any(Number),
            label_totals: { "": expect.any(Number) },
            expressions: [
                {
                    notation: "2d20kl1",
                    steps: [
                        { "2d20": [expect.any(Number), expect.any(Number)] },
                        { "kl1": [expect.any(Number)] },
                    ],
                    total: expect.any(Number),
                },
            ],
        });
        expect(result.total).toBeGreaterThanOrEqual(1);
        expect(result.total).toBeLessThanOrEqual(20);
    });

    it("rolls ability scores", async () => {
        const result = await roll("4d6dl1", { sync: true });

        expect(result).toEqual({
            notation: "4d6dl1",
            total: expect.any(Number),
            label_totals: { "": expect.any(Number) },
            expressions: [
                {
                    notation: "4d6dl1",
                    steps: [
                        { "4d6": [expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number)] },
                        { "dl1": [expect.any(Number), expect.any(Number), expect.any(Number)] },
                    ],
                    total: expect.any(Number),
                },
            ],
        });
        expect(result.total).toBeGreaterThanOrEqual(3);
        expect(result.total).toBeLessThanOrEqual(18);
    });

    it("replaces texture on dropped dice (dl)", async () => {
        const physicsTray = tray() as Tray;
        await roll("4d6dl1", { sync: true });

        const dice = physicsTray.dice;
        expect(dice).toHaveLength(4);

        const values = dice.map((d) => d.readResult());
        const minValue = Math.min(...values);
        const droppedIndex = values.indexOf(minValue);

        const textures = dice.map(
            (d) => (d.mesh.material as THREE.MeshPhysicalMaterial).map,
        );

        // kept dice share the same cached texture
        const keptTextures = textures.filter((_, i) => i !== droppedIndex);
        expect(keptTextures[0]).toBe(keptTextures[1]);
        expect(keptTextures[1]).toBe(keptTextures[2]);

        // dropped die has a different texture
        expect(textures[droppedIndex]).not.toBe(keptTextures[0]);
    });

    it("replaces texture on dropped dice (kh)", async () => {
        const physicsTray = tray() as Tray;
        await roll("4d6kh3", { sync: true });

        const dice = physicsTray.dice;
        expect(dice).toHaveLength(4);

        const values = dice.map((d) => d.readResult());
        const minValue = Math.min(...values);
        const droppedIndex = values.indexOf(minValue);

        const textures = dice.map(
            (d) => (d.mesh.material as THREE.MeshPhysicalMaterial).map,
        );

        // kept dice share the same cached texture
        const keptTextures = textures.filter((_, i) => i !== droppedIndex);
        expect(keptTextures[0]).toBe(keptTextures[1]);
        expect(keptTextures[1]).toBe(keptTextures[2]);

        // dropped die has a different texture
        expect(textures[droppedIndex]).not.toBe(keptTextures[0]);
    });

    it("applies positive modifiers", async () => {
        const result = await roll("1d20+5", { sync: true });

        expect(result).toEqual({
            notation: "1d20+5",
            total: expect.any(Number),
            label_totals: { "": expect.any(Number) },
            expressions: [
                {
                    notation: "1d20+5",
                    steps: [
                        { "1d20": [expect.any(Number)] },
                        { "bonus": 5 },
                    ],
                    total: expect.any(Number),
                },
            ],
        });
        expect(result.total).toBeGreaterThanOrEqual(6);
        expect(result.total).toBeLessThanOrEqual(25);
    });

    it("applies negative modifiers", async () => {
        const result = await roll("1d20-3", { sync: true });

        expect(result).toEqual({
            notation: "1d20-3",
            total: expect.any(Number),
            label_totals: { "": expect.any(Number) },
            expressions: [
                {
                    notation: "1d20-3",
                    steps: [
                        { "1d20": [expect.any(Number)] },
                        { "bonus": -3 },
                    ],
                    total: expect.any(Number),
                },
            ],
        });
        expect(result.total).toBeGreaterThanOrEqual(-2);
        expect(result.total).toBeLessThanOrEqual(17);
    });

    it("combines multiple expressions", async () => {
        const result = await roll("2d6+7 1d8", { sync: true });

        expect(result).toEqual({
            notation: "2d6+7 1d8",
            total: expect.any(Number),
            label_totals: { "": expect.any(Number) },
            expressions: [
                {
                    notation: "2d6+7",
                    steps: [
                        { "2d6": [expect.any(Number), expect.any(Number)] },
                        { "bonus": 7 },
                    ],
                    total: expect.any(Number),
                },
                {
                    notation: "1d8",
                    steps: [{ "1d8": [expect.any(Number)] }],
                    total: expect.any(Number),
                },
            ],
        });
        expect(result.total).toBeGreaterThanOrEqual(10);
        expect(result.total).toBeLessThanOrEqual(27);
    });

    it("combines damage with multiple types", async () => {
        const result = await roll("1d8+5 2d6", { sync: true });

        expect(result).toEqual({
            notation: "1d8+5 2d6",
            total: expect.any(Number),
            label_totals: { "": expect.any(Number) },
            expressions: [
                {
                    notation: "1d8+5",
                    steps: [
                        { "1d8": [expect.any(Number)] },
                        { "bonus": 5 },
                    ],
                    total: expect.any(Number),
                },
                {
                    notation: "2d6",
                    steps: [{ "2d6": [expect.any(Number), expect.any(Number)] }],
                    total: expect.any(Number),
                },
            ],
        });
        expect(result.total).toBeGreaterThanOrEqual(8);
        expect(result.total).toBeLessThanOrEqual(25);
    });

    it("initial roll values sum to total when no modifiers", async () => {
        const result = await roll("3d6", { sync: true });

        expect(result).toEqual({
            notation: "3d6",
            total: expect.any(Number),
            label_totals: { "": expect.any(Number) },
            expressions: [
                {
                    notation: "3d6",
                    steps: [{ "3d6": [expect.any(Number), expect.any(Number), expect.any(Number)] }],
                    total: expect.any(Number),
                },
            ],
        });
        const values = result.expressions[0].steps[0]["3d6"] as number[];
        const sum = values.reduce((a, b) => a + b, 0);
        expect(result.total).toBe(sum);
    });

    it("initial roll values plus bonus sum to total", async () => {
        const result = await roll("3d6+5", { sync: true });

        expect(result).toEqual({
            notation: "3d6+5",
            total: expect.any(Number),
            label_totals: { "": expect.any(Number) },
            expressions: [
                {
                    notation: "3d6+5",
                    steps: [
                        { "3d6": [expect.any(Number), expect.any(Number), expect.any(Number)] },
                        { "bonus": 5 },
                    ],
                    total: expect.any(Number),
                },
            ],
        });
        const values = result.expressions[0].steps[0]["3d6"] as number[];
        const sum = values.reduce((a, b) => a + b, 0);
        expect(result.total).toBe(sum + 5);
    });

    it("rerolls use the same die size", async () => {
        for (let i = 0; i < 100; i++) {
            const result = await roll("1d4rb3", { sync: true });

            expect(result).toEqual({
                notation: "1d4rb3",
                total: expect.any(Number),
                label_totals: { "": expect.any(Number) },
                expressions: [
                    {
                        notation: "1d4rb3",
                        steps: [
                            { "1d4": [expect.any(Number)] },
                            { "rb3": [expect.any(Number)] },
                        ],
                        total: expect.any(Number),
                    },
                ],
            });
            const finalValues = result.expressions[0].steps[1].rb3 as number[];
            for (const value of finalValues) {
                expect(value).toBeGreaterThanOrEqual(1);
                expect(value).toBeLessThanOrEqual(4);
            }
        }
    });

    it("returns empty result when no valid expressions found", async () => {
        const result = await roll("garbage", { sync: true });

        expect(result).toEqual({
            notation: "garbage",
            total: 0,
            label_totals: {},
            expressions: [],
        });
    });

    it("ignores invalid expressions in notation", async () => {
        const result = await roll("1d20 garbage 2d6", { sync: true });

        expect(result).toEqual({
            notation: "1d20 garbage 2d6",
            total: expect.any(Number),
            label_totals: { "": expect.any(Number) },
            expressions: [
                {
                    notation: "1d20",
                    steps: [{ "1d20": [expect.any(Number)] }],
                    total: expect.any(Number),
                },
                {
                    notation: "2d6",
                    steps: [{ "2d6": [expect.any(Number), expect.any(Number)] }],
                    total: expect.any(Number),
                },
            ],
        });
    });

    describe("d100", () => {
        it("rolls a percentile value", async () => {
            const result = await roll("1d100", { sync: true });

            expect(result).toEqual({
                notation: "1d100",
                total: expect.any(Number),
                label_totals: { "": expect.any(Number) },
                expressions: [
                    {
                        notation: "1d100",
                        steps: [{ "1d100": [expect.any(Number)] }],
                        total: expect.any(Number),
                    },
                ],
            });
            expect(result.total).toBeGreaterThanOrEqual(1);
            expect(result.total).toBeLessThanOrEqual(100);
        });

        it("produces varied results across multiple rolls", async () => {
            const seen = new Set<number>();

            for (let i = 0; i < 100; i++) {
                const result = await roll("1d100", { sync: true });
                expect(result).toEqual({
                    notation: "1d100",
                    total: expect.any(Number),
                    label_totals: { "": expect.any(Number) },
                    expressions: [
                        {
                            notation: "1d100",
                            steps: [{ "1d100": [expect.any(Number)] }],
                            total: expect.any(Number),
                        },
                    ],
                });
                seen.add(result.total);
            }

            expect(seen.size).toBeGreaterThanOrEqual(20);
        });
    });

    describe("labels", () => {
        it("unlabelled expressions accumulate under empty string", async () => {
            const result = await roll("2d6+3", { sync: true });

            expect(result).toEqual({
                notation: "2d6+3",
                total: expect.any(Number),
                label_totals: { "": expect.any(Number) },
                expressions: [
                    {
                        notation: "2d6+3",
                        steps: [
                            { "2d6": [expect.any(Number), expect.any(Number)] },
                            { "bonus": 3 },
                        ],
                        total: expect.any(Number),
                    },
                ],
            });
            expect(result.label_totals[""]).toBeGreaterThanOrEqual(5);
            expect(result.label_totals[""]).toBeLessThanOrEqual(15);
            expect(result.total).toBe(result.label_totals[""]);
        });

        it("returns labelled totals for labelled expressions", async () => {
            const result = await roll("slashing:2d6+3", { sync: true });

            expect(result).toEqual({
                notation: "slashing:2d6+3",
                total: expect.any(Number),
                label_totals: { "slashing": expect.any(Number) },
                expressions: [
                    {
                        notation: "slashing:2d6+3",
                        label: "slashing",
                        steps: [
                            { "2d6": [expect.any(Number), expect.any(Number)] },
                            { "bonus": 3 },
                        ],
                        total: expect.any(Number),
                    },
                ],
            });
            expect(result.label_totals.slashing).toBeGreaterThanOrEqual(5);
            expect(result.label_totals.slashing).toBeLessThanOrEqual(15);
            expect(result.total).toBe(result.label_totals.slashing);
        });

        it("returns multiple labelled totals", async () => {
            const result = await roll("slashing:2d6+3 fire:1d6", { sync: true });

            expect(result).toEqual({
                notation: "slashing:2d6+3 fire:1d6",
                total: expect.any(Number),
                label_totals: { "slashing": expect.any(Number), "fire": expect.any(Number) },
                expressions: [
                    {
                        notation: "slashing:2d6+3",
                        label: "slashing",
                        steps: [
                            { "2d6": [expect.any(Number), expect.any(Number)] },
                            { "bonus": 3 },
                        ],
                        total: expect.any(Number),
                    },
                    {
                        notation: "fire:1d6",
                        label: "fire",
                        steps: [{ "1d6": [expect.any(Number)] }],
                        total: expect.any(Number),
                    },
                ],
            });

            const slashingDice = result.expressions[0].steps[0]["2d6"] as number[];
            const slashingSum = slashingDice.reduce((a, b) => a + b, 0) + 3;
            expect(result.label_totals.slashing).toBe(slashingSum);

            const fireDice = result.expressions[1].steps[0]["1d6"] as number[];
            const fireSum = fireDice.reduce((a, b) => a + b, 0);
            expect(result.label_totals.fire).toBe(fireSum);

            expect(result.total).toBe(result.label_totals.slashing + result.label_totals.fire);
        });

        it("applies modifiers and bonus to labelled expressions", async () => {
            const result = await roll("slashing:4d6dl1+3 force:2d8kh1+2", { sync: true });

            expect(result).toEqual({
                notation: "slashing:4d6dl1+3 force:2d8kh1+2",
                total: expect.any(Number),
                label_totals: { "slashing": expect.any(Number), "force": expect.any(Number) },
                expressions: [
                    {
                        notation: "slashing:4d6dl1+3",
                        label: "slashing",
                        steps: [
                            { "4d6": [expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number)] },
                            { "dl1": [expect.any(Number), expect.any(Number), expect.any(Number)] },
                            { "bonus": 3 },
                        ],
                        total: expect.any(Number),
                    },
                    {
                        notation: "force:2d8kh1+2",
                        label: "force",
                        steps: [
                            { "2d8": [expect.any(Number), expect.any(Number)] },
                            { "kh1": [expect.any(Number)] },
                            { "bonus": 2 },
                        ],
                        total: expect.any(Number),
                    },
                ],
            });

            const slashing = result.expressions[0];
            const slashingKept = slashing.steps[1].dl1 as number[];
            const expectedSlashing = slashingKept.reduce((a, b) => a + b, 0) + 3;
            expect(slashing.total).toBe(expectedSlashing);
            expect(result.label_totals.slashing).toBe(slashing.total);

            const force = result.expressions[1];
            const forceKept = force.steps[1].kh1 as number[];
            const expectedForce = forceKept.reduce((a, b) => a + b, 0) + 2;
            expect(force.total).toBe(expectedForce);
            expect(result.label_totals.force).toBe(force.total);

            expect(result.total).toBe(result.label_totals.slashing + result.label_totals.force);
        });

        it("accumulates same labels", async () => {
            const result = await roll("fire:1d6 fire:1d4", { sync: true });

            expect(result).toEqual({
                notation: "fire:1d6 fire:1d4",
                total: expect.any(Number),
                label_totals: { "fire": expect.any(Number) },
                expressions: [
                    {
                        notation: "fire:1d6",
                        label: "fire",
                        steps: [{ "1d6": [expect.any(Number)] }],
                        total: expect.any(Number),
                    },
                    {
                        notation: "fire:1d4",
                        label: "fire",
                        steps: [{ "1d4": [expect.any(Number)] }],
                        total: expect.any(Number),
                    },
                ],
            });
            expect(result.label_totals.fire).toBeGreaterThanOrEqual(2);
            expect(result.label_totals.fire).toBeLessThanOrEqual(10);
            expect(result.total).toBe(result.label_totals.fire);
        });

        it("accumulates labels case-insensitively", async () => {
            const result = await roll("fire:2d6 FIRE:2d6", { sync: true });

            expect(result).toEqual({
                notation: "fire:2d6 FIRE:2d6",
                total: expect.any(Number),
                label_totals: { "fire": expect.any(Number) },
                expressions: [
                    {
                        notation: "fire:2d6",
                        label: "fire",
                        steps: [{ "2d6": [expect.any(Number), expect.any(Number)] }],
                        total: expect.any(Number),
                    },
                    {
                        notation: "fire:2d6",
                        label: "fire",
                        steps: [{ "2d6": [expect.any(Number), expect.any(Number)] }],
                        total: expect.any(Number),
                    },
                ],
            });
            expect(result.label_totals.fire).toBeGreaterThanOrEqual(4);
            expect(result.label_totals.fire).toBeLessThanOrEqual(24);
            expect(result.total).toBe(result.label_totals.fire);
        });

        it("handles mixed labelled and unlabelled", async () => {
            const result = await roll("1d20 slashing:2d6", { sync: true });

            expect(result).toEqual({
                notation: "1d20 slashing:2d6",
                total: expect.any(Number),
                label_totals: { "": expect.any(Number), "slashing": expect.any(Number) },
                expressions: [
                    {
                        notation: "1d20",
                        steps: [{ "1d20": [expect.any(Number)] }],
                        total: expect.any(Number),
                    },
                    {
                        notation: "slashing:2d6",
                        label: "slashing",
                        steps: [{ "2d6": [expect.any(Number), expect.any(Number)] }],
                        total: expect.any(Number),
                    },
                ],
            });
            expect(result.label_totals[""]).toBeGreaterThanOrEqual(1);
            expect(result.label_totals[""]).toBeLessThanOrEqual(20);
            expect(result.label_totals.slashing).toBeGreaterThanOrEqual(2);
            expect(result.label_totals.slashing).toBeLessThanOrEqual(12);
            expect(result.total).toBe(result.label_totals[""] + result.label_totals.slashing);
        });
    });
});
