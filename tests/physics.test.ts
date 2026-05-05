import * as CANNON from "cannon-es";
import { describe, expect, it } from "vitest";
import { createD6 } from "../src/geometries/d6";
import { createTray, roll } from "../src/physics/tray";

describe("d6 body", () => {
    it("returns 2 when +Y faces up", () => {
        const die = createD6(1, 0.1);
        die.physics.body.quaternion.set(0, 0, 0, 1);
        expect(die.physics.readFace()).toBe(2);
    });

    it("returns 5 when -Y faces up", () => {
        const die = createD6(1, 0.1);
        die.physics.body.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI);
        expect(die.physics.readFace()).toBe(5);
    });

    it("returns 1 when +X faces up", () => {
        const die = createD6(1, 0.1);
        die.physics.body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), Math.PI / 2);
        expect(die.physics.readFace()).toBe(1);
    });

    it("returns 6 when -X faces up", () => {
        const die = createD6(1, 0.1);
        die.physics.body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), -Math.PI / 2);
        expect(die.physics.readFace()).toBe(6);
    });

    it("returns 3 when +Z faces up", () => {
        const die = createD6(1, 0.1);
        die.physics.body.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
        expect(die.physics.readFace()).toBe(3);
    });

    it("returns 4 when -Z faces up", () => {
        const die = createD6(1, 0.1);
        die.physics.body.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);
        expect(die.physics.readFace()).toBe(4);
    });

    it("returns 2 when tilted 15° off +Y axis", () => {
        const die = createD6(1, 0.1);
        die.physics.body.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 12);
        expect(die.physics.readFace()).toBe(2);
    });
});

describe("Tray", () => {
    it("returns a valid face value when a die settles", () => {
        const tray = createTray(5, 5);
        const die = createD6(1, 0.1);
        const results = roll(tray, [die.physics]);

        expect(results).toHaveLength(1);
        expect(results[0]).toBeGreaterThanOrEqual(1);
        expect(results[0]).toBeLessThanOrEqual(6);
    });

    it("returns a result for each die added", () => {
        const tray = createTray(5, 5);
        const dice = [createD6(1, 0.1), createD6(1, 0.1), createD6(1, 0.1)];
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
            const die = createD6(1, 0.1);
            const results = roll(tray, [die.physics]);
            seen.add(results[0]);
        }

        expect(seen.size).toBeGreaterThanOrEqual(3);
    });

    it("die rests on the floor after settling", () => {
        const tray = createTray(5, 5);
        const die = createD6(1, 0.1);
        roll(tray, [die.physics]);

        expect(die.physics.body.position.y).toBeGreaterThan(0.4);
        expect(die.physics.body.position.y).toBeLessThan(1.5);
    });
});

describe("Tray containment", () => {
    function assertContainedDuringRoll(halfWidth: number, halfDepth: number) {
        const tray = createTray(halfWidth, halfDepth);
        const dice = Array.from({ length: 6 }, () => createD6(1, 0.1));

        roll(tray, dice.map((d) => d.physics), {
            onStep: () => {
                for (const [i, die] of dice.entries()) {
                    const x = die.physics.body.position.x;
                    const y = die.physics.body.position.y;
                    const z = die.physics.body.position.z;

                    expect(
                        Math.abs(x),
                        `die ${i} left bounds on X axis: x=${x}`,
                    ).toBeLessThan(halfWidth);
                    expect(
                        y,
                        `die ${i} fell through floor: y=${y}`,
                    ).toBeGreaterThan(0);
                    expect(
                        Math.abs(z),
                        `die ${i} left bounds on Z axis: z=${z}`,
                    ).toBeLessThan(halfDepth);

                    for (let j = i + 1; j < dice.length; j++) {
                        const other = dice[j];
                        const dx = x - other.physics.body.position.x;
                        const dy = y - other.physics.body.position.y;
                        const dz = z - other.physics.body.position.z;
                        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

                        expect(
                            distance,
                            `dice ${i} and ${j} overlapping`,
                        ).toBeGreaterThan(0.5);
                    }
                }
            },
        });
    }

    it("dice remain within square tray during roll", () => {
        assertContainedDuringRoll(5, 5);
    });

    it("dice remain within wide tray during roll", () => {
        assertContainedDuringRoll(8, 3);
    });

    it("dice remain within tall tray during roll", () => {
        assertContainedDuringRoll(3, 8);
    });
});
