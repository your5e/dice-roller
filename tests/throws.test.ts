import { describe, expect, it } from "vitest";
import {
    applyFullThrow,
    applyGentleThrow,
    createTray,
    offsetToEdge,
    type PhysicsDie,
    packDice,
    resizeToFitDice,
    simulateThrow,
    type Tray,
} from "../src/physics/tray";
import { createDie, syncDie, throwDice } from "../src/renderer";

const trayWidths = [
    { shape: "square 10:10", halfWidth: 10, halfDepth: 10 },
    { shape: "16:9", halfWidth: 13.3, halfDepth: 7.5 },
    { shape: "25:10", halfWidth: 25, halfDepth: 10 },
    { shape: "50:10", halfWidth: 50, halfDepth: 10 },
];

describe("Full throw velocity", () => {
    it.each(trayWidths)(
        "$shape tray",
        async ({ halfWidth, halfDepth }) => {
            let lowWallHits = 0;
            let farLandings = 0;

            for (let t = 0; t < VELOCITY_TRIALS; t++) {
                const { tray, wallHits } = await angleAdjustedThrow(
                    halfWidth,
                    halfDepth,
                    (die, tray, whichSide) => applyFullThrow(die, tray, whichSide, 0, 1, { spread: 0 }),
                );

                if (wallHits <= 1) lowWallHits++;
                if (measureDistribution(tray, true).far === 1) farLandings++;
            }

            const wallHitPct = (lowWallHits / VELOCITY_TRIALS) * 100;
            const farPct = (farLandings / VELOCITY_TRIALS) * 100;

            expect(wallHitPct, "≤1 wall hit 75%+").toBeGreaterThanOrEqual(75);
            expect(farPct, "far third 80%+").toBeGreaterThanOrEqual(80);
        },
        60000,
    );
});

describe("Coin toss", () => {
    it(
        "coin flips through the air",
        async () => {
            let enough = 0;

            for (let t = 0; t < VELOCITY_TRIALS; t++) {
                const { turns } = await angleAdjustedThrow(
                    10,
                    10,
                    (die, tray, whichSide) => applyFullThrow(die, tray, whichSide, 0, 1),
                    2,
                );
                if (turns >= 8) enough++;
            }

            const enoughPct = (enough / VELOCITY_TRIALS) * 100;
            expect(enoughPct, "8+ turns 80%+").toBeGreaterThanOrEqual(80);
        },
        120000,
    );
});

describe("Gentle throw velocity", () => {
    it.each(trayWidths)(
        "$shape tray",
        async ({ halfWidth, halfDepth }) => {
            let totalFinalX = 0;

            for (let t = 0; t < VELOCITY_TRIALS; t++) {
                const { tray } = await angleAdjustedThrow(
                    halfWidth,
                    halfDepth,
                    (die, tray, whichSide) => applyGentleThrow(die, tray, whichSide, { spread: 0 }),
                );

                totalFinalX += tray.dice[0].physics.body.position.x;
            }

            const avgFinalX = totalFinalX / VELOCITY_TRIALS;

            expect(avgFinalX, "avg within ±5 of midpoint").toBeGreaterThanOrEqual(-5);
            expect(avgFinalX, "avg within ±5 of midpoint").toBeLessThanOrEqual(5);
        },
        60000,
    );
});

const trayRatios = [
    { shape: "square", halfWidth: 10, halfDepth: 10 },
    { shape: "landscape", halfWidth: 16, halfDepth: 8 },
    { shape: "portrait", halfWidth: 8, halfDepth: 16 },
];

