import { describe, expect, it } from "vitest";
import { createD6 } from "../src/geometries/d6";
import { createTray, roll } from "../src/physics/tray";

describe("Throw distribution", () => {
    const shapes = [
        { shape: "square", halfWidth: 10, halfDepth: 10 },
        { shape: "landscape", halfWidth: 16, halfDepth: 8 },
        { shape: "portrait", halfWidth: 8, halfDepth: 16 },
    ];
    const diceCounts = [4, 10, 20, 50];
    const cases = shapes.flatMap((s) => diceCounts.map((n) => ({ ...s, diceCount: n })));

    it.each(cases)(
        "dice spread evenly ($shape, $diceCount dice)",
        async ({ halfWidth, halfDepth, diceCount }) => {
            const trials = 250;
            const totals = { near: 0, middle: 0, far: 0 };

            for (let t = 0; t < trials; t++) {
                const tray = createTray(halfWidth, halfDepth);
                const dice = await Promise.all(
                    Array.from({ length: diceCount }, () => createD6(0.5)),
                );

                roll(tray, dice.map((d) => d.physics));

                const thirdWidth = (2 * halfWidth) / 3;
                for (const die of dice) {
                    const x = die.physics.body.position.x;
                    if (x < -halfWidth + thirdWidth) {
                        totals.near++;
                    } else if (x < -halfWidth + 2 * thirdWidth) {
                        totals.middle++;
                    } else {
                        totals.far++;
                    }
                }
            }

            const total = trials * diceCount;
            const pctNear = ((totals.near / total) * 100).toFixed(1);
            const pctMiddle = ((totals.middle / total) * 100).toFixed(1);
            const pctFar = ((totals.far / total) * 100).toFixed(1);
            console.log(
                `Distribution: near=${pctNear}%, middle=${pctMiddle}%, far=${pctFar}%`,
            );

            expect(totals.middle, "middle > near").toBeGreaterThan(totals.near);
            expect(totals.middle, "middle > far").toBeGreaterThan(totals.far);
        },
        30_000,
    );
});
