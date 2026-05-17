import { performance } from "node:perf_hooks";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createD4 } from "../src/geometries/d4";
import { createD6 } from "../src/geometries/d6";
import { createD8 } from "../src/geometries/d8";
import { createD10, createPercentile } from "../src/geometries/d10";
import { createD12 } from "../src/geometries/d12";
import { createD20 } from "../src/geometries/d20";
import type { Die } from "../src/geometries/dice";
import { createTray, roll } from "../src/physics/tray";

// A "fair" die should roll evenly, but there is always a chance for an
// uneven roll because that's how randomness works. This sets the threshold
// so that it should only fail ~1% of the time, being as close as we can
// get to proving fairness.
// https://en.wikipedia.org/wiki/Chi-squared_distribution#Table_of_%CF%872_values_vs_p-values
const CHI_SQUARED_CRITICAL: Record<number, number> = {
    3: 11.345,
    5: 15.086,
    7: 18.475,
    9: 21.666,
    11: 24.725,
    19: 36.191,
};

const mockTexture = new THREE.Texture();

const ROLLS = 10_000;

function chiSquared(observed: number[], expected: number): number {
    return observed.reduce((sum, o) => sum + ((o - expected) ** 2) / expected, 0);
}

const dice: { name: string; create: () => Promise<Die> }[] = [
    { name: "d4", create: () => createD4(1, mockTexture) },
    { name: "d6", create: () => createD6(1, mockTexture) },
    { name: "d8", create: () => createD8(1, mockTexture) },
    { name: "d10", create: () => createD10(1, mockTexture) },
    { name: "d12", create: () => createD12(1, mockTexture) },
    { name: "d20", create: () => createD20(1, mockTexture) },
    { name: "d%", create: () => createPercentile(1, mockTexture) },
];

describe("Monte Carlo method fairness", () => {
    it.each(dice)("$name distribution is fair", async ({ name, create }) => {
        const sample = await create();
        const faces = sample.physics.faces.length;
        const df = faces - 1;
        const critical = CHI_SQUARED_CRITICAL[df];

        const counts = new Map<number, number>();
        for (const face of sample.physics.faces) {
            counts.set(face.value, 0);
        }

        const start = performance.now();
        for (let i = 0; i < ROLLS; i++) {
            const tray = createTray(5, 5);
            const die = await create();
            const result = roll(tray, [die.physics])[0];
            const count = counts.get(result);
            if (count === undefined) {
                throw new Error(`Unexpected result: ${result}`);
            }
            counts.set(result, count + 1);
        }
        const elapsed = performance.now() - start;

        const expected = ROLLS / faces;
        const chi2 = chiSquared([...counts.values()], expected);

        console.log(`\n  ${name}: ${ROLLS} rolls in ${(elapsed / 1000).toFixed(2)}s`);
        console.log(`  Counts: ${[...counts.entries()].map(([v, c]) => `${v}:${c}`).join(", ")}`);
        console.log(`  Chi-squared: ${chi2.toFixed(2)} (critical: ${critical})`);

        expect(chi2, "distribution appears biased").toBeLessThan(critical);
    });
});
