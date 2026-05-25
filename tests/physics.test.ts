import * as CANNON from "cannon-es";
import { describe, expect, it } from "vitest";
import { createD6 } from "../src/geometries/d6";
import { createD12 } from "../src/geometries/d12";
import { createD20 } from "../src/geometries/d20";
import {
    applyFullThrow,
    boundingSpheresOverlap,
    COCKED_THRESHOLD,
    createTray,
    offsetToEdge,
    packDice,
    resizeToFitDice,
    simulateThrow,
} from "../src/physics/tray";
import { syncDie } from "../src/renderer";

describe("d6 body", () => {
    it("returns 2 when +Y faces up", async () => {
        const die = await createD6(0.5);
        die.physics.body.quaternion.set(0, 0, 0, 1);
        expect(die.physics.readFace()).toBe(2);
    });

    it("returns 5 when -Y faces up", async () => {
        const die = await createD6(0.5);
        die.physics.body.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI);
        expect(die.physics.readFace()).toBe(5);
    });

    it("returns 1 when +X faces up", async () => {
        const die = await createD6(0.5);
        die.physics.body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), Math.PI / 2);
        expect(die.physics.readFace()).toBe(1);
    });

    it("returns 6 when -X faces up", async () => {
        const die = await createD6(0.5);
        die.physics.body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), -Math.PI / 2);
        expect(die.physics.readFace()).toBe(6);
    });

    it("returns 3 when +Z faces up", async () => {
        const die = await createD6(0.5);
        die.physics.body.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
        expect(die.physics.readFace()).toBe(3);
    });

    it("returns 4 when -Z faces up", async () => {
        const die = await createD6(0.5);
        die.physics.body.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);
        expect(die.physics.readFace()).toBe(4);
    });

    it("returns 2 when tilted 15° off +Y axis", async () => {
        const die = await createD6(0.5);
        die.physics.body.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 12);
        expect(die.physics.readFace()).toBe(2);
    });
});

describe("Cocked dice detection", () => {
    const thresholdAngle = Math.acos(COCKED_THRESHOLD);
    const delta = Math.PI / 180; // 1°

    it("flat die is not cocked", async () => {
        const die = await createD6(0.5);
        die.physics.body.quaternion.set(0, 0, 0, 1);
        expect(die.physics.isCocked(COCKED_THRESHOLD)).toBe(false);
    });

    it("mostly flat die is not cocked", async () => {
        const die = await createD6(0.5);
        die.physics.body.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), thresholdAngle - delta);
        expect(die.physics.isCocked(COCKED_THRESHOLD)).toBe(false);
    });

    it("die just past threshold is cocked", async () => {
        const die = await createD6(0.5);
        die.physics.body.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), thresholdAngle + delta);
        expect(die.physics.isCocked(COCKED_THRESHOLD)).toBe(true);
    });
});

describe("Tray", () => {
    it("returns a valid face value when a die settles", async () => {
        const tray = createTray(5, 5);
        const die = await createD6(0.5);
        tray.world.addBody(die.physics.body);
        packDice([die.physics]);
        const result = await simulateThrow(tray, [die.physics]).result;

        expect(result).toEqual({
            rerollCount: expect.any(Number),
            stats: expect.any(Object),
            behaviour: expect.any(Array),
        });
        if (!("cancelled" in result)) {
            const face = die.physics.readFace();
            expect(face).toBeGreaterThanOrEqual(1);
            expect(face).toBeLessThanOrEqual(6);
        }
    });

    it("returns a result for each die added", async () => {
        const tray = createTray(5, 5);
        const dice = await Promise.all([createD6(0.5), createD6(0.5), createD6(0.5)]);
        for (const die of dice) {
            tray.world.addBody(die.physics.body);
        }
        packDice(dice.map((d) => d.physics));
        const result = await simulateThrow(tray, dice.map((d) => d.physics)).result;

        expect(result).toEqual({
            rerollCount: expect.any(Number),
            stats: expect.any(Object),
            behaviour: expect.any(Array),
        });
        if (!("cancelled" in result)) {
            for (const die of dice) {
                const face = die.physics.readFace();
                expect(face).toBeGreaterThanOrEqual(1);
                expect(face).toBeLessThanOrEqual(6);
            }
        }
    });

    it("produces varied results across multiple rolls", async () => {
        const seen = new Set<number>();

        for (let i = 0; i < 20; i++) {
            const tray = createTray(5, 5);
            const die = await createD6(0.5);
            tray.world.addBody(die.physics.body);
            packDice([die.physics]);
            const result = await simulateThrow(tray, [die.physics]).result;
            if (!("cancelled" in result)) {
                seen.add(die.physics.readFace());
            }
        }

        expect(seen.size).toBeGreaterThanOrEqual(3);
    });

    it("die rests on the floor after settling", async () => {
        const tray = createTray(5, 5);
        const die = await createD6(0.5);
        tray.world.addBody(die.physics.body);
        packDice([die.physics]);
        await simulateThrow(tray, [die.physics]).result;

        const inContactWithStatic = tray.world.contacts.some(
            (c) =>
                (c.bi === die.physics.body && c.bj.type === CANNON.Body.STATIC) ||
                (c.bj === die.physics.body && c.bi.type === CANNON.Body.STATIC),
        );
        expect(inContactWithStatic, "die should be touching the floor").toBe(true);
    });
});

