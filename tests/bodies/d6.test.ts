import { describe, expect, it } from "vitest";
import { FACES, VERTICES } from "../../src/bodies/d6";

describe("d6 body", () => {
    it("has 8 vertices", () => {
        expect(VERTICES.length).toBe(8);
    });

    it("has 6 faces with values 1-6", () => {
        expect(FACES.length).toBe(6);
        const values = FACES.map((f) => f.value).sort((a, b) => a - b);
        expect(values).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it("has quadrilateral faces", () => {
        for (const face of FACES) {
            expect(face.vertices.length, `face ${face.value}`).toBe(4);
        }
    });

    it("has each vertex in exactly 3 faces", () => {
        for (let v = 0; v < VERTICES.length; v++) {
            const count = FACES.filter((f) => f.vertices.includes(v)).length;
            expect(count, `vertex ${v}`).toBe(3);
        }
    });

    it("has opposite faces that sum to 7", () => {
        for (const face of FACES) {
            const opposite = FACES.find((f) => f.value === 7 - face.value);
            if (!opposite) {
                throw new Error(`face ${7 - face.value} not found`);
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
