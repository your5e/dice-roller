import { describe, expect, it } from "vitest";
import { FACES as D4_FACES, VERTICES as D4_VERTICES } from "../../src/bodies/d4";
import { FACES as D6_FACES, VERTICES as D6_VERTICES } from "../../src/bodies/d6";
import { FACES as D8_FACES, VERTICES as D8_VERTICES } from "../../src/bodies/d8";
import { FACES as D10_FACES, VERTICES as D10_VERTICES } from "../../src/bodies/d10";
import { FACES as D12_FACES, VERTICES as D12_VERTICES } from "../../src/bodies/d12";
import { FACES as D20_FACES, VERTICES as D20_VERTICES } from "../../src/bodies/d20";
import type { DieFaces } from "../../src/geometries/chamfer";
import { cornerAngles, generatedStrips, type StripQuad } from "../helpers/chamfer";


function maxRightAngleError(strip: StripQuad): number {
    return Math.max(
        ...cornerAngles(strip.corners).map((angle) => Math.abs(angle - 90)),
    );
}

const REGULAR_BODIES = [
    { name: "d4", vertices: D4_VERTICES, faces: D4_FACES, edges: 6 },
    { name: "d6", vertices: D6_VERTICES, faces: D6_FACES, edges: 12 },
    { name: "d8", vertices: D8_VERTICES, faces: D8_FACES, edges: 12 },
    { name: "d12", vertices: D12_VERTICES, faces: D12_FACES, edges: 30 },
    { name: "d20", vertices: D20_VERTICES, faces: D20_FACES, edges: 30 },
];

const D10_APEXES = [0, 1];

function touchesApex(faces: DieFaces, strip: StripQuad): boolean {
    const faceA = faces.find((f) => f.value === strip.faceA);
    const faceB = faces.find((f) => f.value === strip.faceB);
    if (!faceA || !faceB) throw new Error("Unknown strip faces");
    const shared = faceA.vertices.filter((v) => faceB.vertices.includes(v));
    return shared.some((v) => D10_APEXES.includes(v));
}

describe("generated strip shapes", () => {
    it("regular dice strips are rectangles", () => {
        for (const { name, vertices, faces, edges } of REGULAR_BODIES) {
            const strips = generatedStrips(vertices, faces);
            expect(strips.length, name).toBe(edges);
            for (const strip of strips) {
                expect(
                    maxRightAngleError(strip),
                    `${name} strip ${strip.faceA},${strip.faceB}`,
                ).toBeLessThan(0.01);
            }
        }
    });

    it("d10 polar strips are rectangles", () => {
        const polar = generatedStrips(D10_VERTICES, D10_FACES).filter((strip) =>
            touchesApex(D10_FACES, strip),
        );
        expect(polar.length).toBe(10);
        for (const strip of polar) {
            expect(
                maxRightAngleError(strip),
                `strip ${strip.faceA},${strip.faceB}`,
            ).toBeLessThan(0.01);
        }
    });

    it("d10 equator strips are NOT rectangles", () => {
        const equator = generatedStrips(D10_VERTICES, D10_FACES).filter(
            (strip) => !touchesApex(D10_FACES, strip),
        );
        expect(equator.length).toBe(10);
        for (const strip of equator) {
            expect(
                maxRightAngleError(strip),
                `strip ${strip.faceA},${strip.faceB}`,
            ).toBeGreaterThan(1);
        }
    });
});