describe("Tray containment", () => {
    async function assertContainedAfterRoll(halfWidth: number, halfDepth: number) {
        const tray = createTray(halfWidth, halfDepth);
        const dice = await Promise.all(Array.from({ length: 6 }, () => createD6(0.5)));

        for (const die of dice) {
            tray.world.addBody(die.physics.body);
        }
        packDice(dice.map((d) => d.physics));
        await simulateThrow(tray, dice.map((d) => d.physics)).result;

        for (const [i, die] of dice.entries()) {
            const x = die.physics.body.position.x;
            const y = die.physics.body.position.y;
            const z = die.physics.body.position.z;

            expect(
                Math.abs(x),
                `die ${i} outside bounds on X axis: x=${x}`,
            ).toBeLessThan(halfWidth);
            expect(
                y,
                `die ${i} fell through floor: y=${y}`,
            ).toBeGreaterThan(0);
            expect(
                Math.abs(z),
                `die ${i} outside bounds on Z axis: z=${z}`,
            ).toBeLessThan(halfDepth);
        }
    }

    it.each([1, 2, 3, 4, 5])("dice settle within square tray (%i)", async () => {
        await assertContainedAfterRoll(5, 5);
    });

    it.each([1, 2, 3, 4, 5])("dice settle within landscape tray (%i)", async () => {
        await assertContainedAfterRoll(8, 3);
    });

    it.each([1, 2, 3, 4, 5])("dice settle within portrait tray (%i)", async () => {
        await assertContainedAfterRoll(3, 8);
    });
});

describe("Throw behaviour", () => {
    it("dice start at the left edge when thrown from left", async () => {
        const halfWidth = 5;
        const tray = createTray(halfWidth, 5);
        const die = await createD6(0.5);

        packDice([die.physics]);
        offsetToEdge([die.physics], tray, true);

        const r = (die.physics.body.shapes[0] as CANNON.ConvexPolyhedron).boundingSphereRadius;
        const x = die.physics.body.position.x;
        expect(x, "die should start near left edge").toBeLessThan(-halfWidth + r + 0.5);
    });

    it("dice start at the right edge when thrown from right", async () => {
        const halfWidth = 5;
        const tray = createTray(halfWidth, 5);
        const die = await createD6(0.5);

        packDice([die.physics]);
        offsetToEdge([die.physics], tray, false);

        const r = (die.physics.body.shapes[0] as CANNON.ConvexPolyhedron).boundingSphereRadius;
        const x = die.physics.body.position.x;
        expect(x, "die should start near right edge").toBeGreaterThan(halfWidth - r - 0.5);
    });

    it("dice are thrown towards positive X from left", async () => {
        const halfWidth = 5;
        const tray = createTray(halfWidth, 5);
        const die = await createD6(0.5);

        applyFullThrow(die.physics, tray, true, 0, 1);

        const vx = die.physics.body.velocity.x;
        expect(vx, "die should be moving towards positive X").toBeGreaterThan(0);
    });

    it("dice are thrown towards negative X from right", async () => {
        const halfWidth = 5;
        const tray = createTray(halfWidth, 5);
        const die = await createD6(0.5);

        applyFullThrow(die.physics, tray, false, 0, 1);

        const vx = die.physics.body.velocity.x;
        expect(vx, "die should be moving towards negative X").toBeLessThan(0);
    });
});

