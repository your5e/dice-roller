import { describe, expect, it } from "vitest";
import { createTray } from "../src/physics/tray";
import { throwDice } from "../src/renderer";


function timeoutAfter(ms: number): Promise<never> {
    return new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Trial timeout after ${ms}ms`)), ms),
    );
}

const TRIALS = 50;
const TRIAL_TIMEOUT = 500;

type Distribution = { near: number; middle: number; far: number };

function measureDistribution(
    physicsTray: ReturnType<typeof createTray>,
    whichSide: boolean,
): Distribution {
    const isPortrait = physicsTray.halfDepth > physicsTray.halfWidth;
    const halfExtent = isPortrait ? physicsTray.halfDepth : physicsTray.halfWidth;
    const third = (2 * halfExtent) / 3;

    const totals = { near: 0, middle: 0, far: 0 };
    for (const die of physicsTray.dice) {
        const pos = isPortrait
            ? die.physics.body.position.z
            : die.physics.body.position.x;

        // near == where thrown from, far == thrown towards
        const normalisedPos = isPortrait
            ? whichSide
                ? -pos
                : pos
            : whichSide
              ? pos
              : -pos;

        if (normalisedPos < -halfExtent + third) {
            totals.near++;
        } else if (normalisedPos < -halfExtent + 2 * third) {
            totals.middle++;
        } else {
            totals.far++;
        }
    }
    return totals;
}

const shapes = [
    { shape: "square", halfWidth: 10, halfDepth: 10 },
    { shape: "landscape", halfWidth: 16, halfDepth: 8 },
    { shape: "portrait", halfWidth: 8, halfDepth: 16 },
];

async function runTrials(
    halfWidth: number,
    halfDepth: number,
    diceCount: number,
): Promise<{ totals: Distribution; total: number }> {
    const totals = { near: 0, middle: 0, far: 0 };

    for (let t = 0; t < TRIALS; t++) {
        const physicsTray = createTray(halfWidth, halfDepth);
        const whichSide = true;

        await Promise.race([
            throwDice(
                physicsTray,
                [{ count: diceCount, sides: 6 }],
                { whichSide, rerollCocked: false },
            ),
            timeoutAfter(TRIAL_TIMEOUT),
        ]);

        const dist = measureDistribution(physicsTray, whichSide);
        totals.near += dist.near;
        totals.middle += dist.middle;
        totals.far += dist.far;
    }

    return { totals, total: TRIALS * diceCount };
}

describe("Throw distribution", () => {
    describe("small numbers of dice should land near the far wall", () => {
        const diceCounts = [1, 3, 6];
        const cases = shapes.flatMap((s) =>
            diceCounts.map((diceCount) => ({ ...s, diceCount })),
        );

        it.each(cases)(
            "$shape tray, $diceCount dice",
            async ({ halfWidth, halfDepth, diceCount }) => {
                const { totals, total } = await runTrials(halfWidth, halfDepth, diceCount);
                const pctNearNum = (totals.near / total) * 100;
                const pctMiddleNum = (totals.middle / total) * 100;
                const pctFarNum = (totals.far / total) * 100;
                expect(pctFarNum, "far > 50%").toBeGreaterThan(50);
                expect(pctNearNum, "near < 10%").toBeLessThan(10);
                expect(pctFarNum, "far > middle").toBeGreaterThan(pctMiddleNum);
                expect(pctMiddleNum, "middle > near").toBeGreaterThan(pctNearNum);
            },
            TRIALS * TRIAL_TIMEOUT * 2,
        );
    });

    describe("speed adjusted medium numbers of dice should spread more but favour far", () => {
        const diceCounts = [8, 12];
        const cases = shapes.flatMap((s) =>
            diceCounts.map((diceCount) => ({ ...s, diceCount })),
        );

        it.each(cases)(
            "$shape tray, $diceCount dice",
            async ({ halfWidth, halfDepth, diceCount }) => {
                const { totals, total } = await runTrials(halfWidth, halfDepth, diceCount);
                const pctNearNum = (totals.near / total) * 100;
                const pctMiddleNum = (totals.middle / total) * 100;
                const pctFarNum = (totals.far / total) * 100;
                expect(pctNearNum, "near < 10%").toBeLessThan(10);
                expect(pctFarNum, "far <= 80%").toBeLessThanOrEqual(80);
                expect(pctFarNum, "far >= middle").toBeGreaterThanOrEqual(pctMiddleNum - 5);
                expect(pctMiddleNum, "middle > near").toBeGreaterThan(pctNearNum);
            },
            TRIALS * TRIAL_TIMEOUT * 2,
        );
    });

    describe("speed adjusted with many dice should spread evenly", () => {
        const diceCounts = [20, 30, 50];
        const cases = shapes.flatMap((s) =>
            diceCounts.map((diceCount) => ({ ...s, diceCount })),
        );

        it.each(cases)(
            "$shape tray, $diceCount dice",
            async ({ halfWidth, halfDepth, diceCount }) => {
                const { totals, total } = await runTrials(halfWidth, halfDepth, diceCount);
                const pctNearNum = (totals.near / total) * 100;
                const pctMiddleNum = (totals.middle / total) * 100;
                const pctFarNum = (totals.far / total) * 100;
                expect(pctNearNum, "near < 10%").toBeLessThan(10);
                expect(pctMiddleNum, "middle <= 60%").toBeLessThanOrEqual(60);
                expect(pctFarNum, "far <= 75%").toBeLessThanOrEqual(75);
                expect(pctFarNum, "far > middle").toBeGreaterThan(pctMiddleNum);
                expect(pctMiddleNum, "middle > near").toBeGreaterThan(pctNearNum);
            },
            TRIALS * TRIAL_TIMEOUT * 2,
        );
    });
});
