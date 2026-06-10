import { describe, expect, it } from "vitest";
import { centroid2d } from "../../src/geometry";
import { D20Texture } from "../../src/textures/d20";
import {
    adjacentFacePlacement,
    pathBetweenFaces,
    translateFacePoint,
    translateThroughFaces,
} from "../../src/textures/spanning";

describe("spanning", () => {
    describe("d20 face 1 and 17", () => {
        const texture = new D20Texture();
        const face1 = texture.faceData.get(1);
        const face17 = texture.faceData.get(17);
        if (!face1 || !face17) throw new Error("Missing face data");
        const centroid1 = centroid2d(face1.points);
        const centroid17 = centroid2d(face17.points);

        it("centroid of face 1", () => {
            expect(centroid1).toEqual({
                x: 110.78689325833261,
                y: 126.25694709625823,
            });
        });

        it("centroid of face 17", () => {
            expect(centroid17).toEqual({
                x: 320.1286168479597,
                y: 126.25694709625816,
            });
        });

        it("centroid of face 17 seen from face 1", () => {
            const virtual = translateFacePoint(texture, centroid17, 17, 1);
            expect(virtual).toEqual({
                x: 215.4577550531462,
                y: 65.82519686271253,
            });
        });

        it("centroid of face 1 seen from face 17", () => {
            const virtual = translateFacePoint(texture, centroid1, 1, 17);
            expect(virtual).toEqual({
                x: 215.4577550531462,
                y: 65.82519686271247,
            });
        });

        it("placement of face 17 adjacent to face 1", () => {
            const layout = adjacentFacePlacement(texture, 1, 17);
            expect(layout.centre.x).toBeCloseTo(215.45775505314623, 5);
            expect(layout.centre.y).toBeCloseTo(65.82519686271249, 5);
            expect(layout.rotation).toBeCloseTo(60, 5);
        });

        it("round-trip translation returns to original point", () => {
            const translated = translateFacePoint(texture, centroid1, 1, 17);
            const returned = translateFacePoint(texture, translated, 17, 1);
            expect(returned.x).toBeCloseTo(centroid1.x, 10);
            expect(returned.y).toBeCloseTo(centroid1.y, 10);
        });
    });

    describe("d20 face 1 and 19", () => {
        const texture = new D20Texture();
        const face1 = texture.faceData.get(1);
        const face19 = texture.faceData.get(19);
        if (!face1 || !face19) throw new Error("Missing face data");
        const centroid1 = centroid2d(face1.points);
        const centroid19 = centroid2d(face19.points);

        it("centroid of face 19 seen from face 1", () => {
            const virtual = translateFacePoint(texture, centroid19, 19, 1);
            expect(virtual).toBeDefined();
            expect(typeof virtual.x).toBe("number");
            expect(typeof virtual.y).toBe("number");
        });

        it("round-trip translation returns to original point", () => {
            const translated = translateFacePoint(texture, centroid1, 1, 19);
            const returned = translateFacePoint(texture, translated, 19, 1);
            expect(returned.x).toBeCloseTo(centroid1.x, 10);
            expect(returned.y).toBeCloseTo(centroid1.y, 10);
        });
    });

    describe("d20 face 1 and 8", () => {
        const texture = new D20Texture();
        const face1 = texture.faceData.get(1);
        const face8 = texture.faceData.get(8);
        if (!face1 || !face8) throw new Error("Missing face data");
        const centroid1 = centroid2d(face1.points);
        const centroid8 = centroid2d(face8.points);

        it("centroid of face 8 seen from face 1", () => {
            const virtual = translateFacePoint(texture, centroid8, 8, 1);
            expect(virtual).toBeDefined();
            expect(typeof virtual.x).toBe("number");
            expect(typeof virtual.y).toBe("number");
        });

        it("round-trip translation returns to original point", () => {
            const translated = translateFacePoint(texture, centroid1, 1, 8);
            const returned = translateFacePoint(texture, translated, 8, 1);
            expect(returned.x).toBeCloseTo(centroid1.x, 10);
            expect(returned.y).toBeCloseTo(centroid1.y, 10);
        });
    });

    describe("d20 face 9 and 7 (eccentric points)", () => {
        const texture = new D20Texture();
        const face9 = texture.faceData.get(9);
        const face7 = texture.faceData.get(7);
        if (!face9 || !face7) throw new Error("Missing face data");

        const centroid9 = centroid2d(face9.points);
        const centroid7 = centroid2d(face7.points);
        const eccentric9 = {
            x: centroid9.x + (face9.points[0].x - centroid9.x) * 0.6,
            y: centroid9.y + (face9.points[0].y - centroid9.y) * 0.6,
        };
        const eccentric7 = {
            x: centroid7.x + (face7.points[0].x - centroid7.x) * 0.6,
            y: centroid7.y + (face7.points[0].y - centroid7.y) * 0.6,
        };

        it("eccentric point on face 9 seen from face 7", () => {
            const virtual = translateFacePoint(texture, eccentric9, 9, 7);
            expect(virtual).toBeDefined();
            expect(typeof virtual.x).toBe("number");
            expect(typeof virtual.y).toBe("number");
        });

        it("eccentric point on face 7 seen from face 9", () => {
            const virtual = translateFacePoint(texture, eccentric7, 7, 9);
            expect(virtual).toBeDefined();
            expect(typeof virtual.x).toBe("number");
            expect(typeof virtual.y).toBe("number");
        });

        it("round-trip translation of eccentric point returns to original", () => {
            const translated = translateFacePoint(texture, eccentric9, 9, 7);
            const returned = translateFacePoint(texture, translated, 7, 9);
            expect(returned.x).toBeCloseTo(eccentric9.x, 10);
            expect(returned.y).toBeCloseTo(eccentric9.y, 10);
        });
    });

    describe("pathBetweenFaces", () => {
        const texture = new D20Texture();

        it("adjacent faces 1 and 17", () => {
            expect(pathBetweenFaces(texture, 1, 17)).toEqual([1, 17]);
        });

        it("two hops from 11 to 9 via 15", () => {
            expect(pathBetweenFaces(texture, 11, 9)).toEqual([11, 15, 9]);
        });

        it("adjacent faces 19 and 14", () => {
            expect(pathBetweenFaces(texture, 19, 14)).toEqual([19, 14]);
        });

        it("three hops from 20 to 18", () => {
            expect(pathBetweenFaces(texture, 20, 18)).toEqual([20, 2, 7, 18]);
        });

        it("opposite faces 1 and 20", () => {
            expect(pathBetweenFaces(texture, 1, 20)).toEqual([1, 19, 11, 5, 13, 20]);
        });
    });

    describe("translateThroughFaces", () => {
        const texture = new D20Texture();
        const face1 = texture.faceData.get(1);
        const face11 = texture.faceData.get(11);
        if (!face1 || !face11) throw new Error("Missing face data");
        const centroid1 = centroid2d(face1.points);
        const centroid11 = centroid2d(face11.points);

        it("adjacent faces 1 to 17", () => {
            const direct = translateFacePoint(texture, centroid1, 1, 17);
            const result = translateThroughFaces(texture, centroid1, 1, 17);

            expect(result).toEqual({
                point: direct,
                rotation: 780,
            });
        });

        it("two hops from 11 to 9 via 15", () => {
            const result = translateThroughFaces(texture, centroid11, 11, 9);

            expect(result.rotation).toEqual(720);
        });

        it("opposite faces 1 to 20", () => {
            const result = translateThroughFaces(texture, centroid1, 1, 20);

            expect(result.rotation).toEqual(2400);
        });

        it("multi-hop round-trip returns to original point", () => {
            const translated = translateThroughFaces(texture, centroid1, 1, 20);
            const returned = translateThroughFaces(texture, translated.point, 20, 1);

            expect(returned.point.x).toBeCloseTo(centroid1.x, 10);
            expect(returned.point.y).toBeCloseTo(centroid1.y, 10);
        });
    });
});