describe("syncDie", () => {
    it("copies body position to mesh position", async () => {
        const die = await createD6(0.5);
        die.physics.body.position.set(1, 2, 3);
        syncDie(die);
        expect(die.mesh.position.x).toBe(1);
        expect(die.mesh.position.y).toBe(2);
        expect(die.mesh.position.z).toBe(3);
    });

    it("copies body quaternion to mesh quaternion", async () => {
        const die = await createD6(0.5);
        die.physics.body.quaternion.set(0.1, 0.2, 0.3, 0.9);
        syncDie(die);
        expect(die.mesh.quaternion.x).toBeCloseTo(0.1);
        expect(die.mesh.quaternion.y).toBeCloseTo(0.2);
        expect(die.mesh.quaternion.z).toBeCloseTo(0.3);
        expect(die.mesh.quaternion.w).toBeCloseTo(0.9);
    });

    it("syncs dice during roll via onStep callback", async () => {
        const tray = createTray(5, 5);
        const die = await createD6(0.5);
        tray.world.addBody(die.physics.body);
        packDice([die.physics]);
        let syncCount = 0;

        const result = await simulateThrow(tray, [die.physics], {
            onStep: () => {
                syncDie(die);
                syncCount++;
            },
        }).result;

        expect(syncCount).toBeGreaterThan(0);
        expect(result).toEqual({
            rerollCount: expect.any(Number),
            stats: expect.any(Object),
            behaviour: expect.any(Array),
        });
        expect(die.mesh.position.y).toBeGreaterThan(0);
    });
});