describe("Throw distribution", () => {
    describe("small numbers of dice should land near the far wall", () => {
        const diceCounts = [1, 3, 6];
        const cases = trayRatios.flatMap((s) =>
            diceCounts.map((diceCount) => ({ ...s, diceCount })),
        );

        it.each(cases)(
            "$shape tray, $diceCount dice",
            async ({ halfWidth, halfDepth, diceCount }) => {
                const { totals, total } = await runDistributionTrials(halfWidth, halfDepth, diceCount);
                const pctNear = (totals.near / total) * 100;
                const pctMiddle = (totals.middle / total) * 100;
                const pctFar = (totals.far / total) * 100;

                expect(pctFar, "far ≥ 50%").toBeGreaterThanOrEqual(50);
                expect(pctNear, "near < 10%").toBeLessThan(10);
                expect(pctFar, "far > middle").toBeGreaterThan(pctMiddle);
                expect(pctMiddle, "middle > near").toBeGreaterThan(pctNear);
            },
            DISTRIBUTION_TRIALS * TRIAL_TIMEOUT * 2,
        );
    });

    describe("speed adjusted medium numbers of dice should spread more but favour far", () => {
        const diceCounts = [8, 12];
        const cases = trayRatios.flatMap((s) =>
            diceCounts.map((diceCount) => ({ ...s, diceCount })),
        );

        it.each(cases)(
            "$shape tray, $diceCount dice",
            async ({ halfWidth, halfDepth, diceCount }) => {
                const { totals, total } = await runDistributionTrials(halfWidth, halfDepth, diceCount);
                const pctNear = (totals.near / total) * 100;
                const pctMiddle = (totals.middle / total) * 100;
                const pctFar = (totals.far / total) * 100;

                expect(pctNear, "near < 15%").toBeLessThan(15);
                expect(pctMiddle, "middle > near").toBeGreaterThan(pctNear);
                expect(pctFar, "far > near").toBeGreaterThan(pctNear);
            },
            DISTRIBUTION_TRIALS * TRIAL_TIMEOUT * 2,
        );
    });

    describe("speed adjusted with many dice should spread evenly", () => {
        const diceCounts = [20, 30, 50];
        const cases = trayRatios.flatMap((s) =>
            diceCounts.map((diceCount) => ({ ...s, diceCount })),
        );

        it.each(cases)(
            "$shape tray, $diceCount dice",
            async ({ halfWidth, halfDepth, diceCount }) => {
                const { totals, total } = await runDistributionTrials(halfWidth, halfDepth, diceCount);
                const pctNear = (totals.near / total) * 100;
                const pctMiddle = (totals.middle / total) * 100;
                const pctFar = (totals.far / total) * 100;

                expect(pctNear, "near < 30%").toBeLessThan(30);
                expect(pctMiddle, "middle > near").toBeGreaterThan(pctNear);
                expect(pctMiddle, "middle > far").toBeGreaterThan(pctFar);
                expect(pctFar, "far >= near").toBeGreaterThanOrEqual(pctNear - 5);
            },
            DISTRIBUTION_TRIALS * TRIAL_TIMEOUT * 2,
        );
    });
});


const VELOCITY_TRIALS = 100;
const DISTRIBUTION_TRIALS = 50;
const TRIAL_TIMEOUT = 500;

type Distribution = { near: number; middle: number; far: number };

type ThrowResult = {
    tray: Tray;
    wallHits: number;
    turns: number;
};

async function angleAdjustedThrow(
    halfWidth: number,
    halfDepth: number,
    applyThrow: (die: PhysicsDie, tray: Tray, whichSide: boolean) => void,
    sides = 6,
): Promise<ThrowResult> {
    const tray = createTray(halfWidth, halfDepth);
    const whichSide = true;

    const wrapper = await createDie(sides);
    for (const die of wrapper.dice) {
        tray.world.addBody(die.physics.body);
        tray.dice.push(die);
        syncDie(die);
    }

    const physicsDie = tray.dice[0].physics;
    packDice([physicsDie]);
    offsetToEdge([physicsDie], tray, whichSide);

    applyThrow(physicsDie, tray, whichSide);

    const simulation = simulateThrow(tray, [physicsDie], {
        whichSide,
        rerollCocked: false,
    });
    const result = await simulation.result;

    return {
        tray,
        wallHits: "behaviour" in result ? result.behaviour[0].wallHits : 0,
        turns: "behaviour" in result ? result.behaviour[0].turns : 0,
    };
}

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

type TrialResult = {
    totals: Distribution;
    total: number;
};

async function runDistributionTrials(
    halfWidth: number,
    halfDepth: number,
    diceCount: number,
): Promise<TrialResult> {
    const totals = { near: 0, middle: 0, far: 0 };

    for (let t = 0; t < DISTRIBUTION_TRIALS; t++) {
        const physicsTray = createTray(halfWidth, halfDepth);
        const whichSide = true;

        for (let i = 0; i < diceCount; i++) {
            const wrapper = await createDie(6);
            for (const die of wrapper.dice) {
                physicsTray.world.addBody(die.physics.body);
                physicsTray.dice.push(die);
                syncDie(die);
            }
        }

        const indices = Array.from({ length: physicsTray.dice.length }, (_, i) => i);
        const allPhysicsDice = physicsTray.dice.map((d) => d.physics);
        packDice(allPhysicsDice);
        resizeToFitDice(physicsTray, allPhysicsDice);

        await Promise.race([
            throwDice(physicsTray, indices, { whichSide, rerollCocked: false }),
            timeoutAfter(TRIAL_TIMEOUT),
        ]);

        const dist = measureDistribution(physicsTray, whichSide);
        totals.near += dist.near;
        totals.middle += dist.middle;
        totals.far += dist.far;
    }

    return { totals, total: DISTRIBUTION_TRIALS * diceCount };
}

function timeoutAfter(ms: number): Promise<never> {
    return new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Trial timeout after ${ms}ms`)), ms),
    );
}
