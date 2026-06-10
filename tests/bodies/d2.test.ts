import { describe, expect, it } from "vitest";
import { FACES, VERTICES } from "../../src/bodies/d2";

describe("d2 body", () => {
    it("has 32 vertices", () => {
        expect(VERTICES.length).toBe(32);
    });

    it("has heads, tails, and 16 valueless rim faces", () => {
        expect(FACES.length).toBe(18);
        const values = FACES.map((f) => f.value).sort((a, b) => a - b);
        expect(values).toEqual([
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2,
        ]);
    });

    it("has 16-sided caps and quadrilateral rim faces", () => {
        for (const face of FACES) {
            const expected = face.value === 0 ? 4 : 16;
            expect(face.vertices.length, `face ${face.value}`).toBe(expected);
        }
    });

    it("has each vertex in exactly 3 faces", () => {
        for (let v = 0; v < VERTICES.length; v++) {
            const count = FACES.filter((f) => f.vertices.includes(v)).length;
            expect(count, `vertex ${v}`).toBe(3);
        }
    });

});