describe("Dice positioning", () => {
    function getBoundingRadius(die: Awaited<ReturnType<typeof createD6>>): number {
        const shape = die.physics.body.shapes[0] as CANNON.ConvexPolyhedron;
        return shape.boundingSphereRadius;
    }

    function getPosition(die: Awaited<ReturnType<typeof createD6>>): { x: number; z: number } {
        return {
            x: die.physics.body.position.x,
            z: die.physics.body.position.z,
        };
    }

    function distance(a: { x: number; z: number }, b: { x: number; z: number }): number {
        return Math.sqrt((a.x - b.x) ** 2 + (a.z - b.z) ** 2);
    }

    describe("no overlap", () => {
        it("3 d6s do not overlap", async () => {
            const dice = await Promise.all([createD6(0.5), createD6(0.5), createD6(0.5)]);
            packDice(dice.map((d) => d.physics));

            for (let i = 0; i < dice.length; i++) {
                for (let j = i + 1; j < dice.length; j++) {
                    expect(
                        boundingSpheresOverlap(dice[i].physics.body, dice[j].physics.body),
                        `dice ${i} and ${j} overlap`,
                    ).toBe(false);
                }
            }
        });

        it("3 d12s do not overlap", async () => {
            const dice = await Promise.all([createD12(0.5), createD12(0.5), createD12(0.5)]);
            packDice(dice.map((d) => d.physics));

            for (let i = 0; i < dice.length; i++) {
                for (let j = i + 1; j < dice.length; j++) {
                    expect(
                        boundingSpheresOverlap(dice[i].physics.body, dice[j].physics.body),
                        `dice ${i} and ${j} overlap`,
                    ).toBe(false);
                }
            }
        });

        it("12 d6s and 12 d12s do not overlap", async () => {
            const dice = await Promise.all([
                ...Array.from({ length: 12 }, () => createD6(0.5)),
                ...Array.from({ length: 12 }, () => createD12(0.5)),
            ]);
            packDice(dice.map((d) => d.physics));

            for (let i = 0; i < dice.length; i++) {
                for (let j = i + 1; j < dice.length; j++) {
                    expect(
                        boundingSpheresOverlap(dice[i].physics.body, dice[j].physics.body),
                        `dice ${i} and ${j} overlap`,
                    ).toBe(false);
                }
            }
        });
    });

    describe("inside tray walls", () => {
        it("all dice inside walls when thrown from left", async () => {
            const halfWidth = 8;
            const halfDepth = 8;
            const tray = createTray(halfWidth, halfDepth);
            const dice = await Promise.all([
                ...Array.from({ length: 12 }, () => createD6(0.5)),
                ...Array.from({ length: 12 }, () => createD12(0.5)),
            ]);
            packDice(dice.map((d) => d.physics));
            offsetToEdge(dice.map((d) => d.physics), tray, true);

            for (const [i, die] of dice.entries()) {
                const pos = getPosition(die);
                const r = getBoundingRadius(die);
                expect(pos.x - r, `die ${i} outside left wall`).toBeGreaterThanOrEqual(-halfWidth);
                expect(pos.x + r, `die ${i} outside right wall`).toBeLessThanOrEqual(halfWidth);
                expect(pos.z - r, `die ${i} outside back wall`).toBeGreaterThanOrEqual(-halfDepth);
                expect(pos.z + r, `die ${i} outside front wall`).toBeLessThanOrEqual(halfDepth);
            }
        });

        it("all dice inside walls when thrown from right", async () => {
            const halfWidth = 8;
            const halfDepth = 8;
            const tray = createTray(halfWidth, halfDepth);
            const dice = await Promise.all([
                ...Array.from({ length: 12 }, () => createD6(0.5)),
                ...Array.from({ length: 12 }, () => createD12(0.5)),
            ]);
            packDice(dice.map((d) => d.physics));
            offsetToEdge(dice.map((d) => d.physics), tray, false);

            for (const [i, die] of dice.entries()) {
                const pos = getPosition(die);
                const r = getBoundingRadius(die);
                expect(pos.x - r, `die ${i} outside left wall`).toBeGreaterThanOrEqual(-halfWidth);
                expect(pos.x + r, `die ${i} outside right wall`).toBeLessThanOrEqual(halfWidth);
                expect(pos.z - r, `die ${i} outside back wall`).toBeGreaterThanOrEqual(-halfDepth);
                expect(pos.z + r, `die ${i} outside front wall`).toBeLessThanOrEqual(halfDepth);
            }
        });
    });

    describe("near throwing edge", () => {
        it("dice cluster near left edge when thrown from left", async () => {
            const halfWidth = 5;
            const tray = createTray(halfWidth, 5);
            const dice = await Promise.all(Array.from({ length: 10 }, () => createD6(0.5)));
            packDice(dice.map((d) => d.physics));
            offsetToEdge(dice.map((d) => d.physics), tray, true);

            const positions = dice.map(getPosition);
            const avgX = positions.reduce((sum, p) => sum + p.x, 0) / positions.length;

            expect(avgX, "cluster should be in left half").toBeLessThan(0);
        });

        it("dice cluster near right edge when thrown from right", async () => {
            const halfWidth = 5;
            const tray = createTray(halfWidth, 5);
            const dice = await Promise.all(Array.from({ length: 10 }, () => createD6(0.5)));
            packDice(dice.map((d) => d.physics));
            offsetToEdge(dice.map((d) => d.physics), tray, false);

            const positions = dice.map(getPosition);
            const avgX = positions.reduce((sum, p) => sum + p.x, 0) / positions.length;

            expect(avgX, "cluster should be in right half").toBeGreaterThan(0);
        });

        it("no die starts past the midpoint when thrown from left", async () => {
            const halfWidth = 10;
            const tray = createTray(halfWidth, 10);
            const dice = await Promise.all(Array.from({ length: 10 }, () => createD6(0.5)));
            packDice(dice.map((d) => d.physics));
            offsetToEdge(dice.map((d) => d.physics), tray, true);

            for (const [i, die] of dice.entries()) {
                const pos = getPosition(die);
                const r = getBoundingRadius(die);
                expect(pos.x + r, `die ${i} extends past midpoint`).toBeLessThan(0);
            }
        });

        it("no die starts past the midpoint when thrown from right", async () => {
            const halfWidth = 10;
            const tray = createTray(halfWidth, 10);
            const dice = await Promise.all(Array.from({ length: 10 }, () => createD6(0.5)));
            packDice(dice.map((d) => d.physics));
            offsetToEdge(dice.map((d) => d.physics), tray, false);

            for (const [i, die] of dice.entries()) {
                const pos = getPosition(die);
                const r = getBoundingRadius(die);
                expect(pos.x - r, `die ${i} extends past midpoint`).toBeGreaterThan(0);
            }
        });
    });

    describe("compact cluster", () => {
        it("24 dice fit in reasonable radius", async () => {
            const dice = await Promise.all([
                ...Array.from({ length: 12 }, () => createD6(0.5)),
                ...Array.from({ length: 12 }, () => createD12(0.5)),
            ]);
            packDice(dice.map((d) => d.physics));

            const positions = dice.map(getPosition);
            const centerX = positions.reduce((sum, p) => sum + p.x, 0) / positions.length;
            const centerZ = positions.reduce((sum, p) => sum + p.z, 0) / positions.length;

            const maxDist = Math.max(
                ...positions.map((p) => distance(p, { x: centerX, z: centerZ })),
            );

            expect(maxDist, "cluster too spread out").toBeLessThan(5);
        });
    });
});

