import * as CANNON from "cannon-es";
import { describe, expect, it } from "vitest";
import { createD6 } from "../src/geometries/d6";
import { createD12 } from "../src/geometries/d12";
import {
    applyThrowVelocity,
    createTray,
    isSettled,
    offsetToEdge,
    packDice,
    roll,
} from "../src/physics/tray";
import { syncDie } from "../src/renderer";

describe("d6 body", () => {
    it("returns 2 when +Y faces up", () => {
        const die = createD6();
        die.physics.body.quaternion.set(0, 0, 0, 1);
        expect(die.physics.readFace()).toBe(2);
    });

    it("returns 5 when -Y faces up", () => {
        const die = createD6();
        die.physics.body.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI);
        expect(die.physics.readFace()).toBe(5);
    });

    it("returns 1 when +X faces up", () => {
        const die = createD6();
        die.physics.body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), Math.PI / 2);
        expect(die.physics.readFace()).toBe(1);
    });

    it("returns 6 when -X faces up", () => {
        const die = createD6();
        die.physics.body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), -Math.PI / 2);
        expect(die.physics.readFace()).toBe(6);
    });

    it("returns 3 when +Z faces up", () => {
        const die = createD6();
        die.physics.body.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
        expect(die.physics.readFace()).toBe(3);
    });

    it("returns 4 when -Z faces up", () => {
        const die = createD6();
        die.physics.body.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);
        expect(die.physics.readFace()).toBe(4);
    });

    it("returns 2 when tilted 15° off +Y axis", () => {
        const die = createD6();
        die.physics.body.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 12);
        expect(die.physics.readFace()).toBe(2);
    });
});

describe("Tray", () => {
    it("returns a valid face value when a die settles", () => {
        const tray = createTray(5, 5);
        const die = createD6();
        const results = roll(tray, [die.physics]);

        expect(results).toHaveLength(1);
        expect(results[0]).toBeGreaterThanOrEqual(1);
        expect(results[0]).toBeLessThanOrEqual(6);
    });

    it("returns a result for each die added", () => {
        const tray = createTray(5, 5);
        const dice = [createD6(), createD6(), createD6()];
        const results = roll(tray, dice.map((d) => d.physics));

        expect(results).toHaveLength(3);
        for (const result of results) {
            expect(result).toBeGreaterThanOrEqual(1);
            expect(result).toBeLessThanOrEqual(6);
        }
    });

    it("produces varied results across multiple rolls", () => {
        const tray = createTray(5, 5);
        const seen = new Set<number>();

        for (let i = 0; i < 20; i++) {
            const die = createD6();
            const results = roll(tray, [die.physics]);
            seen.add(results[0]);
        }

        expect(seen.size).toBeGreaterThanOrEqual(3);
    });

    it("die rests on the floor after settling", () => {
        const tray = createTray(5, 5);
        const die = createD6();
        roll(tray, [die.physics]);

        const inContactWithStatic = tray.world.contacts.some(
            (c) =>
                (c.bi === die.physics.body && c.bj.type === CANNON.Body.STATIC) ||
                (c.bj === die.physics.body && c.bi.type === CANNON.Body.STATIC),
        );
        expect(inContactWithStatic, "die should be touching the floor").toBe(true);
    });
});

describe("Tray containment", () => {
    function assertContainedAfterRoll(halfWidth: number, halfDepth: number) {
        const tray = createTray(halfWidth, halfDepth);
        const dice = Array.from({ length: 6 }, () => createD6());

        roll(tray, dice.map((d) => d.physics));

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

        return dice;
    }

    function assertDiceNotOverlapping(dice: ReturnType<typeof createD6>[]) {
        for (let i = 0; i < dice.length; i++) {
            const die = dice[i];
            const x = die.physics.body.position.x;
            const y = die.physics.body.position.y;
            const z = die.physics.body.position.z;

            for (let j = i + 1; j < dice.length; j++) {
                const other = dice[j];
                const dx = x - other.physics.body.position.x;
                const dy = y - other.physics.body.position.y;
                const dz = z - other.physics.body.position.z;
                const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

                expect(
                    distance,
                    `dice ${i} and ${j} overlapping`,
                ).toBeGreaterThan(0.45);
            }
        }
    }

    it.each([1, 2, 3, 4, 5])("dice settle within square tray (%i)", () => {
        const dice = assertContainedAfterRoll(5, 5);
        assertDiceNotOverlapping(dice);
    });

    it.each([1, 2, 3, 4, 5])("dice settle within landscape tray (%i)", () => {
        const dice = assertContainedAfterRoll(8, 3);
        assertDiceNotOverlapping(dice);
    });

    it.each([1, 2, 3, 4, 5])("dice settle within portrait tray (%i)", () => {
        const dice = assertContainedAfterRoll(3, 8);
        assertDiceNotOverlapping(dice);
    });
});

