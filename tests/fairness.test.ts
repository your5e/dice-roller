import { beforeAll, describe, expect, it } from "vitest";
import { roll, tray } from "../src/index";

// A "fair" die should roll evenly, but there is always a chance for an uneven roll
// (because that's how randomness works). This sets the threshold so that it should
// only fail ~1% of the time, being a reasonable approximation of proving fairness.
// https://en.wikipedia.org/wiki/Chi-squared_distribution#Table_of_%CF%872_values_vs_p-values
const CHI_SQUARED_CRITICAL: Record<number, number> = {
    1: 6.635,
    3: 11.345,
    5: 15.086,
    7: 18.475,
    9: 21.666,
    11: 24.725,
    19: 36.191,
    99: 134.642,
};

function timeoutAfter(ms: number): Promise<never> {
    return new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Roll timeout after ${ms}ms`)), ms),
    );
}

const ROLL_COUNT = 10_000;
const ROLL_TIMEOUT = 500;     // individual roll timeout
const TEST_TIMEOUT = 30_000;  // all 10,000 rolls per test timeout
const D100_TIMEOUT = 90_000;  // d100 rolls two dice not one, so the simulation takes longer

function chiSquared(observed: number[], expected: number): number {
    return observed.reduce((sum, o) => sum + ((o - expected) ** 2) / expected, 0);
}

const dice: { name: string; notation: string; faces: number }[] = [
    { name: "d2", notation: "1d2", faces: 2 },
    { name: "d4", notation: "1d4", faces: 4 },
    { name: "d6", notation: "1d6", faces: 6 },
    { name: "d8", notation: "1d8", faces: 8 },
    { name: "d10", notation: "1d10", faces: 10 },
    { name: "d12", notation: "1d12", faces: 12 },
    { name: "d20", notation: "1d20", faces: 20 },
];

async function assertFairDistribution(notation: string, faces: number): Promise<void> {
    const df = faces - 1;
    const critical = CHI_SQUARED_CRITICAL[df];

    const counts = new Map<number, number>();
    for (let i = 1; i <= faces; i++) {
        counts.set(i, 0);
    }

    for (let i = 0; i < ROLL_COUNT; i++) {
        const result = await Promise.race([
            roll(notation),
            timeoutAfter(ROLL_TIMEOUT),
        ]);
        const count = counts.get(result.total);
        if (count === undefined) {
            throw new Error(`Unexpected result: ${result.total}`);
        }
        counts.set(result.total, count + 1);
    }

    const expected = ROLL_COUNT / faces;
    const chi2 = chiSquared([...counts.values()], expected);

    expect(chi2, "distribution appears biased").toBeLessThan(critical);
}

describe("Monte Carlo simulations", () => {
    beforeAll(() => {
        tray();
    });

    it.each(dice)(
        "should show $name rolling fairly",
        async ({ notation, faces }) => assertFairDistribution(notation, faces),
        TEST_TIMEOUT,
    );

    it(
        "should show d100 rolling fairly",
        async () => assertFairDistribution("1d100", 100),
        D100_TIMEOUT,
    );
});
