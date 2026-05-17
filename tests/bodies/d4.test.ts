import { describe, expect, it } from "vitest";
import { FACES, VERTICES } from "../../src/bodies/d4";

describe("d4 body", () => {
    it("has 4 vertices", () => {
        expect(VERTICES.length).toBe(4);
    });

    it("has 4 faces with values 1-4", () => {
        expect(FACES.length).toBe(4);
        const values = FACES.map((f) => f.value).sort((a, b) => a - b);
        expect(values).toEqual([1, 2, 3, 4]);
    });

    it("has triangular faces", () => {
        for (const face of FACES) {
            expect(face.vertices.length, `face ${face.value}`).toBe(3);
        }
    });

    it("has each vertex in exactly 3 faces", () => {
        for (let v = 0; v < VERTICES.length; v++) {
            const count = FACES.filter((f) => f.vertices.includes(v)).length;
            expect(count, `vertex ${v}`).toBe(3);
        }
    });

    it("has each pair of faces sharing exactly one edge", () => {
        for (let i = 0; i < FACES.length; i++) {
            for (let j = i + 1; j < FACES.length; j++) {
                const shared = FACES[i].vertices.filter((v) =>
                    FACES[j].vertices.includes(v),
                );
                expect(
                    shared,
                    `faces ${FACES[i].value} and ${FACES[j].value}`,
                ).toHaveLength(2);
            }
        }
    });
});
