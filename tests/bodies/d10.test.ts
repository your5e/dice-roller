import { describe, expect, it } from "vitest";
import { FACES, VERTICES } from "../../src/bodies/d10";

describe("d10 body", () => {
    it("has 12 vertices", () => {
        expect(VERTICES.length).toBe(12);
    });

    it("has 10 faces with values 1-10", () => {
        expect(FACES.length).toBe(10);
        const values = FACES.map((f) => f.value).sort((a, b) => a - b);
        expect(values).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });

    it("has quadrilateral faces", () => {
        for (const face of FACES) {
            expect(face.vertices.length, `face ${face.value}`).toBe(4);
        }
    });

    it("has apex vertices in exactly 5 faces", () => {
        for (const apex of [0, 1]) {
            const count = FACES.filter((f) => f.vertices.includes(apex)).length;
            expect(count, `apex ${apex}`).toBe(5);
        }
    });

    it("has ring vertices in exactly 3 faces", () => {
        for (let v = 2; v < VERTICES.length; v++) {
            const count = FACES.filter((f) => f.vertices.includes(v)).length;
            expect(count, `ring vertex ${v}`).toBe(3);
        }
    });

    it("has opposite faces that sum to 11, sharing one edge", () => {
        for (const face of FACES) {
            const opposite = FACES.find((f) => f.value === 11 - face.value);
            if (!opposite) {
                throw new Error(`face ${11 - face.value} not found`);
            }
            const shared = face.vertices.filter((v) =>
                opposite.vertices.includes(v),
            );
            expect(shared, `faces ${face.value} and ${opposite.value}`).toHaveLength(
                2,
            );
        }
    });
});
