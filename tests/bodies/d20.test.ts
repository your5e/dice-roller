import { describe, expect, it } from "vitest";
import { FACES, VERTICES } from "../../src/bodies/d20";

describe("d20 body", () => {
    it("has 12 vertices", () => {
        expect(VERTICES.length).toBe(12);
    });

    it("has 20 faces with values 1-20", () => {
        expect(FACES.length).toBe(20);
        const values = FACES.map((f) => f.value).sort((a, b) => a - b);
        expect(values).toEqual([
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
        ]);
    });

    it("has triangular faces", () => {
        for (const face of FACES) {
            expect(face.vertices.length, `face ${face.value}`).toBe(3);
        }
    });

    it("has each vertex in exactly 5 faces", () => {
        for (let v = 0; v < VERTICES.length; v++) {
            const count = FACES.filter((f) => f.vertices.includes(v)).length;
            expect(count, `vertex ${v}`).toBe(5);
        }
    });

    it("has opposite faces that sum to 21", () => {
        for (const face of FACES) {
            const opposite = FACES.find((f) => f.value === 21 - face.value);
            if (!opposite) {
                throw new Error(`face ${21 - face.value} not found`);
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