describe("dropped frames", () => {
    it("reports when a significant portion of frames took longer than TIME_STEP", async () => {
        const tray = createTray(5, 5);
        const die = (await createD6(1)).physics;

        tray.world.addBody(die.body);
        packDice([die]);

        const result = await simulateThrow(tray, [die], {
            onStep: () => new Promise((resolve) => setTimeout(resolve, 50)),
        }).result;

        expect("stats" in result).toBe(true);
        if ("stats" in result) {
            expect(result.stats).toMatchObject({
                frames: expect.any(Number),
                physicsDrops: expect.any(Number),
                renderDrops: expect.any(Number),
                elapsed: expect.any(Number),
            });
            expect(result.stats.renderDrops).toBeGreaterThan(0);
        }
    });

    it("does not report when <5% of frames are dropped", async () => {
        const tray = createTray(5, 5);
        const die = (await createD6(1)).physics;

        tray.world.addBody(die.body);
        packDice([die]);

        let frame = 0;
        const result = await simulateThrow(tray, [die], {
            onStep: () => {
                frame++;
                if (frame % 50 === 0) {
                    return new Promise((resolve) => setTimeout(resolve, 50));
                }
            },
        }).result;

        expect("stats" in result).toBe(true);
        if ("stats" in result) {
            expect(result.stats).toMatchObject({
                frames: expect.any(Number),
                physicsDrops: 0,
                renderDrops: 0,
                elapsed: expect.any(Number),
            });
        }
    });
});

describe("simulateThrow() cancel", () => {
    it("returns cancelled result when cancel is called mid-simulation", async () => {
        const tray = createTray(10, 10);
        const dice = (await Promise.all(Array.from({ length: 10 }, () => createD6(1)))).map((d) => d.physics);

        for (const die of dice) {
            tray.world.addBody(die.body);
        }
        packDice(dice);

        const simulation = simulateThrow(tray, dice);
        await simulation.cancel();
        const result = await simulation.result;

        expect(result).toEqual({ cancelled: true });
    });

    it("completes simulation with valid result", async () => {
        const tray = createTray(5, 5);
        const die = (await createD6(1)).physics;

        tray.world.addBody(die.body);
        packDice([die]);

        let steps = 0;
        const simulation = simulateThrow(tray, [die], {
            onStep: () => {
                steps++;
            },
        });
        const result = await simulation.result;

        expect(steps).toBeGreaterThan(5);
        expect(result).toEqual({
            rerollCount: expect.any(Number),
            stats: expect.any(Object),
            behaviour: expect.any(Array),
        });
        if (!("cancelled" in result)) {
            const face = die.readFace();
            expect(face).toBeGreaterThanOrEqual(1);
            expect(face).toBeLessThanOrEqual(6);
        }
    });
});

