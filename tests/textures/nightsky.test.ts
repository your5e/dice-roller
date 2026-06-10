import { describe, expect, it } from "vitest";
import { D20NightSkyTexture } from "../../src/textures/d20";

// the affine latitude map is derived from three polygon corners; if the
// derivation is wrong the band lands in the wrong place with no obvious cause
describe("latitude interpolation", () => {
    it("matches the known latitude at each region corner", () => {
        const texture = new D20NightSkyTexture();
        for (const [, data] of texture.faceData) {
            for (const corner of data.points) {
                if (corner.latitude === undefined) {
                    throw new Error("Corner missing latitude");
                }
                const lat = texture.latitudeMap(data.points)(corner);
                expect(lat).toBeCloseTo(corner.latitude, 6);
            }
        }
    });

    it("averages the corner latitudes at an edge midpoint", () => {
        const texture = new D20NightSkyTexture();
        for (const [, data] of texture.faceData) {
            const [a, b] = data.points;
            if (a.latitude === undefined || b.latitude === undefined) {
                throw new Error("Corner missing latitude");
            }
            const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
            const lat = texture.latitudeMap(data.points)(midpoint);
            expect(lat).toBeCloseTo((a.latitude + b.latitude) / 2, 6);
        }
    });
});