describe("Throw behaviour", () => {
    it("dice start at the left edge when thrown from left", () => {
        const halfWidth = 5;
        const tray = createTray(halfWidth, 5);
        const die = createD6();

        packDice([die.physics], tray.world);
        offsetToEdge([die.physics], halfWidth, true);

        const x = die.physics.body.position.x;
        expect(x, "die should start near left edge").toBeLessThan(-halfWidth + 1);
    });

    it("dice start at the right edge when thrown from right", () => {
        const halfWidth = 5;
        const tray = createTray(halfWidth, 5);
        const die = createD6();

        packDice([die.physics], tray.world);
        offsetToEdge([die.physics], halfWidth, false);

        const x = die.physics.body.position.x;
        expect(x, "die should start near right edge").toBeGreaterThan(halfWidth - 1);
    });

    it("dice are thrown towards positive X from left", () => {
        const halfWidth = 5;
        const die = createD6();

        applyThrowVelocity(die.physics, true, halfWidth);

        const vx = die.physics.body.velocity.x;
        expect(vx, "die should be moving towards positive X").toBeGreaterThan(0);
    });

    it("dice are thrown towards negative X from right", () => {
        const halfWidth = 5;
        const die = createD6();

        applyThrowVelocity(die.physics, false, halfWidth);

        const vx = die.physics.body.velocity.x;
        expect(vx, "die should be moving towards negative X").toBeLessThan(0);
    });
});

describe("syncDie", () => {
    it("copies body position to mesh position", () => {
        const die = createD6();
        die.physics.body.position.set(1, 2, 3);
        syncDie(die);
        expect(die.mesh.position.x).toBe(1);
        expect(die.mesh.position.y).toBe(2);
        expect(die.mesh.position.z).toBe(3);
    });

    it("copies body quaternion to mesh quaternion", () => {
        const die = createD6();
        die.physics.body.quaternion.set(0.1, 0.2, 0.3, 0.9);
        syncDie(die);
        expect(die.mesh.quaternion.x).toBeCloseTo(0.1);
        expect(die.mesh.quaternion.y).toBeCloseTo(0.2);
        expect(die.mesh.quaternion.z).toBeCloseTo(0.3);
        expect(die.mesh.quaternion.w).toBeCloseTo(0.9);
    });

    it("syncs dice during roll via onStep callback", () => {
        const tray = createTray(5, 5);
        const die = createD6();
        let syncCount = 0;

        roll(tray, [die.physics], {
            onStep: () => {
                syncDie(die);
                syncCount++;
            },
        });

        expect(syncCount).toBeGreaterThan(0);
        expect(die.mesh.position.y).toBeGreaterThan(0);
    });
});