describe("tray resize", () => {
    it("preserves landscape aspect ratio and fits dice in one half", async () => {
        const tray = createTray(2, 1);
        const dice = (await Promise.all(Array.from({ length: 100 }, () => createD20(1)))).map((d) => d.physics);
        packDice(dice);
        resizeToFitDice(tray, dice);
        offsetToEdge(dice, tray, true);

        expect(tray.halfWidth).toBeGreaterThan(2);
        expect(tray.halfDepth).toBeGreaterThan(1);
        expect(tray.halfWidth / tray.halfDepth).toBeCloseTo(2);

        for (const [i, die] of dice.entries()) {
            const pos = die.body.position;
            const r = (die.body.shapes[0] as CANNON.ConvexPolyhedron).boundingSphereRadius;
            expect(pos.x + r, `die ${i} crosses midpoint`).toBeLessThanOrEqual(0);
            expect(pos.x - r, `die ${i} outside left wall`).toBeGreaterThanOrEqual(-tray.halfWidth);
            expect(pos.z + r, `die ${i} outside front wall`).toBeLessThanOrEqual(tray.halfDepth);
            expect(pos.z - r, `die ${i} outside back wall`).toBeGreaterThanOrEqual(-tray.halfDepth);
        }
    });

    it("preserves portrait aspect ratio and fits dice in one half", async () => {
        const tray = createTray(1, 2);
        const dice = (await Promise.all(Array.from({ length: 100 }, () => createD20(1)))).map((d) => d.physics);
        packDice(dice);
        resizeToFitDice(tray, dice);
        offsetToEdge(dice, tray, true);

        expect(tray.halfWidth).toBeGreaterThan(1);
        expect(tray.halfDepth).toBeGreaterThan(2);
        expect(tray.halfWidth / tray.halfDepth).toBeCloseTo(0.5);

        for (const [i, die] of dice.entries()) {
            const pos = die.body.position;
            const r = (die.body.shapes[0] as CANNON.ConvexPolyhedron).boundingSphereRadius;
            expect(pos.z - r, `die ${i} crosses midpoint`).toBeGreaterThanOrEqual(0);
            expect(pos.z + r, `die ${i} outside front wall`).toBeLessThanOrEqual(tray.halfDepth);
            expect(pos.x + r, `die ${i} outside right wall`).toBeLessThanOrEqual(tray.halfWidth);
            expect(pos.x - r, `die ${i} outside left wall`).toBeGreaterThanOrEqual(-tray.halfWidth);
        }
    });

    it("preserves square aspect ratio and fits dice in one half", async () => {
        const tray = createTray(1, 1);
        const dice = (await Promise.all(Array.from({ length: 100 }, () => createD20(1)))).map((d) => d.physics);
        packDice(dice);
        resizeToFitDice(tray, dice);
        offsetToEdge(dice, tray, true);

        expect(tray.halfWidth).toBeGreaterThan(1);
        expect(tray.halfDepth).toBeGreaterThan(1);
        expect(tray.halfWidth / tray.halfDepth).toBeCloseTo(1);

        for (const [i, die] of dice.entries()) {
            const pos = die.body.position;
            const r = (die.body.shapes[0] as CANNON.ConvexPolyhedron).boundingSphereRadius;
            expect(pos.x + r, `die ${i} crosses midpoint`).toBeLessThanOrEqual(0);
            expect(pos.x - r, `die ${i} outside left wall`).toBeGreaterThanOrEqual(-tray.halfWidth);
            expect(pos.z + r, `die ${i} outside front wall`).toBeLessThanOrEqual(tray.halfDepth);
            expect(pos.z - r, `die ${i} outside back wall`).toBeGreaterThanOrEqual(-tray.halfDepth);
        }
    });

    it("does not shrink below minimum size", async () => {
        const tray = createTray(10, 10);
        const die = (await createD6(1)).physics;
        packDice([die]);
        resizeToFitDice(tray, [die]);
        expect(tray.halfWidth).toBe(10);
        expect(tray.halfDepth).toBe(10);
    });
});

describe("reroll physics", () => {
    it("dice actually move when rerolled after sleeping", async () => {
        const tray = createTray(5, 5);
        const dice = await Promise.all([createD6(0.5), createD6(0.5)]);
        for (const die of dice) {
            tray.world.addBody(die.physics.body);
        }
        const physicsDice = dice.map((d) => d.physics);

        // first throw
        packDice(physicsDice);
        offsetToEdge(physicsDice, tray, true);
        for (const die of physicsDice) {
            applyFullThrow(die, tray, true, 0.5, physicsDice.length);
        }
        await simulateThrow(tray, physicsDice).result;

        // reposition and re-throw (like rm modifier reroll)
        packDice(physicsDice);
        offsetToEdge(physicsDice, tray, false);
        const positionsBeforeSecond = physicsDice.map((d) => d.body.position.clone());
        for (const die of physicsDice) {
            applyFullThrow(die, tray, false, 0.5, physicsDice.length);
        }
        await simulateThrow(tray, physicsDice).result;

        // dice should have moved from their pre-throw positions
        for (let i = 0; i < physicsDice.length; i++) {
            const before = positionsBeforeSecond[i];
            const after = physicsDice[i].body.position;
            const moved = before.x !== after.x || before.y !== after.y || before.z !== after.z;
            expect(moved, `die ${i} should have moved`).toBe(true);
        }
    });
});
