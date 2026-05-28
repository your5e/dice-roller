import { describe, expect, it } from "vitest";
import { D6KintsugiTexture } from "../../src/textures/d6";

describe("jittered path generation", () => {
    describe("width multipliers", () => {
        it("start and end points are 100% width", () => {
            for (let seed = 0; seed < 100; seed++) {
                const texture = new D6KintsugiTexture({ seed });
                // @ts-expect-error accessing protected method for testing
                const multipliers = texture.generateWidthMultipliers(10, false);
                expect(multipliers[0]).toBe(1.0);
                expect(multipliers[multipliers.length - 1]).toBe(1.0);
            }
        });

        it("middle points are between 50% and 300%", () => {
            for (let seed = 0; seed < 100; seed++) {
                const texture = new D6KintsugiTexture({ seed });
                // @ts-expect-error accessing protected method for testing
                const multipliers = texture.generateWidthMultipliers(10, false);
                for (let i = 1; i < multipliers.length - 1; i++) {
                    expect(multipliers[i]).toBeGreaterThanOrEqual(0.5);
                    expect(multipliers[i]).toBeLessThanOrEqual(3.0);
                }
            }
        });
    });

});
