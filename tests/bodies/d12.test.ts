import { describe, expect, it } from "vitest";
import { FACES, VERTICES } from "../../src/bodies/d12";

describe("d12 body", () => {
    it("has 20 vertices", () => {
        expect(VERTICES.length).toBe(20);
    });

    it("has 12 faces with values 1-12", () => {
        expect(FACES.length).toBe(12);
        const values = FACES.map((f) => f.value).sort((a, b) => a - b);
        expect(values).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    });

    it("has pentagonal faces", () => {
        for (const face of FACES) {
            expect(face.vertices.length, `face ${face.value}`).toBe(5);
        }
    });

    it("has each vertex in exactly 3 faces", () => {
        for (let v = 0; v < VERTICES.length; v++) {
            const count = FACES.filter((f) => f.vertices.includes(v)).length;
            expect(count, `vertex ${v}`).toBe(3);
        }
    });

    it("has opposite faces that sum to 13", () => {
        for (const face of FACES) {
            const opposite = FACES.find((f) => f.value === 13 - face.value);
            if (!opposite) {
                throw new Error(`face ${13 - face.value} not found`);
            }
            const shared = face.vertices.filter((v) =>
                opposite.vertices.includes(v),
            );
            expect(shared, `faces ${face.value} and ${opposite.value}`).toEqual(
                [],
            );
        }
    });

    it("has balanced flowers around faces 1 and 12", () => {
        const getAdjacent = (faceValue: number): number[] => {
            const face = FACES.find((f) => f.value === faceValue);
            if (!face) throw new Error(`face ${faceValue} not found`);
            const verts = new Set(face.vertices);
            return FACES.filter(
                (f) =>
                    f.value !== faceValue &&
                    f.vertices.filter((v) => verts.has(v)).length === 2,
            ).map((f) => f.value);
        };

        const flower1 = 1 + getAdjacent(1).reduce((a, b) => a + b, 0);
        const flower12 = 12 + getAdjacent(12).reduce((a, b) => a + b, 0);
        expect(flower1, `flower 1 (${flower1}) !== flower 12 (${flower12})`).toBe(flower12);
    });
});
