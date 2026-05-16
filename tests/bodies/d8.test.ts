import { describe, expect, it } from "vitest";
import { FACES, VERTICES } from "../../src/bodies/d8";

describe("d8 body", () => {
    it("has 6 vertices", () => {
        expect(VERTICES.length).toBe(6);
    });

    it("has 8 faces with values 1-8", () => {
        expect(FACES.length).toBe(8);
        const values = FACES.map((f) => f.value).sort((a, b) => a - b);
        expect(values).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    });

    it("has triangular faces", () => {
        for (const face of FACES) {
            expect(face.vertices.length, `face ${face.value}`).toBe(3);
        }
    });

    it("has each vertex in exactly 4 faces", () => {
        for (let v = 0; v < VERTICES.length; v++) {
            const count = FACES.filter((f) => f.vertices.includes(v)).length;
            expect(count, `vertex ${v}`).toBe(4);
        }
    });

    it("has opposite faces that sum to 9", () => {
        for (const face of FACES) {
            const opposite = FACES.find((f) => f.value === 9 - face.value);
            if (!opposite) {
                throw new Error(`face ${9 - face.value} not found`);
            }
            const shared = face.vertices.filter((v) =>
                opposite.vertices.includes(v),
            );
            expect(shared, `faces ${face.value} and ${opposite.value}`).toEqual(
                [],
            );
        }
    });
});