describe("Dice positioning", () => {
    function bodiesOverlap(a: CANNON.Body, b: CANNON.Body, world: CANNON.World): boolean {
        a.updateAABB();
        b.updateAABB();

        const contacts: CANNON.ContactEquation[] = [];
        world.narrowphase.getContacts([a], [b], world, contacts, [], [], []);

        return contacts.length > 0;
    }

    function getBoundingRadius(die: ReturnType<typeof createD6>): number {
        const shape = die.physics.body.shapes[0] as CANNON.ConvexPolyhedron;
        return shape.boundingSphereRadius;
    }

    function getPosition(die: ReturnType<typeof createD6>): { x: number; z: number } {
        return {
            x: die.physics.body.position.x,
            z: die.physics.body.position.z,
        };
    }

    function distance(a: { x: number; z: number }, b: { x: number; z: number }): number {
        return Math.sqrt((a.x - b.x) ** 2 + (a.z - b.z) ** 2);
    }

    describe("no overlap", () => {
        it("3 d6s do not overlap", () => {
            const tray = createTray(5, 5);
            const dice = [createD6(), createD6(), createD6()];
            packDice(dice.map((d) => d.physics), tray.world);

            for (let i = 0; i < dice.length; i++) {
                for (let j = i + 1; j < dice.length; j++) {
                    expect(
                        bodiesOverlap(dice[i].physics.body, dice[j].physics.body, tray.world),
                        `dice ${i} and ${j} overlap`,
                    ).toBe(false);
                }
            }
        });

        it("3 d12s do not overlap", () => {
            const tray = createTray(5, 5);
            const dice = [createD12(), createD12(), createD12()];
            packDice(dice.map((d) => d.physics), tray.world);

            for (let i = 0; i < dice.length; i++) {
                for (let j = i + 1; j < dice.length; j++) {
                    expect(
                        bodiesOverlap(dice[i].physics.body, dice[j].physics.body, tray.world),
                        `dice ${i} and ${j} overlap`,
                    ).toBe(false);
                }
            }
        });

        it("12 d6s and 12 d12s do not overlap", () => {
            const tray = createTray(5, 5);
            const dice = [
                ...Array.from({ length: 12 }, () => createD6()),
                ...Array.from({ length: 12 }, () => createD12()),
            ];
            packDice(dice.map((d) => d.physics), tray.world);

            for (let i = 0; i < dice.length; i++) {
                for (let j = i + 1; j < dice.length; j++) {
                    expect(
                        bodiesOverlap(dice[i].physics.body, dice[j].physics.body, tray.world),
                        `dice ${i} and ${j} overlap`,
                    ).toBe(false);
                }
            }
        });
    });

    describe("inside tray walls", () => {
        it("all dice inside walls when thrown from left", () => {
            const halfWidth = 5;
            const halfDepth = 5;
            const tray = createTray(halfWidth, halfDepth);
            const dice = [
                ...Array.from({ length: 12 }, () => createD6()),
                ...Array.from({ length: 12 }, () => createD12()),
            ];
            packDice(dice.map((d) => d.physics), tray.world);
            offsetToEdge(dice.map((d) => d.physics), halfWidth, true);

            for (const [i, die] of dice.entries()) {
                const pos = getPosition(die);
                const r = getBoundingRadius(die);
                expect(pos.x - r, `die ${i} outside left wall`).toBeGreaterThan(-halfWidth);
                expect(pos.x + r, `die ${i} outside right wall`).toBeLessThan(halfWidth);
                expect(pos.z - r, `die ${i} outside back wall`).toBeGreaterThan(-halfDepth);
                expect(pos.z + r, `die ${i} outside front wall`).toBeLessThan(halfDepth);
            }
        });

        it("all dice inside walls when thrown from right", () => {
            const halfWidth = 5;
            const halfDepth = 5;
            const tray = createTray(halfWidth, halfDepth);
            const dice = [
                ...Array.from({ length: 12 }, () => createD6()),
                ...Array.from({ length: 12 }, () => createD12()),
            ];
            packDice(dice.map((d) => d.physics), tray.world);
            offsetToEdge(dice.map((d) => d.physics), halfWidth, false);

            for (const [i, die] of dice.entries()) {
                const pos = getPosition(die);
                const r = getBoundingRadius(die);
                expect(pos.x - r, `die ${i} outside left wall`).toBeGreaterThan(-halfWidth);
                expect(pos.x + r, `die ${i} outside right wall`).toBeLessThan(halfWidth);
                expect(pos.z - r, `die ${i} outside back wall`).toBeGreaterThan(-halfDepth);
                expect(pos.z + r, `die ${i} outside front wall`).toBeLessThan(halfDepth);
            }
        });
    });

    describe("near throwing edge", () => {
        it("dice cluster near left edge when thrown from left", () => {
            const halfWidth = 5;
            const tray = createTray(halfWidth, 5);
            const dice = Array.from({ length: 10 }, () => createD6());
            packDice(dice.map((d) => d.physics), tray.world);
            offsetToEdge(dice.map((d) => d.physics), halfWidth, true);

            const positions = dice.map(getPosition);
            const avgX = positions.reduce((sum, p) => sum + p.x, 0) / positions.length;

            expect(avgX, "cluster should be in left half").toBeLessThan(0);
        });

        it("dice cluster near right edge when thrown from right", () => {
            const halfWidth = 5;
            const tray = createTray(halfWidth, 5);
            const dice = Array.from({ length: 10 }, () => createD6());
            packDice(dice.map((d) => d.physics), tray.world);
            offsetToEdge(dice.map((d) => d.physics), halfWidth, false);

            const positions = dice.map(getPosition);
            const avgX = positions.reduce((sum, p) => sum + p.x, 0) / positions.length;

            expect(avgX, "cluster should be in right half").toBeGreaterThan(0);
        });
    });

    describe("compact cluster", () => {
        it("24 dice fit in reasonable radius", () => {
            const tray = createTray(5, 5);
            const dice = [
                ...Array.from({ length: 12 }, () => createD6()),
                ...Array.from({ length: 12 }, () => createD12()),
            ];
            packDice(dice.map((d) => d.physics), tray.world);

            const positions = dice.map(getPosition);
            const centerX = positions.reduce((sum, p) => sum + p.x, 0) / positions.length;
            const centerZ = positions.reduce((sum, p) => sum + p.z, 0) / positions.length;

            const maxDist = Math.max(
                ...positions.map((p) => distance(p, { x: centerX, z: centerZ })),
            );

            // 24 dice should fit in a cluster no more than ~4 units from center
            expect(maxDist, "cluster too spread out").toBeLessThan(4);
        });
    });
});
