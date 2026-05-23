import type * as THREE from "three";
import { beforeEach, describe, expect, it } from "vitest";
import { createD6 } from "../src/geometries/d6";
import type { DiceCreationResult } from "../src/index";
import { onRoll, roll, tray } from "../src/index";
import type { Tray } from "../src/physics/tray";
import {
    PARKING_MARGIN,
    parkingPosition,
    reserveRows,
    resultPosition,
} from "../src/presentation";
import { preprogrammed } from "./setup";

describe("presentation", () => {
    beforeEach(() => {
        tray();
        onRoll(() => {});
    });

    describe("ghost textures on dropped dice", () => {
        it("replaces texture on dropped dice (dl)", async () => {
            const physicsTray = tray() as Tray;
            await roll("4d6dl1");

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
            await roll("4d6kh3");

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
    });

    describe("parking positions", () => {
        const testTray = { halfWidth: 5, halfDepth: 5 };
        const leftEdge = -testTray.halfWidth + PARKING_MARGIN;
        const rightBoundary = testTray.halfWidth - PARKING_MARGIN;

        it("places first die at left of its reserved row", async () => {
            const dice = await Promise.all([await createD6(), await createD6()]);
            for (const die of dice) die.label = "a";

            const rows = reserveRows(testTray, dice);
            const halfWidth = 0.5; // approximate for d6
            const pos = parkingPosition(testTray, [], { label: "a", halfWidth }, rows);

            expect(pos.x).toBeCloseTo(leftEdge + halfWidth, 0);
            expect(pos.z).toBeCloseTo(rows[0].z);
        });

        it("places subsequent dice to the right", async () => {
            const dice = await Promise.all([await createD6(), await createD6(), await createD6()]);
            for (const die of dice) die.label = "a";

            const rows = reserveRows(testTray, dice);
            const halfWidth = 0.5;
            const existing = [
                { label: "a", x: leftEdge + halfWidth, z: rows[0].z, halfWidth },
            ];
            const pos = parkingPosition(testTray, existing, { label: "a", halfWidth }, rows);

            expect(pos.x).toBeGreaterThan(existing[0].x);
            expect(pos.z).toBeCloseTo(rows[0].z);
        });

        it("wraps to next reserved row when current is full", async () => {
            const dice = await Promise.all(Array.from({ length: 20 }, () => createD6()));
            for (const die of dice) die.label = "a";

            const rows = reserveRows(testTray, dice);
            expect(rows.length).toBeGreaterThan(1);

            const halfWidth = 0.5;
            const existing = [
                { label: "a", x: rightBoundary - halfWidth, z: rows[0].z, halfWidth },
            ];
            const pos = parkingPosition(testTray, existing, { label: "a", halfWidth }, rows);

            expect(pos.x).toBeCloseTo(leftEdge + halfWidth, 0);
            expect(pos.z).toBeCloseTo(rows[1].z);
        });

        it("keeps labels in their reserved rows", async () => {
            const aDice = await Promise.all(Array.from({ length: 20 }, () => createD6()));
            const bDice = await Promise.all([await createD6(), await createD6()]);
            for (const die of aDice) die.label = "a";
            for (const die of bDice) die.label = "b";

            const rows = reserveRows(testTray, [...aDice, ...bDice]);
            const aRows = rows.filter((r) => r.label === "a");
            const bRows = rows.filter((r) => r.label === "b");

            const halfWidth = 0.5;
            const existing = [
                { label: "a", x: leftEdge + halfWidth, z: aRows[0].z, halfWidth },
            ];
            const posB = parkingPosition(testTray, existing, { label: "b", halfWidth }, rows);

            expect(posB.z).toBeCloseTo(bRows[0].z);
        });
    });

    describe("parking", () => {
        it("parks dice from same expression in same rows across reroll rounds", async () => {
            const physicsTray = tray() as Tray;

            const dice: DiceCreationResult = {
                wrappersPerExpr: [
                    [
                        await preprogrammed(6, [5]),
                        await preprogrammed(6, [6]),
                        await preprogrammed(6, [1, 5]),
                        await preprogrammed(6, [1, 6]),
                        await preprogrammed(6, [1, 1, 5]),
                        await preprogrammed(6, [1, 1, 6]),
                    ],
                ],
                wrapperPhysicalStarts: [[0, 1, 2, 3, 4, 5]],
            };

            await roll("fire:6d6rm5", { dice });

            const parkedDice = physicsTray.dice.slice(0, 4);
            for (const die of parkedDice) {
                expect(die.parked).toBeDefined();
            }

            const zValues = parkedDice.map((d) => d.parked?.z);
            const uniqueZs = new Set(zValues);
            expect(uniqueZs.size).toBe(1);
        });

        it("parks dice in contiguous rows when expressions satisfy at different times", async () => {
            const physicsTray = tray() as Tray;

            // str: first roll satisfies (6+1+1=8 >= 6 after dl1)
            // dex: first roll fails (1+1+1=3 < 6), second roll satisfies
            const dice: DiceCreationResult = {
                wrappersPerExpr: [
                    [
                        await preprogrammed(6, [6]),
                        await preprogrammed(6, [1]),
                        await preprogrammed(6, [1]),
                        await preprogrammed(6, [1]),
                    ],
                    [
                        await preprogrammed(6, [1, 6]), // fail then pass
                        await preprogrammed(6, [1, 1]),
                        await preprogrammed(6, [1, 1]),
                        await preprogrammed(6, [1, 1]),
                    ],
                ],
                wrapperPhysicalStarts: [
                    [0, 1, 2, 3],
                    [4, 5, 6, 7],
                ],
            };

            const result = await roll("str:4d6dl1rmt6 dex:4d6dl1rmt6", { dice });

            expect(result.expressions).toHaveLength(2);
            expect(result.expressions[0].total).toBe(8); // str: 6+1+1
            expect(result.expressions[1].total).toBe(8); // dex: 6+1+1 on second roll
            expect(physicsTray.dice).toHaveLength(8);

            // str dice (0-3) should be parked since they finished first
            const strDice = physicsTray.dice.slice(0, 4);
            for (const die of strDice) {
                expect(die.parked).toBeDefined();
            }
            const strZs = strDice.map((d) => d.parked?.z);
            expect(new Set(strZs).size).toBe(1);

            // dex dice (4-7) were last to roll so not parked
            const dexDice = physicsTray.dice.slice(4, 8);
            for (const die of dexDice) {
                expect(die.parked).toBeUndefined();
            }
            const bodiesInWorld = dexDice.filter((d) =>
                physicsTray.world.bodies.includes(d.physics.body),
            );
            expect(bodiesInWorld).toHaveLength(4);
        });
    });

    describe("reserveRows", () => {
        const testTray = { halfWidth: 5, halfDepth: 5 };
        const frontEdge = testTray.halfDepth - PARKING_MARGIN;

        it("reserves one row for a small group", async () => {
            const dice = await Promise.all([await createD6(), await createD6()]);
            for (const die of dice) die.label = "a";

            const rows = reserveRows(testTray, dice);

            expect(rows).toHaveLength(1);
            expect(rows[0].label).toBe("a");
            expect(rows[0].z).toBeLessThan(frontEdge);
        });

        it("reserves multiple rows when group needs them", async () => {
            const dice = await Promise.all(Array.from({ length: 20 }, () => createD6()));
            for (const die of dice) die.label = "a";

            const rows = reserveRows(testTray, dice);

            expect(rows.length).toBeGreaterThan(1);
            expect(rows.every((r) => r.label === "a")).toBe(true);
            expect(rows[0].z).toBeGreaterThan(rows[1].z);
        });

        it("reserves rows for each label in order", async () => {
            const aDice = await Promise.all([await createD6(), await createD6()]);
            const bDice = await Promise.all([await createD6(), await createD6()]);
            for (const die of aDice) die.label = "a";
            for (const die of bDice) die.label = "b";

            const rows = reserveRows(testTray, [...aDice, ...bDice]);

            const aRows = rows.filter((r) => r.label === "a");
            const bRows = rows.filter((r) => r.label === "b");

            expect(aRows.length).toBeGreaterThan(0);
            expect(bRows.length).toBeGreaterThan(0);
            expect(Math.min(...aRows.map((r) => r.z))).toBeGreaterThan(
                Math.max(...bRows.map((r) => r.z)),
            );
        });
    });

    describe("result positions", () => {
        const testTray = { halfWidth: 5, halfDepth: 5 };

        it("centres a single die in its row", async () => {
            const dice = [await createD6()];
            dice[0].label = "a";

            const rows = reserveRows(testTray, dice);
            const halfWidth = 0.5;
            const pos = resultPosition(testTray, [], { label: "a", halfWidth }, rows, 1);
            expect(pos.x).toBeCloseTo(0, 0);
            expect(pos.z).toBeCloseTo(rows[0].z);
        });

        it("centres multiple dice as a group", async () => {
            const dice = await Promise.all([await createD6(), await createD6(), await createD6()]);
            for (const die of dice) die.label = "a";

            const rows = reserveRows(testTray, dice);
            const halfWidth = 0.5;
            const dieWidth = halfWidth * 2;

            const pos1 = resultPosition(testTray, [], { label: "a", halfWidth }, rows, 3);
            const existing1 = [{ label: "a" as string | undefined, halfWidth, ...pos1 }];
            const pos2 = resultPosition(testTray, existing1, { label: "a", halfWidth }, rows, 3);
            const existing2 = [...existing1, { label: "a" as string | undefined, halfWidth, ...pos2 }];
            const pos3 = resultPosition(testTray, existing2, { label: "a", halfWidth }, rows, 3);

            const totalWidth = 3 * dieWidth + 2 * 0.15; // PARKING_GAP is 0.15
            const expectedLeft = -totalWidth / 2 + halfWidth;

            expect(pos1.x).toBeCloseTo(expectedLeft, 1);
            expect(pos3.x).toBeCloseTo(expectedLeft + 2 * (dieWidth + 0.15), 1);
        });

        it("keeps each expression in its own rows", async () => {
            const aDice = await Promise.all([await createD6(), await createD6()]);
            const bDice = await Promise.all([await createD6(), await createD6()]);
            for (const die of aDice) die.label = "a";
            for (const die of bDice) die.label = "b";

            const rows = reserveRows(testTray, [...aDice, ...bDice]);
            const aRows = rows.filter((r) => r.label === "a");
            const bRows = rows.filter((r) => r.label === "b");

            const halfWidth = 0.5;
            const posA = resultPosition(testTray, [], { label: "a", halfWidth }, rows, 2);
            const posB = resultPosition(testTray, [], { label: "b", halfWidth }, rows, 2);

            expect(posA.z).toBeCloseTo(aRows[0].z);
            expect(posB.z).toBeCloseTo(bRows[0].z);
        });
    });

    describe("presenting results", () => {
        it("assigns different textures to different labels", async () => {
            const physicsTray = tray() as Tray;
            const dice: DiceCreationResult = {
                wrappersPerExpr: [
                    [await preprogrammed(6, [6])],
                    [await preprogrammed(6, [6])],
                    [await preprogrammed(6, [6])],
                ],
                wrapperPhysicalStarts: [[0], [1], [2]],
            };

            await roll("a:1d6 b:1d6 c:1d6", { dice });

            // each label should have a different texture
            const textures = physicsTray.dice.map(
                (d) => (d.mesh.material as THREE.MeshPhysicalMaterial).map,
            );
            expect(textures[0]).not.toBe(textures[1]);
            expect(textures[1]).not.toBe(textures[2]);
            expect(textures[0]).not.toBe(textures[2]);
        });

        it("sets result position on all dice from multiple expressions", async () => {
            const physicsTray = tray() as Tray;
            const dice: DiceCreationResult = {
                wrappersPerExpr: [
                    [
                        await preprogrammed(6, [3]),
                        await preprogrammed(6, [5]),
                        await preprogrammed(6, [3]),
                        await preprogrammed(6, [6]),
                    ],
                    [
                        await preprogrammed(6, [1, 4]),
                        await preprogrammed(6, [1, 6]),
                        await preprogrammed(6, [1, 2]),
                        await preprogrammed(6, [1, 5]),
                    ],
                ],
                wrapperPhysicalStarts: [
                    [0, 1, 2, 3],
                    [4, 5, 6, 7],
                ],
            };

            await roll("str:4d6dl1rmt6 dex:4d6dl1rmt6", { dice });

            for (const die of physicsTray.dice) {
                expect(die.result).toBeDefined();
                expect(die.result?.x).toBeDefined();
                expect(die.result?.z).toBeDefined();
            }

            // str dice (0-3) should be in different rows than dex dice (4-7)
            const strZs = physicsTray.dice.slice(0, 4).map((d) => d.result?.z);
            const dexZs = physicsTray.dice.slice(4, 8).map((d) => d.result?.z);
            const strZ = strZs[0];
            const dexZ = dexZs[0];

            expect(new Set(strZs).size).toBe(1);
            expect(new Set(dexZs).size).toBe(1);
            expect(strZ).toBeDefined();
            expect(dexZ).toBeDefined();
            expect(strZ).not.toBe(dexZ);
            expect(strZ as number).toBeLessThan(dexZ as number);

            // str dice [3, 5, 3, 6] with dl1: order should be 6, 5, 3 (kept), 3 (dropped)
            const strDice = physicsTray.dice.slice(0, 4);
            const die6 = strDice.find((d) => d.readResult() === 6);
            const die5 = strDice.find((d) => d.readResult() === 5);
            const kept3 = strDice.find((d) => d.readResult() === 3 && !d.dropped);
            const dropped3 = strDice.find((d) => d.readResult() === 3 && d.dropped);

            expect(die6?.result?.x).toBeLessThan(die5?.result?.x as number);
            expect(die5?.result?.x).toBeLessThan(kept3?.result?.x as number);
            expect(kept3?.result?.x).toBeLessThan(dropped3?.result?.x as number);
        });

        it("restores normal textures on parked non-dropped dice", async () => {
            const physicsTray = tray() as Tray;

            // str: satisfies first roll, gets parked
            // dex: fails first roll, satisfies second, gets parked
            // con: fails first two rolls, satisfies third (never parked)
            const strWrappers = [
                await preprogrammed(6, [6]),
                await preprogrammed(6, [1]),
                await preprogrammed(6, [1]),
                await preprogrammed(6, [1]),
            ];
            const dexWrappers = [
                await preprogrammed(6, [1, 6]),
                await preprogrammed(6, [1, 1]),
                await preprogrammed(6, [1, 1]),
                await preprogrammed(6, [1, 1]),
            ];
            const conWrappers = [
                await preprogrammed(6, [1, 1, 6]),
                await preprogrammed(6, [1, 1, 1]),
                await preprogrammed(6, [1, 1, 1]),
                await preprogrammed(6, [1, 1, 1]),
            ];

            const dice: DiceCreationResult = {
                wrappersPerExpr: [strWrappers, dexWrappers, conWrappers],
                wrapperPhysicalStarts: [
                    [0, 1, 2, 3],
                    [4, 5, 6, 7],
                    [8, 9, 10, 11],
                ],
            };

            await roll("str:4d6dl1rmt6 dex:4d6dl1rmt6 con:4d6dl1rmt6", { dice });

            const strKept = physicsTray.dice.slice(0, 4).filter((d) => !d.dropped);
            const strTextures = strKept.map((d) => (d.mesh.material as THREE.MeshPhysicalMaterial).map);
            expect(new Set(strTextures).size).toBe(1);
            const dexKept = physicsTray.dice.slice(4, 8).filter((d) => !d.dropped);
            const dexTextures = dexKept.map((d) => (d.mesh.material as THREE.MeshPhysicalMaterial).map);
            expect(new Set(dexTextures).size).toBe(1);
            const conKept = physicsTray.dice.slice(8, 12).filter((d) => !d.dropped);
            const conTextures = conKept.map((d) => (d.mesh.material as THREE.MeshPhysicalMaterial).map);
            expect(new Set(conTextures).size).toBe(1);

            expect(strTextures[0]).not.toBe(dexTextures[0]);
            expect(dexTextures[0]).not.toBe(conTextures[0]);
            expect(strTextures[0]).not.toBe(conTextures[0]);

            // kept dice should have their textures restored
            for (const die of [...strKept, ...dexKept, ...conKept]) {
                const material = die.mesh.material as THREE.MeshPhysicalMaterial;
                expect(material.transparent).toBe(false);
            }
        });

        it("does not apply results animation to simple rolls", async () => {
            const physicsTray = tray() as Tray;

            await roll("2d6");
            for (const die of physicsTray.dice) {
                expect(die.result).toBeUndefined();
            }
        });

        it("keeps ghost textures on dropped dice", async () => {
            const physicsTray = tray() as Tray;
            await roll("4d6dl1");

            const dice = physicsTray.dice;
            const values = dice.map((d) => d.readResult());
            const minValue = Math.min(...values);
            const droppedIndex = values.indexOf(minValue);
            const textures = dice.map(
                (d) => (d.mesh.material as THREE.MeshPhysicalMaterial).map,
            );

            const keptTextures = textures.filter((_, i) => i !== droppedIndex);
            expect(keptTextures[0]).toBe(keptTextures[1]);

            expect(textures[droppedIndex]).not.toBe(keptTextures[0]);
        });
    });
});
