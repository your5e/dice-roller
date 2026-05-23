import type * as THREE from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
        const physicsTray = tray() as Tray;
        const result = await roll("2d6");

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

        const diceValues = result.expressions[0].steps[0]["2d6"] as number[];
        const physicalValues = physicsTray.dice.map((d) => d.readResult());
        expect(physicalValues).toEqual(diceValues);
    });

    it("rolls with advantage", async () => {
        const physicsTray = tray() as Tray;
        const result = await roll("2d20kh1");

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

        const diceValues = result.expressions[0].steps[0]["2d20"] as number[];
        const physicalValues = physicsTray.dice.map((d) => d.readResult());
        expect(physicalValues).toEqual(diceValues);
    });

    it("rolls with disadvantage", async () => {
        const physicsTray = tray() as Tray;
        const result = await roll("2d20kl1");

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

        const diceValues = result.expressions[0].steps[0]["2d20"] as number[];
        const physicalValues = physicsTray.dice.map((d) => d.readResult());
        expect(physicalValues).toEqual(diceValues);
    });

    it("rolls ability scores", async () => {
        const physicsTray = tray() as Tray;
        const result = await roll("4d6dl1");

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

        const diceValues = result.expressions[0].steps[0]["4d6"] as number[];
        const physicalValues = physicsTray.dice.map((d) => d.readResult());
        expect(physicalValues).toEqual(diceValues);
    });

    it("applies positive modifiers", async () => {
        const physicsTray = tray() as Tray;
        const result = await roll("1d20+5");

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

        const diceValues = result.expressions[0].steps[0]["1d20"] as number[];
        const physicalValues = physicsTray.dice.map((d) => d.readResult());
        expect(physicalValues).toEqual(diceValues);
    });

    it("applies negative modifiers", async () => {
        const physicsTray = tray() as Tray;
        const result = await roll("1d20-3");

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

        const diceValues = result.expressions[0].steps[0]["1d20"] as number[];
        const physicalValues = physicsTray.dice.map((d) => d.readResult());
        expect(physicalValues).toEqual(diceValues);
    });

    it("combines multiple expressions", async () => {
        const physicsTray = tray() as Tray;
        const result = await roll("2d6+7 1d8");

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

        const diceValues = [
            ...(result.expressions[0].steps[0]["2d6"] as number[]),
            ...(result.expressions[1].steps[0]["1d8"] as number[]),
        ];
        const physicalValues = physicsTray.dice.map((d) => d.readResult());
        expect(physicalValues).toEqual(diceValues);
    });

    it("combines damage with multiple types", async () => {
        const physicsTray = tray() as Tray;
        const result = await roll("1d8+5 2d6");

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

        const diceValues = [
            ...(result.expressions[0].steps[0]["1d8"] as number[]),
            ...(result.expressions[1].steps[0]["2d6"] as number[]),
        ];
        const physicalValues = physicsTray.dice.map((d) => d.readResult());
        expect(physicalValues).toEqual(diceValues);
    });

    it("initial roll values sum to total when no modifiers", async () => {
        const physicsTray = tray() as Tray;
        const result = await roll("3d6");

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

        const physicalValues = physicsTray.dice.map((d) => d.readResult());
        expect(physicalValues).toEqual(values);
    });

    it("initial roll values plus bonus sum to total", async () => {
        const physicsTray = tray() as Tray;
        const result = await roll("3d6+5");

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

        const physicalValues = physicsTray.dice.map((d) => d.readResult());
        expect(physicalValues).toEqual(values);
    });

    it("rb rerolls dice below threshold once", async () => {
        const physicsTray = tray() as Tray;
        for (let i = 0; i < 100; i++) {
            const result = await roll("1d20rb20");
            const initialValue = (result.expressions[0].steps[0]["1d20"] as number[])[0];
            if (initialValue >= 20) continue;

            expect(result).toEqual({
                notation: "1d20rb20",
                total: expect.any(Number),
                label_totals: { "": expect.any(Number) },
                expressions: [
                    {
                        notation: "1d20rb20",
                        steps: [
                            { "1d20": [initialValue] },
                            { "rb20": [expect.any(Number)] },
                        ],
                        total: expect.any(Number),
                    },
                ],
            });
            const rerolledValue = (result.expressions[0].steps[1].rb20 as number[])[0];
            expect(rerolledValue).toBeGreaterThanOrEqual(1);
            expect(rerolledValue).toBeLessThanOrEqual(20);
            expect(result.total).toBe(rerolledValue);

            // die's physical face must match the rerolled value
            const die = physicsTray.dice[0];
            expect(die.readResult()).toBe(rerolledValue);
            return;
        }
        throw new Error("Failed to roll initial value below threshold in 100 attempts");
    });

    it("rm rerolls dice until at or above threshold", async () => {
        const physicsTray = tray() as Tray;
        for (let i = 0; i < 100; i++) {
            const result = await roll("1d20rm20");
            const initialValue = (result.expressions[0].steps[0]["1d20"] as number[])[0];
            if (initialValue >= 20) continue;

            const steps = result.expressions[0].steps;
            expect(steps.length).toBeGreaterThanOrEqual(2);
            expect(steps[0]).toEqual({ "1d20": [initialValue] });
            for (let j = 1; j < steps.length; j++) {
                expect(steps[j]).toHaveProperty("rm20");
            }
            const lastStep = steps[steps.length - 1];
            const finalValue = (lastStep.rm20 as number[])[0];
            expect(finalValue).toBeGreaterThanOrEqual(20);

            expect(result.notation).toBe("1d20rm20");
            expect(result.total).toBe(finalValue);
            expect(result.label_totals).toEqual({ "": finalValue });
            expect(result.expressions).toHaveLength(1);
            expect(result.expressions[0].notation).toBe("1d20rm20");
            expect(result.expressions[0].total).toBe(finalValue);

            const die = physicsTray.dice[0];
            expect(die.readResult()).toBe(finalValue);
            return;
        }
        throw new Error("Failed to roll initial value below threshold in 100 attempts");
    });

    it("returns empty result when no valid expressions found", async () => {
        const result = await roll("garbage");

        expect(result).toEqual({
            notation: "garbage",
            total: 0,
            label_totals: {},
            expressions: [],
        });
    });

    it("ignores invalid expressions in notation", async () => {
        const physicsTray = tray() as Tray;
        const result = await roll("1d20 garbage 2d6");

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

        const diceValues = [
            ...(result.expressions[0].steps[0]["1d20"] as number[]),
            ...(result.expressions[1].steps[0]["2d6"] as number[]),
        ];
        const physicalValues = physicsTray.dice.map((d) => d.readResult());
        expect(physicalValues).toEqual(diceValues);
    });

    describe("d100", () => {
        it("rolls a percentile value", async () => {
            const physicsTray = tray() as Tray;
            const result = await roll("1d100");

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

            // d100 uses two physical dice (percentile + ones)
            expect(physicsTray.dice).toHaveLength(2);
        });

        it("produces varied results across multiple rolls", async () => {
            const physicsTray = tray() as Tray;
            const seen = new Set<number>();

            for (let i = 0; i < 100; i++) {
                const result = await roll("1d100");
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

                expect(physicsTray.dice).toHaveLength(2);
            }

            expect(seen.size).toBeGreaterThanOrEqual(20);
        });
    });

    describe("labels", () => {
        it("unlabelled expressions accumulate under empty string", async () => {
            const physicsTray = tray() as Tray;
            const result = await roll("2d6+3");

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

            const diceValues = result.expressions[0].steps[0]["2d6"] as number[];
            const physicalValues = physicsTray.dice.map((d) => d.readResult());
            expect(physicalValues).toEqual(diceValues);
        });

        it("returns labelled totals for labelled expressions", async () => {
            const physicsTray = tray() as Tray;
            const result = await roll("slashing:2d6+3");

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

            const diceValues = result.expressions[0].steps[0]["2d6"] as number[];
            const physicalValues = physicsTray.dice.map((d) => d.readResult());
            expect(physicalValues).toEqual(diceValues);
        });

        it("returns multiple labelled totals", async () => {
            const physicsTray = tray() as Tray;
            const result = await roll("slashing:2d6+3 fire:1d6");

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

            const diceValues = [...slashingDice, ...fireDice];
            const physicalValues = physicsTray.dice.map((d) => d.readResult());
            expect(physicalValues).toEqual(diceValues);
        });

        it("applies modifiers and bonus to labelled expressions", async () => {
            const physicsTray = tray() as Tray;
            const result = await roll("slashing:4d6dl1+3 force:2d8kh1+2");

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

            const slashingDice = slashing.steps[0]["4d6"] as number[];
            const forceDice = force.steps[0]["2d8"] as number[];
            const diceValues = [...slashingDice, ...forceDice];
            const physicalValues = physicsTray.dice.map((d) => d.readResult());
            expect(physicalValues).toEqual(diceValues);
        });

        it("accumulates same labels", async () => {
            const physicsTray = tray() as Tray;
            const result = await roll("fire:1d6 fire:1d4");

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

            const diceValues = [
                ...(result.expressions[0].steps[0]["1d6"] as number[]),
                ...(result.expressions[1].steps[0]["1d4"] as number[]),
            ];
            const physicalValues = physicsTray.dice.map((d) => d.readResult());
            expect(physicalValues).toEqual(diceValues);
        });

        it("accumulates labels case-insensitively", async () => {
            const physicsTray = tray() as Tray;
            const result = await roll("fire:2d6 FIRE:2d6");

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

            const diceValues = [
                ...(result.expressions[0].steps[0]["2d6"] as number[]),
                ...(result.expressions[1].steps[0]["2d6"] as number[]),
            ];
            const physicalValues = physicsTray.dice.map((d) => d.readResult());
            expect(physicalValues).toEqual(diceValues);
        });

        it("handles mixed labelled and unlabelled", async () => {
            const physicsTray = tray() as Tray;
            const result = await roll("1d20 slashing:2d6");

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

            const diceValues = [
                ...(result.expressions[0].steps[0]["1d20"] as number[]),
                ...(result.expressions[1].steps[0]["2d6"] as number[]),
            ];
            const physicalValues = physicsTray.dice.map((d) => d.readResult());
            expect(physicalValues).toEqual(diceValues);
        });
    });

    describe("concurrent rolls", () => {
        it("only keeps dice from the latest roll", async () => {
            const physicsTray = tray() as Tray;

            const rollA = roll("2d6");
            const rollB = roll("1d8");

            const [resultA, resultB] = await Promise.all([rollA, rollB]);

            expect(resultA.total).toBe(0);
            expect(resultA.expressions).toHaveLength(0);

            expect(resultB.total).toBeGreaterThanOrEqual(1);
            expect(resultB.expressions).toHaveLength(1);

            expect(physicsTray.dice).toHaveLength(1);
            expect(physicsTray.dice[0].physics.faces.length).toBe(8);
        });

        it("disposes dice from previous roll", async () => {
            const physicsTray = tray() as Tray;

            await roll("1d6");
            const oldDie = physicsTray.dice[0];
            const geometryDispose = vi.spyOn(oldDie.mesh.geometry, "dispose");
            const material = oldDie.mesh.material as THREE.MeshPhysicalMaterial;
            const materialDispose = vi.spyOn(material, "dispose");

            await roll("1d8");

            expect(geometryDispose).toHaveBeenCalled();
            expect(materialDispose).toHaveBeenCalled();
        });
    });
});
